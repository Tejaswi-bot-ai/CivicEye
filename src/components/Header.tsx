import React from 'react';
import { 
  Bus, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Video, 
  FileText, 
  Zap,
  Radio
} from 'lucide-react';
import { DashboardStats } from '../types';

interface HeaderProps {
  activeTab: 'vision' | 'triggered' | 'dispatches';
  setActiveTab: (tab: 'vision' | 'triggered' | 'dispatches') => void;
  stats: DashboardStats | null;
  onToggleNetwork: () => void;
  onSyncOffline: () => void;
  isSyncing: boolean;
  triggeredCount?: number;
  dispatchCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  stats,
  onToggleNetwork,
  onSyncOffline,
  isSyncing,
  triggeredCount = 0,
  dispatchCount = 0
}) => {
  const isOnline = stats?.network.isOnline ?? true;
  const queuedCount = stats?.offlineQueuedCount ?? 0;
  const totalCount = stats?.totalDetections ?? 0;

  return (
    <header className="bg-white border-b border-slate-200/80 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Cool Minimalist Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
            <Radio className="w-5 h-5 text-blue-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 tracking-tight">
                CivicEye
              </h1>
              <span className="bg-slate-100 text-slate-600 text-[10px] font-mono px-2 py-0.5 rounded-full border border-slate-200 font-semibold">
                BUS-8402
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Live Vision Anomaly Engine & Autonomous Dispatch
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/80">
          <button
            onClick={() => setActiveTab('vision')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'vision'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Live Vision & Map</span>
          </button>

          <button
            onClick={() => setActiveTab('triggered')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all relative ${
              activeTab === 'triggered'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Triggered</span>
            {triggeredCount > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                activeTab === 'triggered' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'
              }`}>
                {triggeredCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('dispatches')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all relative ${
              activeTab === 'dispatches'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Messages / Dispatches</span>
            {dispatchCount > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                activeTab === 'dispatches' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-700'
              }`}>
                {dispatchCount}
              </span>
            )}
          </button>
        </nav>

        {/* Network Carrier Status */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleNetwork}
            title="Toggle carrier link to test offline SQLite caching"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
              isOnline 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100' 
                : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
            }`}
          >
            {isOnline ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                <span>5G Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-rose-600" />
                <span>Offline Cache</span>
              </>
            )}
          </button>

          {queuedCount > 0 && (
            <button
              onClick={onSyncOffline}
              disabled={!isOnline || isSyncing}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
                !isOnline
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                  : 'bg-amber-600 hover:bg-amber-700 text-white'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>
                {isSyncing ? 'Syncing...' : `Sync (${queuedCount})`}
              </span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

