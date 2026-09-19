export interface ContourPoint {
  x: number;
  y: number;
}

export interface VisionDetection {
  id: string;
  type: 'POTHOLE' | 'WATER_LOGGED_HAZARD' | 'ACCIDENT' | 'TRAFFIC_JAM';
  label: string;
  severity: 'Small' | 'Low' | 'Medium' | 'Large' | 'Critical Water-Logged Hazard' | 'Severe Incident' | 'High Congestion';
  confidence: number;
  contour: ContourPoint[];
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

export interface TriggeredDetection extends VisionDetection {
  detected_at: string;
  road_name: string;
  ward_id: string;
  gps_lat: number;
  gps_lng: number;
  estimatedDistanceM?: number;
  dispatchStatus: 'PENDING' | 'DISPATCHED';
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

export interface DispatchRecord {
  id: string;
  type: 'POTHOLE_MUNICIPAL_COMPLAINT' | 'ACCIDENT_POLICE_EMERGENCY' | 'TRAFFIC_CONGESTION_ALERT';
  department: string;
  title: string;
  severity: 'Small' | 'Low' | 'Medium' | 'Large' | 'Critical Water-Logged Hazard' | 'Severe Incident' | 'High Congestion';
  ward_id: string;
  road_name: string;
  gps_lat: number;
  gps_lng: number;
  payload_json: string;
  formal_letter?: string;
  snapshot_image?: string;
  delivery_status: '200_OK' | 'QUEUED_OFFLINE' | 'SYNCING' | 'FAILED';
  trigger_time_seconds?: number;
  license_plate?: string;
  created_at: string;
  synced_at?: string;
}

export interface EdgeTelemetry {
  busId: string;
  routeId: string;
  routeName: string;
  currentWaypoint: RouteWaypoint;
  telemetry: {
    gpsLat: number;
    gpsLng: number;
    speedKmph: number;
    currentWard: string;
    wardName: string;
    zone: string;
    roadName: string;
  };
  edgeHardware: {
    socModel: string;
    aiInferenceEngine: string;
    inferenceFps: number;
    inferenceLatencyMs: number;
    cpuUsagePercent: number;
    gpuUsagePercent: number;
    deviceTempCelsius: number;
    storageEdgeCache: string;
    cameraSensors: string;
  };
  network: {
    isOnline: boolean;
    signalStrengthDbm: number;
    networkType: string;
    busId: string;
  };
}

export interface SystemLog {
  id: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS' | 'RESILIENCE';
  source: string;
  message: string;
  timestamp: string;
}

export interface DashboardStats {
  totalDetections: number;
  accidentsCount: number;
  potholesCount: number;
  waterloggedHazardsCount: number;
  trafficJamsCount: number;
  offlineQueuedCount: number;
  avgAccidentTriggerSec: number;
  ircComplianceLettersGenerated: number;
  network: {
    isOnline: boolean;
    signalStrengthDbm: number;
    networkType: string;
    busId: string;
  };
}
