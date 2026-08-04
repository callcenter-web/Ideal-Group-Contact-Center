import React, { useState } from "react";
import { WorkstationCalendarDate, UserProfile } from "../types";
import { STATIONS } from "../demoData";
import { 
  Calendar, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Building2, 
  Info, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Mail, 
  Lock, 
  CalendarDays
} from "lucide-react";

interface WorkstationCalendarManagerProps {
  currentUser: UserProfile;
  calendarDates: WorkstationCalendarDate[];
  onAddCalendarDate: (newDate: Omit<WorkstationCalendarDate, "id" | "createdAt" | "createdBy">) => void;
  onRemoveCalendarDate: (id: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
  selectedStationFilter?: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

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

  // Month navigation state
  const [viewDate, setViewDate] = useState<Date>(new Date(2026, 7, 1)); // Default Aug 2026 or current date
  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth();

  // Active view tab: "grid" or "list"
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const [dateInput, setDateInput] = useState<string>("");
  const [typeInput, setTypeInput] = useState<"off_day" | "working_day">("off_day");
  const [reasonInput, setReasonInput] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handlePrevMonth = () => {
    setViewDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(currentYear, currentMonth + 1, 1));
  };

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

  const handleQuickToggleFromGrid = (
    dateStr: string, 
    existingMatch?: WorkstationCalendarDate,
    isDefaultSunday?: boolean
  ) => {
    if (!isAdmin) return; // Station advisers are read-only

    if (existingMatch) {
      onRemoveCalendarDate(existingMatch.id);
      setSuccessMsg(`Removed custom schedule exception for ${dateStr}. Reverted to standard timetable.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } else {
      setDateInput(dateStr);
      setTypeInput(isDefaultSunday ? "working_day" : "off_day");
      setReasonInput(isDefaultSunday ? "Special Sunday Working Shift" : "Special Workstation Off Day / Maintenance");
      setViewMode("list");
    }
  };

  const filteredDates = calendarDates.filter((item) => {
    if (filterStation === "All") return true;
    return item.station === "All" || item.station.toLowerCase() === filterStation.toLowerCase();
  });

  // Calculate calendar grid days for currentYear & currentMonth
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sun, 1 = Mon ...

  const calendarCells = [];
  // Empty padding cells for previous month
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push(null);
  }
  // Days of current month
  for (let day = 1; day <= daysInMonth; day++) {
    const monthStr = String(currentMonth + 1).padStart(2, "0");
    const dayStr = String(day).padStart(2, "0");
    const dateStr = `${currentYear}-${monthStr}-${dayStr}`;
    const dateObj = new Date(currentYear, currentMonth, day);
    const isSunday = dateObj.getDay() === 0;

    // Matches for filterStation or "All"
    const matched = calendarDates.filter(
      (item) => item.date === dateStr && (item.station === "All" || (filterStation !== "All" && item.station.toLowerCase() === filterStation.toLowerCase()))
    );

    const offDayConfig = matched.find((item) => item.type === "off_day");
    const workingDayConfig = matched.find((item) => item.type === "working_day");

    let status: "working" | "off_sunday" | "custom_off" | "custom_working" = "working";
    let reason = "Standard Working Day";

    if (offDayConfig) {
      status = "custom_off";
      reason = `${offDayConfig.reason} (${offDayConfig.station})`;
    } else if (workingDayConfig) {
      status = "custom_working";
      reason = `${workingDayConfig.reason} (${workingDayConfig.station})`;
    } else if (isSunday) {
      status = "off_sunday";
      reason = "Standard Sunday Non-Working Day";
    }

    calendarCells.push({
      day,
      dateStr,
      dateObj,
      isSunday,
      status,
      reason,
      existingMatch: offDayConfig || workingDayConfig,
    });
  }

  const content = (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-w-5xl w-full mx-auto my-auto transition-all">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-4 sm:p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600/30 border border-blue-400/30 rounded-xl text-blue-300 shadow-inner">
            <CalendarDays className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
              Workstation Working & Off-Dates Schedule
              {isAdmin ? (
                <span className="text-[10px] bg-blue-500/30 text-blue-200 border border-blue-400/30 px-2.5 py-0.5 rounded-full font-mono uppercase tracking-wider">
                  Admin Full Access
                </span>
              ) : (
                <span className="text-[10px] bg-amber-500/30 text-amber-200 border border-amber-400/30 px-2.5 py-0.5 rounded-full font-mono uppercase tracking-wider flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Station Read-Only
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-300 font-medium">
              View & adjust non-working holidays, workshop closures, and extra shifts for aging SLA calculations.
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="p-4 sm:p-6 space-y-6 text-left">
        {/* Adviser Notice or Admin Helper Banner */}
        {!isAdmin ? (
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-xl p-4 flex items-start gap-3">
            <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-950 dark:text-amber-200 space-y-1">
              <p className="font-extrabold text-sm flex items-center gap-2">
                Service Station Adviser Schedule View
              </p>
              <p className="text-slate-700 dark:text-amber-300/90 leading-relaxed">
                You are viewing the operational calendar for <strong>{filterStation === "All" ? "All Service Workstations" : filterStation}</strong>. All Sundays & configured off-days are automatically excluded from customer complaint SLA aging calculations.
              </p>
              <div className="pt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-100 bg-amber-100/60 dark:bg-amber-900/40 px-3 py-1.5 rounded-lg border border-amber-300/50">
                <Mail className="h-4 w-4 text-amber-700 dark:text-amber-300 shrink-0" />
                <span>Notice schedule error or need an emergency closure? Contact Call Center:</span>
                <a href="mailto:callcenter@idealgroup.lk" className="underline text-blue-700 dark:text-blue-300 font-extrabold hover:text-blue-900">
                  callcenter@idealgroup.lk
                </a>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl p-3.5 flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-900 dark:text-blue-200 space-y-1">
              <p className="font-bold">Admin Working Calendar Controls</p>
              <p className="text-slate-600 dark:text-blue-300/80 leading-relaxed">
                Click on any calendar day below to toggle or mark it as an <strong>Off-Day (Closed)</strong> or <strong>Special Working Day (Open)</strong>. Changes instantly adjust complaint SLA countdowns for affected workstations.
              </p>
            </div>
          </div>
        )}

        {/* Toolbar: Station Filter & Month Navigator & Mode Switch */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
          {/* Station selector */}
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-slate-500" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Station Filter:</span>
            <select
              value={filterStation}
              onChange={(e) => setFilterStation(e.target.value)}
              className="text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 font-black text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">🌐 All Workstations</option>
              {STATIONS.map((st) => (
                <option key={st.name} value={st.name}>
                  📍 {st.name} ({st.code})
                </option>
              ))}
            </select>
          </div>

          {/* Month Selector Controls */}
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded-md text-slate-600 hover:text-slate-900 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-xs font-black min-w-[130px] text-center text-slate-800 dark:text-slate-200">
              {MONTH_NAMES[currentMonth]} {currentYear}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 rounded-md text-slate-600 hover:text-slate-900 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-slate-200 dark:bg-slate-700 p-1 rounded-lg text-xs font-bold">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                viewMode === "grid"
                  ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-2xs font-extrabold"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
              }`}
            >
              📅 Month View
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                viewMode === "list"
                  ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-2xs font-extrabold"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
              }`}
            >
              📋 Custom Schedule List ({filteredDates.length})
            </button>
          </div>
        </div>

        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2 shadow-2xs">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            {successMsg}
          </div>
        )}

        {/* VIEW MODE 1: INTERACTIVE MONTH GRID */}
        {viewMode === "grid" && (
          <div className="space-y-3">
            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 text-[11px] font-bold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500 border border-emerald-600"></span>
                <span>Open Working Day (Mon-Sat)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-600 border border-slate-400"></span>
                <span>Sunday Default Off</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-500 border border-rose-600"></span>
                <span>Closed / Special Off Day</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-blue-500 border border-blue-600"></span>
                <span>Special Overtime Working Shift</span>
              </span>
            </div>

            {/* Calendar Grid Container */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
              {/* Day Headings */}
              <div className="grid grid-cols-7 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-center text-xs font-black uppercase py-2.5 border-b border-slate-200 dark:border-slate-700">
                <div className="text-rose-600 dark:text-rose-400">Sun</div>
                <div>Mon</div>
                <div>Tue</div>
                <div>Wed</div>
                <div>Thu</div>
                <div>Fri</div>
                <div>Sat</div>
              </div>

              {/* Grid Cells */}
              <div className="grid grid-cols-7 divide-x divide-y divide-slate-200 dark:divide-slate-800 border-b border-slate-200 dark:border-slate-800">
                {calendarCells.map((cell, idx) => {
                  if (!cell) {
                    return (
                      <div
                        key={`empty-${idx}`}
                        className="min-h-[85px] bg-slate-50/50 dark:bg-slate-950/30 p-2"
                      />
                    );
                  }

                  const { day, dateStr, isSunday, status, reason, existingMatch } = cell;

                  return (
                    <div
                      key={dateStr}
                      onClick={() => handleQuickToggleFromGrid(dateStr, existingMatch, isSunday)}
                      className={`min-h-[90px] p-2 flex flex-col justify-between transition-all relative group ${
                        isAdmin ? "cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-950/30" : "cursor-default"
                      } ${
                        status === "custom_off"
                          ? "bg-rose-50/80 dark:bg-rose-950/30 border-rose-200"
                          : status === "custom_working"
                          ? "bg-blue-50/80 dark:bg-blue-950/30 border-blue-200"
                          : isSunday
                          ? "bg-slate-100/70 dark:bg-slate-800/40"
                          : "bg-white dark:bg-slate-900"
                      }`}
                    >
                      {/* Top bar in cell */}
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-black font-mono w-6 h-6 rounded-full flex items-center justify-center ${
                            status === "custom_off"
                              ? "bg-rose-600 text-white"
                              : status === "custom_working"
                              ? "bg-blue-600 text-white"
                              : isSunday
                              ? "bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                              : "bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                          }`}
                        >
                          {day}
                        </span>

                        {status === "custom_off" && (
                          <span className="text-[9px] font-black uppercase bg-rose-200 text-rose-900 dark:bg-rose-900/80 dark:text-rose-200 px-1.5 py-0.5 rounded border border-rose-300">
                            CLOSED
                          </span>
                        )}
                        {status === "custom_working" && (
                          <span className="text-[9px] font-black uppercase bg-blue-200 text-blue-900 dark:bg-blue-900/80 dark:text-blue-200 px-1.5 py-0.5 rounded border border-blue-300">
                            OPEN SHIFT
                          </span>
                        )}
                        {status === "working" && (
                          <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                            OPEN
                          </span>
                        )}
                        {status === "off_sunday" && (
                          <span className="text-[9px] font-bold text-slate-500">
                            OFF
                          </span>
                        )}
                      </div>

                      {/* Reason label */}
                      <div className="mt-1">
                        <p
                          className={`text-[10px] font-medium line-clamp-2 leading-snug ${
                            status === "custom_off"
                              ? "text-rose-800 dark:text-rose-300 font-bold"
                              : status === "custom_working"
                              ? "text-blue-800 dark:text-blue-300 font-bold"
                              : "text-slate-500 dark:text-slate-400"
                          }`}
                        >
                          {reason}
                        </p>
                      </div>

                      {/* Admin Quick Action Hover Prompt */}
                      {isAdmin && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[9px] font-extrabold text-blue-600 dark:text-blue-400 pt-1 border-t border-slate-200 dark:border-slate-800">
                          {existingMatch ? "Click to Remove" : "Click to Edit"}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* VIEW MODE 2: ADMIN FORM & CUSTOM SCHEDULE LIST */}
        {viewMode === "list" && (
          <div className="space-y-6">
            {/* Admin Add / Edit Form */}
            {isAdmin && (
              <form onSubmit={handleFormSubmit} className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2.5">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Plus className="h-4 w-4 text-blue-600" />
                    Add / Cancel Working Date For Workstation
                  </h3>
                  <span className="text-[11px] font-medium text-slate-500">Admin Editor</span>
                </div>

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
                      placeholder="e.g. Public Holiday, Workshop Scheduled Maintenance, Poya Day, Special Sunday Shift..."
                      value={reasonInput}
                      onChange={(e) => setReasonInput(e.target.value)}
                      className="flex-1 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-black shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                      Save Date Config
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Custom Schedule List */}
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                <Building2 className="h-4 w-4 text-slate-600" />
                Configured Non-Working & Overtime Dates ({filteredDates.length})
              </h3>

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
                          <span>📍 Station: <strong>{item.station}</strong></span>
                          <span>By: {item.createdBy}</span>
                        </div>
                      </div>

                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => onRemoveCalendarDate(item.id)}
                          title="Remove this schedule exception"
                          className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors cursor-pointer"
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
        )}
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

