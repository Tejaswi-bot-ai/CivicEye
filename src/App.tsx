/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { LiveVisionFeed } from './components/LiveVisionFeed';
import { LiveRouteMap } from './components/LiveRouteMap';
import { MessagesDispatchLog } from './components/MessagesDispatchLog';
import { TriggeredEventsTab } from './components/TriggeredEventsTab';
import { ManualLetterModal } from './components/ManualLetterModal';
import { DispatchDetailModal } from './components/DispatchDetailModal';
import { DispatchRecord, DashboardStats, EdgeTelemetry, TriggeredDetection } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'vision' | 'triggered' | 'dispatches'>('vision');
  const [dispatches, setDispatches] = useState<DispatchRecord[]>([]);
  const TRIGGER_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
  const MAX_TRIGGERED_EVENTS = 2000;
  const [triggeredEvents, setTriggeredEvents] = useState<TriggeredDetection[]>(() => {
    try {
      const raw = localStorage.getItem('civiceye_triggered_events_v2');
      if (!raw) return [];
      const saved = JSON.parse(raw) as TriggeredDetection[];
      const cutoff = Date.now() - TRIGGER_RETENTION_MS;
      return saved.filter(e => new Date(e.detected_at).getTime() >= cutoff);
    } catch {
      return [];
    }
  });
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [telemetry, setTelemetry] = useState<EdgeTelemetry | null>(null);
  const [selectedDispatch, setSelectedDispatch] = useState<DispatchRecord | null>(null);
  const [isManualLetterModalOpen, setIsManualLetterModalOpen] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Fetch telemetry & status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        setTelemetry(data);
      }
    } catch (err) {
      console.warn('Status fetch error:', err);
    }
  }, []);

  // Fetch dispatches
  const fetchDispatches = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/dispatches');
      if (res.ok) {
        const data = await res.json();
        setDispatches(data);
      }
    } catch (err) {
      console.warn('Dispatches fetch error:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Fetch aggregated stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.warn('Stats fetch error:', err);
    }
  }, []);

  // Initial load & periodic polling
  useEffect(() => {
    fetchStatus();
    fetchDispatches();
    fetchStats();

    const interval = setInterval(() => {
      fetchStatus();
      fetchDispatches();
      fetchStats();
    }, 4000);

    return () => clearInterval(interval);
  }, [fetchStatus, fetchDispatches, fetchStats]);

  // Network Toggle (Cellular 5G vs Offline SQLite Edge Cache)
  const handleToggleNetwork = async () => {
    try {
      const res = await fetch('/api/network/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (res.ok) {
        await fetchStatus();
        await fetchStats();
      }
    } catch (err) {
      console.error('Toggle network error:', err);
    }
  };

  // Sync Offline SQLite Cache to Cloud
  const handleSyncOffline = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/network/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (res.ok) {
        await fetchDispatches();
        await fetchStats();
      }
    } catch (err) {
      console.error('Sync offline cache error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Clear all dispatches
  const handleClearDispatches = async () => {
    try {
      const res = await fetch('/api/dispatches/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        // Explicit delete affects ONLY permanent dispatch history.
        // Triggered events have their own 7-day automatic retention.
        setDispatches([]);
        fetchStats();
      }
    } catch (err) {
      console.error('Clear dispatches error:', err);
    }
  };

  const handleDetectionObserved = (detection: any, waypoint: any) => {
    const event: TriggeredDetection = {
      id: `${detection.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: detection.type === 'WATER_LOGGED' ? 'WATER_LOGGED_HAZARD' : detection.type === 'TRAFFIC' ? 'TRAFFIC_JAM' : detection.type,
      label: detection.label,
      severity: detection.severity,
      confidence: detection.confidence,
      contour: detection.contour,
      boundingBox: { x: detection.boundingBox.x, y: detection.boundingBox.y, width: detection.boundingBox.w, height: detection.boundingBox.h },
      depthCm: detection.depthCm,
      areaSqM: detection.areaSqM,
      licensePlates: detection.licensePlate ? [detection.licensePlate] : undefined,
      vehicleCount: detection.vehicleCount,
      avgSpeedKmph: detection.avgSpeedKmph,
      triggerTimeSec: detection.triggerSec,
      description: detection.label,
      snapshotDataUrl: undefined,
      detected_at: new Date().toISOString(),
      road_name: waypoint?.road || 'Unknown road',
      ward_id: waypoint?.wardId || 'Unknown ward',
      gps_lat: waypoint?.lat || 0,
      gps_lng: waypoint?.lng || 0,
      estimatedDistanceM: detection.estimatedDistanceM,
      dispatchStatus: 'PENDING'
    };

    setTriggeredEvents(prev => {
      const cutoff = Date.now() - TRIGGER_RETENTION_MS;
      // Triggered history is temporary: keep the last 7 days only.
      // There is intentionally NO 100-item cap; 100+ detections continue to
      // appear while the automatic retention handles cleanup.
      const retained = [event, ...prev.filter(e => new Date(e.detected_at).getTime() >= cutoff)];
      return retained.slice(0, MAX_TRIGGERED_EVENTS);
    });
  };

  const handleDeleteTriggered = (id: string) => setTriggeredEvents(prev => prev.filter(e => e.id !== id));

  const handleClearTriggered = () => {
    if (window.confirm('Delete all temporary Triggered Events? Permanent dispatch messages will remain.')) setTriggeredEvents([]);
  };

  const handleDetectionTriggered = (newRecord: DispatchRecord) => {
    setDispatches(prev => {
      if (prev.some(r => r.id === newRecord.id)) return prev;
      return [newRecord, ...prev];
    });
    setTriggeredEvents(prev => {
      const targetType = newRecord.type === 'ACCIDENT_POLICE_EMERGENCY'
        ? 'ACCIDENT'
        : newRecord.type === 'TRAFFIC_CONGESTION_ALERT'
          ? 'TRAFFIC_JAM'
          : (newRecord.severity === 'Critical Water-Logged Hazard' ? 'WATER_LOGGED_HAZARD' : 'POTHOLE');
      const index = prev.findIndex(e => e.type === targetType && e.dispatchStatus === 'PENDING');
      if (index < 0) return prev;
      const copy = [...prev];
      copy[index] = { ...copy[index], dispatchStatus: 'DISPATCHED' };
      return copy;
    });
    fetchStats();
  };

  const handleDeleteDispatch = async (id: string) => {
    try {
      const res = await fetch(`/api/dispatches/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.ok) {
        setDispatches(prev => prev.filter(r => r.id !== id));
        if (selectedDispatch?.id === id) setSelectedDispatch(null);
        await fetchStats();
      }
    } catch (err) {
      console.error('Delete dispatch error:', err);
    }
  };

  const handleManualLetterCreated = (newRecord: DispatchRecord) => {
    setDispatches(prev => prev.some(r => r.id === newRecord.id) ? prev : [newRecord, ...prev]);
    fetchStats();
  };

  // Persist triggered events locally so a refresh does not erase the temporary
  // history. Every 10 minutes, remove entries older than 7 days automatically.
  useEffect(() => {
    const cleanup = () => {
      const cutoff = Date.now() - TRIGGER_RETENTION_MS;
      setTriggeredEvents(prev => prev.filter(e => new Date(e.detected_at).getTime() >= cutoff));
    };
    cleanup();
    const timer = window.setInterval(cleanup, 10 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('civiceye_triggered_events_v2', JSON.stringify(triggeredEvents));
    } catch {
      // UI continues even if browser storage is unavailable.
    }
  }, [triggeredEvents]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Header with Navigation & Network Simulator */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        stats={stats}
        onToggleNetwork={handleToggleNetwork}
        onSyncOffline={handleSyncOffline}
        isSyncing={isSyncing}
        triggeredCount={triggeredEvents.length}
        dispatchCount={dispatches.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'vision' && (
          <div className="space-y-6">
            {/* Live Video Feed with Contour Polygon Segmentation & Interactive Controls */}
            <LiveVisionFeed
              currentWaypoint={telemetry?.currentWaypoint || null}
              onDetectionTriggered={handleDetectionTriggered}
              onDetectionObserved={handleDetectionObserved}
              onNavigateToDispatches={() => setActiveTab('triggered')}
            />

            {/* Real-Time GPS Route Map with Hazard Markers */}
            <LiveRouteMap
              currentWaypoint={telemetry?.currentWaypoint || null}
              dispatches={dispatches}
              onSelectDispatch={(record) => setSelectedDispatch(record)}
            />
          </div>
        )}

        {activeTab === 'triggered' && (
          <TriggeredEventsTab
            dispatches={dispatches}
            triggeredEvents={triggeredEvents}
            onSelectDispatch={(record) => setSelectedDispatch(record)}
            onOpenManualLetter={() => setIsManualLetterModalOpen(true)}
            onClearDispatches={handleClearDispatches}
            onDeleteDispatch={handleDeleteDispatch}
            onDeleteTriggered={handleDeleteTriggered}
            onClearTriggered={handleClearTriggered}
          />
        )}

        {activeTab === 'dispatches' && (
          <MessagesDispatchLog
            dispatches={dispatches}
            onSelectDispatch={(record) => setSelectedDispatch(record)}
            onRefresh={fetchDispatches}
            isRefreshing={isRefreshing}
            onDeleteDispatch={handleDeleteDispatch}
            onOpenManualLetter={() => setIsManualLetterModalOpen(true)}
            onClearDispatches={handleClearDispatches}
          />
        )}
      </main>

      {/* Comprehensive Dispatch Detail Modal */}
      <DispatchDetailModal
        dispatch={selectedDispatch}
        onClose={() => setSelectedDispatch(null)}
      />

      {/* Manual Formal Letter Modal */}
      <ManualLetterModal
        isOpen={isManualLetterModalOpen}
        onClose={() => setIsManualLetterModalOpen(false)}
        onLetterCreated={handleManualLetterCreated}
      />

      {/* Clean Modern Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold text-slate-700">
            CivicEye Vision • Real-Time Road Anomaly Detection & Autonomous Compliance
          </span>
          <span className="font-mono text-slate-500">
            Jetson Edge Core • Discrete Polygon Segmentation • IRC:82 / IRC:SP:20 Compliance
          </span>
        </div>
      </footer>
    </div>
  );
}
