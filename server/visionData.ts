/**
 * Edge Computer Vision & Telemetry Engine
 * Pre-calibrated presets, contour polygon generators, license plate recognition,
 * and high-resolution evidence snapshot synthesizer.
 */

export interface ContourPoint {
  x: number;
  y: number;
}

export interface VisionDetection {
  id: string;
  type: 'POTHOLE' | 'WATER_LOGGED_HAZARD' | 'ACCIDENT' | 'TRAFFIC_JAM';
  label: string;
  severity: 'Small' | 'Medium' | 'Large' | 'Critical Water-Logged Hazard' | 'Severe Incident' | 'High Congestion';
  confidence: number;
  contour: ContourPoint[]; // Precise polygonal contour vertices
  boundingBox: { x: number; y: number; width: number; height: number };
  depthCm?: number;
  areaSqM?: number;
  licensePlates?: string[];
  vehicleCount?: number;
  avgSpeedKmph?: number;
  triggerTimeSec?: number;
  description: string;
  snapshotDataUrl?: string;
  estimatedDistanceM?: number;
}

export interface RouteWaypoint {
  lat: number;
  lng: number;
  road: string;
  wardId: string;
  wardName: string;
  zone: string;
  speedKmph: number;
}

// Preset GPS Route of Municipal Transit Bus in Pune/Maharashtra Urban Belt (Smart City Corridor)
export const URBAN_BUS_ROUTE: RouteWaypoint[] = [
  { lat: 18.520430, lng: 73.856744, road: 'Mahatma Gandhi Road, Camp', wardId: 'Ward 47', wardName: 'Central Civil Lines', zone: 'Zone 3 (Central)', speedKmph: 28 },
  { lat: 18.524580, lng: 73.861120, road: 'East Street Junction', wardId: 'Ward 47', wardName: 'Central Civil Lines', zone: 'Zone 3 (Central)', speedKmph: 24 },
  { lat: 18.529810, lng: 73.868940, road: 'Koregaon Park Main Road', wardId: 'Ward 52', wardName: 'Bund Garden - KP', zone: 'Zone 4 (East)', speedKmph: 32 },
  { lat: 18.535640, lng: 73.874520, road: 'North Main Road & Lane 5', wardId: 'Ward 52', wardName: 'Bund Garden - KP', zone: 'Zone 4 (East)', speedKmph: 18 },
  { lat: 18.541200, lng: 73.882100, road: 'Kalyani Nagar Bridge Approach', wardId: 'Ward 54', wardName: 'Kalyani Nagar', zone: 'Zone 4 (East)', speedKmph: 12 },
  { lat: 18.548900, lng: 73.891200, road: 'Ahmednagar Highway Sector 2', wardId: 'Ward 61', wardName: 'Viman Nagar Corridor', zone: 'Zone 5 (Northeast)', speedKmph: 35 },
  { lat: 18.555400, lng: 73.898500, road: 'Symbiosis Viman Nagar Chowk', wardId: 'Ward 61', wardName: 'Viman Nagar Corridor', zone: 'Zone 5 (Northeast)', speedKmph: 22 }
];

/**
 * Creates high-fidelity SVG snapshot with exact drawn contour segmentation,
 * HUD telemetry overlay, and license plate badges.
 */
export function generateEvidenceSnapshot(detection: Partial<VisionDetection>, waypoint: RouteWaypoint): string {
  const width = 640;
  const height = 360;

  // Generate SVG path for contour polygon
  let contourSvg = '';
  if (detection.contour && detection.contour.length > 0) {
    const pointsStr = detection.contour.map(p => `${p.x * width},${p.y * height}`).join(' ');
    const fillColor = detection.type === 'WATER_LOGGED_HAZARD' ? 'rgba(56, 189, 248, 0.45)' :
                      detection.type === 'ACCIDENT' ? 'rgba(239, 68, 68, 0.45)' :
                      detection.type === 'TRAFFIC_JAM' ? 'rgba(234, 179, 8, 0.4)' :
                      'rgba(249, 115, 22, 0.45)';
    const strokeColor = detection.type === 'WATER_LOGGED_HAZARD' ? '#0284c7' :
                        detection.type === 'ACCIDENT' ? '#dc2626' :
                        detection.type === 'TRAFFIC_JAM' ? '#ca8a04' :
                        '#ea580c';

    contourSvg = `
      <polygon points="${pointsStr}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2.5" stroke-dasharray="4,2" />
      ${detection.contour.map((p, i) => `<circle cx="${p.x * width}" cy="${p.y * height}" r="3" fill="#ffffff" stroke="${strokeColor}" stroke-width="1.5" />`).join('')}
    `;
  }

  // Simulated asphalt/road environment backdrop
  const isNightOrRain = detection.type === 'WATER_LOGGED_HAZARD';
  const bgGrad1 = isNightOrRain ? '#1e293b' : '#334155';
  const bgGrad2 = isNightOrRain ? '#0f172a' : '#1e293b';

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%">
      <defs>
        <linearGradient id="roadGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${bgGrad1}" />
          <stop offset="100%" stop-color="${bgGrad2}" />
        </linearGradient>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
        </pattern>
      </defs>

      <!-- Road Canvas -->
      <rect width="${width}" height="${height}" fill="url(#roadGrad)"/>
      <rect width="${width}" height="${height}" fill="url(#grid)" />

      <!-- Road Perspective Horizon Lines -->
      <line x1="120" y1="80" x2="0" y2="360" stroke="#475569" stroke-width="3" stroke-dasharray="10,8" />
      <line x1="520" y1="80" x2="640" y2="360" stroke="#475569" stroke-width="3" stroke-dasharray="10,8" />
      <line x1="320" y1="80" x2="320" y2="360" stroke="#facc15" stroke-width="4" stroke-dasharray="16,16" opacity="0.6"/>

      <!-- Simulated Obstacle/Vehicles/Pothole visuals -->
      ${detection.type === 'WATER_LOGGED_HAZARD' ? `
        <!-- Water ripple texture -->
        <ellipse cx="320" cy="220" rx="140" ry="60" fill="rgba(14, 165, 233, 0.25)" stroke="#38bdf8" stroke-width="2"/>
        <ellipse cx="310" cy="215" rx="90" ry="35" fill="rgba(56, 189, 248, 0.35)" />
        <ellipse cx="290" cy="210" rx="40" ry="15" fill="rgba(255, 255, 255, 0.25)" />
        <text x="320" y="225" text-anchor="middle" fill="#e0f2fe" font-size="12" font-family="monospace" font-weight="bold">WATER-LOGGED COMPOUND DEPRESSION [Depth: ~${detection.depthCm || 9.2}cm]</text>
      ` : ''}

      ${detection.type === 'POTHOLE' ? `
        <!-- Dry Pothole Crater Texture -->
        <ellipse cx="330" cy="230" rx="110" ry="50" fill="#090d16" stroke="#f97316" stroke-width="2"/>
        <ellipse cx="325" cy="225" rx="75" ry="30" fill="#020617" />
        <text x="330" y="235" text-anchor="middle" fill="#ffedd5" font-size="12" font-family="monospace" font-weight="bold">BITUMINOUS CAVITY [Area: ${detection.areaSqM || 1.15}m² | Depth: ${detection.depthCm || 6.4}cm]</text>
      ` : ''}

      ${detection.type === 'ACCIDENT' ? `
        <!-- Collided Vehicles Silhouettes -->
        <rect x="220" y="150" width="110" height="70" rx="8" fill="#450a0a" stroke="#ef4444" stroke-width="2.5" transform="rotate(-12 275 185)"/>
        <rect x="310" y="165" width="120" height="75" rx="8" fill="#1e1b4b" stroke="#ef4444" stroke-width="2.5" transform="rotate(24 370 200)"/>
        <!-- Impact Spark/Debris -->
        <circle cx="315" cy="180" r="16" fill="rgba(239, 68, 68, 0.6)" stroke="#ffffff" stroke-width="2"/>
        <text x="320" y="140" text-anchor="middle" fill="#fee2e2" font-size="13" font-family="monospace" font-weight="bold">COLLISION ZONE: 2 VEHICLES OVERTURNED</text>
      ` : ''}

      ${detection.type === 'TRAFFIC_JAM' ? `
        <!-- Traffic Jam Queued Vehicles -->
        <rect x="180" y="180" width="70" height="45" rx="4" fill="#854d0e" stroke="#eab308" stroke-width="1.5"/>
        <rect x="270" y="170" width="80" height="50" rx="4" fill="#713f12" stroke="#eab308" stroke-width="1.5"/>
        <rect x="370" y="175" width="75" height="48" rx="4" fill="#854d0e" stroke="#eab308" stroke-width="1.5"/>
        <rect x="230" y="235" width="90" height="55" rx="4" fill="#a16207" stroke="#facc15" stroke-width="2"/>
        <rect x="340" y="240" width="85" height="52" rx="4" fill="#713f12" stroke="#facc15" stroke-width="2"/>
        <text x="320" y="315" text-anchor="middle" fill="#fef08a" font-size="12" font-family="monospace" font-weight="bold">BOTTLENECK DENSITY: 18 VEHICLES / ROLLING WINDOW</text>
      ` : ''}

      <!-- Render Contour Segmentation Polygon -->
      ${contourSvg}

      <!-- HUD Telemetry Header & Border Overlay -->
      <rect x="0" y="0" width="${width}" height="32" fill="rgba(0,0,0,0.85)" />
      <text x="12" y="21" fill="#22c55e" font-size="12" font-family="monospace" font-weight="bold">● LIVE EDGE-AI CAM [JETSON-ORIN] 30 FPS</text>
      <text x="300" y="21" fill="#94a3b8" font-size="11" font-family="monospace">${waypoint.wardId} | ${waypoint.road}</text>
      <text x="${width - 12}" y="21" text-anchor="end" fill="#38bdf8" font-size="11" font-family="monospace">GPS: ${waypoint.lat.toFixed(5)}°N, ${waypoint.lng.toFixed(5)}°E</text>

      <!-- HUD Telemetry Footer -->
      <rect x="0" y="${height - 40}" width="${width}" height="40" fill="rgba(0,0,0,0.85)" />
      <text x="12" y="${height - 23}" fill="#f8fafc" font-size="12" font-family="monospace" font-weight="bold">DETECTION: ${detection.label || 'ANOMALY'} [${detection.severity}]</text>
      <text x="12" y="${height - 8}" fill="#94a3b8" font-size="10" font-family="monospace">Confidence: ${((detection.confidence || 0.96) * 100).toFixed(1)}% | Segmentation: YOLOv8-Seg Instance Polygonal Vertex Vector</text>

      ${detection.licensePlates && detection.licensePlates.length > 0 ? `
        <!-- Extracted License Plate Badge -->
        <rect x="${width - 190}" y="${height - 35}" width="180" height="28" rx="4" fill="#0f172a" stroke="#38bdf8" stroke-width="1.5"/>
        <text x="${width - 180}" y="${height - 17}" fill="#f8fafc" font-size="11" font-family="monospace" font-weight="bold">PLATE: ${detection.licensePlates[0]}</text>
      ` : ''}

      ${detection.triggerTimeSec ? `
        <rect x="${width - 180}" y="${height - 70}" width="170" height="24" rx="3" fill="#991b1b" />
        <text x="${width - 170}" y="${height - 54}" fill="#ffffff" font-size="10" font-family="monospace" font-weight="bold">TRIGGER: ${detection.triggerTimeSec.toFixed(2)}s (&lt; 3s MET)</text>
      ` : ''}
    </svg>
  `;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Pre-defined Detection Templates for Rapid Realistic Simulation & Continuous Edge AI Loops
 */
export const SAMPLE_DETECTION_PRESETS: VisionDetection[] = [
  {
    id: 'det_waterlogged_01',
    type: 'WATER_LOGGED_HAZARD',
    label: 'Compound Water-Logged Pothole',
    severity: 'Critical Water-Logged Hazard',
    confidence: 0.974,
    contour: [
      { x: 0.28, y: 0.52 },
      { x: 0.35, y: 0.48 },
      { x: 0.46, y: 0.49 },
      { x: 0.58, y: 0.54 },
      { x: 0.65, y: 0.62 },
      { x: 0.62, y: 0.71 },
      { x: 0.48, y: 0.74 },
      { x: 0.36, y: 0.72 },
      { x: 0.26, y: 0.64 }
    ],
    boundingBox: { x: 0.26, y: 0.48, width: 0.39, height: 0.26 },
    depthCm: 9.4,
    areaSqM: 1.68,
    description: 'Severe structural subgrade collapse masked by opaque rain water ponding. Exceeds IRC:82 depth tolerance by 276%.'
  },
  {
    id: 'det_accident_01',
    type: 'ACCIDENT',
    label: 'High-Impact Vehicle Collision',
    severity: 'Severe Incident',
    confidence: 0.988,
    contour: [
      { x: 0.32, y: 0.38 },
      { x: 0.48, y: 0.36 },
      { x: 0.64, y: 0.42 },
      { x: 0.71, y: 0.56 },
      { x: 0.62, y: 0.68 },
      { x: 0.45, y: 0.69 },
      { x: 0.30, y: 0.58 }
    ],
    boundingBox: { x: 0.30, y: 0.36, width: 0.41, height: 0.33 },
    licensePlates: ['MH-12-DE-8921', 'MH-14-BT-5104'],
    triggerTimeSec: 1.84, // Sub-3s response trigger
    description: 'Head-on collision between compact sedan and delivery truck with partial rollover. Deployed immediate 112 emergency payload.'
  },
  {
    id: 'det_pothole_02',
    type: 'POTHOLE',
    label: 'Deep Dry Bituminous Crater',
    severity: 'Large',
    confidence: 0.952,
    contour: [
      { x: 0.38, y: 0.55 },
      { x: 0.46, y: 0.52 },
      { x: 0.56, y: 0.54 },
      { x: 0.61, y: 0.63 },
      { x: 0.54, y: 0.70 },
      { x: 0.42, y: 0.68 },
      { x: 0.35, y: 0.62 }
    ],
    boundingBox: { x: 0.35, y: 0.52, width: 0.26, height: 0.18 },
    depthCm: 6.8,
    areaSqM: 0.92,
    description: 'Dry raveling and alligator crack breakdown causing sharp rim depression. Violation of IRC:82 clause 4.3.'
  },
  {
    id: 'det_traffic_01',
    type: 'TRAFFIC_JAM',
    label: 'Critical Corridor Congestion',
    severity: 'High Congestion',
    confidence: 0.963,
    contour: [
      { x: 0.22, y: 0.42 },
      { x: 0.76, y: 0.42 },
      { x: 0.85, y: 0.85 },
      { x: 0.15, y: 0.85 }
    ],
    boundingBox: { x: 0.15, y: 0.42, width: 0.70, height: 0.43 },
    vehicleCount: 23,
    avgSpeedKmph: 4.2,
    description: 'Severe traffic bottleneck detected over 120-meter stretch. Rolling window vehicle density exceeded threshold (LOS F).'
  }
];
