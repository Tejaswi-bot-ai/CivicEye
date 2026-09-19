import { insertDispatch, markDispatchesSynced, getQueuedOfflineDispatches, logSystemEvent, clearAllDispatches, deleteDispatch, DispatchRecord, getAllDispatches } from './db.js';
import { generateFormalMunicipalLetter } from './letterGenerator.js';
import {
  URBAN_BUS_ROUTE,
  generateEvidenceSnapshot,
  VisionDetection,
  RouteWaypoint
} from './visionData.js';

// Network simulation state: simulates the cellular link on the moving bus.
let isCellularOnline = true;
let currentRouteIndex = 0;
const BUS_ID = 'EDGE-BUS-MH12-8402';

export function getNetworkStatus() {
  return {
    isOnline: isCellularOnline,
    signalStrengthDbm: isCellularOnline ? -68 : -115,
    networkType: isCellularOnline ? '5G_CARRIER_LINK' : 'OFFLINE_NO_SERVICE',
    busId: BUS_ID
  };
}

export function setNetworkStatus(online: boolean) {
  isCellularOnline = online;
  logSystemEvent(
    online ? 'SUCCESS' : 'WARN',
    'CellularGateway',
    online
      ? 'Cellular 5G connection established. Edge-to-Cloud sync daemon activated.'
      : 'Cellular carrier link dropped. Switching to local SQLite edge cache (offline_cache.db).'
  );
}

export function getNextWaypoint(): RouteWaypoint {
  const waypoint = URBAN_BUS_ROUTE[currentRouteIndex];
  currentRouteIndex = (currentRouteIndex + 1) % URBAN_BUS_ROUTE.length;
  return waypoint;
}

// ============================================================
// CIVIC EYE AUTONOMOUS DISPATCH ENGINE
//
// TWO INDEPENDENT PIPELINES:
//   A) ROAD HAZARDS = pothole + waterlogging, aggregated per area.
//      One municipal dispatch per area. Repeated frames are deduplicated.
//   B) EMERGENCY/TRAFFIC = accident + severe traffic, evaluated
//      independently and dispatched immediately after confirmation.
// ============================================================

const DISPATCH_RULES = {
  observationWindowMs: 5 * 60 * 1000,
  areaRadiusMeters: 300,
  roadHazardDispatchCooldownMs: 0,

  roadHazard: {
    // Repeated confirmed pothole observations build an area-level evidence
    // counter. At 5 observations, one official complaint is created.
    // Further observations in the same area are absorbed into that same
    // single area ticket; they never become multiple messages.
    minConfirmedDetections: 5,
    // Demo dispatch starts after 5 repeated confirmed observations.
    // Dispatch fires at 30 and the same area remains a single permanent ticket.
    maxDemoPotholeDetections: 50,
    minLargePotholes: 0,
    potholeMinConfidence: 0.80,
    waterlogMinConfidence: 0.80,
    waterlogMinObservations: 2,
    waterlogMinAreaSqM: 0.50
  },

  traffic: {
    minVehicles: 30,
    maxAverageSpeedKmph: 5.5,
    minConfidence: 0.90,
    // Severe traffic is already a high-threshold observation. One confirmed
    // observation is enough for the demo/emergency workflow.
    minConsecutiveObservations: 1
  },

  accident: {
    minConfidence: 0.95,
    maxTriggerTimeSec: 3,
    minConsecutiveObservations: 1
  }
};

interface AggregatedHazard {
  pipeline: 'ROAD_HAZARD' | 'TRAFFIC' | 'ACCIDENT';
  type: VisionDetection['type'];
  detections: VisionDetection[];
  detectionKeys: Set<string>;
  waypoint: RouteWaypoint;
  firstSeen: number;
  lastSeen: number;
}

// Pipeline + geographical area is the key. This prevents accident/traffic
// state from replacing the pothole/waterlogging state.
const activeHazardClusters = new Map<string, AggregatedHazard>();

// Once a dispatch has been emitted, that exact pipeline/area is locked.
// It is unlocked naturally when a new area key is encountered.
const dispatchedAreaLocks = new Set<string>();
const dispatchInFlight = new Set<string>();

function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getAreaKey(waypoint: RouteWaypoint): string {
  // Ward/road remains human-readable while the rounded GPS grid makes
  // the rule geographical rather than merely string based.
  const latGrid = Math.round(waypoint.lat * 1000) / 1000;
  const lngGrid = Math.round(waypoint.lng * 1000) / 1000;
  return `${waypoint.wardId}:${waypoint.road}:${latGrid.toFixed(3)},${lngGrid.toFixed(3)}`;
}

function getPipeline(type: VisionDetection['type']): AggregatedHazard['pipeline'] {
  if (type === 'ACCIDENT') return 'ACCIDENT';
  if (type === 'TRAFFIC_JAM') return 'TRAFFIC';
  return 'ROAD_HAZARD';
}

function getPipelineAreaKey(type: VisionDetection['type'], waypoint: RouteWaypoint): string {
  const base = getAreaKey(waypoint);
  if (type === 'POTHOLE') return `ROAD_HAZARD:POTHOLE:${base}`;
  if (type === 'WATER_LOGGED_HAZARD') return `ROAD_HAZARD:WATERLOG:${base}`;
  return `${getPipeline(type)}:${base}`;
}

function getDetectionKey(detection: VisionDetection): string {
  // Frontend detections historically used w/h while the server type uses
  // width/height. Accept both so distinct potholes cannot collapse into a
  // single NaN key and block the dispatch threshold forever.
  const raw = detection.boundingBox as VisionDetection['boundingBox'] & { w?: number; h?: number };
  const width = Number.isFinite(raw.width) ? raw.width : (raw.w ?? 0);
  const height = Number.isFinite(raw.height) ? raw.height : (raw.h ?? 0);
  const cx = raw.x + width / 2;
  const cy = raw.y + height / 2;
  const w = width;
  const h = height;

  // Coarse frame-space bins suppress repeated observations of the same
  // visible object while still allowing distinct potholes to count.
  const q = (value: number, step: number) => Math.round(value / step);
  return `${detection.type}:${q(cx, 0.05)}:${q(cy, 0.05)}:${q(w, 0.05)}:${q(h, 0.05)}`;
}

function pruneCluster(cluster: AggregatedHazard, now: number) {
  const cutoff = now - DISPATCH_RULES.observationWindowMs;
  cluster.detections = cluster.detections.filter(d => {
    const observedAt = Number((d as VisionDetection & { _observedAt?: number })._observedAt ?? now);
    return observedAt >= cutoff;
  });

  // Rebuild keys because old observations may have expired.
  cluster.detectionKeys = new Set(cluster.detections.map(getDetectionKey));
  if (cluster.detections.length > 0) {
    const times = cluster.detections.map(d => Number((d as VisionDetection & { _observedAt?: number })._observedAt ?? now));
    cluster.firstSeen = Math.min(...times);
    cluster.lastSeen = Math.max(...times);
  }
}

function evaluateRoadHazard(
  detections: VisionDetection[]
): { shouldDispatch: boolean; reason: string } {
  const type = detections[0]?.type;

  if (type === 'POTHOLE') {
    const valid = detections.filter(d =>
      d.type === 'POTHOLE' && d.confidence >= DISPATCH_RULES.roadHazard.potholeMinConfidence
    );
    const large = valid.filter(d =>
      d.severity === 'Large' || (d.areaSqM ?? 0) >= 0.75 || (d.depthCm ?? 0) >= 5
    );
    if (valid.length >= DISPATCH_RULES.roadHazard.minConfirmedDetections) {
      return {
        shouldDispatch: true,
        reason: `Pothole evidence threshold reached: ${valid.length} confirmed observations in this area (${large.length} large)`
      };
    }
    return {
      shouldDispatch: false,
      reason: `Pothole evidence: ${valid.length}/${DISPATCH_RULES.roadHazard.minConfirmedDetections} confirmed observations in this area (${large.length} large)`
    };
  }

  if (type === 'WATER_LOGGED_HAZARD') {
    const valid = detections.filter(d =>
      d.type === 'WATER_LOGGED_HAZARD' && d.confidence >= DISPATCH_RULES.roadHazard.waterlogMinConfidence
    );
    const area = valid.reduce((sum, d) => sum + (d.areaSqM ?? 0), 0);
    if (valid.length >= DISPATCH_RULES.roadHazard.waterlogMinObservations && area >= DISPATCH_RULES.roadHazard.waterlogMinAreaSqM) {
      return { shouldDispatch: true, reason: `Critical waterlogging: ${valid.length} confirmed observations over ${area.toFixed(2)}m²` };
    }
    return { shouldDispatch: false, reason: `Waterlogging evidence: ${valid.length}/${DISPATCH_RULES.roadHazard.waterlogMinObservations} observations, ${area.toFixed(2)}m²` };
  }

  return { shouldDispatch: false, reason: 'Unsupported road-hazard type' };
}

function evaluateTraffic(
  detections: VisionDetection[]
): { shouldDispatch: boolean; reason: string } {
  const valid = detections.filter(
    d =>
      d.type === 'TRAFFIC_JAM' &&
      d.confidence >= DISPATCH_RULES.traffic.minConfidence &&
      (d.vehicleCount ?? 0) >= DISPATCH_RULES.traffic.minVehicles &&
      (d.avgSpeedKmph ?? 100) <= DISPATCH_RULES.traffic.maxAverageSpeedKmph
  );

  if (valid.length >= DISPATCH_RULES.traffic.minConsecutiveObservations) {
    const maxVehicles = Math.max(...valid.map(d => d.vehicleCount ?? 0));
    const minSpeed = Math.min(...valid.map(d => d.avgSpeedKmph ?? 100));
    return {
      shouldDispatch: true,
      reason: `SEVERE traffic confirmed: ${maxVehicles} vehicles at ${minSpeed.toFixed(1)} km/h across ${valid.length} observations`
    };
  }

  return {
    shouldDispatch: false,
    reason: `Traffic not severe enough: ${valid.length}/${DISPATCH_RULES.traffic.minConsecutiveObservations} qualifying observations`
  };
}

function evaluateAccident(
  detection: VisionDetection
): { shouldDispatch: boolean; reason: string } {
  const confidenceOK = detection.confidence >= DISPATCH_RULES.accident.minConfidence;
  const trigger = detection.triggerTimeSec ?? 999;
  const timeOK = trigger <= DISPATCH_RULES.accident.maxTriggerTimeSec;

  if (confidenceOK && timeOK) {
    return {
      shouldDispatch: true,
      reason: `CRITICAL accident confirmed at ${(trigger).toFixed(2)}s with ${(detection.confidence * 100).toFixed(1)}% confidence`
    };
  }

  return {
    shouldDispatch: false,
    reason: `Accident confirmation rejected: confidence ${(detection.confidence * 100).toFixed(1)}%, trigger ${trigger === 999 ? 'N/A' : `${trigger.toFixed(2)}s`}`
  };
}

function buildDispatchRecord(
  detection: VisionDetection,
  cluster: AggregatedHazard,
  waypoint: RouteWaypoint,
  reason: string,
  nowIso: string
): DispatchRecord {
  const ticketRef =
    `CE-${new Date().getFullYear()}-` +
    `${waypoint.wardId.replace(/\s+/g, '')}-` +
    `${Math.floor(1000 + Math.random() * 9000)}`;

  const snapshotUrl =
    detection.snapshotDataUrl || generateEvidenceSnapshot(detection, waypoint);

  const recordType: DispatchRecord['type'] =
    detection.type === 'ACCIDENT'
      ? 'ACCIDENT_POLICE_EMERGENCY'
      : detection.type === 'TRAFFIC_JAM'
        ? 'TRAFFIC_CONGESTION_ALERT'
        : 'POTHOLE_MUNICIPAL_COMPLAINT';

  let department = '';
  let title = '';
  let formalLetter: string | undefined;
  let triggerTimeSec: number | undefined;
  let licensePlate: string | undefined;

  if (detection.type === 'ACCIDENT') {
    department = 'POLICE CONTROL ROOM & 112 EMERGENCY COMMAND';
    title = 'CRITICAL 112 DISPATCH: Confirmed Vehicle Collision';
    triggerTimeSec = detection.triggerTimeSec ?? 1.84;
    licensePlate = detection.licensePlates?.[0];
  } else if (detection.type === 'TRAFFIC_JAM') {
    department = 'SMART CITY TRAFFIC MANAGEMENT CENTER (ITMS)';
    title = `SEVERE TRAFFIC CONGESTION: ${waypoint.road}`;
  } else {
    department = 'MUNICIPAL ROAD MAINTENANCE & STORMWATER DRAINAGE CELL';
    const hasWaterlogging = cluster.detections.some(d => d.type === 'WATER_LOGGED_HAZARD');
    title = hasWaterlogging
      ? `FORMAL COMPLAINT: Critical Waterlogging - ${waypoint.road}`
      : `FORMAL COMPLAINT: Critical Pothole Cluster - ${waypoint.road}`;

    const representative = cluster.detections.find(d => d.type === 'WATER_LOGGED_HAZARD') || detection;
    formalLetter = generateFormalMunicipalLetter({
      ticketId: ticketRef,
      roadName: waypoint.road,
      wardId: waypoint.wardId,
      wardName: waypoint.wardName,
      zone: waypoint.zone,
      gpsLat: waypoint.lat,
      gpsLng: waypoint.lng,
      chainage: '2+450',
      severity: representative.severity as any,
      areaSqMeters: representative.areaSqM ?? 1,
      estimatedDepthCm: representative.depthCm ?? 5,
      isWaterLogged: hasWaterlogging,
      busId: BUS_ID,
      detectedAt: nowIso,
      ircCodes: ['IRC:82-2015', 'IRC:SP:20', 'IRC:SP:84']
    });
  }

  const payloadObj = {
    platform: 'CivicEye',
    dispatch_mode: cluster.pipeline,
    edge_unit_id: BUS_ID,
    ticket_id: ticketRef,
    timestamp_utc: nowIso,
    location: {
      latitude: waypoint.lat,
      longitude: waypoint.lng,
      road_name: waypoint.road,
      ward_id: waypoint.wardId,
      ward_name: waypoint.wardName,
      zone: waypoint.zone,
      area_radius_meters: DISPATCH_RULES.areaRadiusMeters
    },
    aggregated_evidence: {
      detection_count: cluster.detections.length,
      unique_detection_count: cluster.detectionKeys.size,
      observation_window_minutes: Math.max(0, (cluster.lastSeen - cluster.firstSeen) / 60000),
      reason
    },
    ai_evidence: cluster.detections.map(d => ({
      type: d.type,
      confidence: d.confidence,
      severity: d.severity,
      areaSqM: d.areaSqM,
      depthCm: d.depthCm,
      vehicleCount: d.vehicleCount,
      avgSpeedKmph: d.avgSpeedKmph
    }))
  };

  return {
    id: ticketRef,
    type: recordType,
    department,
    title,
    severity: detection.severity,
    ward_id: waypoint.wardId,
    road_name: waypoint.road,
    gps_lat: waypoint.lat,
    gps_lng: waypoint.lng,
    payload_json: JSON.stringify(payloadObj, null, 2),
    formal_letter: formalLetter,
    snapshot_image: snapshotUrl,
    delivery_status: isCellularOnline ? '200_OK' : 'QUEUED_OFFLINE',
    trigger_time_seconds: triggerTimeSec,
    license_plate: licensePlate,
    created_at: nowIso,
    synced_at: isCellularOnline ? nowIso : undefined
  };
}

// ============================================================
// PROCESS ONE DETECTION
// ============================================================

export async function processDetectionAndDispatch(
  detection: VisionDetection,
  waypoint: RouteWaypoint
): Promise<{
  detection: VisionDetection;
  triggered: boolean;
  dispatched: boolean;
  record?: DispatchRecord;
  reason: string;
}> {
  const now = Date.now();
  const areaKey = getAreaKey(waypoint);
  const pipeline = getPipeline(detection.type);
  const pipelineAreaKey = getPipelineAreaKey(detection.type, waypoint);

  // ACCIDENT: independent immediate path. It does not wait for pothole/traffic.
  if (detection.type === 'ACCIDENT') {
    const evaluation = evaluateAccident(detection);
    if (!evaluation.shouldDispatch) {
      logSystemEvent('INFO', 'CivicEye-Accident', `${pipelineAreaKey}: ${evaluation.reason}`);
      return { detection, triggered: true, dispatched: false, reason: evaluation.reason };
    }

    if (dispatchedAreaLocks.has(pipelineAreaKey) || dispatchInFlight.has(pipelineAreaKey)) {
      return {
        detection,
        triggered: true,
        dispatched: false,
        reason: dispatchedAreaLocks.has(pipelineAreaKey) ? 'Accident already dispatched for this area; duplicate emergency dispatch suppressed' : 'Accident dispatch is already being created for this area'
      };
    }
    dispatchInFlight.add(pipelineAreaKey);

    const cluster: AggregatedHazard = {
      pipeline: 'ACCIDENT',
      type: 'ACCIDENT',
      detections: [detection],
      detectionKeys: new Set([getDetectionKey(detection)]),
      waypoint,
      firstSeen: now,
      lastSeen: now
    };

    const nowIso = new Date().toISOString();
    const record = buildDispatchRecord(detection, cluster, waypoint, evaluation.reason, nowIso);
    await insertDispatch(record);
    dispatchedAreaLocks.add(pipelineAreaKey);
    dispatchInFlight.delete(pipelineAreaKey);

    logSystemEvent('SUCCESS', 'CivicEye-Accident', `Immediate 112 dispatch ${record.id} created for ${pipelineAreaKey}`);
    return { detection, triggered: true, dispatched: true, record, reason: evaluation.reason };
  }

  // TRAFFIC: independent severe-congestion path.
  if (detection.type === 'TRAFFIC_JAM') {
    let cluster = activeHazardClusters.get(pipelineAreaKey);
    if (!cluster) {
      cluster = {
        pipeline: 'TRAFFIC',
        type: 'TRAFFIC_JAM',
        detections: [],
        detectionKeys: new Set(),
        waypoint,
        firstSeen: now,
        lastSeen: now
      };
      activeHazardClusters.set(pipelineAreaKey, cluster);
    }

    const observation = { ...detection, _observedAt: now } as VisionDetection & { _observedAt: number };
    cluster.detections.push(observation);
    cluster.lastSeen = now;
    pruneCluster(cluster, now);

    // For traffic we intentionally count qualifying observations, not unique
    // vehicle boxes. This gives us temporal confirmation.
    const evaluation = evaluateTraffic(cluster.detections);
    if (!evaluation.shouldDispatch) {
      return { detection, triggered: true, dispatched: false, reason: evaluation.reason };
    }

    if (dispatchedAreaLocks.has(pipelineAreaKey) || dispatchInFlight.has(pipelineAreaKey)) {
      return { detection, triggered: true, dispatched: false, reason: dispatchedAreaLocks.has(pipelineAreaKey) ? 'Severe traffic already dispatched for this area' : 'Traffic dispatch is already being created for this area' };
    }
    dispatchInFlight.add(pipelineAreaKey);

    const nowIso = new Date().toISOString();
    const record = buildDispatchRecord(detection, cluster, waypoint, evaluation.reason, nowIso);
    await insertDispatch(record);
    dispatchedAreaLocks.add(pipelineAreaKey);
    dispatchInFlight.delete(pipelineAreaKey);

    logSystemEvent('SUCCESS', 'CivicEye-Traffic', `Immediate traffic dispatch ${record.id} created for ${pipelineAreaKey}`);
    return { detection, triggered: true, dispatched: true, record, reason: evaluation.reason };
  }

  // ROAD HAZARDS: POTHOLE + WATERLOGGING intentionally share one area
  // pipeline, so 98 repeated detections in the same area still produce ONE
  // municipal complaint.
  let cluster = activeHazardClusters.get(pipelineAreaKey);
  if (!cluster) {
    cluster = {
      pipeline: 'ROAD_HAZARD',
      type: detection.type,
      detections: [],
      detectionKeys: new Set(),
      waypoint,
      firstSeen: now,
      lastSeen: now
    };
    activeHazardClusters.set(pipelineAreaKey, cluster);
  }

  // Every confirmed emitted observation counts toward the area threshold.
  // This is intentional: the default looping video repeatedly sees the same
  // road hazard, and 30 such confirmed observations should create ONE area
  // complaint rather than zero complaints. The permanent dispatch lock below
  // prevents that cluster from ever creating 30 separate messages.
  const observation = { ...detection, _observedAt: now } as VisionDetection & { _observedAt: number };
  cluster.detections.push(observation);
  cluster.detectionKeys.add(getDetectionKey(detection));
  cluster.lastSeen = now;
  pruneCluster(cluster, now);

  const evaluation = evaluateRoadHazard(cluster.detections);
  if (!evaluation.shouldDispatch) {
    logSystemEvent(
      'INFO',
      'CivicEye-RoadHazard',
      `${pipelineAreaKey}: dispatch suppressed — ${evaluation.reason}`
    );
    return { detection, triggered: true, dispatched: false, reason: evaluation.reason };
  }

  if (dispatchedAreaLocks.has(pipelineAreaKey) || dispatchInFlight.has(pipelineAreaKey)) {
    return {
      detection,
      triggered: true,
      dispatched: false,
      reason: dispatchedAreaLocks.has(pipelineAreaKey) ? 'Municipal road-hazard dispatch already sent for this area; duplicate suppressed' : 'Municipal dispatch is already being created for this area'
    };
  }
  dispatchInFlight.add(pipelineAreaKey);

  const nowIso = new Date().toISOString();
  const record = buildDispatchRecord(detection, cluster, waypoint, evaluation.reason, nowIso);
  await insertDispatch(record);
  dispatchedAreaLocks.add(pipelineAreaKey);
  dispatchInFlight.delete(pipelineAreaKey);

  logSystemEvent(
    'SUCCESS',
    'CivicEye-RoadHazard',
    `ONE municipal dispatch ${record.id} created for ${pipelineAreaKey}. Further detections in this area are locked.`
  );

  return { detection, triggered: true, dispatched: true, record, reason: evaluation.reason };
}

// ============================================================
// MULTI-DETECTION PROCESSOR
// ============================================================

export async function processMultiDetectionsAndDispatch(
  detections: Partial<VisionDetection>[],
  waypointOverride?: RouteWaypoint
): Promise<DispatchRecord[]> {
  const waypoint = waypointOverride || getNextWaypoint();
  const records: DispatchRecord[] = [];

  for (const partial of detections) {
    if (!partial.type || partial.confidence == null) continue;
    const result = await processDetectionAndDispatch(partial as VisionDetection, waypoint);
    if (result.dispatched && result.record) records.push(result.record);
  }

  return records;
}

export async function syncOfflineCache(): Promise<{ syncedCount: number; remainingQueued: number }> {
  try {
    const queued = await getQueuedOfflineDispatches();
    if (queued.length === 0) return { syncedCount: 0, remainingQueued: 0 };

    if (!isCellularOnline) {
      logSystemEvent('WARN', 'SyncBlocked', `Cannot sync ${queued.length} records: Cellular connection is currently offline`);
      return { syncedCount: 0, remainingQueued: queued.length };
    }

    const ids = queued.map(q => q.id);
    const count = await markDispatchesSynced(ids);
    logSystemEvent('SUCCESS', 'EdgeSyncDaemon', `Successfully batch-uploaded ${count} cached dispatches from offline_cache.db to Municipal & Police cloud servers`);
    return { syncedCount: count, remainingQueued: 0 };
  } catch (err: any) {
    console.error('[Sync Error]', err);
    logSystemEvent('ERROR', 'SyncException', `Self-correction recovered from sync exception: ${err?.message}`);
    return { syncedCount: 0, remainingQueued: -1 };
  }
}

export async function getPredictiveHazards(waypoint: RouteWaypoint, radiusKm = 3) {
  const records = await getAllDispatches();
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  return records.map(record => {
    const dLat = toRad(record.gps_lat - waypoint.lat);
    const dLng = toRad(record.gps_lng - waypoint.lng);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(waypoint.lat)) * Math.cos(toRad(record.gps_lat)) * Math.sin(dLng / 2) ** 2;
    const distanceKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return {
      id: record.id,
      type: record.type,
      label: record.title,
      severity: record.severity,
      road: record.road_name,
      distanceKm: Number(distanceKm.toFixed(2)),
      gpsLat: record.gps_lat,
      gpsLng: record.gps_lng,
      verifiedAt: record.created_at
    };
  }).filter(h => h.distanceKm > 0.05 && h.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 20);
}

export async function deleteDispatchHistory(id: string): Promise<boolean> {
  const records = await getAllDispatches();
  const record = records.find(r => r.id === id);
  if (!record) return false;

  const deleted = await deleteDispatch(id);
  if (!deleted) return false;

  const waypoint = {
    lat: record.gps_lat,
    lng: record.gps_lng,
    road: record.road_name,
    wardId: record.ward_id,
    wardName: record.ward_id,
    zone: '',
    speedKmph: 0
  } as RouteWaypoint;
  let type: VisionDetection['type'] = 'POTHOLE';
  if (record.type === 'ACCIDENT_POLICE_EMERGENCY') type = 'ACCIDENT';
  else if (record.type === 'TRAFFIC_CONGESTION_ALERT') type = 'TRAFFIC_JAM';
  else if (/waterlog/i.test(record.title) || record.severity === 'Critical Water-Logged Hazard') type = 'WATER_LOGGED_HAZARD';
  const pipelineAreaKey = getPipelineAreaKey(type, waypoint);
  const remainingForSameArea = (await getAllDispatches()).some(other => {
    const otherWaypoint = {
      lat: other.gps_lat,
      lng: other.gps_lng,
      road: other.road_name,
      wardId: other.ward_id,
      wardName: other.ward_id,
      zone: '',
      speedKmph: 0
    } as RouteWaypoint;
    let otherType: VisionDetection['type'] = 'POTHOLE';
    if (other.type === 'ACCIDENT_POLICE_EMERGENCY') otherType = 'ACCIDENT';
    else if (other.type === 'TRAFFIC_CONGESTION_ALERT') otherType = 'TRAFFIC_JAM';
    else if (/waterlog/i.test(other.title) || other.severity === 'Critical Water-Logged Hazard') otherType = 'WATER_LOGGED_HAZARD';
    return getPipelineAreaKey(otherType, otherWaypoint) === pipelineAreaKey;
  });
  if (!remainingForSameArea) {
    dispatchedAreaLocks.delete(pipelineAreaKey);
    activeHazardClusters.delete(`${getPipeline(type)}:${getAreaKey(waypoint)}`);
  }
  logSystemEvent('WARN', 'DispatchHistory', `User deleted permanent dispatch ${id}. Remaining same-area record: ${remainingForSameArea ? 'yes' : 'no'}.`);
  return true;
}

export async function clearDispatchHistory(): Promise<number> {
  // This is the ONLY code path that intentionally deletes permanent
  // dispatch history. The UI calls it only after an explicit user action.
  const count = await clearAllDispatches();
  activeHazardClusters.clear();
  dispatchedAreaLocks.clear();
  dispatchInFlight.clear();
  logSystemEvent('WARN', 'DispatchHistory', `User explicitly deleted ${count} permanent dispatch record(s)`);
  return count;
}

export async function seedInitialEdgeData(): Promise<void> {
  try {
    // IMPORTANT: dispatch history is permanent. Never clear the SQLite
    // dispatch table on server startup. Rebuild the in-memory duplicate locks
    // from the persisted history instead.
    activeHazardClusters.clear();
    dispatchedAreaLocks.clear();
    dispatchInFlight.clear();

    const records = await getAllDispatches();
    for (const record of records) {
      const waypoint = {
        lat: record.gps_lat,
        lng: record.gps_lng,
        road: record.road_name,
        wardId: record.ward_id,
        wardName: record.ward_id,
        zone: '',
        speedKmph: 0
      } as RouteWaypoint;
      let type: VisionDetection['type'] = 'POTHOLE';
      if (record.type === 'ACCIDENT_POLICE_EMERGENCY') type = 'ACCIDENT';
      else if (record.type === 'TRAFFIC_CONGESTION_ALERT') type = 'TRAFFIC_JAM';
      else if (/waterlog/i.test(record.title) || record.severity === 'Critical Water-Logged Hazard') type = 'WATER_LOGGED_HAZARD';
      dispatchedAreaLocks.add(getPipelineAreaKey(type, waypoint));
    }

    logSystemEvent('INFO', 'Bootstrap', `CivicEye ready. Loaded ${records.length} permanent dispatch record(s); history was preserved.`);
  } catch (err: any) {
    console.error('[Bootstrap Exception]', err?.message);
  }
}

export async function createManualLetterDispatch(params: {
  department: string;
  title: string;
  roadName: string;
  wardId: string;
  severity: string;
  formalLetter: string;
  gpsLat?: number;
  gpsLng?: number;
}): Promise<DispatchRecord> {
  const now = new Date();
  const ticketRef = `CE-MANUAL-${now.getFullYear()}-${params.wardId.replace(/\s+/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
  const deliveryStatus: DispatchRecord['delivery_status'] = isCellularOnline ? '200_OK' : 'QUEUED_OFFLINE';

  const record: DispatchRecord = {
    id: ticketRef,
    type: 'POTHOLE_MUNICIPAL_COMPLAINT',
    department: params.department,
    title: params.title,
    severity: (params.severity as any) || 'Medium',
    ward_id: params.wardId,
    road_name: params.roadName,
    gps_lat: params.gpsLat ?? 17.3850,
    gps_lng: params.gpsLng ?? 78.4867,
    payload_json: JSON.stringify({
      platform: 'CivicEye',
      dispatch_mode: 'MANUAL_OFFICIAL_COMPLIANCE_LETTER',
      ticket_id: ticketRef,
      timestamp_utc: now.toISOString(),
      department: params.department,
      road_name: params.roadName,
      ward_id: params.wardId,
      statutory_letter: params.formalLetter
    }, null, 2),
    formal_letter: params.formalLetter,
    snapshot_image: undefined,
    delivery_status: deliveryStatus,
    created_at: now.toISOString(),
    synced_at: isCellularOnline ? now.toISOString() : undefined
  };

  await insertDispatch(record);
  logSystemEvent('SUCCESS', 'ManualLetterDispatch', `Manual formal letter dispatched to ${params.department} [${record.id}]`);
  return record;
}
