import React, { useState } from "react";
import { 
  X, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Download, 
  MapPin, 
  Users, 
  TrendingUp, 
  Filter, 
  Search, 
  PhoneCall, 
  RefreshCcw,
  FileSpreadsheet,
  ShieldAlert,
  ArrowUpRight
} from "lucide-react";
import { Complaint } from "../types";
import { STATIONS } from "../demoData";
import { matchesStationCodeOrName } from "../utils/stationUtils";

interface CallCenterSLAReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  complaints: Complaint[];
  theme?: "light" | "dark";
  onSelectComplaint?: (complaintId: string) => void;
}

export default function CallCenterSLAReportModal({
  isOpen,
  onClose,
  complaints,
  theme = "light",
  onSelectComplaint
}: CallCenterSLAReportModalProps) {
  const isDark = theme === "dark";

  const [selectedStation, setSelectedStation] = useState<string>("all");
  const [slaFilter, setSlaFilter] = useState<"all" | "compliant" | "breached">("all");
  const [agingFilter, setAgingFilter] = useState<"all" | "0-2" | "3-5" | "6-10" | "11+">("all");
  const [attemptFilter, setAttemptFilter] = useState<"all" | "1st" | "2nd" | "rejected">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  if (!isOpen) return null;

  const todayStr = "2026-08-05"; // Anchor system date

  // Helper: check if station has contacted / actioned the customer
  const isStationContacted = (c: Complaint) => {
    return !!(
      c.stationContactedDate ||
      c.stationResolutionNotes ||
      (c.notes && c.notes.length > 0) ||
      c.status === "Contacted" ||
      c.stationResponseStatus === "Submitted to Call Center"
    );
  };

  // Helper: calculate age in days since station contacted customer (or date received)
  const getCallCenterAgeInDays = (c: Complaint) => {
    const baseDateStr = c.stationContactedDate || c.date || todayStr;
    const baseDate = new Date(baseDateStr);
    const now = new Date(todayStr);
    if (isNaN(baseDate.getTime())) return 0;
    const diffTime = Math.max(0, now.getTime() - baseDate.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  // Helper: SLA Status (SLA target is 24 hours / 1 day for Call Center contact after Station contact)
  const getSLAStatus = (c: Complaint) => {
    const ageDays = getCallCenterAgeInDays(c);
    if (c.callCenterContactedDate) {
      return { isBreached: false, label: "Contacted (On-Time)", color: "text-green-600 bg-green-50 border-green-200" };
    }
    if (ageDays <= 1) {
      return { isBreached: false, label: "On-Time (Within 24h SLA)", color: "text-emerald-700 bg-emerald-50 border-emerald-200" };
    }
    return { isBreached: true, label: `SLA Breached (${ageDays}d pending)`, color: "text-rose-700 bg-rose-50 border-rose-300 font-extrabold" };
  };

  // Helper: Aging Bucket
  const getAgingBucket = (days: number): "0-2" | "3-5" | "6-10" | "11+" => {
    if (days <= 2) return "0-2";
    if (days <= 5) return "3-5";
    if (days <= 10) return "6-10";
    return "11+";
  };

  // Filter complaints that require Call Center Attention (Station Contacted, or Rejected, or Call Center pending)
  const callCenterPendingComplaints = complaints.filter((c) => {
    const stationActioned = isStationContacted(c);
    const isPendingCallCenter = !c.callCenterFinalRemarks && c.status !== "Resolved";
    const isRejected = c.stationResponseStatus === "Rejected";
    return (stationActioned && isPendingCallCenter) || isRejected;
  });

  // Calculate Overall SLA Metrics
  const totalPendingCC = callCenterPendingComplaints.length;
  const slaBreachedCC = callCenterPendingComplaints.filter((c) => getSLAStatus(c).isBreached).length;
  const slaCompliantCC = totalPendingCC - slaBreachedCC;
  const slaRate = totalPendingCC > 0 ? Math.round((slaCompliantCC / totalPendingCC) * 100) : 100;

  const count1stAttempt = callCenterPendingComplaints.filter(
    (c) => c.stationResponseStatus !== "Rejected" && (!c.firstAttemptCallStatus || c.attemptCount === 0)
  ).length;

  const count2ndAttempt = callCenterPendingComplaints.filter(
    (c) => c.stationResponseStatus !== "Rejected" && (!!c.firstAttemptCallStatus || (c.attemptCount && c.attemptCount >= 1))
  ).length;

  const countRejected = callCenterPendingComplaints.filter(
    (c) => c.stationResponseStatus === "Rejected"
  ).length;

  // Aging Counts
  const aging0to2 = callCenterPendingComplaints.filter((c) => getAgingBucket(getCallCenterAgeInDays(c)) === "0-2").length;
  const aging3to5 = callCenterPendingComplaints.filter((c) => getAgingBucket(getCallCenterAgeInDays(c)) === "3-5").length;
  const aging6to10 = callCenterPendingComplaints.filter((c) => getAgingBucket(getCallCenterAgeInDays(c)) === "6-10").length;
  const aging11Plus = callCenterPendingComplaints.filter((c) => getAgingBucket(getCallCenterAgeInDays(c)) === "11+").length;

  // Station-wise Breakdown
  const stationStats = STATIONS.map((station) => {
    const stationComplaints = callCenterPendingComplaints.filter((c) => matchesStationCodeOrName(c.station, station.code));
    const total = stationComplaints.length;
    const breached = stationComplaints.filter((c) => getSLAStatus(c).isBreached).length;
    const compliant = total - breached;
    const slaPercent = total > 0 ? Math.round((compliant / total) * 100) : 100;
    const firstAttempt = stationComplaints.filter((c) => c.stationResponseStatus !== "Rejected" && (!c.firstAttemptCallStatus || c.attemptCount === 0)).length;
    const secondAttempt = stationComplaints.filter((c) => c.stationResponseStatus !== "Rejected" && (!!c.firstAttemptCallStatus || (c.attemptCount && c.attemptCount >= 1))).length;
    const rejected = stationComplaints.filter((c) => c.stationResponseStatus === "Rejected").length;

    const b02 = stationComplaints.filter((c) => getAgingBucket(getCallCenterAgeInDays(c)) === "0-2").length;
    const b35 = stationComplaints.filter((c) => getAgingBucket(getCallCenterAgeInDays(c)) === "3-5").length;
    const b610 = stationComplaints.filter((c) => getAgingBucket(getCallCenterAgeInDays(c)) === "6-10").length;
    const b11p = stationComplaints.filter((c) => getAgingBucket(getCallCenterAgeInDays(c)) === "11+").length;

    return {
      station,
      total,
      breached,
      compliant,
      slaPercent,
      firstAttempt,
      secondAttempt,
      rejected,
      aging: { b02, b35, b610, b11p }
    };
  });

  // Filtered List for Details Table
  const filteredList = callCenterPendingComplaints.filter((c) => {
    // Station filter
    if (selectedStation !== "all") {
      const selected = STATIONS.find((s) => s.code === selectedStation);
      if (selected && !matchesStationCodeOrName(c.station, selected.code)) return false;
    }

    // SLA filter
    const slaInfo = getSLAStatus(c);
    if (slaFilter === "compliant" && slaInfo.isBreached) return false;
    if (slaFilter === "breached" && !slaInfo.isBreached) return false;

    // Aging filter
    const ageDays = getCallCenterAgeInDays(c);
    const bucket = getAgingBucket(ageDays);
    if (agingFilter !== "all" && bucket !== agingFilter) return false;

    // Attempt filter
    if (attemptFilter === "1st" && (c.stationResponseStatus === "Rejected" || !!c.firstAttemptCallStatus)) return false;
    if (attemptFilter === "2nd" && (c.stationResponseStatus === "Rejected" || !c.firstAttemptCallStatus)) return false;
    if (attemptFilter === "rejected" && c.stationResponseStatus !== "Rejected") return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = c.customerName.toLowerCase().includes(q);
      const matchPhone = c.customerPhone.toLowerCase().includes(q);
      const matchWo = (c.woNo || "").toLowerCase().includes(q);
      const matchStation = c.station.toLowerCase().includes(q);
      const matchDesc = c.description.toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchWo && !matchStation && !matchDesc) return false;
    }

    return true;
  });

  // Export Report to CSV
  const handleExportCSV = () => {
    const headers = [
      "WO No",
      "Customer Name",
      "Phone",
      "Service Station",
      "Complaint Category",
      "Date Received",
      "Station Contacted Date",
      "Station Action Notes",
      "Call Center Attempt Status",
      "1st Attempt Status",
      "2nd Attempt Status",
      "Aging (Days)",
      "Aging Category",
      "SLA Status",
      "Response Status"
    ];

    const rows = filteredList.map((c) => {
      const ageDays = getCallCenterAgeInDays(c);
      const sla = getSLAStatus(c);
      const bucket = getAgingBucket(ageDays);
      let attemptState = "1st Attempt Pending";
      if (c.stationResponseStatus === "Rejected") attemptState = "Station Response Rejected";
      else if (c.firstAttemptCallStatus) attemptState = "2nd Attempt Pending";

      return [
        `"${c.woNo || c.id}"`,
        `"${c.customerName}"`,
        `"${c.customerPhone}"`,
        `"${c.station}"`,
        `"${c.category}"`,
        `"${c.date}"`,
        `"${c.stationContactedDate || "N/A"}"`,
        `"${(c.stationResolutionNotes || "").replace(/"/g, '""')}"`,
        `"${attemptState}"`,
        `"${c.firstAttemptCallStatus || "None"}"`,
        `"${c.secondAttemptFeedbackStatus || "None"}"`,
        ageDays,
        `"${bucket} Days"`,
        `"${sla.isBreached ? "SLA BREACHED" : "On-Time SLA"}"`,
        `"${c.stationResponseStatus || "Submitted"}"`
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Call_Center_SLA_Aging_Report_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 overflow-y-auto">
      <div className={`w-full max-w-6xl rounded-2xl shadow-2xl border flex flex-col max-h-[92vh] ${isDark ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-800"}`}>
        
        {/* MODAL HEADER */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? "border-slate-800 bg-slate-950/60" : "border-slate-200 bg-slate-50/80"}`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-md">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight">Call Center Pending Details (SLA & Aging Report)</h2>
                <span className="bg-blue-100 border border-blue-300 text-blue-800 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                  Admin & Management Dashboard
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Comprehensive customer contact reports, SLA compliance rates, and aging-wise analysis for Call Center follow-ups.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-3.5 rounded-xl shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Download className="h-4 w-4" />
              <span>Export CSV Report</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="p-6 overflow-y-auto space-y-6">

          {/* TOP METRICS SUMMARY BAR */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-xl shadow-2xs">
              <span className="text-[10px] font-black text-blue-700 uppercase tracking-wider block mb-1">
                Total Call Center Pending
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-blue-900">{totalPendingCC}</span>
                <span className="text-[10px] bg-blue-200 text-blue-800 font-bold px-1.5 py-0.5 rounded">
                  Station Actioned
                </span>
              </div>
              <p className="text-[10px] text-blue-600 mt-1 font-semibold">Customers ready for CC contact</p>
            </div>

            <div className={`p-3.5 rounded-xl border shadow-2xs ${slaRate >= 80 ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
              <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider block mb-1">
                SLA Compliance Rate
              </span>
              <div className="flex items-baseline justify-between">
                <span className={`text-2xl font-black ${slaRate >= 80 ? "text-emerald-800" : "text-amber-800"}`}>{slaRate}%</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                  Target: 24h SLA
                </span>
              </div>
              <p className="text-[10px] text-slate-600 mt-1 font-semibold">{slaCompliantCC} On-Time / {slaBreachedCC} Breached</p>
            </div>

            <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-xl shadow-2xs">
              <span className="text-[10px] font-black text-rose-800 uppercase tracking-wider block mb-1">
                SLA Breached (&gt;24h Delay)
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-rose-900">{slaBreachedCC}</span>
                <span className="text-[10px] bg-rose-200 text-rose-900 font-black px-1.5 py-0.5 rounded animate-pulse">
                  Urgent Action
                </span>
              </div>
              <p className="text-[10px] text-rose-700 mt-1 font-bold">Overdue for CC follow-up</p>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl shadow-2xs">
              <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider block mb-1">
                1st vs 2nd Attempts
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-black text-amber-900">
                  📞 {count1stAttempt} <span className="text-slate-400 font-normal">|</span> 🔁 {count2ndAttempt}
                </span>
              </div>
              <p className="text-[10px] text-amber-700 mt-1 font-semibold">1st Attempt vs 2nd Attempt Needed</p>
            </div>

            <div className="bg-purple-50 border border-purple-200 p-3.5 rounded-xl shadow-2xs">
              <span className="text-[10px] font-black text-purple-800 uppercase tracking-wider block mb-1">
                Rejected Responses
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-purple-900">{countRejected}</span>
                <span className="text-[10px] bg-purple-200 text-purple-900 font-extrabold px-1.5 py-0.5 rounded">
                  Workshop Re-Action
                </span>
              </div>
              <p className="text-[10px] text-purple-700 mt-1 font-semibold">Sent back to workshop</p>
            </div>
          </div>

          {/* AGING BREAKDOWN CARDS */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-blue-600" />
              <span>Aging-Wise Pending Contact Breakdown</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div 
                onClick={() => setAgingFilter(agingFilter === "0-2" ? "all" : "0-2")}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  agingFilter === "0-2" ? "ring-2 ring-emerald-500 bg-emerald-100/80" : "bg-emerald-50 border-emerald-200 hover:bg-emerald-100/50"
                }`}
              >
                <span className="text-[10px] font-bold text-emerald-800 uppercase">🟢 0 - 2 Days (Fresh)</span>
                <div className="text-xl font-black text-emerald-950 mt-1">{aging0to2} Customers</div>
                <span className="text-[9px] text-emerald-700 font-medium">Within normal timeline</span>
              </div>

              <div 
                onClick={() => setAgingFilter(agingFilter === "3-5" ? "all" : "3-5")}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  agingFilter === "3-5" ? "ring-2 ring-amber-500 bg-amber-100/80" : "bg-amber-50 border-amber-200 hover:bg-amber-100/50"
                }`}
              >
                <span className="text-[10px] font-bold text-amber-800 uppercase">🟡 3 - 5 Days (Moderate)</span>
                <div className="text-xl font-black text-amber-950 mt-1">{aging3to5} Customers</div>
                <span className="text-[9px] text-amber-700 font-medium">Requires follow-up priority</span>
              </div>

              <div 
                onClick={() => setAgingFilter(agingFilter === "6-10" ? "all" : "6-10")}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  agingFilter === "6-10" ? "ring-2 ring-orange-500 bg-orange-100/80" : "bg-orange-50 border-orange-200 hover:bg-orange-100/50"
                }`}
              >
                <span className="text-[10px] font-bold text-orange-800 uppercase">🟠 6 - 10 Days (Delayed)</span>
                <div className="text-xl font-black text-orange-950 mt-1">{aging6to10} Customers</div>
                <span className="text-[9px] text-orange-700 font-bold">High SLA breach risk</span>
              </div>

              <div 
                onClick={() => setAgingFilter(agingFilter === "11+" ? "all" : "11+")}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  agingFilter === "11+" ? "ring-2 ring-rose-500 bg-rose-100/80" : "bg-rose-50 border-rose-200 hover:bg-rose-100/50"
                }`}
              >
                <span className="text-[10px] font-black text-rose-800 uppercase">🔴 11+ Days (Critical)</span>
                <div className="text-xl font-black text-rose-950 mt-1">{aging11Plus} Customers</div>
                <span className="text-[9px] text-rose-700 font-bold">Immediate supervisor review</span>
              </div>
            </div>
          </div>

          {/* STATION SLA PERFORMANCE SUMMARY TABLE */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-blue-600" />
                <span>Service Station SLA & Call Center Contact Summary</span>
              </h3>
              <span className="text-[11px] font-bold text-slate-500">
                Click any station row to filter detailed list below
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold text-[10px] uppercase border-b border-slate-200">
                    <th className="py-2 px-3">Service Station</th>
                    <th className="py-2 px-3 text-center">Total CC Pending</th>
                    <th className="py-2 px-3 text-center">1st Attempt</th>
                    <th className="py-2 px-3 text-center">2nd Attempt</th>
                    <th className="py-2 px-3 text-center">Rejected</th>
                    <th className="py-2 px-3 text-center">SLA Breached</th>
                    <th className="py-2 px-3 text-center">SLA Rate</th>
                    <th className="py-2 px-3 text-center">Aging (0-2d / 3-5d / 6-10d / 11+d)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stationStats.map((st) => (
                    <tr 
                      key={st.station.code}
                      onClick={() => setSelectedStation(selectedStation === st.station.code ? "all" : st.station.code)}
                      className={`hover:bg-blue-50/50 transition-all cursor-pointer font-medium ${
                        selectedStation === st.station.code ? "bg-blue-50 font-bold" : ""
                      }`}
                    >
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900">{st.station.name}</span>
                          <span className="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-mono">
                            {st.station.code}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center font-black text-blue-900">{st.total}</td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-700">{st.firstAttempt}</td>
                      <td className="py-2.5 px-3 text-center font-bold text-amber-700">{st.secondAttempt}</td>
                      <td className="py-2.5 px-3 text-center font-bold text-purple-700">{st.rejected}</td>
                      <td className="py-2.5 px-3 text-center font-bold text-rose-700">
                        {st.breached > 0 ? (
                          <span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded text-[10px] font-black">
                            ⚠️ {st.breached}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center font-black">
                        <span className={`px-2 py-0.5 rounded text-[10px] ${st.slaPercent >= 80 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                          {st.slaPercent}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center text-[10px] font-mono">
                        <span className="text-emerald-700 font-bold">{st.aging.b02}</span> /{" "}
                        <span className="text-amber-700 font-bold">{st.aging.b35}</span> /{" "}
                        <span className="text-orange-700 font-bold">{st.aging.b610}</span> /{" "}
                        <span className="text-rose-700 font-bold">{st.aging.b11p}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* DETAILED PENDING CUSTOMERS LIST & FILTERS */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  Pending Customer Contact List ({filteredList.length})
                </h3>
              </div>

              {/* SEARCH & FILTERS BAR */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search name, phone, WO..."
                    className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs w-48 focus:outline-none focus:border-blue-500 font-medium"
                  />
                </div>

                {/* Station Filter */}
                <select
                  value={selectedStation}
                  onChange={(e) => setSelectedStation(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg px-2.5 py-1.5 focus:outline-none"
                >
                  <option value="all">All Stations</option>
                  {STATIONS.map((s) => (
                    <option key={s.code} value={s.code}>{s.name} ({s.code})</option>
                  ))}
                </select>

                {/* SLA Filter */}
                <select
                  value={slaFilter}
                  onChange={(e) => setSlaFilter(e.target.value as any)}
                  className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg px-2.5 py-1.5 focus:outline-none"
                >
                  <option value="all">All SLA Statuses</option>
                  <option value="compliant">On-Time SLA (&lt;24h)</option>
                  <option value="breached">SLA Breached (&gt;24h Delay)</option>
                </select>

                {/* Attempt Filter */}
                <select
                  value={attemptFilter}
                  onChange={(e) => setAttemptFilter(e.target.value as any)}
                  className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg px-2.5 py-1.5 focus:outline-none"
                >
                  <option value="all">All Attempts</option>
                  <option value="1st">1st Attempt Pending</option>
                  <option value="2nd">2nd Attempt Pending</option>
                  <option value="rejected">Station Response Rejected</option>
                </select>

                {(selectedStation !== "all" || slaFilter !== "all" || agingFilter !== "all" || attemptFilter !== "all" || searchQuery) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStation("all");
                      setSlaFilter("all");
                      setAgingFilter("all");
                      setAttemptFilter("all");
                      setSearchQuery("");
                    }}
                    className="text-xs text-rose-600 hover:text-rose-700 font-bold px-2 py-1 bg-rose-50 rounded-md"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            </div>

            {/* CUSTOMER LIST TABLE */}
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-100 text-slate-700 font-bold text-[10px] uppercase shadow-2xs z-10">
                  <tr>
                    <th className="py-2.5 px-3">WO No / Customer</th>
                    <th className="py-2.5 px-3">Service Station</th>
                    <th className="py-2.5 px-3">Station Resolution Note</th>
                    <th className="py-2.5 px-3">Current Call Center Status</th>
                    <th className="py-2.5 px-3 text-center">Aging</th>
                    <th className="py-2.5 px-3 text-center">SLA Compliance</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 font-medium italic">
                        No pending call center customer records found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredList.map((c) => {
                      const ageDays = getCallCenterAgeInDays(c);
                      const sla = getSLAStatus(c);
                      const bucket = getAgingBucket(ageDays);

                      return (
                        <tr key={c.id} className="hover:bg-blue-50/40 transition-all font-medium">
                          <td className="py-2.5 px-3">
                            <div className="space-y-0.5">
                              <span className="font-extrabold text-blue-900 block">{c.customerName}</span>
                              <div className="text-[10px] text-slate-500 font-mono">
                                <span>WO: {c.woNo || c.id}</span> • <span>📞 {c.customerPhone}</span>
                              </div>
                            </div>
                          </td>

                          <td className="py-2.5 px-3">
                            <span className="bg-slate-100 text-slate-800 font-bold text-[10px] px-2 py-0.5 rounded border border-slate-200">
                              {c.station}
                            </span>
                          </td>

                          <td className="py-2.5 px-3 max-w-xs">
                            <p className="text-[11px] text-slate-600 line-clamp-2 italic">
                              "{c.stationResolutionNotes || c.notes || "Station contacted customer. Resolution logged."}"
                            </p>
                            <span className="text-[9px] text-slate-400 block mt-0.5">
                              Date: {c.stationContactedDate || c.date}
                            </span>
                          </td>

                          <td className="py-2.5 px-3">
                            {c.stationResponseStatus === "Rejected" ? (
                              <span className="inline-flex items-center text-[10px] bg-rose-100 text-rose-800 border border-rose-300 font-black px-2 py-0.5 rounded uppercase tracking-wider">
                                ❌ Response Rejected
                              </span>
                            ) : c.firstAttemptCallStatus ? (
                              <span className="inline-flex items-center text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-bold px-2 py-0.5 rounded uppercase">
                                🔁 2nd Attempt ({c.firstAttemptCallStatus})
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-[10px] bg-blue-100 text-blue-900 border border-blue-300 font-bold px-2 py-0.5 rounded uppercase">
                                📞 1st Attempt Pending
                              </span>
                            )}
                          </td>

                          <td className="py-2.5 px-3 text-center">
                            <span className={`inline-block text-[10px] font-black px-2 py-0.5 rounded ${
                              bucket === "0-2" ? "bg-emerald-100 text-emerald-800" :
                              bucket === "3-5" ? "bg-amber-100 text-amber-800" :
                              bucket === "6-10" ? "bg-orange-100 text-orange-800" :
                              "bg-rose-100 text-rose-900 animate-pulse"
                            }`}>
                              {ageDays} Days ({bucket}d)
                            </span>
                          </td>

                          <td className="py-2.5 px-3 text-center">
                            <span className={`inline-block text-[10px] px-2 py-0.5 rounded font-bold border ${sla.color}`}>
                              {sla.label}
                            </span>
                          </td>

                          <td className="py-2.5 px-3 text-center">
                            {onSelectComplaint && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectComplaint(c.id);
                                  onClose();
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold px-2.5 py-1 rounded-md shadow-2xs flex items-center gap-1 mx-auto transition-all cursor-pointer"
                              >
                                <span>Open</span>
                                <ArrowUpRight className="h-3 w-3" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* MODAL FOOTER */}
        <div className={`px-6 py-3 border-t flex items-center justify-between ${isDark ? "border-slate-800 bg-slate-950/60" : "border-slate-200 bg-slate-50/80"}`}>
          <div className="text-xs text-slate-500 font-medium">
            Showing <strong className="text-slate-800">{filteredList.length}</strong> of <strong className="text-slate-800">{callCenterPendingComplaints.length}</strong> call center pending records.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs py-2 px-5 rounded-xl transition-all cursor-pointer"
          >
            Close Report
          </button>
        </div>

      </div>
    </div>
  );
}
