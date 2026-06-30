import React from "react";
import { Complaint, StationProfile } from "../types";
import { STATIONS } from "../demoData";
import { MapPin, ArrowRight, ShieldCheck, AlertCircle } from "lucide-react";

interface StationOverviewProps {
  complaints: Complaint[];
  onSelectStation: (stationCode: string) => void;
}

export default function StationOverview({ complaints, onSelectStation }: StationOverviewProps) {
  // Calculate metrics per station
  const stationStats = STATIONS.map((station) => {
    const stationComplaints = complaints.filter((c) => c.station === station.code);
    const total = stationComplaints.length;
    const pending = stationComplaints.filter((c) => c.status === "Pending").length;
    const inProgress = stationComplaints.filter((c) => c.status === "In Progress").length;
    const resolved = stationComplaints.filter((c) => c.status === "Resolved").length;
    
    // Converted: Initial was Dissatisfied, now Neutral/Satisfied/Very Satisfied
    const converted = stationComplaints.filter(
      (c) => c.status === "Resolved" || c.currentSatisfaction === "Satisfied" || c.currentSatisfaction === "Very Satisfied"
    ).length;

    const conversionRate = total > 0 ? Math.round((converted / total) * 100) : 0;

    return {
      ...station,
      total,
      pending,
      inProgress,
      resolved,
      conversionRate,
    };
  });

  return (
    <div id="stations-performance-panel" className="space-y-4">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-2">
        <div>
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            Regional Service Station Performance
          </h3>
          <p className="text-slate-500 text-xs mt-0.5">
            Real-time conversion metrics and unresolved backlogs across active service areas.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stationStats.map((stat) => (
          <div
            key={stat.code}
            className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm flex flex-col justify-between hover:border-blue-300 transition-all text-slate-900"
          >
            <div>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-blue-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-800">{stat.name}</span>
                </div>
                <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                  {stat.code}
                </span>
              </div>

              {/* Stat breakdown */}
              <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                <div className="bg-slate-50 p-2 rounded border border-slate-100">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Total</span>
                  <span className="text-base font-black text-slate-800 block mt-0.5">{stat.total}</span>
                </div>
                <div className="bg-slate-50 p-2 rounded border border-slate-100">
                  <span className="text-[9px] font-bold text-orange-500 uppercase tracking-wider block">Pending</span>
                  <span className={`text-base font-black block mt-0.5 ${stat.pending > 0 ? "text-orange-600" : "text-slate-400"}`}>
                    {stat.pending}
                  </span>
                </div>
                <div className="bg-slate-50 p-2 rounded border border-slate-100">
                  <span className="text-[9px] font-bold text-green-500 uppercase tracking-wider block">Resolved</span>
                  <span className="text-base font-black text-green-600 block mt-0.5">{stat.resolved}</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-4 space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-500 font-semibold">CX Recovery Rate</span>
                  <span className="text-blue-600 font-bold">{stat.conversionRate}%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                  <div
                    className="bg-gradient-to-r from-blue-600 to-green-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${stat.conversionRate}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] text-slate-500 flex items-center gap-1 font-medium">
                {stat.pending > 0 ? (
                  <>
                    <AlertCircle className="h-3 w-3 text-orange-500" />
                    Action required
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-3 w-3 text-green-600" />
                    All clear
                  </>
                )}
              </span>
              <button
                id={`btn-view-station-${stat.code}`}
                type="button"
                onClick={() => onSelectStation(stat.code)}
                className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline transition-all"
              >
                Manage Station
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
