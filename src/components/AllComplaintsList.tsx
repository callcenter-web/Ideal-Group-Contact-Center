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
  Trash2,
  Edit3,
  PhoneCall,
  PhoneOff,
  PhoneMissed,
  History,
  CheckCircle2,
  UserCheck,
  ShieldAlert,
  CalendarClock
} from "lucide-react";
import { Complaint, WorkstationCalendarDate } from "../types";
import { STATIONS } from "../demoData";
import { matchesStationCodeOrName } from "../utils/stationUtils";
import { getComplaintAgeInfo, getAgeFormulaBreakdown, parseComplaintDate, isComplaintTimeFrozen } from "../utils/agingUtils";
import { getEffectiveStationContactStatus } from "../utils/supabaseSanitizer";

interface AllComplaintsListProps {
  complaints: Complaint[];
  theme?: "light" | "dark";
  recentlyUpdatedStatusIds?: Set<string>;
  onSelectComplaintInWorkspace: (complaintId: string) => void;
  onEditComplaint?: (complaint: Complaint) => void;
  onDeleteComplaint?: (complaintId: string) => void;
  onDeleteAllComplaints?: () => void;
  onQuickContact?: (complaint: Complaint) => void;
  onViewContactHistory?: (complaint: Complaint) => void;
  calendarDates?: WorkstationCalendarDate[];
  initialContactStatusFilter?: string;
}

export default function AllComplaintsList({
  complaints,
  theme = "light",
  recentlyUpdatedStatusIds,
  onSelectComplaintInWorkspace,
  onEditComplaint,
  onDeleteComplaint,
  onDeleteAllComplaints,
  onQuickContact,
  onViewContactHistory,
  calendarDates = [],
  initialContactStatusFilter = "ALL",
}: AllComplaintsListProps) {

  const isDark = theme === "dark";

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [contactStatusFilter, setContactStatusFilter] = useState(initialContactStatusFilter);
  const [stationFilter, setStationFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [satisfactionFilter, setSatisfactionFilter] = useState("all");
  const [attemptFilter, setAttemptFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");

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

  // Helper: check if station has contacted/actioned customer
  const isStationContacted = (c: Complaint) => {
    if (c.stationResponseStatus === "Rejected") return false;
    return !!(
      (c.stationContactedDate && c.stationContactedDate.trim().length > 0) ||
      (c.stationResolutionNotes && c.stationResolutionNotes.trim().length > 0) ||
      c.serviceStationContactStatus === "CONTACTED" ||
      (c.serviceStationContactedAt && c.serviceStationContactedAt.trim().length > 0) ||
      c.status === "Contacted" ||
      c.stationResponseStatus === "Submitted to Call Center" ||
      (c.callCenterContactedDate && c.callCenterContactedDate.trim().length > 0)
    );
  };

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
      const matchesStation = matchesStationCodeOrName(c.station, stationFilter);

      // Primary Service Station Contact Status Filter
      if (contactStatusFilter !== "ALL" && contactStatusFilter !== "all") {
        const contactStatus = getEffectiveStationContactStatus(c);
        const isRej = c.stationResponseStatus === "Rejected" ||
                      c.stationResponseStatus === "Returned to Service Station" ||
                      c.stationResponseStatus === "Rejected by Call Center" ||
                      c.feedbackStatus === "Returned to Service Station";
        
        if (contactStatusFilter === "NOT_CONTACTED") {
          if (contactStatus !== "NOT_CONTACTED") return false;
        } else if (contactStatusFilter === "CONTACTED") {
          if (contactStatus !== "CONTACTED") return false;
        } else if (contactStatusFilter === "CONTACT_ATTEMPTED") {
          if (contactStatus !== "CONTACT_ATTEMPTED") return false;
        } else if (contactStatusFilter === "CUSTOMER_UNREACHABLE") {
          if (contactStatus !== "CUSTOMER_UNREACHABLE") return false;
        } else if (contactStatusFilter === "PENDING_CONTACT") {
          if (contactStatus !== "PENDING_CONTACT") return false;
        } else if (contactStatusFilter === "SLA_BREACHED") {
          const ageInfo = getComplaintAgeInfo(c, tickerDate, calendarDates);
          if (!(ageInfo.workingDaysPassed >= 1 && contactStatus !== "CONTACTED" && c.status !== "Resolved")) return false;
        } else if (contactStatusFilter === "RETURNED_TO_STATION") {
          if (!isRej) return false;
        }
      }

      // Status
      let matchesStatus = true;
      if (statusFilter === "rejected") {
        matchesStatus = c.stationResponseStatus === "Rejected" || 
                        c.stationResponseStatus === "Returned to Service Station" ||
                        c.stationResponseStatus === "Rejected by Call Center" ||
                        c.feedbackStatus === "Returned to Service Station";
      } else if (statusFilter === "to_contact" || statusFilter === "pending") {
        matchesStatus = getEffectiveStationContactStatus(c) === "NOT_CONTACTED";
      } else if (statusFilter === "station_contacted") {
        matchesStatus = getEffectiveStationContactStatus(c) === "CONTACTED" && c.status !== "Resolved";
      } else {
        matchesStatus = statusFilter === "all" || c.status === statusFilter;
      }

      // Satisfaction
      const matchesSatisfaction =
        satisfactionFilter === "all" || c.currentSatisfaction === satisfactionFilter;

      // Attempt Filter
      let matchesAttempt = true;
      if (attemptFilter === "1st") {
        matchesAttempt = c.attemptCount === 1 || (c.contactAttempts && c.contactAttempts.length === 1) || !!c.firstAttemptCallStatus;
      } else if (attemptFilter === "2nd") {
        matchesAttempt = c.attemptCount === 2 || (c.contactAttempts && c.contactAttempts.length >= 2) || !!c.secondAttemptFeedbackStatus;
      } else if (attemptFilter === "unreachable") {
        matchesAttempt =
          c.serviceStationContactStatus === "CUSTOMER_UNREACHABLE" ||
          c.firstAttemptCallStatus === "Customer Unreachable" ||
          c.secondAttemptFeedbackStatus === "Customer Unreachable" ||
          c.feedbackStatus === "Customer Unreachable" ||
          c.finalStatus?.includes("Unreachable");
      }

      // Added Date Filter
      let matchesDate = true;
      if (dateFilter !== "all") {
        const complaintDate = parseComplaintDate(c.date);
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (dateFilter === "today") {
          matchesDate = complaintDate >= todayStart;
        } else if (dateFilter === "yesterday") {
          const yesterdayStart = new Date(todayStart);
          yesterdayStart.setDate(yesterdayStart.getDate() - 1);
          const yesterdayEnd = new Date(todayStart);
          matchesDate = complaintDate >= yesterdayStart && complaintDate < yesterdayEnd;
        } else if (dateFilter === "this_week") {
          const weekStart = new Date(todayStart);
          weekStart.setDate(weekStart.getDate() - weekStart.getDay());
          matchesDate = complaintDate >= weekStart;
        } else if (dateFilter === "this_month") {
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          matchesDate = complaintDate >= monthStart;
        } else if (dateFilter === "last_30_days") {
          const thirtyDaysAgo = new Date(todayStart);
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          matchesDate = complaintDate >= thirtyDaysAgo;
        } else if (dateFilter === "custom") {
          if (startDateFilter) {
            const start = new Date(startDateFilter);
            start.setHours(0, 0, 0, 0);
            if (complaintDate < start) matchesDate = false;
          }
          if (endDateFilter) {
            const end = new Date(endDateFilter);
            end.setHours(23, 59, 59, 999);
            if (complaintDate > end) matchesDate = false;
          }
        }
      }

      return matchesSearch && matchesStation && matchesStatus && matchesSatisfaction && matchesAttempt && matchesDate;
    });
  }, [complaints, searchQuery, contactStatusFilter, stationFilter, statusFilter, satisfactionFilter, attemptFilter, dateFilter, startDateFilter, endDateFilter, tickerDate, calendarDates]);

  // Reset filters
  const handleResetFilters = () => {
    setSearchQuery("");
    setContactStatusFilter("ALL");
    setStationFilter("all");
    setStatusFilter("all");
    setSatisfactionFilter("all");
    setAttemptFilter("all");
    setDateFilter("all");
    setStartDateFilter("");
    setEndDateFilter("");
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

  // Contact status stats
  const contactStats = useMemo(() => {
    let notContacted = 0;
    let contacted = 0;
    let attempted = 0;
    let unreachable = 0;
    let pendingContact = 0;
    let slaBreached = 0;
    let returned = 0;

    complaints.forEach((c) => {
      const st = getEffectiveStationContactStatus(c);
      const isRej = c.stationResponseStatus === "Rejected" ||
                    c.stationResponseStatus === "Returned to Service Station" ||
                    c.stationResponseStatus === "Rejected by Call Center" ||
                    c.feedbackStatus === "Returned to Service Station";

      if (isRej) returned++;

      if (st === "NOT_CONTACTED") notContacted++;
      else if (st === "CONTACTED") contacted++;
      else if (st === "CONTACT_ATTEMPTED") attempted++;
      else if (st === "CUSTOMER_UNREACHABLE") unreachable++;
      else if (st === "PENDING_CONTACT") pendingContact++;

      const ageInfo = getComplaintAgeInfo(c, tickerDate, calendarDates);
      if (ageInfo.workingDaysPassed >= 1 && st !== "CONTACTED" && c.status !== "Resolved") {
        slaBreached++;
      }
    });

    return {
      notContacted,
      contacted,
      attempted,
      unreachable,
      pendingContact,
      slaBreached,
      returned,
    };
  }, [complaints, tickerDate, calendarDates]);

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

      {/* PRIMARY FILTER: SERVICE STATION CUSTOMER CONTACT STATUS */}
      <div className="bg-slate-900 text-white rounded-xl border border-slate-800 p-3.5 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-red-600/30 text-red-400 rounded-lg border border-red-500/40">
              <PhoneCall className="h-4 w-4" />
            </span>
            <div>
              <span className="text-[11px] font-black tracking-wider uppercase text-slate-100 flex items-center gap-1.5">
                PRIMARY OPERATIONAL FILTER: SERVICE STATION CONTACT STATUS
              </span>
              <span className="text-[10px] text-slate-400 block font-medium">
                Live status calculated from verified Service Station contact logs &amp; call center feedback
              </span>
            </div>
          </div>
          {contactStatusFilter !== "ALL" && (
            <button
              type="button"
              onClick={() => {
                setContactStatusFilter("ALL");
                setCurrentPage(1);
              }}
              className="text-[10px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer underline"
            >
              Reset Contact Filter (Show All)
            </button>
          )}
        </div>

        {/* Status Pill Tabs */}
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => {
              setContactStatusFilter("ALL");
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              contactStatusFilter === "ALL" || contactStatusFilter === "all"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-800/80 text-slate-300 hover:bg-slate-800 border border-slate-700/60"
            }`}
          >
            <span>ALL COMPLAINTS</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/30 text-white font-mono">
              {complaints.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setContactStatusFilter("NOT_CONTACTED");
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              contactStatusFilter === "NOT_CONTACTED"
                ? "bg-rose-600 text-white shadow-xs ring-2 ring-rose-400"
                : "bg-rose-950/40 text-rose-300 hover:bg-rose-950/70 border border-rose-900/60"
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping"></span>
            <span>🔴 NOT CONTACTED</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-900/80 text-rose-100 font-mono font-bold">
              {contactStats.notContacted}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setContactStatusFilter("CONTACTED");
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              contactStatusFilter === "CONTACTED"
                ? "bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-400"
                : "bg-emerald-950/40 text-emerald-300 hover:bg-emerald-950/70 border border-emerald-900/60"
            }`}
          >
            <span>🟢 CONTACTED</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-900/80 text-emerald-100 font-mono font-bold">
              {contactStats.contacted}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setContactStatusFilter("CONTACT_ATTEMPTED");
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              contactStatusFilter === "CONTACT_ATTEMPTED"
                ? "bg-amber-600 text-white shadow-xs ring-2 ring-amber-400"
                : "bg-amber-950/40 text-amber-300 hover:bg-amber-950/70 border border-amber-900/60"
            }`}
          >
            <span>🟡 CONTACT ATTEMPTED</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-900/80 text-amber-100 font-mono font-bold">
              {contactStats.attempted}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setContactStatusFilter("CUSTOMER_UNREACHABLE");
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              contactStatusFilter === "CUSTOMER_UNREACHABLE"
                ? "bg-orange-600 text-white shadow-xs ring-2 ring-orange-400"
                : "bg-orange-950/40 text-orange-300 hover:bg-orange-950/70 border border-orange-900/60"
            }`}
          >
            <span>🟠 CUSTOMER UNREACHABLE</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-orange-900/80 text-orange-100 font-mono font-bold">
              {contactStats.unreachable}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setContactStatusFilter("PENDING_CONTACT");
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              contactStatusFilter === "PENDING_CONTACT"
                ? "bg-slate-600 text-white shadow-xs ring-2 ring-slate-400"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
            }`}
          >
            <span>⚪ PENDING CONTACT</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900 text-slate-200 font-mono font-bold">
              {contactStats.pendingContact}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setContactStatusFilter("SLA_BREACHED");
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              contactStatusFilter === "SLA_BREACHED"
                ? "bg-red-700 text-white shadow-xs ring-2 ring-red-400"
                : "bg-red-950/40 text-red-300 hover:bg-red-950/70 border border-red-900/60"
            }`}
          >
            <ShieldAlert className="h-3.5 w-3.5 text-red-400 shrink-0" />
            <span>⚠️ SLA BREACHED (&gt;24H)</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-red-900/80 text-red-100 font-mono font-bold">
              {contactStats.slaBreached}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setContactStatusFilter("RETURNED_TO_STATION");
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              contactStatusFilter === "RETURNED_TO_STATION"
                ? "bg-purple-700 text-white shadow-xs ring-2 ring-purple-400"
                : "bg-purple-950/40 text-purple-300 hover:bg-purple-950/70 border border-purple-900/60"
            }`}
          >
            <RotateCcw className="h-3.5 w-3.5 text-purple-400 shrink-0" />
            <span>❌ RETURNED TO STATION</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-900/80 text-purple-100 font-mono font-bold">
              {contactStats.returned}
            </span>
          </button>
        </div>
      </div>

      {/* Controls & Filter Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
          {/* Search Box */}
          <div className="md:col-span-3 relative">
            <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Customer, Phone, WO No, Reg No..."
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
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-2 font-semibold text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
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
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-2 font-semibold text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">All Recovery Statuses</option>
              <option value="to_contact">⚡ Who Has To Contact (Pending Action)</option>
              <option value="rejected">❌ Response Rejected by Call Center</option>
              <option value="station_contacted">💬 Station Contacted (Pending & In Progress)</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
            </select>
          </div>

          {/* Added Date Filter */}
          <div className="md:col-span-2">
            <select
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs bg-blue-50/80 border border-blue-200 text-blue-900 rounded-lg py-1.5 px-2 font-bold focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">📅 All Added Dates</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="last_30_days">Last 30 Days</option>
              <option value="custom">Custom Date Range...</option>
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
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-2 font-semibold text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">All Call Attempts</option>
              <option value="1st">1st Attempt Recorded</option>
              <option value="2nd">2nd Attempt Recorded</option>
              <option value="unreachable">Unreachable Calls</option>
            </select>
          </div>

          {/* Reset Filters */}
          <div className="md:col-span-1 flex justify-end">
            <button
              type="button"
              onClick={handleResetFilters}
              className="w-full flex items-center justify-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-1.5 px-2 rounded-lg transition-all cursor-pointer"
              title="Reset all filters"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Custom Date Range Picker inputs if custom selected */}
        {dateFilter === "custom" && (
          <div className="flex items-center gap-3 bg-blue-50/70 border border-blue-200 p-2.5 rounded-lg text-xs">
            <span className="font-extrabold text-blue-800 flex items-center gap-1">
              📅 Added Date Range:
            </span>
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] text-slate-600 font-bold">From:</label>
              <input
                type="date"
                value={startDateFilter}
                onChange={(e) => {
                  setStartDateFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-300 rounded px-2 py-0.5 text-xs text-slate-800 font-medium focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] text-slate-600 font-bold">To:</label>
              <input
                type="date"
                value={endDateFilter}
                onChange={(e) => {
                  setEndDateFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-300 rounded px-2 py-0.5 text-xs text-slate-800 font-medium focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        )}
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
                <th className="py-3 px-3 min-w-[160px]">Reason (Tell us more...)</th>
                <th className="py-3 px-3 min-w-[170px] bg-slate-200/60 text-slate-800 font-black">
                  <div className="flex items-center gap-1">
                    <PhoneCall className="h-3 w-3 text-red-600 shrink-0" />
                    <span>Station Contact Status</span>
                  </div>
                </th>
                <th className="py-3 px-3">Attempts &amp; Log</th>
                <th className="py-3 px-3">Time Passing</th>
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
                  const contactStatus = getEffectiveStationContactStatus(c);
                  const isRejectedByCallCenter = 
                    c.stationResponseStatus === "Rejected" ||
                    c.stationResponseStatus === "Returned to Service Station" ||
                    c.stationResponseStatus === "Rejected by Call Center" ||
                    c.feedbackStatus === "Returned to Service Station";
                  
                  const ageInfo = getComplaintAgeInfo(c, tickerDate, calendarDates);
                  const isUpdatedRecently = recentlyUpdatedStatusIds?.has(c.id);
                  const attemptsCount = c.contactAttempts ? c.contactAttempts.length : (c.attemptCount || 0);

                  return (
                    <tr 
                      key={c.id} 
                      className={`transition-colors duration-500 ${
                        isUpdatedRecently
                          ? "bg-amber-100/90 dark:bg-amber-900/40 border-l-4 border-l-amber-500 animate-pulse font-semibold"
                          : idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                      } hover:bg-blue-50/40`}
                    >
                      {/* WO & Reg No */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1 font-bold text-slate-900">
                          <span>{c.woNo || c.id}</span>
                          {isUpdatedRecently && (
                            <span className="text-[9px] bg-amber-500 text-white font-extrabold px-1.5 py-0.5 rounded shadow-xs uppercase tracking-wider animate-bounce">
                              ✨ Status Updated
                            </span>
                          )}
                        </div>
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
                      <td className="py-2.5 px-3 max-w-[240px]">
                        <p className="line-clamp-2 text-[11px] text-slate-700 leading-snug font-normal" title={c.description}>
                          {c.description && c.description !== "No feedback details provided." ? (
                            c.description
                          ) : (
                            <span className="italic text-slate-400 font-normal">No comment provided</span>
                          )}
                        </p>
                      </td>

                      {/* SERVICE STATION CONTACT STATUS (PRIMARY COLUMN) */}
                      <td className="py-2.5 px-3 bg-slate-50/70">
                        {isRejectedByCallCenter ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
                              <RotateCcw className="h-2.5 w-2.5 text-rose-600 shrink-0" />
                              RE-CONTACT REQUIRED
                            </span>
                            <span className="text-[9px] text-rose-700 font-extrabold block">
                              Rejected by Call Center
                            </span>
                          </div>
                        ) : contactStatus === "CONTACTED" ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600 shrink-0" />
                              CONTACTED
                            </span>
                            {c.stationContactedDate && (
                              <div className="text-[9px] text-slate-500 font-medium">
                                {c.stationContactedDate} {c.contactMethod ? `• ${c.contactMethod}` : ""}
                              </div>
                            )}
                            {c.contactOfficerName && (
                              <div className="text-[9px] text-slate-600 font-bold flex items-center gap-0.5">
                                <UserCheck className="h-2.5 w-2.5 text-slate-400" />
                                {c.contactOfficerName}
                              </div>
                            )}
                          </div>
                        ) : contactStatus === "NOT_CONTACTED" ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                              <PhoneOff className="h-2.5 w-2.5 text-rose-600 shrink-0" />
                              NOT CONTACTED
                            </span>
                            <span className="text-[9px] text-rose-600 font-bold block">
                              Action Required
                            </span>
                          </div>
                        ) : contactStatus === "CONTACT_ATTEMPTED" ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                              <PhoneCall className="h-2.5 w-2.5 text-amber-600 shrink-0" />
                              ATTEMPTED
                            </span>
                            {c.lastContactAttemptDate && (
                              <div className="text-[9px] text-slate-500">
                                {c.lastContactAttemptDate}
                              </div>
                            )}
                          </div>
                        ) : contactStatus === "CUSTOMER_UNREACHABLE" ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 border border-orange-300">
                              <PhoneMissed className="h-2.5 w-2.5 text-orange-600 shrink-0" />
                              UNREACHABLE
                            </span>
                            <span className="text-[9px] text-orange-700 font-medium block">
                              Follow-up Needed
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300">
                            PENDING CONTACT
                          </span>
                        )}
                      </td>

                      {/* Attempts & History */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                            attemptsCount > 0 
                              ? "bg-blue-50 text-blue-700 border-blue-200" 
                              : "bg-slate-50 text-slate-400 border-slate-200"
                          }`}>
                            {attemptsCount} {attemptsCount === 1 ? "Attempt" : "Attempts"}
                          </span>
                          {onViewContactHistory && (
                            <button
                              type="button"
                              onClick={() => onViewContactHistory(c)}
                              className="p-1 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded border border-slate-200 transition-colors cursor-pointer"
                              title="View full contact history & timestamps"
                            >
                              <History className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        {c.lastContactOutcome && (
                          <div className="text-[9px] text-slate-500 truncate max-w-[120px] mt-0.5" title={c.lastContactOutcome}>
                            {c.lastContactOutcome}
                          </div>
                        )}
                      </td>

                      {/* Time Passing / Aging */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`inline-flex items-center text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${ageInfo.badgeColorClass}`}>
                          <Clock className="h-2.5 w-2.5 mr-1 shrink-0" />
                          {ageInfo.category}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[9px] font-mono text-slate-600 font-bold">
                            {ageInfo.days}d {String(ageInfo.hours).padStart(2, "0")}h {String(ageInfo.minutes).padStart(2, "0")}m
                          </span>
                          {isComplaintTimeFrozen(c) ? (
                            <span className="text-[8px] bg-emerald-100 text-emerald-800 border border-emerald-300 font-black px-1.5 py-0.2 rounded uppercase">
                              Frozen
                            </span>
                          ) : (
                            <span className="text-[8px] bg-blue-50 text-blue-700 border border-blue-200 font-bold px-1.5 py-0.2 rounded uppercase">
                              Live
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Satisfaction */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            c.currentSatisfaction === "Satisfied" || c.currentSatisfaction === "Very Satisfied"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : c.currentSatisfaction === "Neutral"
                              ? "bg-slate-100 text-slate-700 border-slate-200"
                              : "bg-orange-50 text-orange-700 border-orange-200"
                          }`}
                        >
                          {(c.currentSatisfaction === "Dissatisfied" || c.currentSatisfaction === "Not Satisfied" || !c.currentSatisfaction) ? "Not Satisfied" : c.currentSatisfaction}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 whitespace-nowrap space-y-1">
                        <span
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full border flex items-center gap-1 w-fit ${
                            c.status === "Resolved" || isResolved
                              ? "bg-green-100 text-green-800 border-green-300"
                              : c.status === "Contacted — Still Dissatisfied" || c.status === "Contacted - Still Dissatisfied"
                              ? "bg-indigo-100 text-indigo-800 border-indigo-300 font-extrabold"
                              : c.status === "Contacted"
                              ? "bg-blue-100 text-blue-800 border-blue-300"
                              : c.status === "In Progress"
                              ? "bg-amber-100 text-amber-800 border-amber-300"
                              : "bg-red-100 text-red-800 border-red-300"
                          }`}
                        >
                          {(c.status === "Resolved" || isResolved) ? (
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          ) : (c.status === "Contacted — Still Dissatisfied" || c.status === "Contacted - Still Dissatisfied") ? (
                            <AlertTriangle className="h-3 w-3 text-indigo-600" />
                          ) : c.status === "Contacted" ? (
                            <CheckCircle className="h-3 w-3 text-blue-600" />
                          ) : (
                            <Clock className="h-3 w-3 text-red-600" />
                          )}
                          {c.status || "Pending"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Quick Contact / Re-contact action */}
                          {onQuickContact && (
                            <button
                              type="button"
                              onClick={() => onQuickContact(c)}
                              className={`flex items-center gap-1 text-[10px] font-black py-1 px-2.5 rounded-lg border transition-all cursor-pointer shadow-2xs ${
                                isRejectedByCallCenter
                                  ? "bg-purple-600 hover:bg-purple-700 text-white border-purple-700 ring-2 ring-purple-400"
                                  : contactStatus === "NOT_CONTACTED"
                                  ? "bg-rose-600 hover:bg-rose-700 text-white border-rose-700"
                                  : "bg-blue-600 hover:bg-blue-700 text-white border-blue-700"
                              }`}
                              title="Open standard contact logging form"
                            >
                              <PhoneCall className="h-3 w-3 shrink-0" />
                              <span>{isRejectedByCallCenter ? "Re-Contact" : contactStatus === "NOT_CONTACTED" ? "Contact" : "Log Contact"}</span>
                            </button>
                          )}

                          {onEditComplaint && (
                            <button
                              type="button"
                              onClick={() => onEditComplaint(c)}
                              className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer border border-indigo-200"
                              title="Admin Master Edit Details"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                          )}

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
                            className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] py-1 px-2.5 rounded-md border border-slate-300 transition-colors cursor-pointer"
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
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                                title="Delete Complaint"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
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

            {/* Station Notes & Rejection Alert */}
            {activeModalComplaint.stationResponseStatus === "Rejected" && (
              <div className="bg-rose-50 border border-rose-300 p-3 rounded-lg text-xs space-y-1">
                <div className="flex items-center gap-1.5 text-rose-800 font-extrabold uppercase text-[10px]">
                  <AlertTriangle className="h-4 w-4 text-rose-600" />
                  <span>Response Rejected by Call Center</span>
                </div>
                <p className="text-slate-800 font-bold bg-white p-2 rounded border border-rose-200">
                  "{activeModalComplaint.stationResponseRejectionReason || "No rejection reason specified."}"
                </p>
                <div className="text-[10px] text-slate-500 flex justify-between pt-1 font-semibold">
                  <span>Rejected Date: {activeModalComplaint.stationResponseRejectedDate || "N/A"}</span>
                  <span>Rejected By: {activeModalComplaint.stationResponseRejectedBy || "Call Center"}</span>
                </div>
              </div>
            )}

            {activeModalComplaint.stationResolutionNotes && (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Station Resolution Notes:</span>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-700">
                  {activeModalComplaint.stationResolutionNotes}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              {onEditComplaint && (
                <button
                  type="button"
                  onClick={() => {
                    const comp = activeModalComplaint;
                    setActiveModalComplaint(null);
                    onEditComplaint(comp);
                  }}
                  className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1.5"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>Edit Details</span>
                </button>
              )}
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
