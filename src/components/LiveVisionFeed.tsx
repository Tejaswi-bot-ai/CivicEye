import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  Upload, 
  AlertTriangle, 
  Car, 
  Droplets, 
  Camera, 
  CheckCircle2, 
  Layers, 
  Video, 
  VideoOff, 
  RefreshCw, 
  Zap, 
  FileVideo, 
  ShieldAlert, 
  Sliders,
  Sparkles,
  Info,
  Check,
  RotateCcw,
  Trash2
} from 'lucide-react';
import { RouteWaypoint, DispatchRecord, ContourPoint } from '../types';

interface LiveVisionFeedProps {
  currentWaypoint: RouteWaypoint | null;
  onDetectionTriggered: (record: DispatchRecord) => void;
  onNavigateToDispatches: () => void;
  onDetectionObserved?: (detection: ActiveHazard, waypoint: RouteWaypoint | null) => void;
}

export interface ActiveHazard {
  id: string;
  type: 'WATER_LOGGED' | 'POTHOLE' | 'TRAFFIC' | 'ACCIDENT';
  label: string;
  severity: string;
  confidence: number;
  contour: ContourPoint[];
  depthCm?: number;
  areaSqM?: number;
  vehicleCount?: number;
  avgSpeedKmph?: number;
  triggerSec?: number;
  licensePlate?: string;
  complianceTag: string;
  color: string;
  fillColor: string;
  boundingBox: { x: number; y: number; w: number; h: number };
  estimatedDistanceM?: number;
}

// 2D Convex Hull (Monotone Chain) algorithm
function computeConvexHull(points: { x: number; y: number }[]): { x: number; y: number }[] {
  if (points.length <= 3) return points;
  const sorted = [...points].sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);

  const cross = (o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  };

  const lower: { x: number; y: number }[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: { x: number; y: number }[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

// Constrained Euclidean distance spatial clustering
// Strictly limits bounding box so side-by-side hazards never merge into a whole-road polygon!
function clusterPoints(
  points: { x: number; y: number }[],
  distanceThreshold: number,
  minPointsPerCluster: number,
  maxBoundingWidth: number = 0.20,
  maxBoundingHeight: number = 0.15
): { x: number; y: number }[][] {
  const clusters: { x: number; y: number }[][] = [];
  const visited = new Uint8Array(points.length);

  for (let i = 0; i < points.length; i++) {
    if (visited[i]) continue;
    visited[i] = 1;

    const cluster: { x: number; y: number }[] = [points[i]];
    const queue: number[] = [i];

    let minX = points[i].x;
    let maxX = points[i].x;
    let minY = points[i].y;
    let maxY = points[i].y;

    while (queue.length > 0) {
      const currIdx = queue.pop()!;
      const curr = points[currIdx];

      for (let j = 0; j < points.length; j++) {
        if (visited[j]) continue;
        const dx = points[j].x - curr.x;
        const dy = points[j].y - curr.y;
        if (dx * dx + dy * dy <= distanceThreshold * distanceThreshold) {
          const prospectiveMinX = Math.min(minX, points[j].x);
          const prospectiveMaxX = Math.max(maxX, points[j].x);
          const prospectiveMinY = Math.min(minY, points[j].y);
          const prospectiveMaxY = Math.max(maxY, points[j].y);

          // Only absorb point if cluster stays within realistic individual crater dimensions
          if ((prospectiveMaxX - prospectiveMinX) <= maxBoundingWidth &&
              (prospectiveMaxY - prospectiveMinY) <= maxBoundingHeight) {
            visited[j] = 1;
            cluster.push(points[j]);
            queue.push(j);
            minX = prospectiveMinX;
            maxX = prospectiveMaxX;
            minY = prospectiveMinY;
            maxY = prospectiveMaxY;
          }
        }
      }
    }

    if (cluster.length >= minPointsPerCluster) {
      clusters.push(cluster);
    }
  }

  return clusters;
}

export const LiveVisionFeed: React.FC<LiveVisionFeedProps> = ({
  currentWaypoint,
  onDetectionTriggered,
  onNavigateToDispatches,
  onDetectionObserved
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const uploadedVideoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // 3 Exact Feed sources: 'default_video' | 'uploaded_video' | 'hardware_camera'
  const [feedSource, setFeedSource] = useState<'default_video' | 'uploaded_video' | 'hardware_camera'>('default_video');
  
  // Default video scenario filter
  const [defaultVideoScenario, setDefaultVideoScenario] = useState<'ALL' | 'WATERLOG' | 'POTHOLE' | 'TRAFFIC' | 'ACCIDENT'>('ALL');

  // Playback & Video
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
  const [uploadedVideoName, setUploadedVideoName] = useState<string | null>(null);

  // Camera
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Vision Sensitivity & Thresholds
  const [detectionSensitivity, setDetectionSensitivity] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [calibratedRoadLuminance, setCalibratedRoadLuminance] = useState<number>(75);

  // The true list of hazards actively detected in the current frame
  const [activeDetections, setActiveDetections] = useState<ActiveHazard[]>([]);
  const activeDetectionsRef = useRef<ActiveHazard[]>([]);
  activeDetectionsRef.current = activeDetections;
  const lastObservedDetectionRef = useRef<Map<string, number>>(new Map());
  const lastVoiceRef = useRef<Map<string, number>>(new Map());
  const [voiceSafetyEnabled, setVoiceSafetyEnabled] = useState<boolean>(false);
  const [voiceStatus, setVoiceStatus] = useState<'READY' | 'UNAVAILABLE' | 'SENT'>('READY');
  const [voiceAlertHistory, setVoiceAlertHistory] = useState<Array<{ id: string; time: string; message: string; automatic: boolean }>>([]);
  const [predictiveHazards, setPredictiveHazards] = useState<any[]>([]);

  // Road movement distance in simulated default video
  const roadTravelDistRef = useRef<number>(0);

  // Dispatch & Automation state
  const [isDispatching, setIsDispatching] = useState<boolean>(false);
  const [autoDispatchContinuous, setAutoDispatchContinuous] = useState<boolean>(true); // Fully automated by default
  const [recentDispatchedTickets, setRecentDispatchedTickets] = useState<DispatchRecord[]>([]);
  const [showDispatchBanner, setShowDispatchBanner] = useState<boolean>(false);
  const [dispatchNotice, setDispatchNotice] = useState<string | null>(null);
  const [liveNotificationToast, setLiveNotificationToast] = useState<{ message: string; count: number; type: string } | null>(null);

  // Autonomous anti-spam cooldown tracker
  const recentlyQueuedKeysRef = useRef<Map<string, number>>(new Map());
  const lastHighQuantityDispatchTimeRef = useRef<number>(0);

  // Start Hardware Camera Stream
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (videoRef.current && videoRef.current.srcObject) {
        const s = videoRef.current.srcObject as MediaStream;
        s.getTracks().forEach(t => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: cameraFacing,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsCameraActive(true);
        setFeedSource('hardware_camera');
      }
    } catch (err: any) {
      console.error('Camera permission/device error:', err);
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access in browser.'
          : `Camera error: ${err.message}`
      );
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const s = videoRef.current.srcObject as MediaStream;
      s.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setFeedSource('default_video');
  };

  const toggleCameraFacing = async () => {
    const nextFacing = cameraFacing === 'user' ? 'environment' : 'user';
    setCameraFacing(nextFacing);
    if (isCameraActive) {
      stopCamera();
      setTimeout(startCamera, 300);
    }
  };

  // Video File Upload
  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (uploadedVideoUrl) {
      URL.revokeObjectURL(uploadedVideoUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setUploadedVideoUrl(objectUrl);
    setUploadedVideoName(file.name);
    setFeedSource('uploaded_video');
    if (isCameraActive) stopCamera();

    if (uploadedVideoRef.current) {
      uploadedVideoRef.current.src = objectUrl;
      uploadedVideoRef.current.play().catch(err => console.warn('Autoplay prevented:', err));
    }
  };

  // Approximate camera-to-road distance from image perspective.
  // This is a demo estimate only; production distance requires camera calibration/stereo depth.
  const estimateDistanceAheadM = (box: { x: number; y: number; w?: number; h?: number }) => {
    const centerY = box.y + (box.h ?? 0) / 2;
    const normalized = Math.max(0, Math.min(1, (centerY - 0.40) / 0.55));
    return Number((220 - normalized * 195).toFixed(0));
  };

  // Browser speech is the prototype voice-output channel. A physical speaker connected
  // near the camera/edge computer can use the same system audio output in deployment.
  const speakDriverWarning = useCallback((text: string, key: string, automatic = true) => {
    if (!voiceSafetyEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      if (typeof window !== 'undefined' && !('speechSynthesis' in window)) setVoiceStatus('UNAVAILABLE');
      return false;
    }
    const now = Date.now();
    const last = lastVoiceRef.current.get(key) ?? 0;
    if (automatic && now - last < 10000) return false;
    lastVoiceRef.current.set(key, now);
    try {
      const synth = window.speechSynthesis;
      synth.cancel();
      synth.resume();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.92; utterance.pitch = 1; utterance.volume = 1;
      const voice = synth.getVoices().find(v => /^en(-|_)/i.test(v.lang)) || synth.getVoices().find(v => /english/i.test(v.name));
      if (voice) utterance.voice = voice;
      utterance.onstart = () => setVoiceStatus('SENT');
      utterance.onerror = () => setVoiceStatus('UNAVAILABLE');
      synth.speak(utterance);
    } catch (error) {
      console.warn('Voice output error:', error); setVoiceStatus('UNAVAILABLE'); return false;
    }
    setVoiceAlertHistory(prev => [{ id: `${now}-${Math.random().toString(36).slice(2, 7)}`, time: new Date(now).toLocaleTimeString(), message: text, automatic }, ...prev].slice(0, 8));
    return true;
  }, [voiceSafetyEnabled]);

  const toggleVoiceSafety = () => {
    if (!voiceSafetyEnabled) {
      setVoiceSafetyEnabled(true); setVoiceStatus('READY');
      setTimeout(() => {
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) { setVoiceStatus('UNAVAILABLE'); return; }
        const synth = window.speechSynthesis; synth.cancel(); synth.resume();
        const message = 'CivicEye voice safety channel enabled. Driver warnings are now active.';
        const utterance = new SpeechSynthesisUtterance(message); utterance.rate = 0.92; utterance.volume = 1;
        const voice = synth.getVoices().find(v => /^en(-|_)/i.test(v.lang)); if (voice) utterance.voice = voice;
        utterance.onstart = () => setVoiceStatus('SENT'); utterance.onerror = () => setVoiceStatus('UNAVAILABLE');
        synth.speak(utterance);
        setVoiceAlertHistory(prev => [{ id: `voice-on-${Date.now()}`, time: new Date().toLocaleTimeString(), message, automatic: false }, ...prev].slice(0, 8));
      }, 0);
    } else {
      setVoiceSafetyEnabled(false); if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel(); setVoiceStatus('READY');
    }
  };

  const testDefaultVoiceover = () => {
    const message = 'CivicEye safety voice channel active. Hazard detected. Driver, reduce speed and proceed with caution. Official notification will be sent when the dispatch threshold is reached.';
    speakDriverWarning(message, 'TEST_DEFAULT_VOICE', false);
  };

  // Computer Vision Frame Analyzer with Spatial Clustering
  const analyzeRealFrame = (ctx: CanvasRenderingContext2D, w: number, h: number): ActiveHazard[] => {
    try {
      const sw = 320;
      const sh = 180;
      if (!offscreenCanvasRef.current) {
        offscreenCanvasRef.current = document.createElement('canvas');
      }
      const off = offscreenCanvasRef.current;
      off.width = sw;
      off.height = sh;
      const offCtx = off.getContext('2d', { willReadFrequently: true });
      if (!offCtx) return [];

      offCtx.drawImage(ctx.canvas, 0, 0, sw, sh);
      const imgData = offCtx.getImageData(0, 0, sw, sh);
      const data = imgData.data;

      // Sensitivity tuning parameters
      const minClusterSize = detectionSensitivity === 'LOW' ? 14 : detectionSensitivity === 'HIGH' ? 6 : 9;
      const cavityContrastFactor = detectionSensitivity === 'HIGH' ? 0.75 : detectionSensitivity === 'LOW' ? 0.55 : 0.65;
      const waterBlueDiffThreshold = detectionSensitivity === 'HIGH' ? 3 : detectionSensitivity === 'LOW' ? 8 : 5;

      // Calculate baseline road brightness in the lower-middle half
      let totalLuminance = 0;
      let sampleCount = 0;
      const roadStartY = Math.floor(sh * 0.40);
      const roadEndY = Math.floor(sh * 0.90);

      for (let y = roadStartY; y < roadEndY; y += 4) {
        for (let x = 20; x < sw - 20; x += 4) {
          const idx = (y * sw + x) * 4;
          const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          totalLuminance += lum;
          sampleCount++;
        }
      }

      const meanRoadLum = sampleCount > 0 ? totalLuminance / sampleCount : calibratedRoadLuminance;

      const waterPoints: { x: number; y: number }[] = [];
      const potholePoints: { x: number; y: number }[] = [];
      const vehiclePoints: { x: number; y: number }[] = [];

      // Scan the road surface area
      for (let y = roadStartY; y < roadEndY; y += 2) {
        for (let x = 12; x < sw - 12; x += 2) {
          const idx = (y * sw + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;

          // Water detection
          const blueRatio = b / (r + g + b + 0.001);
          const isWaterCandidate =
            ((b - r) > waterBlueDiffThreshold && blueRatio > 0.35 && lum > 45 && lum < 215) ||
            (lum > 195 && (r > 160 && b > 160) && y > sh * 0.45);

          if (isWaterCandidate) {
            waterPoints.push({ x: x / sw, y: y / sh });
            continue;
          }

          // Dry pothole cavity detection
          const isCavity = lum < (meanRoadLum * cavityContrastFactor) && lum < 68;
          if (isCavity) {
            potholePoints.push({ x: x / sw, y: y / sh });
            continue;
          }

          // Vehicle cluster detection in middle distance
          if (y < sh * 0.68 && Math.abs(r - g) > 35 && Math.abs(r - b) > 35) {
            vehiclePoints.push({ x: x / sw, y: y / sh });
          }
        }
      }

      const detectedList: ActiveHazard[] = [];

      // SPATIAL CLUSTERING FOR WATERLOGGED PUDDLES
      // Strictly isolates side-by-side puddles into individual distinct contours
      const waterClusters = clusterPoints(waterPoints, 0.045, minClusterSize, 0.20, 0.14);
      waterClusters.forEach((pts, clusterIdx) => {
        const hull = computeConvexHull(pts);
        if (hull.length >= 3) {
          const xs = hull.map(p => p.x);
          const ys = hull.map(p => p.y);
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys);

          const depthCm = Number((6.5 + (pts.length / 25) * 3.0).toFixed(1));
          const areaSqM = Number((0.4 + (maxX - minX) * (maxY - minY) * 3.0).toFixed(2));

          detectedList.push({
            id: `hazard-water-puddle-${clusterIdx + 1}`,
            type: 'WATER_LOGGED',
            label: `waterlog_puddle #${clusterIdx + 1} • ${depthCm}cm`,
            severity: 'Critical Water-Logged Hazard',
            confidence: Math.min(0.985, 0.89 + pts.length * 0.001),
            contour: hull,
            depthCm,
            areaSqM,
            complianceTag: 'IRC:SP:20 Drainage Breach Notice',
            color: '#0284c7',
            fillColor: 'rgba(2, 132, 199, 0.20)',
            boundingBox: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
            estimatedDistanceM: estimateDistanceAheadM({ x: minX, y: minY, w: maxX - minX, h: maxY - minY })
          });
        }
      });

      // SPATIAL CLUSTERING FOR ROAD POTHOLES (Matching po.jpeg with Red Contours & roadpothole label)
      // Strictly isolates individual side-by-side craters within their own shapes
      const potholeClusters = clusterPoints(potholePoints, 0.045, minClusterSize, 0.18, 0.13);
      potholeClusters.forEach((pts, clusterIdx) => {
        const hull = computeConvexHull(pts);
        if (hull.length >= 3) {
          const xs = hull.map(p => p.x);
          const ys = hull.map(p => p.y);
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys);

          const depthCm = Number((4.8 + (pts.length / 20) * 3.2).toFixed(1));
          const areaSqM = Number((0.25 + (maxX - minX) * (maxY - minY) * 2.2).toFixed(2));

          detectedList.push({
            id: `hazard-pothole-crater-${clusterIdx + 1}`,
            type: 'POTHOLE',
            label: `roadpothole #${clusterIdx + 1} • ${depthCm}cm`,
            severity: 'Large Bituminous Crater',
            confidence: Math.min(0.985, 0.90 + pts.length * 0.001),
            contour: hull,
            depthCm,
            areaSqM,
            complianceTag: 'IRC:82-2015 Clause 4.3 (>25mm)',
            color: '#dc2626', // Vibrant Red matching user reference po.jpeg
            fillColor: 'rgba(220, 38, 38, 0.16)',
            boundingBox: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
            estimatedDistanceM: estimateDistanceAheadM({ x: minX, y: minY, w: maxX - minX, h: maxY - minY })
          });
        }
      });

      // VEHICLE CONGESTION
      if (vehiclePoints.length >= minClusterSize * 4) {
        const hull = computeConvexHull(vehiclePoints.filter((_, i) => i % 2 === 0));
        if (hull.length >= 3) {
          const xs = hull.map(p => p.x);
          const ys = hull.map(p => p.y);
          detectedList.push({
            id: 'hazard-traffic-real',
            type: 'TRAFFIC',
            label: 'Corridor Traffic Congestion Wave',
            severity: 'High Congestion',
            confidence: 0.945,
            contour: hull,
            vehicleCount: Math.min(60, 8 + Math.floor(vehiclePoints.length / 3)),
            avgSpeedKmph: 12.0,
            complianceTag: 'ITMS Signal Timing Override',
            color: '#ca8a04',
            fillColor: 'rgba(202, 138, 4, 0.25)',
            boundingBox: { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
          });
        }
      }

      return detectedList;
    } catch (e) {
      return [];
    }
  };

  // Main Canvas Render Loop
  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;

      if (isPlaying) {
        roadTravelDistRef.current += 1.8 * playbackSpeed;
      }

      let currentFrameDetections: ActiveHazard[] = [];

      // 1. RENDER FEED
      if (feedSource === 'hardware_camera' && videoRef.current && videoRef.current.readyState >= 2) {
        ctx.drawImage(videoRef.current, 0, 0, w, h);
        currentFrameDetections = analyzeRealFrame(ctx, w, h);
      } else if (feedSource === 'uploaded_video' && uploadedVideoRef.current && uploadedVideoRef.current.readyState >= 2) {
        ctx.drawImage(uploadedVideoRef.current, 0, 0, w, h);
        currentFrameDetections = analyzeRealFrame(ctx, w, h);
      } else {
        // Draw Default Video with 4 Hazards (individual polygons, side-by-side)
        currentFrameDetections = drawDefaultVideoCorridor(ctx, w, h, roadTravelDistRef.current, defaultVideoScenario);
      }

      // PAUSE MEANS PAUSE: when the default feed is paused, freeze the current
      // frame and stop ALL automatic detection/trigger generation. The previous
      // implementation only stopped road movement; requestAnimationFrame kept
      // analyzing the frozen frame and repeatedly creating Triggered events.
      if (!isPlaying) {
        setActiveDetections([]);
        drawSleekHUD(ctx, w, h, feedSource, currentWaypoint, []);
        animId = requestAnimationFrame(render);
        return;
      }

      setActiveDetections(currentFrameDetections);

      // Every confirmed visual detection enters Triggered immediately. This is independent
      // from municipal/police dispatch eligibility.
      if (onDetectionObserved && currentFrameDetections.length > 0 && currentWaypoint) {
        const now = Date.now();
        currentFrameDetections.forEach((hazard) => {
          const key = `${hazard.type}:${hazard.id}`;
          const previous = lastObservedDetectionRef.current.get(key) ?? 0;
          if (now - previous >= 1200) {
            lastObservedDetectionRef.current.set(key, now);
            onDetectionObserved(hazard, currentWaypoint);
          }
        });
      }

      // 2. DRAW CONTOUR POLYGONS ONLY FOR WHAT IS ACTUALLY IN VIEW
      currentFrameDetections.forEach((hazard) => {
        drawContourPolygon(
          ctx,
          hazard.contour,
          w,
          h,
          hazard.color,
          hazard.fillColor,
          hazard.label,
          hazard.complianceTag
        );
      });

      // 3. SLEEK MINIMAL HUD RIBBON
      drawSleekHUD(ctx, w, h, feedSource, currentWaypoint, currentFrameDetections);

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [feedSource, isPlaying, playbackSpeed, defaultVideoScenario, detectionSensitivity, calibratedRoadLuminance, currentWaypoint]);

  // Helper: Draw Default Video Realistic Corridor with Side-By-Side Hazards
  const drawDefaultVideoCorridor = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    travelDistance: number,
    scenario: 'ALL' | 'WATERLOG' | 'POTHOLE' | 'TRAFFIC' | 'ACCIDENT'
  ): ActiveHazard[] => {
    // Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.42);
    skyGrad.addColorStop(0, '#94a3b8');
    skyGrad.addColorStop(1, '#cbd5e1');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h * 0.42);

    // City Backdrop Silhouette
    ctx.fillStyle = '#64748b';
    ctx.fillRect(w * 0.08, h * 0.35, 50, h * 0.07);
    ctx.fillRect(w * 0.20, h * 0.30, 70, h * 0.12);
    ctx.fillRect(w * 0.38, h * 0.33, 60, h * 0.09);
    ctx.fillRect(w * 0.62, h * 0.31, 85, h * 0.11);
    ctx.fillRect(w * 0.80, h * 0.34, 60, h * 0.08);

    // Asphalt Road
    const roadGrad = ctx.createLinearGradient(0, h * 0.42, 0, h);
    roadGrad.addColorStop(0, '#334155');
    roadGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = roadGrad;
    ctx.fillRect(0, h * 0.42, w, h * 0.58);

    // Road Edges
    ctx.beginPath();
    ctx.moveTo(w * 0.38, h * 0.42);
    ctx.lineTo(0, h);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(w * 0.62, h * 0.42);
    ctx.lineTo(w, h);
    ctx.stroke();

    // Moving Dashed Yellow Center Line
    const dashOffset = (travelDistance * 3.5) % 60;
    ctx.beginPath();
    ctx.setLineDash([24, 28]);
    ctx.lineDashOffset = -dashOffset;
    ctx.moveTo(w * 0.5, h * 0.42);
    ctx.lineTo(w * 0.5, h);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.setLineDash([]);

    // Lane Dividers
    ctx.beginPath();
    ctx.setLineDash([15, 25]);
    ctx.lineDashOffset = -dashOffset;
    ctx.moveTo(w * 0.44, h * 0.42);
    ctx.lineTo(w * 0.22, h);
    ctx.moveTo(w * 0.56, h * 0.42);
    ctx.lineTo(w * 0.78, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);

    const detectedInFrame: ActiveHazard[] = [];

    // Continuous cycle calculation
    const cycleLength = 480;
    const progress = (travelDistance % cycleLength) / cycleLength; // 0 to 1

    // -------------------------------------------------------------
    // 1. WATERLOGGED PUDDLES (SIDE-BY-SIDE: PUDDLE 1 & PUDDLE 2)
    // -------------------------------------------------------------
    const showWaterlog = scenario === 'ALL' ? (progress >= 0.05 && progress <= 0.48) : scenario === 'WATERLOG';
    if (showWaterlog) {
      const waterProg = scenario === 'ALL' ? ((progress - 0.05) / 0.43) : ((travelDistance % 300) / 300);
      const baseY = h * (0.48 + waterProg * 0.42);

      // PUDDLE #1 (Left Lane)
      const p1X = w * (0.34 - waterProg * 0.12);
      const p1Y = baseY;
      const p1Rx = 24 + waterProg * 45;
      const p1Ry = 9 + waterProg * 18;

      ctx.save();
      ctx.beginPath();
      ctx.ellipse(p1X, p1Y, p1Rx, p1Ry, -0.05, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(14, 165, 233, 0.45)';
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Specular sheen
      ctx.beginPath();
      ctx.ellipse(p1X - p1Rx * 0.2, p1Y - p1Ry * 0.2, p1Rx * 0.4, p1Ry * 0.35, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fill();
      ctx.restore();

      // Tight polygon for Puddle 1 ONLY
      if (waterProg > 0.08 && waterProg < 0.94) {
        const pts1: ContourPoint[] = [];
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          const rW = p1Rx * (0.95 + Math.sin(angle * 3) * 0.08);
          const rH = p1Ry * (0.95 + Math.cos(angle * 2) * 0.08);
          pts1.push({ x: (p1X + Math.cos(angle) * rW) / w, y: (p1Y + Math.sin(angle) * rH) / h });
        }

        detectedInFrame.push({
          id: 'sim-water-1',
          type: 'WATER_LOGGED',
          label: 'waterlog_puddle #1 (Left Lane) • 8.6cm',
          severity: 'Critical Water-Logged Hazard',
          confidence: 0.985,
          contour: pts1,
          depthCm: 8.6,
          areaSqM: Number(((p1Rx * p1Ry * 0.0012)).toFixed(2)),
          complianceTag: 'IRC:SP:20 Subgrade Breach Letter',
          color: '#0284c7',
          fillColor: 'rgba(2, 132, 199, 0.20)',
          boundingBox: { x: (p1X - p1Rx) / w, y: (p1Y - p1Ry) / h, w: (p1Rx * 2) / w, h: (p1Ry * 2) / h },
          estimatedDistanceM: estimateDistanceAheadM({ x: (p1X - p1Rx) / w, y: (p1Y - p1Ry) / h, w: (p1Rx * 2) / w, h: (p1Ry * 2) / h })
        });
      }

      // PUDDLE #2 (Right Lane - Side-by-side with Puddle 1!)
      const p2X = w * (0.64 + waterProg * 0.12);
      const p2Y = baseY + 12;
      const p2Rx = 20 + waterProg * 38;
      const p2Ry = 8 + waterProg * 15;

      ctx.save();
      ctx.beginPath();
      ctx.ellipse(p2X, p2Y, p2Rx, p2Ry, 0.08, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(14, 165, 233, 0.45)';
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Specular sheen
      ctx.beginPath();
      ctx.ellipse(p2X - p2Rx * 0.25, p2Y - p2Ry * 0.2, p2Rx * 0.4, p2Ry * 0.3, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fill();
      ctx.restore();

      // Tight polygon for Puddle 2 ONLY
      if (waterProg > 0.08 && waterProg < 0.94) {
        const pts2: ContourPoint[] = [];
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          const rW = p2Rx * (0.94 + Math.cos(angle * 3) * 0.08);
          const rH = p2Ry * (0.94 + Math.sin(angle * 2) * 0.08);
          pts2.push({ x: (p2X + Math.cos(angle) * rW) / w, y: (p2Y + Math.sin(angle) * rH) / h });
        }

        detectedInFrame.push({
          id: 'sim-water-2',
          type: 'WATER_LOGGED',
          label: 'waterlog_puddle #2 (Right Lane) • 7.2cm',
          severity: 'Critical Water-Logged Hazard',
          confidence: 0.978,
          contour: pts2,
          depthCm: 7.2,
          areaSqM: Number(((p2Rx * p2Ry * 0.0011)).toFixed(2)),
          complianceTag: 'IRC:SP:20 Subgrade Breach Letter',
          color: '#0284c7',
          fillColor: 'rgba(2, 132, 199, 0.20)',
          boundingBox: { x: (p2X - p2Rx) / w, y: (p2Y - p2Ry) / h, w: (p2Rx * 2) / w, h: (p2Ry * 2) / h },
          estimatedDistanceM: estimateDistanceAheadM({ x: (p2X - p2Rx) / w, y: (p2Y - p2Ry) / h, w: (p2Rx * 2) / w, h: (p2Ry * 2) / h })
        });
      }
    }

    // -------------------------------------------------------------
    // 2. MULTIPLE BITUMINOUS ROAD POTHOLES (Matching po.jpeg Red Contours)
    // 4 Distinct Potholes side-by-side and sequential down the road!
    // -------------------------------------------------------------
    const showPotholes = scenario === 'ALL' ? (progress >= 0.50 && progress <= 0.95) : scenario === 'POTHOLE';
    if (showPotholes) {
      const potProg = scenario === 'ALL' ? ((progress - 0.50) / 0.45) : ((travelDistance % 300) / 300);
      const baseY = h * (0.46 + potProg * 0.44);

      // Helper to render individual pothole asphalt pit and red contour
      const renderSinglePothole = (
        pId: string,
        pIndex: number,
        relX: number,
        relYOffset: number,
        baseRx: number,
        baseRy: number,
        depthVal: number,
        rot: number
      ) => {
        const pX = w * relX;
        const pY = baseY + relYOffset;
        const pRx = baseRx + potProg * 28;
        const pRy = baseRy + potProg * 12;

        if (pY < h * 0.40 || pY > h * 0.95) return;

        // Asphalt crater cavity
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(pX, pY, pRx, pRy, rot, 0, Math.PI * 2);
        ctx.fillStyle = '#0f172a';
        ctx.fill();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Deep cavity inner void
        ctx.beginPath();
        ctx.ellipse(pX + pRx * 0.1, pY + pRy * 0.1, pRx * 0.6, pRy * 0.55, rot, 0, Math.PI * 2);
        ctx.fillStyle = '#020617';
        ctx.fill();
        ctx.restore();

        // Exact Red Contour Polygon & Badge
        if (potProg > 0.05 && potProg < 0.96) {
          const pts: ContourPoint[] = [];
          const vertexCount = 7;
          for (let i = 0; i < vertexCount; i++) {
            const angle = (i / vertexCount) * Math.PI * 2;
            const rW = pRx * (0.95 + Math.cos(angle * 3) * 0.08);
            const rH = pRy * (0.95 + Math.sin(angle * 4) * 0.08);
            pts.push({ x: (pX + Math.cos(angle) * rW) / w, y: (pY + Math.sin(angle) * rH) / h });
          }

          detectedInFrame.push({
            id: `sim-pothole-${pId}`,
            type: 'POTHOLE',
            label: `roadpothole #${pIndex} • ${depthVal}cm`,
            severity: 'Large Bituminous Crater',
            confidence: Number((0.965 + pIndex * 0.005).toFixed(3)),
            contour: pts,
            depthCm: depthVal,
            areaSqM: Number(((pRx * pRy * 0.0009)).toFixed(2)),
            complianceTag: 'IRC:82-2015 Clause 4.3 Notice',
            color: '#dc2626', // Vibrant Red matching user po.jpeg
            fillColor: 'rgba(220, 38, 38, 0.16)',
            boundingBox: { x: (pX - pRx) / w, y: (pY - pRy) / h, w: (pRx * 2) / w, h: (pRy * 2) / h },
            estimatedDistanceM: estimateDistanceAheadM({ x: (pX - pRx) / w, y: (pY - pRy) / h, w: (pRx * 2) / w, h: (pRy * 2) / h })
          });
        }
      };

      // 4 SEPARATE DISTINCT POTHOLES (High Quantity in scene!)
      // Pothole 1: Left lane, upper
      renderSinglePothole('1', 1, 0.35 - potProg * 0.10, 0, 16, 7, 6.8, -0.06);
      // Pothole 2: Right lane, side-by-side
      renderSinglePothole('2', 2, 0.63 + potProg * 0.12, 14, 15, 6, 5.4, 0.07);
      // Pothole 3: Center lane, staggered
      renderSinglePothole('3', 3, 0.48, -28, 14, 6, 8.2, 0.02);
      // Pothole 4: Left-center lane, foreground
      renderSinglePothole('4', 4, 0.40 - potProg * 0.05, 34, 18, 8, 7.5, -0.04);
    }

    // -------------------------------------------------------------
    // 3. TRAFFIC JAM CONGESTION QUEUE
    // -------------------------------------------------------------
    const showTraffic = scenario === 'TRAFFIC' || (scenario === 'ALL' && progress < 0.35);
    if (showTraffic) {
      const tY = h * 0.44;
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(w * 0.46, tY, 24, 15);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(w * 0.48, tY + 2, 18, 7);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(w * 0.52, tY + 3, 26, 17);

      ctx.fillStyle = '#0284c7';
      ctx.fillRect(w * 0.41, tY + 7, 30, 18);

      const pts: ContourPoint[] = [
        { x: 0.38, y: 0.42 },
        { x: 0.62, y: 0.42 },
        { x: 0.65, y: 0.52 },
        { x: 0.35, y: 0.52 }
      ];

      detectedInFrame.push({
        id: 'sim-traffic',
        type: 'TRAFFIC',
        label: 'Traffic Jam Congestion Wave • 40 Vehicles • 5.0 km/h',
        severity: 'High Congestion',
        confidence: 0.975,
        contour: pts,
        vehicleCount: 40,
        avgSpeedKmph: 5.0,
        complianceTag: 'Snapshot + Timings -> ITMS Green Wave Phase',
        color: '#ca8a04',
        fillColor: 'rgba(202, 138, 4, 0.25)',
        boundingBox: { x: 0.35, y: 0.42, w: 0.30, h: 0.10 },
        estimatedDistanceM: 180
      });
    }

    // -------------------------------------------------------------
    // 4. VEHICLE COLLISION / ACCIDENT
    // -------------------------------------------------------------
    const showAccident = scenario === 'ACCIDENT' || (scenario === 'ALL' && progress >= 0.35 && progress < 0.70);
    if (showAccident) {
      const aX = w * 0.20;
      const aY = h * 0.64;

      ctx.save();
      ctx.translate(aX, aY);
      ctx.rotate(0.28);
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(-28, -16, 56, 32);
      ctx.fillStyle = '#f87171';
      ctx.fillRect(-15, -12, 30, 24);
      // Hazard blinker
      if (Math.floor(travelDistance / 15) % 2 === 0) {
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(-26, -14, 4, 0, Math.PI * 2);
        ctx.arc(26, -14, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      const pts: ContourPoint[] = [
        { x: 0.12, y: 0.56 },
        { x: 0.28, y: 0.56 },
        { x: 0.32, y: 0.74 },
        { x: 0.14, y: 0.74 }
      ];

      detectedInFrame.push({
        id: 'sim-accident',
        type: 'ACCIDENT',
        label: 'Vehicle Collision Alert • Plate: MH-12-DE-8921',
        severity: 'Severe Incident',
        confidence: 0.994,
        contour: pts,
        triggerSec: 1.84,
        licensePlate: 'MH-12-DE-8921',
        complianceTag: 'Snapshot + Plate MH-12-DE-8921 -> Police 112 Command',
        color: '#dc2626',
        fillColor: 'rgba(220, 38, 38, 0.35)',
        boundingBox: { x: 0.12, y: 0.56, w: 0.20, h: 0.18 },
        estimatedDistanceM: 105
      });
    }

    return detectedInFrame;
  };

  // Draw tight contour polygon with corner vertex rings and compact floating pill badge
  const drawContourPolygon = (
    ctx: CanvasRenderingContext2D,
    points: ContourPoint[],
    w: number,
    h: number,
    strokeColor: string,
    fillColor: string,
    primaryLabel: string,
    secondaryTag: string
  ) => {
    if (points.length < 3) return;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(points[0].x * w, points[0].y * h);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x * w, points[i].y * h);
    }
    ctx.closePath();

    ctx.fillStyle = fillColor;
    ctx.fill();

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Corner vertex anchors
    points.forEach((pt) => {
      ctx.beginPath();
      ctx.arc(pt.x * w, pt.y * h, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // Compact floating pill badge matching reference po.jpeg
    const topPt = points.reduce((min, p) => (p.y < min.y ? p : min), points[0]);
    const isPothole = strokeColor === '#dc2626' || strokeColor === '#ef4444';
    const tagText = isPothole ? primaryLabel : `${primaryLabel} ${secondaryTag ? '• ' + secondaryTag : ''}`;

    ctx.font = 'bold 9.5px monospace, system-ui, sans-serif';
    const textMetrics = ctx.measureText(tagText);
    const badgeW = Math.min(220, textMetrics.width + 12);
    const badgeH = 17;
    const badgeX = Math.max(6, Math.min(topPt.x * w - badgeW / 2, w - badgeW - 6));
    const badgeY = Math.max(34, topPt.y * h - badgeH - 4);

    ctx.fillStyle = isPothole ? '#dc2626' : strokeColor;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 3);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.fillText(tagText, badgeX + 6, badgeY + 12);

    ctx.restore();
  };

  // Sleek HUD Ribbon (Minimal & Unpacked)
  const drawSleekHUD = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    source: string,
    waypoint: RouteWaypoint | null,
    activeList: ActiveHazard[]
  ) => {
    // Top Bar
    ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
    ctx.fillRect(0, 0, w, 32);

    // Status Light
    ctx.beginPath();
    ctx.arc(16, 16, 4, 0, Math.PI * 2);
    ctx.fillStyle = activeList.length > 0 ? '#ef4444' : '#22c55e';
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    const sourceLabel =
      source === 'hardware_camera'
        ? 'LIVE ON-BUS HARDWARE CAMERA'
        : source === 'uploaded_video'
        ? `CLIP: ${uploadedVideoName || 'Uploaded Video'}`
        : 'DEFAULT VIDEO (4 HAZARD CORRIDOR)';
    ctx.fillText(sourceLabel, 28, 20);

    if (waypoint) {
      ctx.fillStyle = '#38bdf8';
      ctx.textAlign = 'right';
      ctx.font = '10px monospace';
      ctx.fillText(`${waypoint.wardId} • ${waypoint.road}`, w - 14, 20);
      ctx.textAlign = 'left';
    }

    // Bottom Ribbon
    ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
    ctx.fillRect(0, h - 30, w, 30);

    ctx.fillStyle = activeList.length === 0 ? '#22c55e' : '#facc15';
    ctx.font = '600 10.5px system-ui, sans-serif';
    if (activeList.length === 0) {
      ctx.fillText('ROAD STATUS: ZERO HAZARDS IN FRAME (CLEAR PAVEMENT)', 14, h - 11);
    } else {
      ctx.fillText(`DETECTED IN FOV (${activeList.length}): ${activeList.map(a => a.label.split('•')[0].trim()).join(' | ')}`, 14, h - 11);
    }

    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'right';
    ctx.font = '9.5px monospace';
    ctx.fillText('SHAPED CONTOURS RENDER INDIVIDUALLY PER HAZARD', w - 14, h - 11);
    ctx.textAlign = 'left';
  };

  // Predictive 2–3 km hazard corridor: uses GPS-tagged, previously confirmed hazards.
  useEffect(() => {
    if (!currentWaypoint) return;
    let cancelled = false;
    const loadPredictiveHazards = async () => {
      try {
        const res = await fetch(`/api/hazard-intelligence?lat=${currentWaypoint.lat}&lng=${currentWaypoint.lng}&radiusKm=3`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setPredictiveHazards(Array.isArray(data.hazards) ? data.hazards : []);
      } catch (err) {
        console.warn('Predictive hazard fetch:', err);
      }
    };
    loadPredictiveHazards();
    const timer = setInterval(loadPredictiveHazards, 5000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [currentWaypoint]);

  // Passenger-safety voice channel: only serious events produce spoken driver commands.
  useEffect(() => {
    if (!isPlaying) return;
    const upcoming = predictiveHazards.find(h => h.distanceKm <= 3 && h.severity && (h.type === 'ACCIDENT_POLICE_EMERGENCY' || h.type === 'POTHOLE_MUNICIPAL_COMPLAINT' || h.severity === 'Critical Water-Logged Hazard'));
    if (upcoming && activeDetections.length === 0) {
      const distanceText = upcoming.distanceKm >= 1 ? `${upcoming.distanceKm.toFixed(1)} kilometers` : `${Math.max(50, Math.round(upcoming.distanceKm * 1000))} meters`;
      speakDriverWarning(`Warning. Previously verified critical road hazard ahead in ${distanceText}. Reduce speed and proceed with caution.`, `UPCOMING:${upcoming.id}`);
      return;
    }
    if (activeDetections.length === 0) return;
    const accident = activeDetections.find(h => h.type === 'ACCIDENT' && h.confidence >= 0.95 && (h.triggerSec ?? 999) <= 3);
    if (accident) {
      speakDriverWarning('Emergency warning. Severe accident detected ahead. Reduce speed immediately.', 'ACCIDENT');
      return;
    }

    const severeTraffic = activeDetections.find(h => h.type === 'TRAFFIC' && (h.vehicleCount ?? 0) >= 30 && (h.avgSpeedKmph ?? 100) <= 5.5 && h.confidence >= 0.90);
    if (severeTraffic) {
      speakDriverWarning('Severe traffic congestion ahead. Slow down and prepare to stop.', 'TRAFFIC');
      return;
    }

    const severeRoad = activeDetections.find(h => {
      const criticalPothole = h.type === 'POTHOLE' && ((h.areaSqM ?? 0) >= 1 || (h.depthCm ?? 0) >= 8 || h.severity.toLowerCase().includes('large'));
      const criticalWater = h.type === 'WATER_LOGGED' && ((h.areaSqM ?? 0) >= 1.5 || (h.depthCm ?? 0) >= 8);
      return (criticalPothole || criticalWater) && h.confidence >= 0.90;
    });
    if (severeRoad) {
      const label = severeRoad.type === 'WATER_LOGGED' ? 'Severe waterlogging' : 'Critical pothole';
      speakDriverWarning(`${label} ahead. Reduce speed and proceed with caution.`, `ROAD:${severeRoad.type}`);
    }
  }, [activeDetections, isPlaying, predictiveHazards, speakDriverWarning]);

  const triggerDirectHazard = async (type: ActiveHazard['type']) => {
    if (!currentWaypoint) { setDispatchNotice('Route/GPS waypoint is not available yet. Start the live route first.'); setTimeout(() => setDispatchNotice(null), 3000); return; }
    const now = Date.now();
    const presets: Record<ActiveHazard['type'], any> = {
      POTHOLE: { label:'Direct demo pothole', severity:'Critical', confidence:.98, depthCm:9.2, complianceTag:'MUNICIPAL_ROAD_HAZARD' },
      WATER_LOGGED: { label:'Direct demo waterlogging', severity:'Critical Water-Logged Hazard', confidence:.98, depthCm:8.8, areaSqM:1.4, complianceTag:'MUNICIPAL_WATERLOG_HAZARD' },
      TRAFFIC: { label:'Direct demo severe traffic congestion', severity:'Severe', confidence:.98, vehicleCount:45, avgSpeedKmph:4.5, complianceTag:'TRAFFIC_CONGESTION' },
      ACCIDENT: { label:'Direct demo vehicle collision', severity:'Critical', confidence:.995, triggerSec:2.2, licensePlate:'DEMO-112', complianceTag:'POLICE_EMERGENCY' }
    };
    const q=presets[type];
    const hazard: ActiveHazard = { id:`direct-${type.toLowerCase()}-${now}-${Math.random().toString(36).slice(2,6)}`, type, label:q.label, severity:q.severity, confidence:q.confidence, contour:[{x:.30,y:.70},{x:.45,y:.62},{x:.58,y:.72},{x:.48,y:.84},{x:.34,y:.82}], depthCm:q.depthCm, areaSqM:q.areaSqM, vehicleCount:q.vehicleCount, avgSpeedKmph:q.avgSpeedKmph, triggerSec:q.triggerSec, licensePlate:q.licensePlate, complianceTag:q.complianceTag, color:'#f59e0b', fillColor:'rgba(245,158,11,.22)', boundingBox:{x:.30,y:.62,w:.28,h:.22}, estimatedDistanceM:42 };
    onDetectionObserved?.(hazard,currentWaypoint);
    setActiveDetections(prev=>[...prev,hazard]);
    const voice=type==='ACCIDENT'?'Emergency warning. Vehicle collision detected ahead. Reduce speed immediately.':type==='TRAFFIC'?'CivicEye safety warning. Severe traffic congestion detected ahead. Slow down and prepare to stop.':type==='WATER_LOGGED'?'CivicEye safety warning. Severe waterlogging detected ahead. Reduce speed and proceed with caution.':'CivicEye safety warning. Critical pothole detected ahead. Reduce speed and proceed with caution.';
    speakDriverWarning(voice,`DIRECT:${type}:${now}`,false);
    try {
      const detType=type==='WATER_LOGGED'?'WATER_LOGGED_HAZARD':type==='TRAFFIC'?'TRAFFIC_JAM':type;
      const res=await fetch('/api/dispatches/trigger-multi',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({detections:[{id:hazard.id,type:detType,label:hazard.label,severity:hazard.severity,confidence:hazard.confidence,contour:hazard.contour,boundingBox:hazard.boundingBox,depthCm:hazard.depthCm,areaSqM:hazard.areaSqM,licensePlates:hazard.licensePlate?[hazard.licensePlate]:undefined,vehicleCount:hazard.vehicleCount,avgSpeedKmph:hazard.avgSpeedKmph,triggerTimeSec:hazard.triggerSec}],waypoint:currentWaypoint})});
      const data=await res.json();
      if(Array.isArray(data.records)&&data.records.length){setRecentDispatchedTickets(data.records);data.records.forEach((r:DispatchRecord)=>onDetectionTriggered(r));setDispatchNotice(`${type} triggered and official notification created.`);} else setDispatchNotice(`${type} triggered. Notification is waiting for the dispatch threshold.`);
      setTimeout(()=>setDispatchNotice(null),3500);
    } catch(err){console.error('Direct trigger dispatch error:',err);setDispatchNotice(`${type} triggered, but dispatch evaluation could not be completed.`);setTimeout(()=>setDispatchNotice(null),3500);}
  };

  // TRIGGER & DISPATCH ACTIVE HAZARDS (Fully Automated & Manual)
  const handleExecuteAllDispatches = async (isAutomated: boolean = false) => {
    const current = activeDetectionsRef.current;
    if (current.length === 0) {
      if (!isAutomated) {
        setDispatchNotice('No active hazards in camera frame. Polygons only dispatch when road anomalies are detected.');
        setTimeout(() => setDispatchNotice(null), 3000);
      }
      return;
    }

    // Capture real-time evidence snapshot directly from video/canvas frame
    const canvas = canvasRef.current;
    let realSnapshotUrl: string | undefined = undefined;
    if (canvas) {
      try {
        realSnapshotUrl = canvas.toDataURL('image/jpeg', 0.85);
      } catch (e) {
        console.warn('Canvas snapshot capture:', e);
      }
    }

    setIsDispatching(true);
    try {
      const detectionsPayload = current.map(hazard => {
        let detType: 'POTHOLE' | 'WATER_LOGGED_HAZARD' | 'ACCIDENT' | 'TRAFFIC_JAM' = 'POTHOLE';
        if (hazard.type === 'WATER_LOGGED') detType = 'WATER_LOGGED_HAZARD';
        else if (hazard.type === 'TRAFFIC') detType = 'TRAFFIC_JAM';
        else if (hazard.type === 'ACCIDENT') detType = 'ACCIDENT';

        return {
          id: `det-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          type: detType,
          label: hazard.label,
          severity: hazard.severity,
          confidence: hazard.confidence,
          contour: hazard.contour,
          boundingBox: hazard.boundingBox,
          depthCm: hazard.depthCm,
          areaSqM: hazard.areaSqM,
          licensePlates: hazard.licensePlate ? [hazard.licensePlate] : undefined,
          vehicleCount: hazard.vehicleCount,
          avgSpeedKmph: hazard.avgSpeedKmph,
          triggerTimeSec: hazard.triggerSec,
          description: hazard.label,
          snapshotDataUrl: realSnapshotUrl // Real video/camera snapshot attached!
        };
      });

      const res = await fetch('/api/dispatches/trigger-multi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          detections: detectionsPayload,
          waypoint: currentWaypoint
        })
      });

      const data = await res.json();
      if (data.records && Array.isArray(data.records)) {
        setRecentDispatchedTickets(data.records);
        data.records.forEach((r: DispatchRecord) => onDetectionTriggered(r));
        setShowDispatchBanner(true);
      }
    } catch (err) {
      console.error('Dispatch error:', err);
    } finally {
      setIsDispatching(false);
    }
  };

  // ============================================================
  // CIVIC EYE: TWO INDEPENDENT AUTOMATION TIMERS
  //
  // Road hazards are submitted continuously so the server can build
  // one area-level pothole/waterlogging cluster.
  // Accident and severe traffic use their own immediate path.
  // ============================================================
  useEffect(() => {
    if (!autoDispatchContinuous || !isPlaying) return;

    const timer = setInterval(() => {
      const hazards = activeDetectionsRef.current;
      if (hazards.length === 0) return;

      const potholes = hazards.filter(h => h.type === 'POTHOLE');
      const waterlogs = hazards.filter(h => h.type === 'WATER_LOGGED');
      const traffic = hazards.filter(h => h.type === 'TRAFFIC');
      const accidents = hazards.filter(h => h.type === 'ACCIDENT');

      // UI notification is detection-only. Detection does NOT mean dispatch.
      const parts: string[] = [];
      if (potholes.length > 0) parts.push(`${potholes.length} pothole${potholes.length > 1 ? 's' : ''}`);
      if (waterlogs.length > 0) parts.push(`${waterlogs.length} waterlogging${waterlogs.length > 1 ? 's' : ''}`);
      if (traffic.length > 0) parts.push(`Traffic (${traffic[0].vehicleCount || 0} vehicles, ${(traffic[0].avgSpeedKmph ?? 0).toFixed(1)} km/h)`);
      if (accidents.length > 0) parts.push('Vehicle collision');

      setLiveNotificationToast({
        message: `⚡ CivicEye AI: ${parts.join(', ')} detected — dispatch rules evaluating`,
        count: hazards.length,
        type: accidents.length > 0 ? 'ACCIDENT' : (potholes.length + waterlogs.length) > 0 ? 'ROAD_HAZARD' : 'NORMAL'
      });

      // Send every ~1 second. The SERVER is responsible for spatial,
      // temporal and area-level deduplication. There is deliberately no
      // frontend "5-second dispatch cooldown" anymore.
      handleExecuteAllDispatches(true);
    }, 1000);

    return () => clearInterval(timer);
  }, [autoDispatchContinuous, isPlaying, currentWaypoint]);
  return (
    <div className="space-y-4">
      {/* Hidden Media Elements */}
      <video ref={videoRef} playsInline muted className="hidden" />
      <video ref={uploadedVideoRef} playsInline loop muted className="hidden" />
      <input
        type="file"
        ref={fileInputRef}
        accept="video/mp4,video/webm,video/ogg,video/quicktime"
        onChange={handleVideoUpload}
        className="hidden"
      />

      {/* DISPATCH CONFIRMATION BANNER */}
      {showDispatchBanner && recentDispatchedTickets.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 shadow-xs animate-fadeIn text-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-xs text-emerald-950">
                    Dispatched {recentDispatchedTickets.length} Hazard Event{recentDispatchedTickets.length > 1 ? 's' : ''} to Respective Authorities
                  </h4>
                  <span className="bg-emerald-200 text-emerald-900 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                    100% Autonomous
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Generated formal letters for Potholes & Waterlogging; generated snapshot & coordinates for Traffic; generated sub-3s 112 alert for Accident.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDispatchBanner(false)}
                className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1"
              >
                Dismiss
              </button>
              <button
                onClick={() => {
                  setShowDispatchBanner(false);
                  onNavigateToDispatches();
                }}
                className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold px-3.5 py-1.5 rounded-xl shadow-xs transition-all"
              >
                View in Dispatches Log &rarr;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INFO NOTICE BANNER */}
      {dispatchNotice && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            <span>{dispatchNotice}</span>
          </div>
          <button onClick={() => setDispatchNotice(null)} className="text-blue-700 font-bold">✕</button>
        </div>
      )}

      {/* COOL MINIMAL TOP CONTROLS BAR: 3 OPTIONS ONLY */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* 3 Segmented Feed Source Buttons */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => {
                if (isCameraActive) stopCamera();
                setFeedSource('default_video');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                feedSource === 'default_video'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Video className="w-3.5 h-3.5 text-blue-600" />
              <span>Default Video</span>
            </button>

            <button
              onClick={() => {
                fileInputRef.current?.click();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                feedSource === 'uploaded_video'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Upload className="w-3.5 h-3.5 text-blue-600" />
              <span>Upload Video</span>
            </button>

            <button
              onClick={() => {
                if (isCameraActive) {
                  stopCamera();
                } else {
                  startCamera();
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                feedSource === 'hardware_camera'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isCameraActive ? (
                <>
                  <VideoOff className="w-3.5 h-3.5" />
                  <span>Stop Camera</span>
                </>
              ) : (
                <>
                  <Camera className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Live Hardware Camera</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {feedSource === 'hardware_camera' && isCameraActive && (
              <button
                onClick={toggleCameraFacing}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 flex items-center gap-1"
                title="Flip Front / Rear Camera"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Flip Camera</span>
              </button>
            )}

            {/* Auto-Dispatch Daemon Toggle */}
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoDispatchContinuous}
                onChange={(e) => setAutoDispatchContinuous(e.target.checked)}
                className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-blue-500"
              />
              <span>Auto-Trigger Daemon</span>
            </label>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-slate-700">Passenger Safety Voice Channel</div>
              <div className="text-[11px] text-slate-500">Automatic voice warnings are separate from Trigger and Notify. A physical speaker connected to the edge computer can use the same output.</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={testDefaultVoiceover}
                className="px-3 py-1.5 rounded-lg text-xs font-bold border bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
              >
                ▶ Test Voice Alert
              </button>
              <button
                onClick={toggleVoiceSafety}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${voiceSafetyEnabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}
                title={voiceSafetyEnabled ? 'Disable voice safety' : 'Enable voice safety and hear a confirmation'}
              >
                {voiceSafetyEnabled ? '🔊 Voice ON' : '🔇 Voice OFF'}
              </button>
              <span className={`text-[10px] font-bold ${voiceStatus === 'UNAVAILABLE' ? 'text-rose-600' : 'text-slate-500'}`}>{voiceStatus === 'UNAVAILABLE' ? 'Voice unavailable' : voiceStatus === 'SENT' ? 'VOICE SENT' : 'Voice ready'}</span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] font-bold text-slate-700">Voice Alert History</div>
              <span className="text-[10px] font-mono text-slate-400">VOICE SENT = audio command issued</span>
            </div>
            {voiceAlertHistory.length === 0 ? (
              <div className="text-[10px] text-slate-400">No voice alerts sent yet. Use “Test Voice Alert” for the default demo voiceover.</div>
            ) : (
              <div className="space-y-1.5">
                {voiceAlertHistory.map(alert => (
                  <div key={alert.id} className="flex items-start gap-2 text-[10px]">
                    <span className="shrink-0 font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">VOICE SENT</span>
                    <span className="font-mono text-slate-400">{alert.time}</span>
                    <span className="text-slate-600 truncate">{alert.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* DEFAULT VIDEO SCENARIO SELECTOR */}
        {feedSource === 'default_video' && (
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-600 font-semibold">Video Scenario:</span>
              <span className="text-slate-400 text-[11px]">(Exact separate shapes for side-by-side hazards)</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(['ALL', 'WATERLOG', 'POTHOLE', 'TRAFFIC', 'ACCIDENT'] as const).map((scen) => (
                <button
                  key={scen}
                  onClick={() => setDefaultVideoScenario(scen)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                    defaultVideoScenario === scen
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900'
                  }`}
                >
                  {scen === 'ALL' && 'All 4 In Motion'}
                  {scen === 'WATERLOG' && 'Waterlogged Puddles (Side-by-Side)'}
                  {scen === 'POTHOLE' && 'Pothole Craters (Side-by-Side)'}
                  {scen === 'TRAFFIC' && 'Traffic Jam'}
                  {scen === 'ACCIDENT' && 'Vehicle Collision'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Camera Permission Alert */}
        {cameraError && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{cameraError}</span>
            </div>
            <button
              onClick={() => setCameraError(null)}
              className="text-xs font-semibold text-rose-700 hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Uploaded Video File Badge */}
        {feedSource === 'uploaded_video' && uploadedVideoName && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-xs text-blue-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileVideo className="w-4 h-4 text-blue-600" />
              <span>
                Active Video: <strong>{uploadedVideoName}</strong> • Analyzing for real puddles & craters using multi-instance spatial clustering.
              </span>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-xs font-semibold text-blue-700 hover:underline"
            >
              Change
            </button>
          </div>
        )}
      </div>

      {/* AUTONOMOUS REAL-TIME NOTIFICATION STRIP */}
      {liveNotificationToast && (
        <div className={`p-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-between shadow-xs transition-all ${
          liveNotificationToast.type === 'ACCIDENT'
            ? 'bg-rose-600 text-white'
            : liveNotificationToast.type === 'HIGH_QUANTITY'
            ? 'bg-amber-600 text-white'
            : 'bg-slate-900 text-slate-100'
        }`}>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0 text-yellow-300" />
            <span>{liveNotificationToast.message}</span>
          </div>
          <span className="text-[10px] font-mono uppercase bg-white/20 px-2 py-0.5 rounded-md shrink-0">
            Autonomous Dispatch & Evidence Snapshot Ready
          </span>
        </div>
      )}

      {predictiveHazards.length > 0 && (
        <div className="bg-indigo-950 text-indigo-50 border border-indigo-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold">Predictive Safety Corridor • 3 km</div>
            <div className="text-[11px] text-indigo-200 mt-0.5">GPS-tagged severe hazards previously verified by CivicEye buses are shared ahead of the current bus.</div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {predictiveHazards.slice(0, 4).map(h => (
              <span key={h.id} className="text-[10px] font-mono bg-white/10 border border-white/10 rounded-lg px-2 py-1">⚠ {h.distanceKm.toFixed(1)} km • {h.label}</span>
            ))}
          </div>
        </div>
      )}

      {/* MAIN VIDEO & CONTOUR SEGMENTATION CANVAS */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
        <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
          <canvas
            ref={canvasRef}
            width={960}
            height={540}
            className="w-full h-full object-contain"
          />

          {/* Floating Transport Bar */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
            <div className="flex items-center gap-2 bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700 text-xs text-white pointer-events-auto shadow-md">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="hover:text-blue-400 flex items-center gap-1 font-medium"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlaying ? 'Pause' : 'Play'}</span>
              </button>
              <span className="text-slate-600">|</span>
              <button
                onClick={() => {
                  const nextSpeed = playbackSpeed === 1 ? 2 : playbackSpeed === 2 ? 0.5 : 1;
                  setPlaybackSpeed(nextSpeed);
                  if (uploadedVideoRef.current) uploadedVideoRef.current.playbackRate = nextSpeed;
                }}
                className="hover:text-blue-400 font-mono text-[11px]"
              >
                {playbackSpeed}x
              </button>
            </div>

            {/* Live Detection Summary Indicator */}
            <div className="bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700 text-xs text-white pointer-events-auto flex items-center gap-2 shadow-md">
              <span className={`w-2 h-2 rounded-full ${activeDetections.length > 0 ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
              <span className="font-semibold text-[11px]">
                {activeDetections.length === 0
                  ? 'Zero Hazards in FOV'
                  : `${activeDetections.length} Active Hazard${activeDetections.length > 1 ? 's' : ''} Detected`}
              </span>
            </div>
          </div>
        </div>

        {/* DYNAMIC ACTION & STATUS FOOTER */}
        <div className="p-4 bg-slate-50 border-t border-slate-200/80 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-bold text-slate-800">
                Active Computer Vision State
              </h3>
              <p className="text-[11px] text-slate-500">
                Side-by-side hazards receive individual exact contour shapes. Polygons disappear when anomalies leave the screen.
              </p>
            </div>

            {/* DIRECT TRIGGER CONTROLS */}
            <div className="w-full flex flex-wrap items-center gap-2 p-3 rounded-xl bg-white border border-amber-200">
              <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500 mr-1">Direct Trigger</span>
              {([['POTHOLE','🕳️ Pothole'],['WATER_LOGGED','💧 Waterlogging'],['TRAFFIC','🚗 Severe Traffic'],['ACCIDENT','🚨 Accident']] as [ActiveHazard['type'],string][]).map(([type,label]) => <button key={type} onClick={()=>triggerDirectHazard(type)} className="px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[11px] font-bold">{label}</button>)}
              <span className="text-[10px] text-slate-400">TRIGGERED immediately; NOTIFY follows dispatch rules.</span>
            </div>

            {/* Action Button: Dispatches only what is in view */}
            <button
              onClick={handleExecuteAllDispatches}
              disabled={isDispatching}
              className={`text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs flex items-center gap-2 transition-all ${
                activeDetections.length > 0
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-slate-200 text-slate-500 cursor-not-allowed'
              }`}
            >
              {isDispatching ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Routing Dispatches...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 text-yellow-300" />
                  <span>{activeDetections.length > 0 ? 'Evaluate & Dispatch Eligible Hazards' : 'No Active Hazards in Frame'}</span>
                </>
              )}
            </button>
          </div>

          {/* ACTIVE HAZARDS TILES */}
          {activeDetections.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-3 text-center text-xs text-slate-400 italic">
              Pavement is clear. When hazards enter camera view, their exact individual shapes and parameters will appear here.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {activeDetections.map((hazard) => (
                <div
                  key={hazard.id}
                  className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ backgroundColor: hazard.fillColor, color: hazard.color }}>
                      {hazard.type}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-slate-400">
                      {(hazard.confidence * 100).toFixed(0)}% Conf
                    </span>
                  </div>
                  <h5 className="font-bold text-xs text-slate-800 truncate">
                    {hazard.label.split('•')[0]}
                  </h5>
                  <p className="text-[11px] text-slate-500">
                    {hazard.depthCm ? `Depth: ${hazard.depthCm}cm` : ''} {hazard.areaSqM ? `• Area: ${hazard.areaSqM}m²` : ''}
                    {hazard.licensePlate ? `Plate: ${hazard.licensePlate}` : ''}
                    {hazard.vehicleCount ? `Vehicles: ${hazard.vehicleCount}` : ''}
                  </p>
                  <div className="text-[10px] text-slate-400 font-mono truncate">
                    {hazard.complianceTag}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
