import React, { useState } from "react";
import { Complaint, WorkstationCalendarDate } from "../types";
import { STATIONS } from "../demoData";
import { 
  MapPin, 
  ArrowRight, 
  ShieldCheck, 
  AlertCircle, 
  Clock, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2,
  TrendingUp,
  RotateCcw,
  Bug,
  ChevronDown,
  ChevronUp,
  X,
  Database,
  Search,
  LayoutGrid,
  Table as TableIcon,
  PhoneCall,
  PhoneOff
} from "lucide-react";
import { 
  calculateStationMetrics, 
  calculateNationalSummary, 
  getReconciliationAudit,
  DiagnosticAuditItem
} from "../utils/workflowTallyUtils";

interface StationOverviewProps {
  complaints: Complaint[];
  onSelectStation: (stationCode: string) => void;
  calendarDates?: WorkstationCalendarDate[];
  onOpenCalendarModal?: (stationName: string) => void;
  theme?: "light" | "dark";
}

export default function StationOverview({ 
  complaints, 
  onSelectStation, 
  calendarDates = [], 
  onOpenCalendarModal, 
  theme = "light" 
}: StationOverviewProps) {
  const isDark = theme === "dark";
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState(false);
  const [diagnosticSearch, setDiagnosticSearch] = useState("");
  const [filterStationDiagnostics, setFilterStationDiagnostics] = useState("all");

  const now = new Date();

  // Calculate National Summary & Station Metrics dynamically from database records
  const nationalSummary = calculateNationalSummary(complaints, now, calendarDates);
  const auditReport = getReconciliationAudit(complaints, now, calendarDates);

  // Filtered diagnostics items
  const filteredAuditItems = auditReport.auditItems.filter(item => {
    if (filterStationDiagnostics !== "all" && item.station.toLowerCase() !== filterStationDiagnostics.toLowerCase()) {
      return false;
    }
    if (!diagnosticSearch) return true;
    const q = diagnosticSearch.toLowerCase();
    return (
      item.complaintId.toLowerCase().includes(q) ||
      item.customerName.toLowerCase().includes(q) ||
      item.station.toLowerCase().includes(q) ||
      item.status.toLowerCase().includes(q)
    );
  });

  return (
    <div id="stations-performance-panel" className="space-y-4">
      {/* Header with Title and Dynamic Integrity Indicator */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 mb-2 transition-colors duration-500 ${
        isDark ? "border-slate-800" : "border-slate-200"
      }`}>
        <div>
          <div className="flex items-center gap-2">
            <h3 className={`text-sm font-black uppercase tracking-widest transition-colors duration-500 ${
              isDark ? "text-slate-100" : "text-slate-800"
            }`}>
              Regional Service Station Performance
            </h3>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-black rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
              <Database className="h-3 w-3" />
              Dynamic DB Calculated ({complaints.length} Records)
            </span>
          </div>
          <p className={`text-xs mt-0.5 transition-colors duration-500 ${
            isDark ? "text-slate-400" : "text-slate-500"
          }`}>
            Real-time conversion metrics, SLA ageing, and re-action backlogs computed dynamically from database truth.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle Switch */}
          <div className={`p-0.5 rounded-lg border flex items-center ${
            isDark ? "bg-slate-950 border-slate-800" : "bg-slate-100 border-slate-300"
          }`}>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`px-2.5 py-1 rounded-md text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === "table"
                  ? isDark 
                    ? "bg-blue-600 text-white shadow-xs" 
                    : "bg-white text-blue-700 shadow-xs"
                  : isDark 
                    ? "text-slate-400 hover:text-slate-200" 
                    : "text-slate-600 hover:text-slate-900"
              }`}
              title="View Station Performance Table"
            >
              <TableIcon className="h-3.5 w-3.5" />
              <span>Table View</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`px-2.5 py-1 rounded-md text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === "cards"
                  ? isDark 
                    ? "bg-blue-600 text-white shadow-xs" 
                    : "bg-white text-blue-700 shadow-xs"
                  : isDark 
                    ? "text-slate-400 hover:text-slate-200" 
                    : "text-slate-600 hover:text-slate-900"
              }`}
              title="View Station Cards Matrix"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Cards Grid</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowDiagnosticsModal(true)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition-all cursor-pointer ${
              auditReport.issueCasesCount > 0
                ? "bg-rose-50 border-rose-300 text-rose-800 hover:bg-rose-100 animate-pulse"
                : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700"
            }`}
            title="Open Data Reconciliation & Audit Engine"
          >
            <Bug className="h-3.5 w-3.5 text-blue-600" />
            <span>Audit ({auditReport.cleanCasesCount}/{auditReport.totalAudited})</span>
          </button>
        </div>
      </div>

      {/* National Overview Strip */}
      <div className={`p-3.5 rounded-xl border grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 shadow-xs transition-colors duration-300 ${
        isDark ? "bg-slate-900/90 border-slate-800/90 text-slate-100 shadow-black/20" : "bg-slate-50/80 border-slate-200 text-slate-800 shadow-slate-100"
      }`}>
        <div className={`p-2 rounded-lg border text-center transition-colors ${
          isDark ? "bg-slate-950/50 border-slate-800/80" : "bg-white border-slate-200/80"
        }`}>
          <span className={`text-[9px] font-black uppercase tracking-wider block ${isDark ? "text-slate-400" : "text-slate-500"}`}>Total Cases</span>
          <span className={`text-base font-black mt-0.5 block ${isDark ? "text-slate-100" : "text-slate-900"}`}>{nationalSummary.totalComplaints}</span>
        </div>
        <div className={`p-2 rounded-lg border text-center transition-colors ${
          isDark ? "bg-amber-950/20 border-amber-900/40" : "bg-white border-amber-200/70"
        }`}>
          <span className={`text-[9px] font-black uppercase tracking-wider block ${isDark ? "text-amber-400" : "text-amber-700"}`}>Pending Action</span>
          <span className={`text-base font-black mt-0.5 block ${isDark ? "text-amber-400" : "text-amber-600"}`}>{nationalSummary.totalPending}</span>
        </div>
        <div className={`p-2 rounded-lg border text-center transition-colors ${
          isDark ? "bg-emerald-950/20 border-emerald-900/40" : "bg-white border-emerald-200/70"
        }`}>
          <span className={`text-[9px] font-black uppercase tracking-wider block ${isDark ? "text-emerald-400" : "text-emerald-700"}`}>Resolved</span>
          <span className={`text-base font-black mt-0.5 block ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>{nationalSummary.totalResolved}</span>
        </div>
        <div className={`p-2 rounded-lg border text-center transition-colors ${
          isDark ? "bg-rose-950/20 border-rose-900/40" : "bg-white border-rose-200/70"
        }`}>
          <span className={`text-[9px] font-black uppercase tracking-wider block ${isDark ? "text-rose-400" : "text-rose-700"}`}>Not Contacted</span>
          <span className={`text-base font-black mt-0.5 block ${isDark ? "text-rose-400" : "text-rose-600"}`}>{nationalSummary.totalNotContacted}</span>
        </div>
        <div className={`p-2 rounded-lg border text-center transition-colors ${
          isDark ? "bg-blue-950/20 border-blue-900/40" : "bg-white border-blue-200/70"
        }`}>
          <span className={`text-[9px] font-black uppercase tracking-wider block ${isDark ? "text-blue-400" : "text-blue-700"}`}>Contacted</span>
          <span className={`text-base font-black mt-0.5 block ${isDark ? "text-blue-400" : "text-blue-600"}`}>{nationalSummary.totalContacted}</span>
        </div>
        <div className={`p-2 rounded-lg border text-center transition-colors ${
          isDark ? "bg-rose-950/25 border-rose-900/50" : "bg-white border-rose-200/80"
        }`}>
          <span className={`text-[9px] font-black uppercase tracking-wider block ${isDark ? "text-rose-400" : "text-rose-700"}`}>Re-Action Req.</span>
          <span className={`text-base font-black mt-0.5 block ${isDark ? "text-rose-400" : "text-rose-700"}`}>{nationalSummary.totalRejectedReAction}</span>
        </div>
        <div className={`p-2 rounded-lg border text-center col-span-2 sm:col-span-1 transition-colors ${
          isDark ? "bg-indigo-950/20 border-indigo-900/40" : "bg-white border-indigo-200/70"
        }`}>
          <span className={`text-[9px] font-black uppercase tracking-wider block ${isDark ? "text-indigo-400" : "text-indigo-700"}`}>CX Recovery</span>
          <span className={`text-base font-black mt-0.5 block ${isDark ? "text-indigo-400" : "text-indigo-600"}`}>{nationalSummary.overallRecoveryRate}%</span>
        </div>
      </div>

      {/* Station Performance Content: Table View vs Cards Grid */}
      {viewMode === "table" ? (
        <div className={`rounded-xl border overflow-hidden shadow-xs transition-colors duration-300 ${
          isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
        }`}>
          <div className={`p-3.5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
            isDark ? "border-slate-800 bg-slate-950/60" : "border-slate-200 bg-slate-50/70"
          }`}>
            <div className="flex items-center gap-2">
              <TableIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                Service Station Performance Scorecard Table
              </h4>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-semibold">
              <span>Click on any station name or rejected count to navigate to that station queue</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
              <thead>
                <tr className={`border-b text-[10px] font-black uppercase tracking-wider ${
                  isDark ? "bg-slate-950/90 text-slate-300 border-slate-800" : "bg-slate-100 text-slate-700 border-slate-200"
                }`}>
                  <th className="py-3 px-3.5">Service Station</th>
                  <th className="py-3 px-2 text-center">Total</th>
                  <th className="py-3 px-2 text-center text-emerald-600 dark:text-emerald-400">Resolved</th>
                  <th className="py-3 px-2 text-center text-amber-600 dark:text-amber-400">Pending</th>
                  {/* Station-by-Station Rejected Counts column */}
                  <th className="py-3 px-2 text-center text-rose-700 bg-rose-50/80 dark:bg-rose-950/40 dark:text-rose-300">
                    <div className="flex items-center justify-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-rose-600 dark:text-rose-400 shrink-0" />
                      <span>Rejected by CC (Re-Action)</span>
                    </div>
                  </th>
                  <th className="py-3 px-2 text-center text-rose-600 dark:text-rose-400">Not Contacted</th>
                  <th className="py-3 px-2 text-center text-blue-600 dark:text-blue-400">Contacted</th>
                  <th className="py-3 px-2 text-center text-amber-600 dark:text-amber-400">Attempted</th>
                  <th className="py-3 px-2 text-center text-emerald-600 dark:text-emerald-400">0-3d (New)</th>
                  <th className="py-3 px-2 text-center text-amber-600 dark:text-amber-400">3-5d (Pending)</th>
                  <th className="py-3 px-2 text-center text-orange-600 dark:text-orange-400">6-10d (Esc.)</th>
                  <th className="py-3 px-2 text-center text-rose-600 dark:text-rose-400">&gt;10d (Crit.)</th>
                  <th className="py-3 px-2 text-center text-indigo-600 dark:text-indigo-400">CX Recovery %</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y text-xs font-medium ${
                isDark ? "divide-slate-800 text-slate-200" : "divide-slate-100 text-slate-800"
              }`}>
                {nationalSummary.stationMetrics.map((stat, idx) => {
                  const matchedProfile = STATIONS.find(st => st.code === stat.stationCode || st.name === stat.stationName);
                  const offDates = calendarDates.filter(
                    d => d.station === "All" || d.station.toLowerCase() === stat.stationName.toLowerCase() || d.station.toLowerCase() === stat.stationCode.toLowerCase()
                  );

                  return (
                    <tr 
                      key={stat.stationCode}
                      className={`transition-colors ${
                        idx % 2 === 0 
                          ? isDark ? "bg-slate-900/60 hover:bg-slate-800/60" : "bg-white hover:bg-slate-50"
                          : isDark ? "bg-slate-950/40 hover:bg-slate-800/60" : "bg-slate-50/60 hover:bg-slate-100/70"
                      }`}
                    >
                      <td className="py-2.5 px-3.5">
                        <div className="flex items-center gap-2">
                          <MapPin className={`h-3.5 w-3.5 shrink-0 ${isDark ? "text-red-500" : "text-blue-600"}`} />
                          <div>
                            <button
                              type="button"
                              onClick={() => onSelectStation(stat.stationCode)}
                              className="font-bold text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer text-left flex items-center gap-1.5"
                            >
                              <span>{stat.stationName}</span>
                              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                                isDark ? "bg-slate-950 border-slate-800 text-slate-400" : "bg-slate-100 border-slate-300 text-slate-600"
                              }`}>
                                {stat.stationCode}
                              </span>
                            </button>
                            {matchedProfile?.officers && matchedProfile.officers.length > 0 && (
                              <div className="text-[10px] text-slate-400 dark:text-slate-500">
                                Mgr: {matchedProfile.officers[0].name}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-center font-black text-slate-900 dark:text-slate-100">
                        {stat.total}
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold text-emerald-600 dark:text-emerald-400">
                        {stat.resolved}
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold text-amber-600 dark:text-amber-400">
                        {stat.pending}
                      </td>
                      {/* Station-by-Station Rejected Counts badge */}
                      <td className="py-2.5 px-2 text-center bg-rose-50/50 dark:bg-rose-950/20">
                        {stat.rejectedReAction > 0 ? (
                          <button
                            type="button"
                            onClick={() => onSelectStation(stat.stationCode)}
                            className="font-black px-2.5 py-0.5 rounded text-xs bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-700 dark:hover:bg-rose-600 shadow-2xs inline-flex items-center gap-1 cursor-pointer transition-all hover:scale-105"
                            title={`Click to manage ${stat.rejectedReAction} rejected re-action cases for ${stat.stationName}`}
                          >
                            <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
                            <span>{stat.rejectedReAction}</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 font-bold">0</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <span className={`font-bold ${stat.notContacted > 0 ? "text-rose-600 dark:text-rose-400 font-black" : "text-slate-400"}`}>
                          {stat.notContacted}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <span className={`font-bold ${stat.contacted > 0 ? "text-blue-600 dark:text-blue-400 font-black" : "text-slate-400"}`}>
                          {stat.contacted}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <span className={`font-bold ${stat.attempted > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-400"}`}>
                          {stat.attempted}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {stat.sla_0_3}
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono font-bold text-amber-600 dark:text-amber-400">
                        {stat.sla_3_5}
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono font-bold text-orange-600 dark:text-orange-400">
                        {stat.sla_6_10}
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono font-bold text-rose-600 dark:text-rose-400">
                        {stat.sla_gt_10}
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          {stat.recoveryRate}%
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {onOpenCalendarModal && (
                            <button
                              type="button"
                              onClick={() => onOpenCalendarModal(stat.stationName)}
                              className={`p-1.5 rounded border transition-all ${
                                isDark 
                                  ? "bg-slate-950 border-slate-800 text-blue-400 hover:bg-slate-800" 
                                  : "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                              }`}
                              title={`View ${offDates.length} Holiday / Calendar Dates`}
                            >
                              <Calendar className="h-3 w-3" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onSelectStation(stat.stationCode)}
                            className={`px-2 py-1 rounded text-[10px] font-black uppercase flex items-center gap-1 transition-all ${
                              isDark 
                                ? "bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-800/60" 
                                : "bg-blue-600 hover:bg-blue-700 text-white shadow-2xs"
                            }`}
                          >
                            <span>Manage</span>
                            <ArrowRight className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* National Grand Totals Footer */}
              <tfoot>
                <tr className={`border-t-2 font-black text-xs ${
                  isDark ? "bg-slate-950 text-white border-slate-700" : "bg-slate-900 text-white border-slate-800"
                }`}>
                  <td className="py-3 px-3.5 uppercase tracking-wider">
                    Grand Total ({nationalSummary.stationMetrics.length} Stations)
                  </td>
                  <td className="py-3 px-2 text-center text-white font-black">
                    {nationalSummary.totalComplaints}
                  </td>
                  <td className="py-3 px-2 text-center text-emerald-400">
                    {nationalSummary.totalResolved}
                  </td>
                  <td className="py-3 px-2 text-center text-amber-400">
                    {nationalSummary.totalPending}
                  </td>
                  {/* Grand Total Rejected */}
                  <td className="py-3 px-2 text-center text-rose-300 bg-rose-950/40">
                    <div className="inline-flex items-center gap-1 font-black px-2 py-0.5 rounded bg-rose-600 text-white">
                      <AlertTriangle className="h-3 w-3" />
                      <span>{nationalSummary.totalRejectedReAction} Total Rejected</span>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-center text-rose-400">
                    {nationalSummary.totalNotContacted}
                  </td>
                  <td className="py-3 px-2 text-center text-blue-400">
                    {nationalSummary.totalContacted}
                  </td>
                  <td className="py-3 px-2 text-center text-amber-400">
                    {nationalSummary.stationMetrics.reduce((sum, s) => sum + s.attempted, 0)}
                  </td>
                  <td className="py-3 px-2 text-center text-emerald-400 font-mono">
                    {nationalSummary.stationMetrics.reduce((sum, s) => sum + s.sla_0_3, 0)}
                  </td>
                  <td className="py-3 px-2 text-center text-amber-400 font-mono">
                    {nationalSummary.stationMetrics.reduce((sum, s) => sum + s.sla_3_5, 0)}
                  </td>
                  <td className="py-3 px-2 text-center text-orange-400 font-mono">
                    {nationalSummary.stationMetrics.reduce((sum, s) => sum + s.sla_6_10, 0)}
                  </td>
                  <td className="py-3 px-2 text-center text-rose-400 font-mono">
                    {nationalSummary.stationMetrics.reduce((sum, s) => sum + s.sla_gt_10, 0)}
                  </td>
                  <td className="py-3 px-2 text-center text-indigo-300">
                    {nationalSummary.overallRecoveryRate}%
                  </td>
                  <td className="py-3 px-3 text-right text-[10px] text-slate-400">
                    All Stations
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
      /* Grid of Service Station Cards */
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {nationalSummary.stationMetrics.map((stat) => {
          const matchedStationProfile = STATIONS.find(st => st.code === stat.stationCode || st.name === stat.stationName);
          
          const stationOffDates = calendarDates.filter(
            (d) => d.station === "All" || d.station.toLowerCase() === stat.stationName.toLowerCase() || d.station.toLowerCase() === stat.stationCode.toLowerCase()
          );

          return (
            <div
              key={stat.stationCode}
              className={`rounded-xl border p-4 shadow-sm flex flex-col justify-between hover:scale-[1.01] transition-all duration-300 ${
                isDark 
                  ? "bg-slate-900/90 border-slate-800 hover:border-red-900/40 text-slate-100 shadow-black/20" 
                  : "bg-white border-slate-200 hover:border-blue-300 text-slate-900 shadow-slate-100"
              }`}
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className={`h-4 w-4 shrink-0 ${isDark ? "text-red-500" : "text-blue-600"}`} />
                    <span className={`text-xs font-black uppercase tracking-wider ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                      {stat.stationName}
                    </span>
                  </div>
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                    isDark 
                      ? "text-slate-400 bg-slate-950 border-slate-800" 
                      : "text-slate-500 bg-slate-50 border-slate-200"
                  }`}>
                    {stat.stationCode}
                  </span>
                </div>

                {/* Primary Metric Tally: Total = Pending + Resolved */}
                <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                  <div className={`p-2 rounded-lg border ${
                    isDark ? "bg-slate-950/40 border-slate-800/60" : "bg-slate-50 border-slate-100"
                  }`}>
                    <span className={`text-[9px] font-black uppercase tracking-widest block ${isDark ? "text-slate-500" : "text-slate-400"}`}>Total</span>
                    <span className="text-base font-black block mt-0.5">{stat.total}</span>
                  </div>
                  <div className={`p-2 rounded-lg border ${
                    isDark ? "bg-slate-950/40 border-slate-800/60" : "bg-orange-50/60 border-orange-200/60"
                  }`}>
                    <span className="text-[9px] font-black text-orange-600 uppercase tracking-widest block">Pending</span>
                    <span className={`text-base font-black block mt-0.5 ${stat.pending > 0 ? "text-orange-600 animate-pulse" : isDark ? "text-slate-600" : "text-slate-400"}`}>
                      {stat.pending}
                    </span>
                  </div>
                  <div className={`p-2 rounded-lg border ${
                    isDark ? "bg-slate-950/40 border-slate-800/60" : "bg-emerald-50/60 border-emerald-200/60"
                  }`}>
                    <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest block">Resolved</span>
                    <span className={`text-base font-black block mt-0.5 ${stat.resolved > 0 ? "text-emerald-600" : isDark ? "text-slate-600" : "text-slate-400"}`}>
                      {stat.resolved}
                    </span>
                  </div>
                </div>

                {/* Active Cycle Contact Breakdown */}
                <div className="grid grid-cols-3 gap-1.5 mt-2 text-center text-[10px]">
                  <div className={`p-1.5 rounded-md border transition-colors ${
                    isDark ? "bg-rose-950/20 border-rose-900/40 text-rose-400" : "bg-rose-50 border-rose-200 text-rose-700"
                  }`}>
                    <span className={`text-[8px] font-black uppercase block ${isDark ? "text-rose-400" : "text-rose-700"}`}>Not Contacted</span>
                    <span className={`font-black ${stat.notContacted > 0 ? (isDark ? "text-rose-400" : "text-rose-700") + " font-black text-xs" : isDark ? "text-slate-600" : "text-slate-400"}`}>
                      {stat.notContacted}
                    </span>
                  </div>
                  <div className={`p-1.5 rounded-md border transition-colors ${
                    isDark ? "bg-emerald-950/20 border-emerald-900/40 text-emerald-400" : "bg-emerald-50 border-emerald-200 text-emerald-700"
                  }`}>
                    <span className={`text-[8px] font-black uppercase block ${isDark ? "text-emerald-400" : "text-emerald-700"}`}>Contacted</span>
                    <span className={`font-black ${stat.contacted > 0 ? (isDark ? "text-emerald-400" : "text-emerald-700") + " font-black text-xs" : isDark ? "text-slate-600" : "text-slate-400"}`}>
                      {stat.contacted}
                    </span>
                  </div>
                  <div className={`p-1.5 rounded-md border transition-colors ${
                    isDark ? "bg-amber-950/20 border-amber-900/40 text-amber-400" : "bg-amber-50 border-amber-200 text-amber-700"
                  }`}>
                    <span className={`text-[8px] font-black uppercase block ${isDark ? "text-amber-400" : "text-amber-700"}`}>Attempted</span>
                    <span className={`font-black ${stat.attempted > 0 ? (isDark ? "text-amber-400" : "text-amber-700") + " font-black text-xs" : isDark ? "text-slate-600" : "text-slate-400"}`}>
                      {stat.attempted}
                    </span>
                  </div>
                </div>

                {/* Rejected Response Re-Action Needed Banner */}
                {stat.rejectedReAction > 0 && (
                  <div
                    onClick={() => onSelectStation(stat.stationCode)}
                    className={`mt-2.5 border rounded-lg p-2 text-center flex items-center justify-between cursor-pointer transition-all shadow-2xs ${
                      isDark 
                        ? "bg-rose-950/30 border-rose-900/60 text-rose-300 hover:bg-rose-950/50" 
                        : "bg-rose-50 border-rose-300 text-rose-800 hover:bg-rose-100/80"
                    }`}
                    title="Click to manage re-action queue for this station"
                  >
                    <span className={`text-[10px] font-black uppercase flex items-center gap-1 ${isDark ? "text-rose-300" : "text-rose-800"}`}>
                      <AlertTriangle className="h-3 w-3 text-rose-500 shrink-0" />
                      {stat.rejectedReAction} Response{stat.rejectedReAction > 1 ? "s" : ""} Rejected
                    </span>
                    <span className="text-[9px] bg-rose-600 hover:bg-rose-700 text-white font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">
                      Re-Action Queue →
                    </span>
                  </div>
                )}

                {/* Progress bar */}
                <div className="mt-4 space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className={`font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>CX Recovery Rate</span>
                    <span className={`font-bold ${isDark ? "text-indigo-400" : "text-indigo-600"}`}>{stat.recoveryRate}%</span>
                  </div>
                  <div className={`w-full h-2 rounded-full overflow-hidden border ${
                    isDark ? "bg-slate-950 border-slate-800" : "bg-slate-100 border-slate-200"
                  }`}>
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isDark ? "bg-indigo-500" : "bg-indigo-600"
                      }`}
                      style={{ width: `${Math.min(100, stat.recoveryRate)}%` }}
                    />
                  </div>
                </div>

                {/* Officers / Contact Info */}
                {matchedStationProfile && (
                  <div className={`mt-3 p-2.5 rounded-lg border space-y-1 transition-colors ${
                    isDark ? "bg-slate-950/60 border-slate-800/80" : "bg-slate-50 border-slate-200/60"
                  }`}>
                    <div className={`flex items-center justify-between text-[10px] font-bold ${
                      isDark ? "text-slate-400" : "text-slate-500"
                    }`}>
                      <span>Contact Email(s):</span>
                      <span className={`font-mono text-[9px] font-extrabold truncate max-w-[170px] ${
                        isDark ? "text-blue-400" : "text-blue-600"
                      }`}>
                        {matchedStationProfile.email}
                      </span>
                    </div>
                    {matchedStationProfile.officers && matchedStationProfile.officers.length > 0 && (
                      <div className={`text-[10px] font-medium pt-0.5 border-t ${
                        isDark ? "text-slate-300 border-slate-800" : "text-slate-700 border-slate-200/40"
                      }`}>
                        <span className="font-bold">Manager:</span> {matchedStationProfile.officers[0].name} ({matchedStationProfile.officers[0].role})
                      </div>
                    )}
                  </div>
                )}

                {/* Station SLA Ageing Matrix (Strictly computed on Active Pending Cases) */}
                <div className={`mt-3.5 pt-3 border-t space-y-1.5 ${
                  isDark ? "border-slate-800" : "border-slate-100"
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                      isDark ? "text-slate-400" : "text-slate-600"
                    }`}>
                      <Clock className="h-3 w-3 text-blue-500 shrink-0" />
                      Active Cycle SLA Matrix
                    </span>
                    <span className={`text-[9px] font-mono font-bold ${isDark ? "text-slate-500" : "text-slate-500"}`}>
                      Pending Sum = {stat.slaTotal}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className={`px-2 py-1 rounded-md border flex items-center justify-between text-[10px] font-bold ${
                      isDark ? "bg-emerald-950/25 text-emerald-400 border-emerald-900/50" : "bg-emerald-50 text-emerald-800 border-emerald-300"
                    }`}>
                      <span className="truncate mr-1 text-[9px] font-extrabold">0-3 Days (New)</span>
                      <span className="font-mono font-black">{stat.sla_0_3}</span>
                    </div>
                    <div className={`px-2 py-1 rounded-md border flex items-center justify-between text-[10px] font-bold ${
                      isDark ? "bg-amber-950/25 text-amber-400 border-amber-900/50" : "bg-amber-50 text-amber-800 border-amber-300"
                    }`}>
                      <span className="truncate mr-1 text-[9px] font-extrabold">3-5 Days (Pending)</span>
                      <span className="font-mono font-black">{stat.sla_3_5}</span>
                    </div>
                    <div className={`px-2 py-1 rounded-md border flex items-center justify-between text-[10px] font-bold ${
                      isDark ? "bg-orange-950/25 text-orange-400 border-orange-900/50" : "bg-orange-50 text-orange-800 border-orange-300"
                    }`}>
                      <span className="truncate mr-1 text-[9px] font-extrabold">6-10 Days (Escalated)</span>
                      <span className="font-mono font-black">{stat.sla_6_10}</span>
                    </div>
                    <div className={`px-2 py-1 rounded-md border flex items-center justify-between text-[10px] font-bold ${
                      isDark ? "bg-rose-950/25 text-rose-400 border-rose-900/50" : "bg-rose-50 text-rose-800 border-rose-300"
                    }`}>
                      <span className="truncate mr-1 text-[9px] font-extrabold">&gt;10 Days (Critical)</span>
                      <span className="font-mono font-black">{stat.sla_gt_10}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className={`mt-5 pt-3 border-t flex items-center justify-between flex-wrap gap-2 ${
                isDark ? "border-slate-800/80" : "border-slate-100"
              }`}>
                {onOpenCalendarModal && (
                  <button
                    id={`btn-station-calendar-${stat.stationCode}`}
                    type="button"
                    onClick={() => onOpenCalendarModal(stat.stationName)}
                    className={`text-[10px] font-bold flex items-center gap-1 px-2 py-1 rounded border transition-all ${
                      isDark
                        ? "bg-slate-950 border-slate-800 text-blue-400 hover:bg-slate-800"
                        : "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                    }`}
                    title="View / Edit Station Working & Holiday Dates"
                  >
                    <Calendar className="h-3 w-3 text-blue-600" />
                    <span>Dates ({stationOffDates.length})</span>
                  </button>
                )}

                <div className="flex items-center gap-3 ml-auto">
                  <span className="text-[10px] flex items-center gap-1 font-semibold">
                    {stat.pending > 0 ? (
                      <>
                        <AlertCircle className="h-3 w-3 text-orange-500" />
                        <span className={isDark ? "text-slate-300" : "text-slate-600"}>Action required</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-3 w-3 text-green-500" />
                        <span className={isDark ? "text-slate-400" : "text-slate-500"}>All clear</span>
                      </>
                    )}
                  </span>
                  <button
                    id={`btn-view-station-${stat.stationCode}`}
                    type="button"
                    onClick={() => onSelectStation(stat.stationCode)}
                    className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1 hover:underline transition-all ${
                      isDark ? "text-red-400 hover:text-red-300" : "text-blue-600 hover:text-blue-700"
                    }`}
                  >
                    Manage Station
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Diagnostics / Reconciliation Modal */}
      {showDiagnosticsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className={`w-full max-w-5xl rounded-2xl shadow-2xl border overflow-hidden flex flex-col max-h-[90vh] ${
            isDark ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-900"
          }`}>
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-600 text-white">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider">
                    Database Reconciliation & Integrity Diagnostic Engine
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Live record-by-record audit of all {complaints.length} database cases, SLA cycle math, and station tallies.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDiagnosticsModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Reconciliation KPI Strip */}
            <div className="p-4 bg-slate-100/60 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Database Records</span>
                <span className="text-lg font-black text-slate-900 dark:text-white block mt-0.5">{complaints.length}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold text-emerald-600 uppercase block">Clean &amp; Reconciled</span>
                <span className="text-lg font-black text-emerald-600 block mt-0.5">{auditReport.cleanCasesCount}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold text-rose-600 uppercase block">Discrepancies / Conflicts</span>
                <span className="text-lg font-black text-rose-600 block mt-0.5">{auditReport.issueCasesCount}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold text-blue-600 uppercase block">Mathematical Formula Integrity</span>
                <span className="text-sm font-black text-emerald-600 block mt-1">
                  {nationalSummary.isFullyReconciled ? "100% VALIDATED" : "CHECK REQUIRED"}
                </span>
              </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap gap-2 items-center justify-between">
              <div className="relative flex-1 min-w-[200px]">
                <input
                  type="text"
                  placeholder="Search by ID, customer name, station, or status..."
                  value={diagnosticSearch}
                  onChange={(e) => setDiagnosticSearch(e.target.value)}
                  className="w-full text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md py-1.5 pl-8 pr-3 text-slate-800 dark:text-slate-100"
                />
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              </div>
              <select
                value={filterStationDiagnostics}
                onChange={(e) => setFilterStationDiagnostics(e.target.value)}
                className="text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-slate-800 dark:text-slate-100"
              >
                <option value="all">All Service Stations</option>
                {nationalSummary.stationMetrics.map(sm => (
                  <option key={sm.stationCode} value={sm.stationCode}>{sm.stationName}</option>
                ))}
              </select>
            </div>

            {/* Diagnostic Table */}
            <div className="flex-1 overflow-y-auto p-4">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-black text-slate-500">
                    <th className="py-2 px-2">Case ID</th>
                    <th className="py-2 px-2">Customer</th>
                    <th className="py-2 px-2">Station</th>
                    <th className="py-2 px-2">DB Status</th>
                    <th className="py-2 px-2">Cycle Contact</th>
                    <th className="py-2 px-2">SLA Ageing</th>
                    <th className="py-2 px-2">SLA Bucket</th>
                    <th className="py-2 px-2">Reconciliation Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {filteredAuditItems.map(item => (
                    <tr key={item.complaintId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-2 px-2 font-mono font-bold text-blue-600 dark:text-blue-400">{item.complaintId}</td>
                      <td className="py-2 px-2 font-semibold text-slate-800 dark:text-slate-200">{item.customerName}</td>
                      <td className="py-2 px-2">{item.station}</td>
                      <td className="py-2 px-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          item.isResolved 
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : item.isRejected
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                              : "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300"
                        }`}>
                          {item.isResolved ? "Resolved" : item.isRejected ? "Re-Action Required" : "Pending"}
                        </span>
                      </td>
                      <td className="py-2 px-2 font-mono text-[11px]">{item.cycleContactStatus}</td>
                      <td className="py-2 px-2 font-mono text-[11px]">{item.slaWorkingDays} working days</td>
                      <td className="py-2 px-2 font-semibold">{item.slaBucket}</td>
                      <td className="py-2 px-2">
                        {item.issues.length === 0 ? (
                          <span className="text-emerald-600 font-bold flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Reconciled
                          </span>
                        ) : (
                          <span className="text-rose-600 font-bold flex items-center gap-1" title={item.issues.join("; ")}>
                            <AlertTriangle className="h-3.5 w-3.5" /> {item.issues[0]}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950 text-xs">
              <span className="text-slate-500 font-bold">
                Showing {filteredAuditItems.length} of {complaints.length} database cases
              </span>
              <button
                type="button"
                onClick={() => setShowDiagnosticsModal(false)}
                className="px-3 py-1 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold rounded-md hover:bg-slate-300 dark:hover:bg-slate-700"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
