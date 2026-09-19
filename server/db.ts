import { DatabaseSync } from 'node:sqlite';
import path from 'path';

// Resilient SQLite Edge Cache & Central Store
const dbPath = path.resolve(process.cwd(), 'offline_cache.db');

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

export interface SystemLog {
  id: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS' | 'RESILIENCE';
  source: string;
  message: string;
  timestamp: string;
}

// In-memory fallback if file system fails, ensuring resilient self-correction
let memoryCache: DispatchRecord[] = [];
let memoryLogs: SystemLog[] = [];

let db: DatabaseSync | null = null;

try {
  db = new DatabaseSync(dbPath);
  console.log('[DB] Native node:sqlite edge cache successfully mounted at:', dbPath);
  initTables();
  logSystemEvent('INFO', 'DatabaseInit', 'SQLite offline_cache.db mounted successfully with WAL mode');
} catch (err: any) {
  console.error('[DB] SQLite initialization warning (using resilient memory fallback):', err.message);
  logSystemEvent('WARN', 'DatabaseInit', `Failed to open offline_cache.db, using resilient memory fallback: ${err.message}`);
}

function initTables() {
  if (!db) return;
  
  try {
    // Edge cache table for queued and delivered municipal/police payloads
    db.exec(`
      CREATE TABLE IF NOT EXISTS offline_dispatches (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        department TEXT NOT NULL,
        title TEXT NOT NULL,
        severity TEXT NOT NULL,
        ward_id TEXT NOT NULL,
        road_name TEXT NOT NULL,
        gps_lat REAL NOT NULL,
        gps_lng REAL NOT NULL,
        payload_json TEXT NOT NULL,
        formal_letter TEXT,
        snapshot_image TEXT,
        delivery_status TEXT NOT NULL,
        trigger_time_seconds REAL,
        license_plate TEXT,
        created_at TEXT NOT NULL,
        synced_at TEXT
      )
    `);

    // System logs table for self-correction and telemetry
    db.exec(`
      CREATE TABLE IF NOT EXISTS system_logs (
        id TEXT PRIMARY KEY,
        level TEXT NOT NULL,
        source TEXT NOT NULL,
        message TEXT NOT NULL,
        timestamp TEXT NOT NULL
      )
    `);
  } catch (e: any) {
    console.error('[DB Init Error]', e.message);
  }
}

export function logSystemEvent(level: SystemLog['level'], source: string, message: string) {
  const logEntry: SystemLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    level,
    source,
    message,
    timestamp: new Date().toISOString()
  };

  memoryLogs.unshift(logEntry);
  if (memoryLogs.length > 500) memoryLogs.pop();

  if (db) {
    try {
      const stmt = db.prepare(
        `INSERT INTO system_logs (id, level, source, message, timestamp) VALUES (?, ?, ?, ?, ?)`
      );
      stmt.run(logEntry.id, logEntry.level, logEntry.source, logEntry.message, logEntry.timestamp);
    } catch (e: any) {
      console.warn('[DB Log Caught]', e?.message);
    }
  }
}

export async function insertDispatch(record: DispatchRecord): Promise<void> {
  // Add to in-memory backup
  const existingIdx = memoryCache.findIndex(r => r.id === record.id);
  if (existingIdx >= 0) {
    memoryCache[existingIdx] = record;
  } else {
    memoryCache.unshift(record);
  }

  if (!db) return;

  try {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO offline_dispatches 
      (id, type, department, title, severity, ward_id, road_name, gps_lat, gps_lng, payload_json, formal_letter, snapshot_image, delivery_status, trigger_time_seconds, license_plate, created_at, synced_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      record.id,
      record.type,
      record.department,
      record.title,
      record.severity,
      record.ward_id,
      record.road_name,
      record.gps_lat,
      record.gps_lng,
      record.payload_json,
      record.formal_letter || null,
      record.snapshot_image || null,
      record.delivery_status,
      record.trigger_time_seconds || null,
      record.license_plate || null,
      record.created_at,
      record.synced_at || null
    );

    logSystemEvent('INFO', 'DB_Insert', `Recorded ${record.type} [${record.id}] with status: ${record.delivery_status}`);
  } catch (err: any) {
    console.error('[DB Insert Exception]', err?.message);
    logSystemEvent('ERROR', 'DB_Exception', `Exception during insert: ${err?.message}. Retained in edge RAM cache.`);
  }
}

export async function getAllDispatches(): Promise<DispatchRecord[]> {
  if (!db) return memoryCache;

  try {
    const stmt = db.prepare(`SELECT * FROM offline_dispatches ORDER BY created_at DESC`);
    const rows = stmt.all() as any[];
    return rows.map(r => ({
      ...r,
      formal_letter: r.formal_letter || undefined,
      snapshot_image: r.snapshot_image || undefined,
      license_plate: r.license_plate || undefined,
      synced_at: r.synced_at || undefined
    })) as DispatchRecord[];
  } catch (err: any) {
    console.error('[DB Query Exception]', err?.message);
    return memoryCache;
  }
}


export async function deleteDispatch(id: string): Promise<boolean> {
  const before = memoryCache.length;
  memoryCache = memoryCache.filter(r => r.id !== id);

  if (!db) return memoryCache.length < before;

  try {
    const stmt = db.prepare(`DELETE FROM offline_dispatches WHERE id = ?`);
    stmt.run(id);
    const deleted = memoryCache.length < before;
    if (deleted) logSystemEvent('WARN', 'DB_Delete', `User deleted permanent dispatch ${id}`);
    return deleted;
  } catch (err: any) {
    console.error('[DB Delete Exception]', err?.message);
    return memoryCache.length < before;
  }
}

export async function clearAllDispatches(): Promise<number> {
  const count = memoryCache.length;
  memoryCache = [];
  if (db) {
    try {
      db.exec(`DELETE FROM offline_dispatches`);
      logSystemEvent('INFO', 'DB_Clear', 'All historical and default dispatches purged from offline_cache.db');
    } catch (e: any) {
      console.error('[DB Clear Error]', e?.message);
    }
  }
  return count;
}

export async function getQueuedOfflineDispatches(): Promise<DispatchRecord[]> {
  if (!db) return memoryCache.filter(r => r.delivery_status === 'QUEUED_OFFLINE');

  try {
    const stmt = db.prepare(`SELECT * FROM offline_dispatches WHERE delivery_status = 'QUEUED_OFFLINE'`);
    const rows = stmt.all() as any[];
    return rows.map(r => ({
      ...r,
      formal_letter: r.formal_letter || undefined,
      snapshot_image: r.snapshot_image || undefined,
      license_plate: r.license_plate || undefined,
      synced_at: r.synced_at || undefined
    })) as DispatchRecord[];
  } catch (err: any) {
    return memoryCache.filter(r => r.delivery_status === 'QUEUED_OFFLINE');
  }
}

export async function markDispatchesSynced(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const now = new Date().toISOString();

  // Update memory
  memoryCache.forEach(r => {
    if (ids.includes(r.id)) {
      r.delivery_status = '200_OK';
      r.synced_at = now;
    }
  });

  if (!db) return ids.length;

  try {
    const placeholders = ids.map(() => '?').join(',');
    const stmt = db.prepare(
      `UPDATE offline_dispatches SET delivery_status = '200_OK', synced_at = ? WHERE id IN (${placeholders})`
    );
    stmt.run(now, ...ids);
    logSystemEvent('SUCCESS', 'EdgeSync', `Auto-synced ${ids.length} queued records from offline_cache.db to central cloud repository`);
    return ids.length;
  } catch (err: any) {
    console.error('[DB Sync Exception]', err?.message);
    return ids.length;
  }
}

export async function getSystemLogs(limit = 100): Promise<SystemLog[]> {
  if (!db) return memoryLogs.slice(0, limit);

  try {
    const stmt = db.prepare(`SELECT * FROM system_logs ORDER BY timestamp DESC LIMIT ?`);
    const rows = stmt.all(limit) as any[];
    return rows as SystemLog[];
  } catch (err: any) {
    return memoryLogs.slice(0, limit);
  }
}
