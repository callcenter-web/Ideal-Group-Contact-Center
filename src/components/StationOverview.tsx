import React from "react";
import { Complaint, StationProfile, WorkstationCalendarDate } from "../types";
import { STATIONS } from "../demoData";
import { MapPin, ArrowRight, ShieldCheck, AlertCircle, Clock, Calendar } from "lucide-react";
import { getAgeFormulaBreakdown } from "../utils/agingUtils";
import { matchesStationCodeOrName } from "../utils/stationUtils";

interface StationOverviewProps {
  complaints: Complaint[];
  onSelectStation: (stationCode: string) => void;
  calendarDates?: WorkstationCalendarDate[];
  onOpenCalendarModal?: (stationName: string) => void;
  theme?: "light" | "dark";
}

export default function StationOverview({ complaints, onSelectStation, calendarDates = [], onOpenCalendarModal, theme = "light" }: StationOverviewProps) {
  const isDark = theme === "dark";

  // Calculate metrics per station
  const stationStats = STATIONS.map((station) => {
    const stationComplaints = complaints.filter((c) => matchesStationCodeOrName(c.station, station.code));
    const total = stationComplaints.length;
    const pending = stationComplaints.filter((c) => c.status === "Pending").length;
    const inProgress = stationComplaints.filter((c) => c.status === "In Progress").length;
    const resolved = stationComplaints.filter((c) => c.status === "Resolved").length;
    
    // Converted: Initial was Dissatisfied, now Neutral/Satisfied/Very Satisfied
    const converted = stationComplaints.filter(
      (c) => c.status === "Resolved" || c.currentSatisfaction === "Satisfied" || c.currentSatisfaction === "Very Satisfied"
    ).length;

    const conversionRate = total > 0 ? Math.round((converted / total) * 100) : 0;
    const ageBreakdown = getAgeFormulaBreakdown(stationComplaints, new Date(), calendarDates);

    // Filter station custom off dates
    const stationOffDates = calendarDates.filter(
      (d) => d.station === "All" || d.station.toLowerCase() === station.name.toLowerCase() || d.station.toLowerCase() === station.code.toLowerCase()
    );

    return {
      ...station,
      total,
      pending,
      inProgress,
      resolved,
      conversionRate,
      ageBreakdown,
      stationComplaints,
      stationOffDates,
    };
  });


  return (
    <div id="stations-performance-panel" className="space-y-4">
      <div className={`flex items-center justify-between border-b pb-3 mb-2 transition-colors duration-500 ${
        isDark ? "border-slate-800" : "border-slate-200"
      }`}>
        <div>
          <h3 className={`text-sm font-black uppercase tracking-widest transition-colors duration-500 ${
            isDark ? "text-slate-100" : "text-slate-800"
          }`}>
            Regional Service Station Performance
          </h3>
          <p className={`text-xs mt-0.5 transition-colors duration-500 ${
            isDark ? "text-slate-400" : "text-slate-500"
          }`}>
            Real-time conversion metrics and unresolved backlogs across active service areas.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stationStats.map((stat) => (
          <div
            key={stat.code}
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
                    {stat.name}
                  </span>
                </div>
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                  isDark 
                    ? "text-slate-400 bg-slate-950 border-slate-800" 
                    : "text-slate-500 bg-slate-50 border-slate-200"
                }`}>
                  {stat.code}
                </span>
              </div>

              {/* Stat breakdown */}
              <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                <div className={`p-2 rounded border ${
                  isDark ? "bg-slate-950/40 border-slate-800/60" : "bg-slate-50 border-slate-100"
                }`}>
                  <span className={`text-[9px] font-black uppercase tracking-widest block ${isDark ? "text-slate-500" : "text-slate-400"}`}>Total</span>
                  <span className="text-base font-black block mt-0.5">{stat.total}</span>
                </div>
                <div className={`p-2 rounded border ${
                  isDark ? "bg-slate-950/40 border-slate-800/60" : "bg-slate-50 border-slate-100"
                }`}>
                  <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest block">Pending</span>
                  <span className={`text-base font-black block mt-0.5 ${stat.pending > 0 ? "text-orange-500 animate-pulse" : isDark ? "text-slate-600" : "text-slate-400"}`}>
                    {stat.pending}
                  </span>
                </div>
                <div className={`p-2 rounded border ${
                  isDark ? "bg-slate-950/40 border-slate-800/60" : "bg-slate-50 border-slate-100"
                }`}>
                  <span className="text-[9px] font-black text-green-500 uppercase tracking-widest block">Resolved</span>
                  <span className={`text-base font-black block mt-0.5 ${stat.resolved > 0 ? "text-green-500" : isDark ? "text-slate-600" : "text-slate-400"}`}>{stat.resolved}</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-4 space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className={`font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>CX Recovery Rate</span>
                  <span className={`font-bold ${isDark ? "text-red-400" : "text-blue-600"}`}>{stat.conversionRate}%</span>
                </div>
                <div className={`w-full h-2 rounded-full overflow-hidden border ${
                  isDark ? "bg-slate-950 border-slate-800" : "bg-slate-100 border-slate-200"
                }`}>
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isDark ? "bg-gradient-to-r from-red-600 to-green-500" : "bg-gradient-to-r from-blue-600 to-green-500"
                    }`}
                    style={{ width: `${stat.conversionRate}%` }}
                  />
                </div>
              </div>
              {/* Officers / Systemic Dispatch Info */}
              <div className="mt-3 bg-slate-50 dark:bg-slate-950/50 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  <span>Contact Email(s):</span>
                  <span className="font-mono text-[9px] text-blue-600 dark:text-blue-400 font-extrabold truncate max-w-[170px]">
                    {stat.email}
                  </span>
                </div>
                {stat.address && (
                  <p className="text-[10px] text-slate-600 dark:text-slate-400 truncate">
                    📍 {stat.address}
                  </p>
                )}
                {stat.officers && stat.officers.length > 0 && (
                  <div className="text-[10px] text-slate-700 dark:text-slate-300 font-medium pt-0.5 border-t border-slate-200/40 dark:border-slate-800">
                    <span className="font-bold">Manager:</span> {stat.officers[0].name} ({stat.officers[0].role}) &bull; Tel: <span className="font-mono font-bold">{stat.officers[0].phone}</span>
                  </div>
                )}
              </div>

              {/* Station Aging Breakdown Matrix */}
              <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                    isDark ? "text-slate-400" : "text-slate-600"
                  }`}>
                    <Clock className="h-3 w-3 text-blue-500 shrink-0" />
                    Station Aging Matrix
                  </span>
                  <span className={`text-[9px] font-mono font-bold ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                    SLA Status
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {stat.ageBreakdown.map((item) => (
                    <div
                      key={item.category}
                      className={`px-2 py-1 rounded border flex items-center justify-between text-[10px] font-bold ${
                        isDark 
                          ? `${item.badgeColorClass} bg-opacity-20 border-opacity-30` 
                          : item.badgeColorClass
                      }`}
                    >
                      <span className="truncate mr-1 text-[9px] font-extrabold">{item.category}</span>
                      <span className="font-mono font-black">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className={`mt-5 pt-3 border-t flex items-center justify-between flex-wrap gap-2 ${
              isDark ? "border-slate-800/80" : "border-slate-100"
            }`}>
              {onOpenCalendarModal && (
                <button
                  id={`btn-station-calendar-${stat.code}`}
                  type="button"
                  onClick={() => onOpenCalendarModal(stat.name)}
                  className={`text-[10px] font-bold flex items-center gap-1 px-2 py-1 rounded border transition-all ${
                    isDark
                      ? "bg-slate-950 border-slate-800 text-blue-400 hover:bg-slate-800"
                      : "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                  }`}
                  title="View / Edit Station Working & Cancelled Dates"
                >
                  <Calendar className="h-3 w-3 text-blue-600" />
                  <span>Dates ({stat.stationOffDates.length})</span>
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
                  id={`btn-view-station-${stat.code}`}
                  type="button"
                  onClick={() => onSelectStation(stat.code)}
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
        ))}
      </div>
    </div>
  );
}
