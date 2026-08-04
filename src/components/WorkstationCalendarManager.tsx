import React, { useState } from "react";
import { WorkstationCalendarDate, UserProfile } from "../types";
import { STATIONS } from "../demoData";
import { Calendar, Plus, Trash2, CheckCircle2, AlertTriangle, Building2, Shield, Info, X } from "lucide-react";

interface WorkstationCalendarManagerProps {
  currentUser: UserProfile;
  calendarDates: WorkstationCalendarDate[];
  onAddCalendarDate: (newDate: Omit<WorkstationCalendarDate, "id" | "createdAt" | "createdBy">) => void;
  onRemoveCalendarDate: (id: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
  selectedStationFilter?: string;
}

export const WorkstationCalendarManager: React.FC<WorkstationCalendarManagerProps> = ({
  currentUser,
  calendarDates,
  onAddCalendarDate,
  onRemoveCalendarDate,
  isOpen = true,
  onClose,
  selectedStationFilter = "All",
}) => {
  const isAdmin = currentUser.role === "admin" || currentUser.role === "callcenter";

  const [targetStation, setTargetStation] = useState<string>(
    currentUser.role === "agent" && currentUser.station ? currentUser.station : selectedStationFilter
  );
  const [filterStation, setFilterStation] = useState<string>(
    currentUser.role === "agent" && currentUser.station ? currentUser.station : "All"
  );

  const [dateInput, setDateInput] = useState<string>("");
  const [typeInput, setTypeInput] = useState<"off_day" | "working_day">("off_day");
  const [reasonInput, setReasonInput] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dateInput) return;

    onAddCalendarDate({
      station: targetStation,
      date: dateInput,
      type: typeInput,
      reason: reasonInput || (typeInput === "off_day" ? "Scheduled Off-Day / Holiday" : "Special Overtime Working Day"),
    });

    setSuccessMsg(`Date ${dateInput} (${typeInput === "off_day" ? "Non-Working Off Day" : "Working Day"}) saved for ${targetStation}!`);
    setDateInput("");
    setReasonInput("");

    setTimeout(() => {
      setSuccessMsg(null);
    }, 3500);
  };

  const filteredDates = calendarDates.filter((item) => {
    if (filterStation === "All") return true;
    return item.station === "All" || item.station.toLowerCase() === filterStation.toLowerCase();
  });

  const content = (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden max-w-4xl w-full mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-4 sm:p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600/30 border border-blue-400/30 rounded-xl text-blue-300 shadow-inner">
            <Calendar className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
              Workstation Working & Off-Dates Schedule
              {isAdmin ? (
                <span className="text-[10px] bg-blue-500/30 text-blue-200 border border-blue-400/30 px-2 py-0.5 rounded-full font-mono uppercase">
                  Admin Editable
                </span>
              ) : (
                <span className="text-[10px] bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 px-2 py-0.5 rounded-full font-mono uppercase">
                  Station View Only
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-300 font-medium">
              Manage non-working holidays, maintenance days & extra working shifts for SLA calculation across all service centers.
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="p-4 sm:p-6 space-y-6 text-left">
        {/* Banner */}
        <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl p-3.5 flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-900 dark:text-blue-200 space-y-1">
            <p className="font-bold">Automated SLA & Aging Matrix Integration</p>
            <p className="text-slate-600 dark:text-blue-300/80 leading-relaxed">
              Standard logic automatically excludes all <strong>Sundays</strong>. Custom <strong>Off-Days / Holidays</strong> added here by Admins will also be deducted from the SLA countdown for affected workstation complaints.
            </p>
          </div>
        </div>

        {/* Admin Add / Cancel Work Day Form */}
        {isAdmin && (
          <form onSubmit={handleFormSubmit} className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2.5">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Plus className="h-4 w-4 text-blue-600" />
                Add / Cancel Working Date For Workstation
              </h3>
              <span className="text-[11px] font-medium text-slate-500">Logged in as {currentUser.name || "Admin"}</span>
            </div>

            {successMsg && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                {successMsg}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Target Station */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  Target Workstation
                </label>
                <select
                  value={targetStation}
                  onChange={(e) => setTargetStation(e.target.value)}
                  className="w-full text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="All">🌐 All Workstations (Global Holiday)</option>
                  {STATIONS.map((st) => (
                    <option key={st.name} value={st.name}>
                      📍 {st.name} ({st.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  Select Date
                </label>
                <input
                  type="date"
                  required
                  value={dateInput}
                  onChange={(e) => setDateInput(e.target.value)}
                  className="w-full text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  Date Type
                </label>
                <select
                  value={typeInput}
                  onChange={(e) => setTypeInput(e.target.value as "off_day" | "working_day")}
                  className="w-full text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="off_day">🚫 Non-Working Day (Cancel Work Day / Off)</option>
                  <option value="working_day">✅ Special Working Day (Overtime Shift)</option>
                </select>
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                Reason / Remarks
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Public Holiday, Workshop Maintenance, Poya Day, Special Sunday Shift..."
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                  className="flex-1 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-black shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  Save Date
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Filter and Schedule List */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-slate-600" />
              Configured Calendar Dates ({filteredDates.length})
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-500">Filter Workstation:</span>
              <select
                value={filterStation}
                onChange={(e) => setFilterStation(e.target.value)}
                className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 font-bold text-slate-700 dark:text-slate-200"
              >
                <option value="All">All Stations</option>
                {STATIONS.map((st) => (
                  <option key={st.name} value={st.name}>
                    {st.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredDates.length === 0 ? (
            <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
              <Calendar className="h-8 w-8 mx-auto text-slate-300 mb-2" />
              <p className="text-xs font-bold text-slate-500">No custom non-working dates configured for this workstation.</p>
              <p className="text-[11px] text-slate-400 mt-1">Standard 6-day working schedule (Mon-Sat, Sundays off) applies.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredDates.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 rounded-xl border flex items-start justify-between gap-3 transition-all ${
                    item.type === "off_day"
                      ? "bg-rose-50/50 border-rose-200 text-rose-950 dark:bg-rose-950/20 dark:border-rose-800 dark:text-rose-200"
                      : "bg-emerald-50/50 border-emerald-200 text-emerald-950 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-200"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black font-mono px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                        {item.date}
                      </span>
                      <span
                        className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                          item.type === "off_day"
                            ? "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/60 dark:text-rose-200"
                            : "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/60 dark:text-emerald-200"
                        }`}
                      >
                        {item.type === "off_day" ? "Off Day (Non-Working)" : "Extra Working Shift"}
                      </span>
                    </div>

                    <p className="text-xs font-bold leading-tight">{item.reason}</p>

                    <div className="flex items-center gap-3 text-[10px] opacity-75 pt-1 font-medium">
                      <span>📍 Workstation: <strong>{item.station}</strong></span>
                      <span>By: {item.createdBy}</span>
                    </div>
                  </div>

                  {isAdmin && (
                    <button
                      onClick={() => onRemoveCalendarDate(item.id)}
                      title="Remove/Cancel this configured date"
                      className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (!isOpen) return null;

  if (onClose) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
        {content}
      </div>
    );
  }

  return content;
};
