import React, { useState } from 'react';
import { 
  Search, 
  FileText, 
  ShieldAlert, 
  Car, 
  Droplets, 
  Clock, 
  Database,
  RefreshCw,
  Eye,
  AlertTriangle,
  ArrowUpRight,
  PenTool,
  Trash2
} from 'lucide-react';
import { DispatchRecord } from '../types';

interface MessagesDispatchLogProps {
  dispatches: DispatchRecord[];
  onSelectDispatch: (dispatch: DispatchRecord) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  onOpenManualLetter?: () => void;
  onClearDispatches?: () => void;
  onDeleteDispatch?: (id: string) => void;
}

export const MessagesDispatchLog: React.FC<MessagesDispatchLogProps> = ({
  dispatches,
  onSelectDispatch,
  onRefresh,
  isRefreshing,
  onOpenManualLetter,
  onClearDispatches,
  onDeleteDispatch
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'MUNICIPAL' | 'POLICE' | 'TRAFFIC' | 'OFFLINE'>('ALL');

  const deleteOne = (id: string) => {
    if (!onDeleteDispatch) return;
    if (window.confirm(`Delete permanent dispatch ${id}? This removes only this official message.`)) {
      onDeleteDispatch(id);
    }
  };

  // Filter & Search Logic
  const filteredDispatches = dispatches.filter(d => {
    // Filter matching
    if (selectedFilter === 'MUNICIPAL' && d.type !== 'POTHOLE_MUNICIPAL_COMPLAINT') return false;
    if (selectedFilter === 'POLICE' && d.type !== 'ACCIDENT_POLICE_EMERGENCY') return false;
    if (selectedFilter === 'TRAFFIC' && d.type !== 'TRAFFIC_CONGESTION_ALERT') return false;
    if (selectedFilter === 'OFFLINE' && d.delivery_status !== 'QUEUED_OFFLINE') return false;

    // Search matching
    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase();
      const matchId = d.id.toLowerCase().includes(q);
      const matchTitle = d.title.toLowerCase().includes(q);
      const matchRoad = d.road_name.toLowerCase().includes(q);
      const matchWard = d.ward_id.toLowerCase().includes(q);
      const matchPlate = d.license_plate ? d.license_plate.toLowerCase().includes(q) : false;
      return matchId || matchTitle || matchRoad || matchWard || matchPlate;
    }

    return true;
  });

  const municipalCount = dispatches.filter(d => d.type === 'POTHOLE_MUNICIPAL_COMPLAINT').length;
  const policeCount = dispatches.filter(d => d.type === 'ACCIDENT_POLICE_EMERGENCY').length;
  const trafficCount = dispatches.filter(d => d.type === 'TRAFFIC_CONGESTION_ALERT').length;
  const offlineCount = dispatches.filter(d => d.delivery_status === 'QUEUED_OFFLINE').length;

  return (
    <div className="space-y-6">
      {/* Top Metric Cards (Material Design 3 Elevated Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/80 p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-semibold">Total Dispatches</span>
            <FileText className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 tracking-tight">{dispatches.length}</span>
            <span className="text-xs text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">100% Autonomous</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Multi-Department System</p>
        </div>

        <div className="bg-white border border-slate-200/80 p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-semibold">Police 112 Requisitions</span>
            <ShieldAlert className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-700 tracking-tight">{policeCount}</span>
            <span className="text-xs text-rose-700 font-mono font-bold bg-rose-50 px-1.5 py-0.5 rounded">&lt; 3.0s Latency</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">ANPR & Collision Extraction</p>
        </div>

        <div className="bg-white border border-slate-200/80 p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-semibold">IRC Compliance Notices</span>
            <Droplets className="w-4 h-4 text-sky-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-sky-800 tracking-tight">{municipalCount}</span>
            <span className="text-xs text-sky-800 font-bold bg-sky-50 px-1.5 py-0.5 rounded">IRC:82 Formals</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Sent to Ward Exec Engineer</p>
        </div>

        <div className="bg-white border border-slate-200/80 p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-semibold">SQLite Edge Cache</span>
            <Database className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-800 tracking-tight">{offlineCount}</span>
            <span className="text-xs text-amber-800 font-mono font-bold bg-amber-50 px-1.5 py-0.5 rounded">offline_cache.db</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Pending Cloud Upload</p>
        </div>
      </div>

      {/* Main Filter & Search Control Panel */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Docket ID, Ward, Road Name, License Plate..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2">
            {onOpenManualLetter && (
              <button
                onClick={onOpenManualLetter}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all shadow-xs"
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>Compose Letter</span>
              </button>
            )}

            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all border border-slate-300"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            {onClearDispatches && dispatches.length > 0 && (
              <button
                onClick={onClearDispatches}
                className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 text-xs font-semibold border border-slate-300 hover:border-rose-200 transition-all"
                title="Clear all dispatches"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Chips (Material 3 Segmented Chips) */}
        <div className="flex flex-wrap items-center gap-2 text-xs pt-1 border-t border-slate-100">
          <button
            onClick={() => setSelectedFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              selectedFilter === 'ALL'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            All Messages ({dispatches.length})
          </button>

          <button
            onClick={() => setSelectedFilter('MUNICIPAL')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
              selectedFilter === 'MUNICIPAL'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Municipal Formal Notices ({municipalCount})</span>
          </button>

          <button
            onClick={() => setSelectedFilter('POLICE')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
              selectedFilter === 'POLICE'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Police 112 SOS ({policeCount})</span>
          </button>

          <button
            onClick={() => setSelectedFilter('TRAFFIC')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
              selectedFilter === 'TRAFFIC'
                ? 'bg-yellow-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <Car className="w-3.5 h-3.5" />
            <span>ITMS Traffic Jams ({trafficCount})</span>
          </button>

          <button
            onClick={() => setSelectedFilter('OFFLINE')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
              selectedFilter === 'OFFLINE'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Cached in SQLite ({offlineCount})</span>
          </button>
        </div>
      </div>

      {/* Dispatches List / Table */}
      <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600 font-semibold">
          <span>Automated Dispatch Records ({filteredDispatches.length} items)</span>
          <span>Click any entry to view IRC statutory letter & raw JSON payload</span>
        </div>

        {filteredDispatches.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-medium">No messages found matching the selected filter</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredDispatches.map((record) => {
              const isAccident = record.type === 'ACCIDENT_POLICE_EMERGENCY';
              const isWaterLogged = record.severity === 'Critical Water-Logged Hazard';
              const isPothole = record.type === 'POTHOLE_MUNICIPAL_COMPLAINT';

              return (
                <div
                  key={record.id}
                  onClick={() => onSelectDispatch(record)}
                  className="p-4 sm:px-6 hover:bg-slate-50 cursor-pointer transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <div className={`w-9 h-9 rounded-lg shrink-0 flex items-center justify-center font-bold text-white shadow-xs ${
                      isAccident ? 'bg-rose-600' : isWaterLogged ? 'bg-sky-600' : isPothole ? 'bg-amber-600' : 'bg-yellow-600'
                    }`}>
                      {isAccident ? <ShieldAlert className="w-5 h-5" /> : isWaterLogged ? <Droplets className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-blue-700">
                          {record.id}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
                          record.delivery_status === '200_OK' 
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-300' 
                            : 'bg-amber-50 text-amber-800 border border-amber-300'
                        }`}>
                          {record.delivery_status === '200_OK' ? '200 OK (DELIVERED)' : 'QUEUED IN SQLITE'}
                        </span>
                        {record.trigger_time_seconds && (
                          <span className="bg-rose-50 text-rose-800 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border border-rose-300">
                            {record.trigger_time_seconds.toFixed(2)}s S.O.S.
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-bold text-slate-900 truncate mt-1">
                        {record.title}
                      </h4>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                        <span>To: <strong className="text-slate-800">{record.department}</strong></span>
                        <span>•</span>
                        <span>{record.ward_id} ({record.road_name})</span>
                        <span>•</span>
                        <span className="font-mono">{new Date(record.created_at).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions / Badges */}
                  <div className="flex items-center gap-2 sm:self-center">
                    {record.formal_letter && (
                      <span className="bg-sky-50 text-sky-800 border border-sky-200 text-[11px] font-semibold px-2 py-1 rounded hidden md:inline-block">
                        Formal IRC Letter Attached
                      </span>
                    )}
                    {onDeleteDispatch && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteOne(record.id);
                        }}
                        className="bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-700 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 border border-slate-200 hover:border-rose-200 transition-all"
                        title="Delete only this permanent dispatch"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectDispatch(record);
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-xs transition-all"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{record.formal_letter ? 'View Letter' : 'View Snapshot & Evidence'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
