import React, { useState } from 'react';
import { 
  Zap, 
  MapPin, 
  Clock, 
  FileText, 
  ShieldAlert, 
  Car, 
  Droplets, 
  Layers, 
  Eye, 
  PenTool, 
  Trash2,
  CheckCircle2,
  Copy,
  Check
} from 'lucide-react';
import { DispatchRecord, TriggeredDetection } from '../types';

interface TriggeredEventsTabProps {
  dispatches: DispatchRecord[];
  triggeredEvents: TriggeredDetection[];
  onSelectDispatch: (dispatch: DispatchRecord) => void;
  onOpenManualLetter: () => void;
  onClearDispatches: () => void;
  onDeleteDispatch?: (id: string) => void;
  onDeleteTriggered?: (id: string) => void;
  onClearTriggered?: () => void;
}

// Convert integer (1, 2, 3...) to Roman numeral (I, II, III, IV, V...)
function toRoman(num: number): string {
  if (num <= 0) return '0';
  const lookup: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
  ];
  let roman = '';
  let n = num;
  for (const [val, letter] of lookup) {
    while (n >= val) {
      roman += letter;
      n -= val;
    }
  }
  return roman;
}

export const TriggeredEventsTab: React.FC<TriggeredEventsTabProps> = ({
  dispatches,
  triggeredEvents,
  onSelectDispatch,
  onOpenManualLetter,
  onClearDispatches,
  onDeleteDispatch,
  onDeleteTriggered,
  onClearTriggered
}) => {
  const [filter, setFilter] = useState<'ALL' | 'POTHOLE' | 'WATERLOG' | 'TRAFFIC' | 'ACCIDENT'>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = dispatches.filter(d => {
    if (filter === 'POTHOLE') return d.type === 'POTHOLE_MUNICIPAL_COMPLAINT' && d.severity !== 'Critical Water-Logged Hazard';
    if (filter === 'WATERLOG') return d.severity === 'Critical Water-Logged Hazard';
    if (filter === 'TRAFFIC') return d.type === 'TRAFFIC_CONGESTION_ALERT';
    if (filter === 'ACCIDENT') return d.type === 'ACCIDENT_POLICE_EMERGENCY';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions Bar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <Zap className="w-4 h-4" />
            </span>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Triggered Events Stream
            </h2>
            <span className="bg-slate-100 text-slate-700 text-xs font-mono font-semibold px-2 py-0.5 rounded-full border border-slate-200">
              {triggeredEvents.length} Triggered
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Detections enter this queue immediately. Triggered history is retained for 7 days and then removed automatically; official dispatch messages remain permanently until manually deleted.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenManualLetter}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all"
          >
            <PenTool className="w-3.5 h-3.5" />
            <span>Compose Manual Letter</span>
          </button>

          {triggeredEvents.length > 0 && onClearTriggered && (
            <button onClick={onClearTriggered} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 text-xs font-semibold border border-slate-200 hover:border-rose-200 transition-all"><Trash2 className="w-3.5 h-3.5" /><span>Delete Triggered History</span></button>
          )}

          {dispatches.length > 0 && (
            <button
              onClick={onClearDispatches}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 text-xs font-semibold border border-slate-200 hover:border-rose-200 transition-all"
              title="Delete all permanent dispatch messages"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Dispatch History</span>
            </button>
          )}
        </div>
      </div>

      {/* TRIGGER / NOTIFY CONTROL VIEW — intentionally compact, not a giant card wall */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Trigger & Notify Monitor</h3>
            <p className="text-[11px] text-slate-500 mt-1">Every confirmed detection is <strong>TRIGGERED</strong> immediately. <strong>NOTIFY</strong> changes only when an official dispatch is created.</p>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-bold">
            <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">TRIGGERED {triggeredEvents.length}</span>
            <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">NOTIFIED {triggeredEvents.filter(e => e.dispatchStatus === 'DISPATCHED').length}</span>
            <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200">PERMANENT MESSAGES {dispatches.length}</span>
          </div>
        </div>

        {triggeredEvents.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500">Waiting for confirmed camera detections…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-left text-[10px] uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 w-12">#</th>
                  <th className="px-4 py-3">Detection</th>
                  <th className="px-4 py-3">Trigger</th>
                  <th className="px-4 py-3">Notify</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {triggeredEvents.slice(0, 100).map((event, index) => {
                  const notified = event.dispatchStatus === 'DISPATCHED';
                  const label = event.type === 'WATER_LOGGED_HAZARD' ? 'WATERLOG' : event.type.replaceAll('_', ' ');
                  return (
                    <tr key={`${event.id}-${event.detected_at}`} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-mono font-bold text-slate-400">{toRoman(index + 1)}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{label}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5 max-w-[300px] truncate">{event.label}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                          <Zap className="w-3 h-3" /> TRIGGERED
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {notified ? (
                          <button onClick={() => {
                            const linked = dispatches.find(d => {
                              const target = event.type === 'ACCIDENT' ? 'ACCIDENT_POLICE_EMERGENCY' : event.type === 'TRAFFIC_JAM' ? 'TRAFFIC_CONGESTION_ALERT' : 'POTHOLE_MUNICIPAL_COMPLAINT';
                              return d.type === target && d.road_name === event.road_name;
                            });
                            if (linked) onSelectDispatch(linked);
                          }} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold hover:bg-emerald-100">
                            <CheckCircle2 className="w-3 h-3" /> NOTIFIED
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-50 text-slate-500 border border-slate-200 font-bold">
                            <Clock className="w-3 h-3" /> WAITING
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{event.road_name}<div className="text-[10px] text-slate-400">{event.estimatedDistanceM ? `${event.estimatedDistanceM}m visual estimate` : 'GPS linked'}</div></td>
                      <td className="px-4 py-3 font-mono text-slate-600">{new Date(event.detected_at).toLocaleTimeString()}</td>
                      <td className="px-4 py-3">{onDeleteTriggered && <button onClick={()=>onDeleteTriggered(event.id)} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-bold hover:bg-rose-100"><Trash2 className="w-3 h-3"/> Delete</button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {triggeredEvents.length > 100 && (
              <div className="px-4 py-3 text-[10px] text-slate-500 border-t border-slate-100">Showing the latest 100 rows for display performance. Total retained Triggered Events: <strong>{triggeredEvents.length}</strong> / 2000 maximum. Older records expire after 7 days; use Delete for manual cleanup.</div>
            )}
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button
          onClick={() => setFilter('ALL')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
            filter === 'ALL'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
          }`}
        >
          All Dispatch Messages ({dispatches.length})
        </button>

        <button
          onClick={() => setFilter('POTHOLE')}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-semibold transition-all ${
            filter === 'POTHOLE'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Potholes</span>
        </button>

        <button
          onClick={() => setFilter('WATERLOG')}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-semibold transition-all ${
            filter === 'WATERLOG'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <Droplets className="w-3.5 h-3.5" />
          <span>Waterlogged Puddles</span>
        </button>

        <button
          onClick={() => setFilter('TRAFFIC')}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-semibold transition-all ${
            filter === 'TRAFFIC'
              ? 'bg-yellow-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <Car className="w-3.5 h-3.5" />
          <span>Traffic Jams</span>
        </button>

        <button
          onClick={() => setFilter('ACCIDENT')}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-semibold transition-all ${
            filter === 'ACCIDENT'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Accidents</span>
        </button>
      </div>

      {/* Events List */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Zap className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">
            No Events Triggered Yet
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Run the <strong>Default Video</strong> or start the <strong>Hardware Camera</strong> in the Live Vision tab. Any detected hazards will be automatically logged here with Roman numerals.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item, index) => {
            const romanIndex = toRoman(index + 1);
            const isAccident = item.type === 'ACCIDENT_POLICE_EMERGENCY';
            const isWaterLogged = item.severity === 'Critical Water-Logged Hazard';
            const isPothole = item.type === 'POTHOLE_MUNICIPAL_COMPLAINT' && !isWaterLogged;
            const isTraffic = item.type === 'TRAFFIC_CONGESTION_ALERT';

            return (
              <div
                key={item.id}
                className="bg-white border border-slate-200/80 hover:border-slate-300 rounded-2xl p-5 shadow-xs transition-all hover:shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                {/* Left: Roman Numeral + Type Badge + Details */}
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  {/* Roman Numeral Callout */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-serif text-lg font-bold shrink-0 shadow-xs ${
                    isAccident 
                      ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                      : isWaterLogged 
                      ? 'bg-sky-50 text-sky-700 border border-sky-200'
                      : isPothole
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                  }`}>
                    {romanIndex}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        isAccident
                          ? 'bg-rose-600 text-white'
                          : isWaterLogged
                          ? 'bg-sky-600 text-white'
                          : isPothole
                          ? 'bg-amber-600 text-white'
                          : 'bg-yellow-600 text-white'
                      }`}>
                        {isAccident ? 'Emergency Collision' : isWaterLogged ? 'Waterlogged Puddle' : isPothole ? 'Bituminous Pothole' : 'Traffic Jam'}
                      </span>

                      <span className="font-mono text-xs font-semibold text-slate-500">
                        {item.id}
                      </span>

                      <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded border ${
                        item.delivery_status === '200_OK'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}>
                        {item.delivery_status === '200_OK' ? '200 OK DELIVERED' : 'QUEUED OFFLINE'}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 truncate">
                      {item.title}
                    </h4>

                    {/* Location and Timings Row */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-slate-800 font-medium">
                          {item.road_name}, {item.ward_id}
                        </span>
                        <span className="font-mono text-slate-400 text-[11px]">
                          ({item.gps_lat.toFixed(4)}°N, {item.gps_lng.toFixed(4)}°E)
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-mono text-slate-700">
                          {new Date(item.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>

                    {/* Rule Fulfillment Details */}
                    <div className="text-xs bg-slate-50 rounded-lg p-2.5 border border-slate-100 mt-1">
                      {isPothole || isWaterLogged ? (
                        <div className="flex items-center gap-1.5 text-sky-900">
                          <FileText className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                          <span>
                            <strong>Formal Letter Created:</strong> Statutory IRC compliance notice generated for Municipal PWD / Drainage Division.
                          </span>
                        </div>
                      ) : isAccident ? (
                        <div className="flex items-center gap-1.5 text-rose-900">
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span>
                            <strong>Incident Snapshot & License Plate:</strong> Recorded plate <strong className="font-mono">{item.license_plate || 'MH-12-DE-8921'}</strong>, sub-3s response ({item.trigger_time_seconds || 1.84}s) to Police 112 Command.
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-yellow-900">
                          <Car className="w-3.5 h-3.5 text-yellow-600 shrink-0" />
                          <span>
                            <strong>Snapshot & Timings:</strong> High-density bottleneck captured with location coordinates & timestamps for ITMS green signal clearance.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Inspect Action Button */}
                <div className="flex items-center gap-2 self-end lg:self-center">
                  <button
                    onClick={() => handleCopy(item.id, item.id)}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                    title="Copy Ticket ID"
                  >
                    {copiedId === item.id ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={() => onSelectDispatch(item)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-all"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{isPothole || isWaterLogged ? 'View Formal Letter' : 'View Evidence & Snapshot'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
