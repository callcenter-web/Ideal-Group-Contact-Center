import React, { useState, useEffect, useMemo } from "react";
import { 
  Search, 
  Filter, 
  ListFilter, 
  Download, 
  Eye, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  MapPin, 
  Phone, 
  ArrowRight,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Sparkles,
  Trash2
} from "lucide-react";
import { Complaint, WorkstationCalendarDate } from "../types";
import { STATIONS } from "../demoData";
import { getComplaintAgeInfo, getAgeFormulaBreakdown } from "../utils/agingUtils";

interface AllComplaintsListProps {
  complaints: Complaint[];
  theme?: "light" | "dark";
  onSelectComplaintInWorkspace: (complaintId: string) => void;
  onDeleteComplaint?: (complaintId: string) => void;
  onDeleteAllComplaints?: () => void;
  calendarDates?: WorkstationCalendarDate[];
}

export default function AllComplaintsList({
  complaints,
  theme = "light",
  onSelectComplaintInWorkspace,
  onDeleteComplaint,
  onDeleteAllComplaints,
  calendarDates = [],
}: AllComplaintsListProps) {

  const isDark = theme === "dark";

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [stationFilter, setStationFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [satisfactionFilter, setSatisfactionFilter] = useState("all");
  const [attemptFilter, setAttemptFilter] = useState("all");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(15);

  // Quick Detail Modal State
  const [activeModalComplaint, setActiveModalComplaint] = useState<Complaint | null>(null);

  // Live ticker clock updating every second for real-time elapsed counter
  const [tickerDate, setTickerDate] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setTickerDate(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Delete Confirmation State
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);

  // Filter logic
  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      // Search
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        c.customerName.toLowerCase().includes(query) ||
        c.customerPhone.toLowerCase().includes(query) ||
        (c.woNo && c.woNo.toLowerCase().includes(query)) ||
        (c.vehicleRegNo && c.vehicleRegNo.toLowerCase().includes(query)) ||
        (c.chassiNo && c.chassiNo.toLowerCase().includes(query)) ||
        (c.advisorName && c.advisorName.toLowerCase().includes(query)) ||
        (c.description && c.description.toLowerCase().includes(query)) ||
        c.id.toLowerCase().includes(query);

      // Station
      const matchesStation = stationFilter === "all" || c.station === stationFilter;

      // Status
      let matchesStatus = true;
      if (statusFilter === "station_contacted") {
        matchesStatus = !!(c.stationContactedDate || c.stationResolutionNotes || c.status === "Contacted") && (c.status === "Pending" || c.status === "In Progress");
      } else {
        matchesStatus = statusFilter === "all" || c.status === statusFilter;
      }

      // Satisfaction
      const matchesSatisfaction =
        satisfactionFilter === "all" || c.currentSatisfaction === satisfactionFilter;

      // Attempt Filter
      let matchesAttempt = true;
      if (attemptFilter === "1st") {
        matchesAttempt = c.attemptCount === 1 || !!c.firstAttemptCallStatus;
      } else if (attemptFilter === "2nd") {
        matchesAttempt = c.attemptCount === 2 || !!c.secondAttemptFeedbackStatus;
      } else if (attemptFilter === "unreachable") {
        matchesAttempt =
          c.firstAttemptCallStatus === "Customer Unreachable" ||
          c.secondAttemptFeedbackStatus === "Customer Unreachable" ||
          c.feedbackStatus === "Customer Unreachable" ||
          c.finalStatus?.includes("Unreachable");
      }

      return matchesSearch && matchesStation && matchesStatus && matchesSatisfaction && matchesAttempt;
    });
  }, [complaints, searchQuery, stationFilter, statusFilter, satisfactionFilter, attemptFilter]);

  // Reset filters
  const handleResetFilters = () => {
    setSearchQuery("");
    setStationFilter("all");
    setStatusFilter("all");
    setSatisfactionFilter("all");
    setAttemptFilter("all");
    setCurrentPage(1);
  };

  // Pagination calculation
  const totalPages = Math.ceil(filteredComplaints.length / rowsPerPage) || 1;
  const paginatedComplaints = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredComplaints.slice(start, start + rowsPerPage);
  }, [filteredComplaints, currentPage, rowsPerPage]);

  // Stats calculation
  const totalCount = complaints.length;
  const pendingCount = complaints.filter((c) => c.status === "Pending").length;
  const progressCount = complaints.filter((c) => c.status === "In Progress").length;
  const resolvedCount = complaints.filter((c) => c.status === "Resolved").length;

  // CSV Export
  const handleExportCSV = () => {
    const headers = [
      "ID",
      "Date",
      "Month",
      "Company",
      "WO No",
      "WO State",
      "Vehicle Reg No",
      "Customer Name",
      "Customer Phone",
      "Station",
      "Category",
      "Rating Score",
      "Complaint Reason (Tell us more...)",
      "Station Notes",
      "1st Attempt Status",
      "2nd Attempt Feedback",
      "Call Center Remarks",
      "Current Satisfaction",
      "Recovery Status"
    ];

    const rows = filteredComplaints.map((c) => [
      `"${c.id}"`,
      `"${c.date}"`,
      `"${c.month || ""}"`,
      `"${c.company || ""}"`,
      `"${c.woNo || ""}"`,
      `"${c.woState || ""}"`,
      `"${c.vehicleRegNo || ""}"`,
      `"${c.customerName.replace(/"/g, '""')}"`,
      `"${c.customerPhone}"`,
      `"${c.station}"`,
      `"${c.category}"`,
      `"${c.npsScore !== undefined ? c.npsScore : ""}"`,
      `"${(c.description || "").replace(/"/g, '""')}"`,
      `"${(c.stationResolutionNotes || "").replace(/"/g, '""')}"`,
      `"${c.firstAttemptCallStatus || ""}"`,
      `"${c.secondAttemptFeedbackStatus || ""}"`,
      `"${(c.callCenterFinalRemarks || "").replace(/"/g, '""')}"`,
      `"${c.currentSatisfaction}"`,
      `"${c.status}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `All_Complaints_Master_List_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & KPI Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <ListFilter className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-800 tracking-tight">
                Master Complaints Directory (Admin List View)
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Comprehensive tabular view of all registered dissatisfaction records across stations and call center attempts.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-3.5 rounded-lg shadow-xs transition-all cursor-pointer"
          >
            <Download className="h-4 w-4" />
            Export Filtered CSV ({filteredComplaints.length})
          </button>

          {onDeleteAllComplaints && (
            !showClearAllConfirm ? (
              <button
                type="button"
                onClick={() => setShowClearAllConfirm(true)}
                className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs py-2 px-3 rounded-lg border border-rose-200 transition-all cursor-pointer"
                title="Delete all complaint records from database"
              >
                <Trash2 className="h-4 w-4 text-rose-600" />
                <span>Clear All DB</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1">
                <span className="text-[10px] font-black text-rose-800 uppercase">Delete whole DB?</span>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteAllComplaints();
                    setShowClearAllConfirm(false);
                  }}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-extrabold px-2 py-0.5 rounded cursor-pointer transition-colors"
                >
                  Yes, Delete All
                </button>
                <button
                  type="button"
                  onClick={() => setShowClearAllConfirm(false)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer transition-colors"
                >
                  Cancel
                </button>
              </div>
            )
          )}
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">Total Complaints</span>
            <span className="text-xl font-black text-slate-900">{totalCount}</span>
          </div>
          <div className="p-2.5 bg-slate-100 text-slate-600 rounded-lg">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-red-50 p-3.5 rounded-xl border border-red-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase text-red-700 block tracking-wider">Pending Action</span>
            <span className="text-xl font-black text-red-700">{pendingCount}</span>
          </div>
          <div className="p-2.5 bg-red-100 text-red-600 rounded-lg">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-orange-50 p-3.5 rounded-xl border border-orange-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase text-orange-700 block tracking-wider">In Progress</span>
            <span className="text-xl font-black text-orange-700">{progressCount}</span>
          </div>
          <div className="p-2.5 bg-orange-100 text-orange-600 rounded-lg">
            <Sparkles className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-green-50 p-3.5 rounded-xl border border-green-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase text-green-700 block tracking-wider">Resolved</span>
            <span className="text-xl font-black text-green-700">{resolvedCount}</span>
          </div>
          <div className="p-2.5 bg-green-100 text-green-600 rounded-lg">
            <CheckCircle className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Time Passing Formula Breakdown Banner */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 shadow-2xs space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-600" />
            <span className="text-xs font-black uppercase text-slate-800 tracking-wider">
              Time Passing Breakdown (Aging Matrix)
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-bold">
            Standard Breakdown Formula ({complaints.length} Total Records)
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {getAgeFormulaBreakdown(complaints, tickerDate).map((item) => (
            <div key={item.category} className={`p-2.5 rounded-lg border ${item.badgeColorClass} flex justify-between items-center shadow-2xs`}>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-tight block">{item.category}</span>
                <span className="text-sm font-black font-mono">{item.count} complaints</span>
              </div>
              <span className="text-xs font-black px-2 py-1 rounded bg-white/80 border border-current shadow-2xs">
                {item.percentage}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Controls & Filter Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
          {/* Search Box */}
          <div className="md:col-span-4 relative">
            <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Customer, Phone, WO No, Reg No, Description..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 font-medium text-slate-800"
            />
          </div>

          {/* Station Filter */}
          <div className="md:col-span-2">
            <select
              value={stationFilter}
              onChange={(e) => {
                setStationFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-2.5 font-semibold text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">All Stations ({STATIONS.length})</option>
              {STATIONS.map((st) => (
                <option key={st.code} value={st.code}>
                  {st.name} ({st.code})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="md:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-2.5 font-semibold text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">All Recovery Statuses</option>
              <option value="station_contacted">⚡ Station Contacted (Pending & In Progress Only)</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
            </select>
          </div>

          {/* Attempt Filter */}
          <div className="md:col-span-2">
            <select
              value={attemptFilter}
              onChange={(e) => {
                setAttemptFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-2.5 font-semibold text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">All Call Attempts</option>
              <option value="1st">1st Attempt Recorded</option>
              <option value="2nd">2nd Attempt Recorded</option>
              <option value="unreachable">Unreachable Calls</option>
            </select>
          </div>

          {/* Reset Filters */}
          <div className="md:col-span-2 flex justify-end">
            <button
              type="button"
              onClick={handleResetFilters}
              className="w-full flex items-center justify-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-1.5 px-3 rounded-lg transition-all cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/80 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                <th className="py-3 px-3">WO / Reg No</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Customer Details</th>
                <th className="py-3 px-3">Station</th>
                <th className="py-3 px-3 min-w-[180px]">Reason (Tell us more...)</th>
                <th className="py-3 px-3">Time Passing</th>
                <th className="py-3 px-3">1st Call Attempt</th>
                <th className="py-3 px-3">2nd Call Attempt</th>
                <th className="py-3 px-3">Satisfaction</th>
                <th className="py-3 px-3">Recovery Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {paginatedComplaints.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">No complaints match the specified filters.</p>
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="mt-2 text-blue-600 hover:underline text-xs font-bold"
                    >
                      Clear search & filters
                    </button>
                  </td>
                </tr>
              ) : (
                paginatedComplaints.map((c, idx) => {
                  const isResolved = c.status === "Resolved";
                  const isPending = c.status === "Pending";
                  const isUnreachable =
                    c.firstAttemptCallStatus === "Customer Unreachable" ||
                    c.secondAttemptFeedbackStatus === "Customer Unreachable";
                  const ageInfo = getComplaintAgeInfo(c, tickerDate, calendarDates);

                  return (
                    <tr 
                      key={c.id} 
                      className={`hover:bg-blue-50/40 transition-colors ${
                        idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                      }`}
                    >
                      {/* WO & Reg No */}
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900">{c.woNo || c.id}</div>
                        {c.vehicleRegNo && (
                          <div className="text-[10px] text-blue-700 font-semibold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 inline-block mt-0.5">
                            {c.vehicleRegNo}
                          </div>
                        )}
                      </td>

                      {/* Date */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 font-semibold">
                        {c.date}
                        {c.month && <span className="text-[10px] text-slate-400 block font-normal">{c.month}</span>}
                      </td>

                      {/* Customer Info */}
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-800">{c.customerName}</div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Phone className="h-3 w-3 text-slate-400" />
                          {c.customerPhone}
                        </div>
                      </td>

                      {/* Station */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-slate-800 font-semibold">
                          <MapPin className="h-3 w-3 text-red-500 shrink-0" />
                          <span>{c.station}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 block">{c.category}</span>
                      </td>

                      {/* Excel Complaint Reason */}
                      <td className="py-2.5 px-3 max-w-[280px]">
                        <p className="line-clamp-2 text-[11px] text-slate-700 leading-snug font-normal" title={c.description}>
                          {c.description && c.description !== "No feedback details provided." ? (
                            c.description
                          ) : (
                            <span className="italic text-slate-400 font-normal">No comment provided</span>
                          )}
                        </p>
                      </td>

                      {/* Time Passing / Aging */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`inline-flex items-center text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${ageInfo.badgeColorClass}`}>
                          <Clock className="h-2.5 w-2.5 mr-1 shrink-0" />
                          {ageInfo.category}
                        </span>
                        <span className="text-[9px] font-mono text-slate-500 block mt-0.5 font-bold">
                          {ageInfo.days}d {String(ageInfo.hours).padStart(2, "0")}h {String(ageInfo.minutes).padStart(2, "0")}m {String(ageInfo.seconds).padStart(2, "0")}s
                        </span>
                      </td>

                      {/* 1st Attempt */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {c.firstAttemptCallStatus ? (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            c.firstAttemptCallStatus === "Connected"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}>
                            1st: {c.firstAttemptCallStatus}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Not logged</span>
                        )}
                      </td>

                      {/* 2nd Attempt */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {c.secondAttemptFeedbackStatus ? (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            c.secondAttemptFeedbackStatus === "Satisfied"
                              ? "bg-green-50 text-green-700 border-green-200"
                              : c.secondAttemptFeedbackStatus === "Customer Unreachable"
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          }`}>
                            2nd: {c.secondAttemptFeedbackStatus}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Not logged</span>
                        )}
                      </td>

                      {/* Satisfaction */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            c.currentSatisfaction === "Satisfied" || c.currentSatisfaction === "Very Satisfied"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : c.currentSatisfaction === "Neutral"
                              ? "bg-slate-100 text-slate-700 border-slate-200"
                              : "bg-rose-50 text-rose-700 border-rose-200"
                          }`}
                        >
                          {c.currentSatisfaction || "Dissatisfied"}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full border flex items-center gap-1 w-fit ${
                            isResolved
                              ? "bg-green-100 text-green-800 border-green-300"
                              : isPending
                              ? "bg-red-100 text-red-800 border-red-300"
                              : "bg-orange-100 text-orange-800 border-orange-300"
                          }`}
                        >
                          {isResolved ? (
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          ) : (
                            <Clock className="h-3 w-3 text-red-600" />
                          )}
                          {c.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setActiveModalComplaint(c)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                            title="Quick View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => onSelectComplaintInWorkspace(c.id)}
                            className="flex items-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] py-1 px-2.5 rounded-md border border-blue-200 transition-colors cursor-pointer"
                            title="Open in Recovery Workspace"
                          >
                            <span>Open</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>

                          {onDeleteComplaint && (
                            deletingId === c.id ? (
                              <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 rounded p-1">
                                <span className="text-[9px] font-extrabold text-rose-800">Delete?</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    onDeleteComplaint(c.id);
                                    setDeletingId(null);
                                  }}
                                  className="bg-rose-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded hover:bg-rose-700 cursor-pointer"
                                >
                                  Yes
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingId(null)}
                                  className="bg-slate-200 text-slate-700 text-[9px] font-bold px-1.5 py-0.5 rounded hover:bg-slate-300 cursor-pointer"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setDeletingId(c.id)}
                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                                title="Delete complaint permanently from database"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer & Pagination Controls */}
        <div className="bg-slate-50 p-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span>Showing</span>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-semibold focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>of <strong>{filteredComplaints.length}</strong> complaints</span>
          </div>

          {/* Pagination Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-bold text-slate-700 px-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Details Modal */}
      {activeModalComplaint && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
                  Complaint Record Detail
                </span>
                <h3 className="text-base font-black text-slate-800">
                  {activeModalComplaint.customerName} ({activeModalComplaint.woNo || activeModalComplaint.id})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModalComplaint(null)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Phone</span>
                <span className="font-bold text-slate-800">{activeModalComplaint.customerPhone}</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Vehicle Reg No</span>
                <span className="font-bold text-slate-800">{activeModalComplaint.vehicleRegNo || "N/A"}</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Service Station</span>
                <span className="font-bold text-slate-800">{activeModalComplaint.station}</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Category</span>
                <span className="font-bold text-slate-800">{activeModalComplaint.category}</span>
              </div>
            </div>

            {/* Excel Complaint Description */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">
                Complaint Reason (Tell us more about the reason for this rating .):
              </span>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-800 font-semibold leading-relaxed">
                {activeModalComplaint.description || "No comment provided."}
              </div>
            </div>

            {/* Attempts Summary */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-amber-50/70 p-3 rounded-lg border border-amber-200">
                <span className="text-[10px] font-bold text-amber-900 uppercase block">1st Call Attempt</span>
                <span className="font-bold text-slate-800 block mt-0.5">
                  {activeModalComplaint.firstAttemptCallStatus || "Not logged"}
                </span>
                {activeModalComplaint.firstAttemptNotes && (
                  <p className="text-[11px] text-slate-600 mt-1 italic">{activeModalComplaint.firstAttemptNotes}</p>
                )}
              </div>

              <div className="bg-blue-50/70 p-3 rounded-lg border border-blue-200">
                <span className="text-[10px] font-bold text-blue-900 uppercase block">2nd Call Attempt</span>
                <span className="font-bold text-slate-800 block mt-0.5">
                  {activeModalComplaint.secondAttemptFeedbackStatus || "Not logged"}
                </span>
                {activeModalComplaint.secondAttemptNotes && (
                  <p className="text-[11px] text-slate-600 mt-1 italic">{activeModalComplaint.secondAttemptNotes}</p>
                )}
              </div>
            </div>

            {/* Station Notes */}
            {activeModalComplaint.stationResolutionNotes && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Station Resolution Notes:</span>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-700">
                  {activeModalComplaint.stationResolutionNotes}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveModalComplaint(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = activeModalComplaint.id;
                  setActiveModalComplaint(null);
                  onSelectComplaintInWorkspace(id);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1.5"
              >
                <span>Open in Workspace</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
