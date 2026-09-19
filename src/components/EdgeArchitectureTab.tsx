import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  Database, 
  ShieldCheck, 
  HardDrive,
  FileCheck2,
  Terminal, 
  RefreshCw,
  Layers,
  FileText,
  AlertOctagon,
  Clock
} from 'lucide-react';
import { SystemLog, EdgeTelemetry } from '../types';

interface EdgeArchitectureTabProps {
  telemetry: EdgeTelemetry | null;
}

export const EdgeArchitectureTab: React.FC<EdgeArchitectureTabProps> = ({
  telemetry
}) => {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(false);

  const fetchLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const res = await fetch('/api/system/logs');
      const data = await res.json();
      setLogs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      {/* Edge Hardware & Telemetry Grid (Material Elevated Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/80 p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Edge Compute SoC</span>
            <Cpu className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2">
            <strong className="text-sm font-bold text-slate-900 block truncate">
              {telemetry?.edgeHardware.socModel || 'NVIDIA Jetson Orin Nano'}
            </strong>
            <span className="text-xs text-emerald-700 font-mono font-semibold">
              TensorRT / YOLOv8-Seg FP16
            </span>
          </div>
          <div className="mt-2 text-[10px] text-slate-500 flex justify-between">
            <span>Inference FPS: <strong className="text-slate-800">29.4</strong></span>
            <span>Latency: <strong className="text-slate-800">27.8ms</strong></span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">SQLite Edge Cache</span>
            <Database className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2">
            <strong className="text-sm font-bold text-slate-900 block font-mono">
              offline_cache.db
            </strong>
            <span className="text-xs text-blue-700 font-semibold">
              ACID Resilient Local Cache
            </span>
          </div>
          <div className="mt-2 text-[10px] text-slate-500">
            Zero data loss on carrier drop • Auto-sync daemon
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Camera Optics</span>
            <HardDrive className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2">
            <strong className="text-sm font-bold text-slate-900 block">
              Dual Sony IMX390
            </strong>
            <span className="text-xs text-indigo-700 font-mono font-semibold">
              1080p60 HDR Automotive
            </span>
          </div>
          <div className="mt-2 text-[10px] text-slate-500">
            Instance contour polygon & ANPR OCR engine
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Self-Correction State</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2">
            <strong className="text-sm font-bold text-emerald-800 block">
              Continuous Watchdog OK
            </strong>
            <span className="text-xs text-emerald-700 font-mono font-semibold">
              Resilient Try-Catch Shields
            </span>
          </div>
          <div className="mt-2 text-[10px] text-slate-500">
            Failover memory mirror + auto retry
          </div>
        </div>
      </div>

      {/* Autonomous System Architecture Diagram (SIH #26124) */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Autonomous Urban Intelligence & Municipal Compliance Pipeline Architecture
            </h3>
            <p className="text-xs text-slate-500">
              End-to-end edge AI flow from video/camera capture to statutory multi-department execution
            </p>
          </div>
          <span className="text-xs font-mono bg-blue-50 text-blue-800 font-bold px-2.5 py-1 rounded border border-blue-200">
            SIH Problem ID: 26124
          </span>
        </div>

        {/* Modular Architecture Flow Blocks */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          {/* Stage 1: Edge Sensing */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">
              1
            </div>
            <strong className="text-slate-900 block font-bold">1. Computer Vision & Segmentation</strong>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              Onboard camera frames fed into TensorRT YOLOv8-Seg. Simultaneously segments geometric contour polygons of dry potholes, water ponding depth, traffic jams, and accidents.
            </p>
            <div className="bg-white p-2 rounded border border-slate-200 text-[10px] font-mono text-blue-700">
              ▶ YOLOv8-Seg Polygon Vertices<br/>
              ▶ Puddle Depth / Water Meniscus<br/>
              ▶ ANPR License Plate OCR
            </div>
          </div>

          {/* Stage 2: Programmatic Statutory Compliance */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold">
              2
            </div>
            <strong className="text-slate-900 block font-bold">2. Programmatic IRC Letter Writer</strong>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              Upon verifying road distress, dynamically drafts formal legal notices addressed to the Ward Executive Engineer citing IRC:82 (Section 4.3 48-hr mandate) and IRC:SP:20.
            </p>
            <div className="bg-white p-2 rounded border border-slate-200 text-[10px] font-mono text-sky-800">
              ▶ IRC:82 Depth Violation &gt; 25mm<br/>
              ▶ IRC:SP:84 4-Hr Barricading SLA<br/>
              ▶ Geo-tagged Docket Memo
            </div>
          </div>

          {/* Stage 3: Resilient SQLite Edge Cache */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold">
              3
            </div>
            <strong className="text-slate-900 block font-bold">3. Resilient SQLite Edge Cache</strong>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              When cellular connection drops in tunnels or dead-zones, payloads, images, and letters commit immediately to local <code className="text-amber-800 font-bold">offline_cache.db</code>. Auto-sync daemon uploads when 5G resumes.
            </p>
            <div className="bg-white p-2 rounded border border-slate-200 text-[10px] font-mono text-amber-800">
              ▶ WAL SQLite Persistence<br/>
              ▶ Auto-sync Daemon<br/>
              ▶ In-Memory Self-Correction Failover
            </div>
          </div>

          {/* Stage 4: Multi-Department Automated Routing */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center font-bold">
              4
            </div>
            <strong className="text-slate-900 block font-bold">4. Multi-Department Routing</strong>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              Timed automated dispatch: Accidents triggered under 3.0s to Police 112 Command; Potholes routed to Municipal PWD; Traffic bottlenecks routed to Smart City ITMS.
            </p>
            <div className="bg-white p-2 rounded border border-slate-200 text-[10px] font-mono text-rose-800">
              ▶ Accidents &rarr; Police 112 (&lt;3s)<br/>
              ▶ Potholes &rarr; Municipal PWD<br/>
              ▶ Traffic &rarr; ITMS Signal Waves
            </div>
          </div>
        </div>
      </div>

      {/* Statutory IRC & Legal References Table */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-sm space-y-3 text-xs">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <FileCheck2 className="w-4 h-4 text-blue-600" />
          <span>Statutory Compliance Matrix (Indian Roads Congress & Municipal Corporation Act)</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 text-[11px] bg-slate-50">
                <th className="py-2.5 px-3 font-bold">Statutory Code</th>
                <th className="py-2.5 px-3 font-bold">Standard Engineering Mandate</th>
                <th className="py-2.5 px-3 font-bold">Violation Threshold</th>
                <th className="py-2.5 px-3 font-bold">Legal Action Mandated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              <tr className="hover:bg-slate-50">
                <td className="py-2.5 px-3 font-mono text-blue-700 font-bold">IRC:82-2015 Clause 4.3</td>
                <td className="py-2.5 px-3 font-medium">Bituminous Surface Pothole Depth Tolerance</td>
                <td className="py-2.5 px-3 font-mono font-bold text-amber-700">&gt; 25mm (2.5 cm)</td>
                <td className="py-2.5 px-3">Mandatory Cold-Mix / DBM patch within 48 hours</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="py-2.5 px-3 font-mono text-blue-700 font-bold">IRC:SP:20 / IRC:SP:84</td>
                <td className="py-2.5 px-3 font-medium">Cross-camber Drainage & Water Ponding Prevention</td>
                <td className="py-2.5 px-3 font-mono font-bold text-sky-700">Standing water masking subgrade</td>
                <td className="py-2.5 px-3">Stormwater pump-out & suction gully clearance</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="py-2.5 px-3 font-mono text-blue-700 font-bold">IRC:SP:84 Clause 7.1</td>
                <td className="py-2.5 px-3 font-medium">Highway Safety & Barricading SLA</td>
                <td className="py-2.5 px-3 font-mono font-bold text-amber-700">Critical hazards unbarricaded</td>
                <td className="py-2.5 px-3">Deploy retro-reflective cones within 4 hours</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="py-2.5 px-3 font-mono text-blue-700 font-bold">Section 314 Municipal Act</td>
                <td className="py-2.5 px-3 font-medium">Civic Maintenance Duty & Commuter Safety</td>
                <td className="py-2.5 px-3 font-mono font-bold text-rose-700">Willful neglect of dangerous craters</td>
                <td className="py-2.5 px-3">Formal administrative notice & Action-Taken-Report</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Self-Correction & Telemetry Audit Log */}
      <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-slate-700" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Edge Node Self-Correction & Database Audit Trail
            </h3>
          </div>
          <button
            onClick={fetchLogs}
            disabled={isLoadingLogs}
            className="text-xs text-slate-600 hover:text-slate-900 font-semibold flex items-center gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${isLoadingLogs ? 'animate-spin' : ''}`} />
            <span>Reload</span>
          </button>
        </div>

        <div className="p-4 bg-slate-900 max-h-72 overflow-y-auto font-mono text-[11px] space-y-1.5 leading-relaxed">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start gap-2">
              <span className="text-slate-400 shrink-0">
                [{new Date(log.timestamp).toLocaleTimeString()}]
              </span>
              <span className={`shrink-0 px-1 py-0.2 rounded text-[10px] font-bold ${
                log.level === 'SUCCESS' ? 'bg-emerald-950 text-emerald-300' :
                log.level === 'RESILIENCE' ? 'bg-amber-950 text-amber-300' :
                log.level === 'WARN' ? 'bg-yellow-950 text-yellow-300' :
                log.level === 'ERROR' ? 'bg-rose-950 text-rose-300' :
                'bg-slate-800 text-slate-300'
              }`}>
                {log.level}
              </span>
              <span className="text-blue-400 shrink-0 font-semibold">[{log.source}]</span>
              <span className="text-slate-200">{log.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
