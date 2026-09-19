import React, { useState } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  FileText, 
  Image as ImageIcon, 
  Printer, 
  ShieldAlert, 
  MapPin, 
  Building2,
  CheckCircle2,
  Radio,
  Clock
} from 'lucide-react';
import { DispatchRecord } from '../types';

interface DispatchDetailModalProps {
  dispatch: DispatchRecord | null;
  onClose: () => void;
}

export const DispatchDetailModal: React.FC<DispatchDetailModalProps> = ({
  dispatch,
  onClose
}) => {
  const [activeView, setActiveView] = useState<'letter' | 'evidence' | 'telemetry'>(
    dispatch?.formal_letter ? 'letter' : dispatch?.snapshot_image ? 'evidence' : 'telemetry'
  );
  const [copied, setCopied] = useState<boolean>(false);

  if (!dispatch) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const isAccident = dispatch.type === 'ACCIDENT_POLICE_EMERGENCY';
  const isWaterLogged = dispatch.severity === 'Critical Water-Logged Hazard';
  const isPothole = dispatch.type === 'POTHOLE_MUNICIPAL_COMPLAINT';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header (Material 3 App Bar) */}
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-xs ${
              isAccident ? 'bg-rose-600' : isWaterLogged ? 'bg-sky-600' : isPothole ? 'bg-amber-600' : 'bg-yellow-600'
            }`}>
              {isAccident ? <ShieldAlert className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-blue-700">
                  {dispatch.id}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
                  dispatch.delivery_status === '200_OK' 
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-300' 
                    : 'bg-amber-50 text-amber-800 border border-amber-300'
                }`}>
                  {dispatch.delivery_status === '200_OK' ? 'STATUS: 200 OK (DELIVERED)' : 'STATUS: CACHED OFFLINE (SQLITE)'}
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-900 mt-0.5">
                {dispatch.title}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* View Switcher Tabs (No Raw JSON) */}
        <div className="px-6 py-2.5 bg-slate-50/60 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            {dispatch.formal_letter && (
              <button
                onClick={() => setActiveView('letter')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                  activeView === 'letter'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Formal Statutory Letter (IRC)</span>
              </button>
            )}

            {dispatch.snapshot_image && (
              <button
                onClick={() => setActiveView('evidence')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                  activeView === 'evidence'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Camera Frame Evidence</span>
              </button>
            )}

            <button
              onClick={() => setActiveView('telemetry')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                activeView === 'telemetry'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Incident Telemetry & Details</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCopy(activeView === 'letter' ? dispatch.formal_letter || '' : `${dispatch.title}\n${dispatch.road_name}\n${dispatch.ward_id}`)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold border border-slate-300 transition-all"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Content'}</span>
            </button>

            {activeView === 'letter' && (
              <button
                onClick={handlePrint}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-semibold shadow-xs transition-all"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Official Letter</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
          {/* VIEW 1: Formal Municipal Letter */}
          {activeView === 'letter' && dispatch.formal_letter && (
            <div className="bg-white border border-slate-300 rounded-xl p-8 shadow-sm font-serif text-slate-900 text-sm leading-relaxed max-w-3xl mx-auto space-y-4">
              <div className="border-b-2 border-slate-900 pb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold tracking-wider text-slate-900 uppercase">
                    Municipal Corporation Road Safety Cell
                  </h3>
                  <p className="text-xs text-slate-600 font-sans mt-0.5">
                    Autonomous On-Bus Edge Intelligence & Infrastructure Monitoring System
                  </p>
                </div>
                <div className="text-right text-xs font-sans text-slate-600">
                  <p><strong>Notice Ref:</strong> {dispatch.id}</p>
                  <p><strong>Date:</strong> {new Date(dispatch.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-slate-800 bg-slate-50/80 p-4 rounded-lg border border-slate-200">
                {dispatch.formal_letter}
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-sans">
                <span>Verified by Edge System ID: EDGE-BUS-MH12-8402</span>
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Statutory Proof Auto-Enclosed
                </span>
              </div>
            </div>
          )}

          {/* VIEW 2: Clean Telemetry & Incident Details (Replaces Raw JSON) */}
          {activeView === 'telemetry' && (
            <div className="max-w-2xl mx-auto space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-2">
                  <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Location Telemetry</span>
                  <div className="space-y-1 text-slate-700">
                    <p><strong className="text-slate-900">Road Corridor:</strong> {dispatch.road_name}</p>
                    <p><strong className="text-slate-900">Municipal Ward:</strong> {dispatch.ward_id}</p>
                    <p><strong className="text-slate-900">GPS Coordinates:</strong> {dispatch.gps_lat.toFixed(6)}°N, {dispatch.gps_lng.toFixed(6)}°E</p>
                    <p><strong className="text-slate-900">Transit Edge Unit:</strong> EDGE-BUS-MH12-8402</p>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-2">
                  <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Dispatch Classification</span>
                  <div className="space-y-1 text-slate-700">
                    <p><strong className="text-slate-900">Category:</strong> {dispatch.type}</p>
                    <p><strong className="text-slate-900">Severity Tier:</strong> {dispatch.severity}</p>
                    <p><strong className="text-slate-900">Target Authority:</strong> {dispatch.department}</p>
                    <p><strong className="text-slate-900">Transmission Status:</strong> {dispatch.delivery_status}</p>
                  </div>
                </div>
              </div>

              {dispatch.license_plate && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-900 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 block">ANPR Plate Detected</span>
                    <span className="text-base font-mono font-bold">{dispatch.license_plate}</span>
                  </div>
                  {dispatch.trigger_time_seconds && (
                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 block">Trigger Latency</span>
                      <span className="text-sm font-mono font-bold text-emerald-700">{dispatch.trigger_time_seconds.toFixed(2)}s (Sub-3s SLA)</span>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px] block mb-2">Automated Dispatch Protocol Summary</span>
                <p className="text-slate-600 leading-relaxed">
                  Autonomous detection verified on the bus edge processor. All spatial contours, depth estimates, and geographic coordinates were extracted and verified without human intervention.
                </p>
              </div>
            </div>
          )}

          {/* VIEW 3: Snapshot Evidence */}
          {activeView === 'evidence' && dispatch.snapshot_image && (
            <div className="space-y-4 text-center max-w-2xl mx-auto">
              <div className="bg-black rounded-xl overflow-hidden inline-block shadow-lg border border-slate-300">
                <img
                  src={dispatch.snapshot_image}
                  alt="Camera Evidence Snapshot"
                  className="max-h-[500px] w-auto object-contain mx-auto"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 bg-white p-3 rounded-lg border border-slate-200">
                <div className="flex items-center gap-1.5 font-medium">
                  <MapPin className="w-3.5 h-3.5 text-blue-600" />
                  <span>{dispatch.road_name}, {dispatch.ward_id} ({dispatch.gps_lat.toFixed(5)}°N, {dispatch.gps_lng.toFixed(5)}°E)</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-slate-500">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{new Date(dispatch.created_at).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
