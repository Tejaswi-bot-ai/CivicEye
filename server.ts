import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { getAllDispatches, getQueuedOfflineDispatches, getSystemLogs, logSystemEvent } from './server/db.js';
import { 
  processDetectionAndDispatch, 
  processMultiDetectionsAndDispatch,
  getNetworkStatus, 
  setNetworkStatus, 
  syncOfflineCache, 
  seedInitialEdgeData,
  clearDispatchHistory,
  deleteDispatchHistory,
  createManualLetterDispatch,
  getNextWaypoint,
  getPredictiveHazards
} from './server/dispatcher.js';
import { URBAN_BUS_ROUTE } from './server/visionData.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for large payload handling (base64 image snapshots, JSON dockets)
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Restore permanent dispatch history and rebuild duplicate-prevention locks.
  await seedInitialEdgeData();

  // ----------------------------------------------------
  // API ROUTING
  // ----------------------------------------------------

  // 1. Health check
  app.get('/api/health', (req, res) => {
    try {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    } catch (e: any) {
      res.status(500).json({ error: e?.message });
    }
  });

  // 2. Edge Bus Telemetry & Diagnostics
  app.get('/api/status', (req, res) => {
    try {
      const net = getNetworkStatus();
      const currentWaypoint = URBAN_BUS_ROUTE[0];
      res.json({
        busId: net.busId,
        routeId: 'ROUTE-PUNE-METRO-47B',
        routeName: 'Swargate to Viman Nagar Tech Corridor',
        currentWaypoint,
        telemetry: {
          gpsLat: currentWaypoint.lat,
          gpsLng: currentWaypoint.lng,
          speedKmph: currentWaypoint.speedKmph,
          currentWard: currentWaypoint.wardId,
          wardName: currentWaypoint.wardName,
          zone: currentWaypoint.zone,
          roadName: currentWaypoint.road
        },
        edgeHardware: {
          socModel: 'NVIDIA Jetson Orin Nano (8GB)',
          aiInferenceEngine: 'TensorRT / YOLOv8-Seg FP16',
          inferenceFps: 29.4,
          inferenceLatencyMs: 27.8,
          cpuUsagePercent: 38,
          gpuUsagePercent: 64,
          deviceTempCelsius: 47.5,
          storageEdgeCache: 'offline_cache.db (SQLite 3.42)',
          cameraSensors: 'Dual Sony IMX390 HDR Automotive Stereo'
        },
        network: net
      });
    } catch (err: any) {
      logSystemEvent('ERROR', 'API_Status', `Status telemetry failed: ${err.message}`);
      res.status(500).json({ error: 'Internal telemetry error' });
    }
  });

  // Predictive hazard corridor for passenger/driver safety.
  // Uses GPS-tagged hazards already verified and dispatched by CivicEye.
  app.get('/api/hazard-intelligence', async (req, res) => {
    try {
      const lat = Number(req.query.lat);
      const lng = Number(req.query.lng);
      const radiusKm = Math.min(3, Math.max(0.5, Number(req.query.radiusKm) || 3));
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        res.status(400).json({ error: 'lat and lng are required' });
        return;
      }
      const hazards = await getPredictiveHazards({ lat, lng, road: '', wardId: '', wardName: '', zone: '', speedKmph: 0 }, radiusKm);
      res.json({ radiusKm, hazards });
    } catch (err: any) {
      logSystemEvent('ERROR', 'API_HazardIntelligence', `Predictive hazard lookup failed: ${err.message}`);
      res.status(500).json({ error: 'Predictive hazard lookup failed' });
    }
  });

  // 3. Retrieve All Dispatches & Messages
  app.get('/api/dispatches', async (req, res) => {
    try {
      const { type, department, status, search } = req.query;
      let records = await getAllDispatches();

      if (type && typeof type === 'string' && type !== 'ALL') {
        records = records.filter(r => r.type === type);
      }
      if (department && typeof department === 'string' && department !== 'ALL') {
        records = records.filter(r => r.department === department);
      }
      if (status && typeof status === 'string' && status !== 'ALL') {
        records = records.filter(r => r.delivery_status === status);
      }
      if (search && typeof search === 'string') {
        const query = search.toLowerCase();
        records = records.filter(r => 
          r.id.toLowerCase().includes(query) ||
          r.title.toLowerCase().includes(query) ||
          r.road_name.toLowerCase().includes(query) ||
          r.ward_id.toLowerCase().includes(query) ||
          (r.license_plate && r.license_plate.toLowerCase().includes(query))
        );
      }

      res.json(records);
    } catch (err: any) {
      logSystemEvent('ERROR', 'API_Dispatches', `Failed retrieving dispatches: ${err.message}`);
      res.status(500).json({ error: 'Failed to retrieve dispatches' });
    }
  });

  // 4. Retrieve Single Dispatch Details
  app.get('/api/dispatches/:id', async (req, res) => {
    try {
      const records = await getAllDispatches();
      const record = records.find(r => r.id === req.params.id);
      if (!record) {
        res.status(404).json({ error: 'Dispatch ticket not found' });
        return;
      }
      res.json(record);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5. Trigger Autonomous Edge Detection (Pothole, Waterlogged, Accident, Traffic Jam)
  app.post('/api/dispatches/trigger', async (req, res) => {
    try {
      const { detectionType, customValues, waypoint } = req.body;
      let detectionOverride: any = {};

      if (detectionType === 'ACCIDENT') {
        detectionOverride = {
          type: 'ACCIDENT',
          label: 'Vehicle Collision & Emergency Alert',
          severity: 'Severe Incident',
          triggerTimeSec: customValues?.triggerTimeSec || 1.84, // Sub-3s verification
          licensePlates: customValues?.licensePlates || ['MH-12-DE-8921', 'DL-01-AB-3429'],
          confidence: 0.988
        };
      } else if (detectionType === 'WATER_LOGGED_HAZARD') {
        detectionOverride = {
          type: 'WATER_LOGGED_HAZARD',
          label: 'Compound Water-Logged Hazard & Subgrade Depression',
          severity: 'Critical Water-Logged Hazard',
          depthCm: customValues?.depthCm || 9.4,
          areaSqM: customValues?.areaSqM || 1.68,
          confidence: 0.975
        };
      } else if (detectionType === 'POTHOLE') {
        detectionOverride = {
          type: 'POTHOLE',
          label: 'Bituminous Cavity Rupture',
          severity: customValues?.severity || 'Large',
          depthCm: customValues?.depthCm || 6.2,
          areaSqM: customValues?.areaSqM || 0.88,
          confidence: 0.954
        };
      } else if (detectionType === 'TRAFFIC_JAM') {
        detectionOverride = {
          type: 'TRAFFIC_JAM',
          label: 'Corridor Traffic Bottleneck & High Density',
          severity: 'High Congestion',
          vehicleCount: customValues?.vehicleCount || 24,
          avgSpeedKmph: customValues?.avgSpeedKmph || 4.2,
          confidence: 0.968
        };
      }

      const targetWaypoint = waypoint || getNextWaypoint();
      const record = await processDetectionAndDispatch(detectionOverride, targetWaypoint);
      res.json({ success: true, record });
    } catch (err: any) {
      logSystemEvent('ERROR', 'API_Trigger', `Trigger execution failed: ${err.message}`);
      res.status(500).json({ error: 'Trigger failed', message: err.message });
    }
  });

  // 5b. Trigger Multiple Autonomous Detections (Simultaneous Multi-Hazard Frame)
  app.post('/api/dispatches/trigger-multi', async (req, res) => {
    try {
      const { detections, waypoint } = req.body;
      if (!Array.isArray(detections) || detections.length === 0) {
        res.status(400).json({ error: 'detections array required' });
        return;
      }
      const targetWaypoint = waypoint || getNextWaypoint();
      const records = await processMultiDetectionsAndDispatch(detections, targetWaypoint);
      res.json({ success: true, records, count: records.length });
    } catch (err: any) {
      logSystemEvent('ERROR', 'API_TriggerMulti', `Multi-trigger failed: ${err.message}`);
      res.status(500).json({ error: 'Multi-trigger failed', message: err.message });
    }
  });

  // 5c. Purge/Clear All Dispatches (Clean Slate)
  app.delete('/api/dispatches/:id', async (req, res) => {
    try {
      const deleted = await deleteDispatchHistory(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: 'Dispatch not found' });
        return;
      }
      res.json({ success: true, id: req.params.id });
    } catch (err: any) {
      logSystemEvent('ERROR', 'API_DeleteDispatch', `Failed deleting dispatch: ${err.message}`);
      res.status(500).json({ error: 'Failed to delete dispatch' });
    }
  });

  app.post('/api/dispatches/clear', async (req, res) => {
    try {
      const cleared = await clearDispatchHistory();
      res.json({ success: true, count: cleared });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5d. Manual Formal Letter / Dispatch Creator
  app.post('/api/dispatches/manual-letter', async (req, res) => {
    try {
      const { department, title, roadName, wardId, severity, formalLetter, gpsLat, gpsLng } = req.body;
      if (!formalLetter || !department || !title) {
        res.status(400).json({ error: 'Department, title, and formal letter content are required' });
        return;
      }
      const record = await createManualLetterDispatch({
        department,
        title,
        roadName: roadName || 'Ward Corridor',
        wardId: wardId || 'Ward 12',
        severity: severity || 'Medium',
        formalLetter,
        gpsLat,
        gpsLng
      });
      res.json({ success: true, record });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 6. Network Carrier Link Toggle (Online vs Offline Simulation)
  app.post('/api/network/toggle', (req, res) => {
    try {
      const { online } = req.body;
      const newStatus = typeof online === 'boolean' ? online : !getNetworkStatus().isOnline;
      setNetworkStatus(newStatus);
      res.json({ success: true, network: getNetworkStatus() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 7. Auto-Sync Trigger: Bulk Upload from SQLite Edge Cache
  app.post('/api/network/sync', async (req, res) => {
    try {
      const result = await syncOfflineCache();
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 8. Self-Correction & System Logs
  app.get('/api/system/logs', async (req, res) => {
    try {
      const logs = await getSystemLogs(80);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 9. Aggregated Metrics & Stats
  app.get('/api/stats', async (req, res) => {
    try {
      const records = await getAllDispatches();
      const queued = await getQueuedOfflineDispatches();
      const accidents = records.filter(r => r.type === 'ACCIDENT_POLICE_EMERGENCY');
      const potholes = records.filter(r => r.type === 'POTHOLE_MUNICIPAL_COMPLAINT');
      const waterlogged = records.filter(r => r.severity === 'Critical Water-Logged Hazard');
      const trafficJams = records.filter(r => r.type === 'TRAFFIC_CONGESTION_ALERT');

      res.json({
        totalDetections: records.length,
        accidentsCount: accidents.length,
        potholesCount: potholes.length,
        waterloggedHazardsCount: waterlogged.length,
        trafficJamsCount: trafficJams.length,
        offlineQueuedCount: queued.length,
        avgAccidentTriggerSec: 1.82,
        ircComplianceLettersGenerated: potholes.length,
        network: getNetworkStatus()
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 10. Available Waypoints for interactive route simulation
  app.get('/api/routes/waypoints', (req, res) => {
    res.json(URBAN_BUS_ROUTE);
  });

  // ----------------------------------------------------
  // VITE MIDDLEWARE / STATIC FILES
  // ----------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[CivicEye AI] On-Bus Edge Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[MuniEdge AI Fatal Startup Error]', err);
});
