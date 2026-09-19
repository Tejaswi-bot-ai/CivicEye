import React, { useState } from 'react';
import { X, Send, PenTool, CheckCircle2, AlertTriangle, FileText, Building2 } from 'lucide-react';
import { DispatchRecord } from '../types';

interface ManualLetterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLetterCreated: (record: DispatchRecord) => void;
}

const DEPARTMENT_PRESETS = [
  {
    name: 'MUNICIPAL ROAD MAINTENANCE & STORMWATER DRAINAGE CELL',
    role: 'Executive Engineer (Civil & Drainage)',
    defaultSubject: 'Statutory Notice: Immediate Repair Directive for Road Surface Anomaly',
    defaultTemplate: `OFFICIAL STATUTORY COMPLIANCE DIRECTIVE
To: The Executive Engineer (Civil Maintenance & Drainage Cell)
Municipal Corporation Infrastructure Works Division

Subject: Formal Remedial Order - Road Cavity / Surface Distress Breach

Sir/Madam,
Pursuant to the statutory powers vested under the Municipal Infrastructure Maintenance Regulations and Indian Roads Congress (IRC:82 / IRC:SP:20) Quality Standards:

An on-site inspection has recorded significant physical distress on the designated roadway requiring immediate engineering intervention. The localized depression compromises vehicle safety and violates permissible limits.

Location Details:
- Road Corridor: North Main Road / Ward Corridor
- Ward Jurisdiction: Ward 12 / Urban Sector 4
- Defect Classification: Surface Depression / Bituminous Crater Cavity

STATUTORY RECTIFICATION ORDER:
You are hereby formally directed to deploy emergency pothole repair squads and cold-mix bituminous compaction crews within 48 hours of this notice. A compliance completion report must be submitted to the Urban Municipal Portal.

By Order of Municipal Road Engineering Bureau.`
  },
  {
    name: 'SMART CITY TRAFFIC MANAGEMENT CENTER (ITMS)',
    role: 'Director of Traffic Operations',
    defaultSubject: 'Traffic Optimization Advisory: Corridor Congestion Clearance Directive',
    defaultTemplate: `INTELLIGENT TRAFFIC MANAGEMENT SYSTEM (ITMS) ADVISORY
To: The Director, Integrated Command & Control Center (ICCC)
Smart City Traffic Operations Cell

Subject: Dynamic Signal Timing Override Request - Bottleneck Clearance

Sir/Madam,
Telemetry and camera surveillance have identified significant bottlenecking and Level of Service (LOS F) degradation along the arterial corridor. 

OBSERVED CONDITIONS:
- Arterial: Swargate - Viman Nagar Arterial Road
- Queuing Volume: Heavy vehicular clustering exceeding corridor discharge capacity
- Recommended Action: Implement emergency Green Wave signal phase extension (+35 seconds) on downstream junctions to discharge standing vehicular queue.

Coordinated ITMS routing is requested immediately.`
  },
  {
    name: 'POLICE COMMISSIONERATE & 112 EMERGENCY OPERATIONS',
    role: 'Emergency Dispatch Officer (112 Command)',
    defaultSubject: 'Emergency Traffic Advisory: Critical Road Hazard Incident',
    defaultTemplate: `EMERGENCY OPERATIONS REQUISITION (112 COMMAND)
To: In-Charge Officer, City Traffic Police Control Room
Commissioner of Police Headquarters

Subject: Urgent Road Safety & Hazard Intervention Requisition

Sir/Madam,
This official communication reports an urgent roadway hazard impacting vehicular safety and requiring traffic diversion / personnel deployment.

Incident Parameters:
- Zone: Central Transit Arterial Corridor
- Hazard Severity: High / Urgent
- Action Requested: Deployment of traffic personnel, placement of reflective barricades, and caution notices for approaching public transport vehicles.

Submitted for priority action.`
  }
];

export const ManualLetterModal: React.FC<ManualLetterModalProps> = ({
  isOpen,
  onClose,
  onLetterCreated
}) => {
  const [selectedDeptIndex, setSelectedDeptIndex] = useState<number>(0);
  const [title, setTitle] = useState<string>(DEPARTMENT_PRESETS[0].defaultSubject);
  const [roadName, setRoadName] = useState<string>('North Main Road, Ward 48');
  const [wardId, setWardId] = useState<string>('Ward 48');
  const [severity, setSeverity] = useState<'Low' | 'Medium' | 'Large' | 'Critical Water-Logged Hazard'>('Large');
  const [letterBody, setLetterBody] = useState<string>(DEPARTMENT_PRESETS[0].defaultTemplate);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDepartmentChange = (index: number) => {
    setSelectedDeptIndex(index);
    setTitle(DEPARTMENT_PRESETS[index].defaultSubject);
    setLetterBody(DEPARTMENT_PRESETS[index].defaultTemplate);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!letterBody.trim() || !title.trim()) {
      setErrorMessage('Title and Letter Body cannot be empty.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload = {
        department: DEPARTMENT_PRESETS[selectedDeptIndex].name,
        title,
        roadName,
        wardId,
        severity,
        formalLetter: letterBody,
        gpsLat: 18.5362,
        gpsLng: 73.8939
      };

      const res = await fetch('/api/dispatches/manual-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success && data.record) {
        onLetterCreated(data.record);
        onClose();
      } else {
        setErrorMessage(data.error || 'Failed to dispatch manual letter');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <PenTool className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Compose Official Statutory Letter
              </h3>
              <p className="text-[11px] text-slate-500">
                Manually draft and dispatch compliance letters to municipal or traffic departments
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Department Selector */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Target Authority / Department
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {DEPARTMENT_PRESETS.map((dept, idx) => (
                <button
                  key={dept.name}
                  type="button"
                  onClick={() => handleDepartmentChange(idx)}
                  className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    selectedDeptIndex === idx
                      ? 'border-blue-600 bg-blue-50/50 text-blue-900 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                  }`}
                >
                  <Building2 className={`w-4 h-4 mb-1.5 ${selectedDeptIndex === idx ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className="font-bold text-[11px] leading-tight line-clamp-2">
                    {dept.name}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-1">
                    {dept.role}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Subject & Title */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Letter Subject / Reference Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              required
            />
          </div>

          {/* Location & Severity Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Road Name
              </label>
              <input
                type="text"
                value={roadName}
                onChange={(e) => setRoadName(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Ward / Sector ID
              </label>
              <input
                type="text"
                value={wardId}
                onChange={(e) => setWardId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Severity
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as any)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              >
                <option value="Low">Low (Surface Wear)</option>
                <option value="Medium">Medium (&gt;25mm IRC:82)</option>
                <option value="Large">Large / Severe Defect</option>
                <option value="Critical Water-Logged Hazard">Critical Water-Logged Hazard</option>
              </select>
            </div>
          </div>

          {/* Letter Body Textarea */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>Statutory Formal Letter Body</span>
              </label>
              <span className="text-[10px] text-slate-400">
                You can freely edit or customize the text
              </span>
            </div>
            <textarea
              rows={10}
              value={letterBody}
              onChange={(e) => setLetterBody(e.target.value)}
              className="w-full p-3 font-mono text-[11px] leading-relaxed bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-hidden"
              required
            />
          </div>

          {/* Modal Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Dispatching Letter...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Dispatch Official Letter</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
