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
  ArrowUpRight,
  Calendar,
  Building2,
  Headphones,
  AlertCircle,
  RotateCcw,
  CheckCircle,
  Calculator,
  FileText,
  Printer,
  BarChart3
} from "lucide-react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
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

  // Mode/Perspective Toggle: "station" or "callcenter"
  const [perspective, setPerspective] = useState<"station" | "callcenter">("station");

  // Shared Filters
  const [timePreset, setTimePreset] = useState<"all" | "daily" | "weekly" | "monthly">("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [startDateFilter, setStartDateFilter] = useState<string>("");
  const [endDateFilter, setEndDateFilter] = useState<string>("");
  const [selectedStation, setSelectedStation] = useState<string>("all");
  const [feedbackStatusFilter, setFeedbackStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Station Perspective Specific Filters
  const [stationWorkflowStatusFilter, setStationWorkflowStatusFilter] = useState<string>("all");

  // Call Center Perspective Specific Filters
  const [selectedOfficer, setSelectedOfficer] = useState<string>("all");
  const [callCenterSlaFilter, setCallCenterSlaFilter] = useState<"all" | "compliant" | "breached">("all");
  const [callCenterStatusFilter, setCallCenterStatusFilter] = useState<string>("all");
  const [agingFilter, setAgingFilter] = useState<"all" | "0-2" | "3-5" | "6-10" | "11+">("all");

  if (!isOpen) return null;

  const todayStr = "2026-08-05"; // Anchor system date

  // Extract available distinct months from complaints dataset
  const availableMonths = Array.from(
    new Set(
      complaints
        .map((c) => {
          if (c.month) return c.month;
          if (c.date) {
            const parts = c.date.split(/[\/\-\s]/);
            if (parts.length >= 3) {
              if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, "0")}`;
              if (parts[2].length === 4) return `${parts[2]}-${parts[1].padStart(2, "0")}`;
            }
          }
          return "";
        })
        .filter(Boolean)
    )
  ).sort().reverse();

  // Helper: check if station has contacted / actioned the customer
  const isStationContacted = (c: Complaint) => {
    if (c.stationResponseStatus === "Rejected") return false;
    return !!(
      (c.stationContactedDate && c.stationContactedDate.trim().length > 0) ||
      (c.stationResolutionNotes && c.stationResolutionNotes.trim().length > 0) ||
      c.status === "Contacted" ||
      c.stationResponseStatus === "Submitted to Call Center"
    );
  };

  // Extract available distinct Call Center Officers / Agents from complaints dataset (only for station-contacted complaints)
  const availableOfficers = Array.from(
    new Set(
      complaints
        .filter(isStationContacted)
        .map((c) => c.callCenterOfficer || c.callCenterContactedBy || c.updatedBy)
        .filter(Boolean)
    )
  ).sort();

  // Helper: calculate Call Center age / SLA difference in days
  const getCallCenterAgeInDays = (c: Complaint) => {
    const stationDateStr = c.stationContactedDate || c.date || todayStr;
    const ccDateStr = c.callCenterContactedDate || todayStr;

    const stationDate = new Date(stationDateStr);
    const ccDate = new Date(ccDateStr);

    if (isNaN(stationDate.getTime()) || isNaN(ccDate.getTime())) return 0;
    const diffTime = Math.max(0, ccDate.getTime() - stationDate.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  // Helper: SLA Status for Call Center (24 Hours SLA target)
  const getCallCenterSLAStatus = (c: Complaint) => {
    const ageDays = getCallCenterAgeInDays(c);
    if (c.callCenterContactedDate) {
      if (ageDays <= 1) {
        return { isBreached: false, label: "On-Time (<24h SLA)", color: "text-emerald-700 bg-emerald-50 border-emerald-200 font-bold" };
      }
      return { isBreached: true, label: `Delay (${ageDays}d diff)`, color: "text-amber-800 bg-amber-50 border-amber-300 font-bold" };
    }
    if (ageDays <= 1) {
      return { isBreached: false, label: "On-Time (<24h SLA)", color: "text-emerald-700 bg-emerald-50 border-emerald-200 font-bold" };
    }
    return { isBreached: true, label: `SLA Breached (${ageDays}d diff)`, color: "text-rose-700 bg-rose-50 border-rose-300 font-extrabold" };
  };

  // Helper: Aging Bucket
  const getAgingBucket = (days: number): "0-2" | "3-5" | "6-10" | "11+" => {
    if (days <= 2) return "0-2";
    if (days <= 5) return "3-5";
    if (days <= 10) return "6-10";
    return "11+";
  };

  // Master Filter by Time Preset / Date Range / Month
  const dateFilteredComplaints = complaints.filter((c) => {
    const complaintDateStr = c.date || todayStr;

    if (timePreset === "daily") {
      // Daily = Complaints from today or last 24-48h
      const cDate = new Date(complaintDateStr);
      const refDate = new Date(todayStr);
      const diffDays = (refDate.getTime() - cDate.getTime()) / (1000 * 3600 * 24);
      if (diffDays > 2) return false;
    } else if (timePreset === "weekly") {
      // Weekly = Complaints from last 7 days
      const cDate = new Date(complaintDateStr);
      const refDate = new Date(todayStr);
      const diffDays = (refDate.getTime() - cDate.getTime()) / (1000 * 3600 * 24);
      if (diffDays > 7) return false;
    } else if (timePreset === "monthly") {
      // Monthly = Complaints from last 30 days or month filter
      if (monthFilter !== "all") {
        const cMonth = c.month || (c.date ? c.date.substring(0, 7) : "");
        if (!cMonth.includes(monthFilter)) return false;
      } else {
        const cDate = new Date(complaintDateStr);
        const refDate = new Date(todayStr);
        const diffDays = (refDate.getTime() - cDate.getTime()) / (1000 * 3600 * 24);
        if (diffDays > 31) return false;
      }
    } else {
      if (monthFilter !== "all") {
        const cMonth = c.month || (c.date ? c.date.substring(0, 7) : "");
        if (!cMonth.includes(monthFilter)) return false;
      }
    }

    if (startDateFilter && complaintDateStr < startDateFilter) return false;
    if (endDateFilter && complaintDateStr > endDateFilter) return false;
    return true;
  });

  // Handler to generate graphical PDF of report
  const handleExportGraphicalPDF = async () => {
    const reportElement = document.getElementById("sla-modal-report-content");
    if (!reportElement) return;
    setIsGeneratingPDF(true);

    try {
      const canvas = await html2canvas(reportElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: isDark ? "#0f172a" : "#ffffff"
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = 210;
      const pdfHeight = 297;
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save(`Graphical_SLA_Performance_Report_${perspective}_${timePreset}_${todayStr}.pdf`);
    } catch (err) {
      console.error("Graphical PDF export error:", err);
      alert("Opening print view for graphical PDF download...");
      window.print();
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // ==========================================
  // A. SERVICE STATION PERSPECTIVE CALCULATIONS
  // ==========================================
  const stationPerspectiveComplaints = dateFilteredComplaints.filter((c) => {
    // Service Station filter
    if (selectedStation !== "all") {
      const selected = STATIONS.find((s) => s.code === selectedStation);
      if (selected && !matchesStationCodeOrName(c.station, selected.code)) return false;
    }

    // Main Workflow Status filter
    if (stationWorkflowStatusFilter !== "all") {
      if (stationWorkflowStatusFilter === "Pending" && c.status !== "Pending") return false;
      if (stationWorkflowStatusFilter === "Contacted" && c.status !== "Contacted") return false;
      if (stationWorkflowStatusFilter === "In Progress" && c.status !== "In Progress") return false;
      if (stationWorkflowStatusFilter === "Resolved" && c.status !== "Resolved") return false;
    }

    // Feedback Status filter
    if (feedbackStatusFilter !== "all") {
      if (feedbackStatusFilter === "Satisfied" && c.feedbackStatus !== "Satisfied") return false;
      if (feedbackStatusFilter === "Not Satisfied" && c.feedbackStatus !== "Not Satisfied") return false;
      if (feedbackStatusFilter === "No Solution Received" && c.feedbackStatus !== "No Solution Received" && c.feedbackStatus !== "No solution Received") return false;
      if (feedbackStatusFilter === "Unreachable" && c.feedbackStatus !== "Customer Unreachable" && c.feedbackStatus !== "Unreachable") return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = c.customerName.toLowerCase().includes(q);
      const matchPhone = c.customerPhone.toLowerCase().includes(q);
      const matchWo = (c.woNo || "").toLowerCase().includes(q);
      const matchStation = c.station.toLowerCase().includes(q);
      const matchNotes = (c.stationResolutionNotes || "").toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchWo && !matchStation && !matchNotes) return false;
    }

    return true;
  });

  const totalStationCount = stationPerspectiveComplaints.length;
  const pendingStationActionCount = stationPerspectiveComplaints.filter((c) => !isStationContacted(c)).length;
  const contactedStationCount = stationPerspectiveComplaints.filter((c) => isStationContacted(c)).length;
  const resolvedStationCount = stationPerspectiveComplaints.filter((c) => c.status === "Resolved" || c.feedbackStatus === "Satisfied").length;
  const reassignedStationCount = stationPerspectiveComplaints.filter((c) => c.stationResponseStatus === "Rejected" || c.finalStatus?.includes("Re-assigned")).length;

  const stationResolutionRate = totalStationCount > 0 ? Math.round((resolvedStationCount / totalStationCount) * 100) : 100;

  // Helper for overall list aging metrics
  const getDaysDiffHelper = (startStr: string, endStr: string): number => {
    if (!startStr || !endStr) return 0;
    const start = parseComplaintDate(startStr);
    const end = parseComplaintDate(endStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    const diffTime = end.getTime() - start.getTime();
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  };

  const getOverallAgingStats = (complaintList: Complaint[]) => {
    let stSum = 0, stCount = 0;
    let ccSum = 0, ccCount = 0;
    let solveSum = 0, solveCount = 0;

    complaintList.forEach((c) => {
      // 1) Avg Days to Contact Customer (Service Station)
      const stContactDate = c.stationContactedDate;
      stSum += getDaysDiffHelper(c.date, stContactDate || todayStr);
      stCount++;

      // 2) Avg Days to Contact Customer (Call Center) - calculated after service station contacted customer
      const startAfterStation = c.stationContactedDate || c.date;
      const ccContactDate = c.callCenterContactedDate || c.solutionDate || c.updatedAt || todayStr;
      ccSum += getDaysDiffHelper(startAfterStation, ccContactDate);
      ccCount++;

      // 3) Avg Days to Solve Case
      const isResolved = 
        c.status === "Resolved" || 
        c.finalStatus === "Closed" || 
        c.finalStatus === "Completed" || 
        c.finalStatus === "Resolved" ||
        c.feedbackStatus === "Satisfied" || 
        c.feedbackStatus === "Satisfied After Resolution" || 
        c.currentSatisfaction === "Satisfied" || 
        c.currentSatisfaction === "Very Satisfied";

      if (isResolved) {
        const resolveDate = c.solutionDate || c.updatedAt || todayStr;
        solveSum += getDaysDiffHelper(c.date, resolveDate);
        solveCount++;
      }
    });

    return {
      avgDaysStationContact: stCount > 0 ? Math.round(stSum / stCount) : 0,
      avgDaysCallCenterContact: ccCount > 0 ? Math.round(ccSum / ccCount) : 0,
      avgDaysToSolveCase: solveCount > 0 ? Math.round(solveSum / solveCount) : 0,
    };
  };

  const overallStationAging = getOverallAgingStats(stationPerspectiveComplaints);

  // Station-wise detailed breakdown array
  const stationBreakdownStats = STATIONS.map((st) => {
    const list = dateFilteredComplaints.filter((c) => matchesStationCodeOrName(c.station, st.code));
    const total = list.length;
    const resolved = list.filter((c) => c.status === "Resolved" || c.feedbackStatus === "Satisfied").length;
    const reassigned = list.filter((c) => c.stationResponseStatus === "Rejected" || c.finalStatus?.includes("Re-assigned")).length;
    const pending = Math.max(0, total - resolved - reassigned);
    const resRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    let days0_3 = 0;
    let days3_5 = 0;
    let days6_10 = 0;
    let days10Plus = 0;

    list.forEach((c) => {
      const resolveDate = c.callCenterContactedDate || c.stationContactedDate || c.updatedAt || todayStr;
      const days = c.status === "Resolved" ? getDaysDiffHelper(c.date, resolveDate) : getDaysDiffHelper(c.date, todayStr);
      if (days <= 3) days0_3++;
      else if (days <= 5) days3_5++;
      else if (days <= 10) days6_10++;
      else days10Plus++;
    });

    const aging = getOverallAgingStats(list);

    return {
      station: st,
      total,
      pending,
      resolved,
      reassigned,
      resRate,
      days0_3,
      days3_5,
      days6_10,
      days10Plus,
      avgDaysStationContact: aging.avgDaysStationContact,
      avgDaysCallCenterContact: aging.avgDaysCallCenterContact,
      avgDaysToSolveCase: aging.avgDaysToSolveCase
    };
  });

  // ==========================================
  // B. CALL CENTER PERSPECTIVE CALCULATIONS
  // ==========================================
  const callCenterPerspectiveComplaints = dateFilteredComplaints.filter((c) => {
    // Call Center queue ONLY includes customers contacted/actioned/submitted by Service Station
    const isCcEligible = isStationContacted(c);
    if (!isCcEligible) return false;

    // Service Station filter
    if (selectedStation !== "all") {
      const selected = STATIONS.find((s) => s.code === selectedStation);
      if (selected && !matchesStationCodeOrName(c.station, selected.code)) return false;
    }

    // Call Center Officer filter
    if (selectedOfficer !== "all") {
      const officerName = c.callCenterOfficer || c.callCenterContactedBy || c.updatedBy || "";
      if (selectedOfficer === "Unassigned" && officerName) return false;
      if (selectedOfficer !== "Unassigned" && !officerName.toLowerCase().includes(selectedOfficer.toLowerCase())) return false;
    }

    // Call Center SLA filter
    const ccSla = getCallCenterSLAStatus(c);
    if (callCenterSlaFilter === "compliant" && ccSla.isBreached) return false;
    if (callCenterSlaFilter === "breached" && !ccSla.isBreached) return false;

    // Feedback Status filter
    if (feedbackStatusFilter !== "all") {
      if (feedbackStatusFilter === "Satisfied" && c.feedbackStatus !== "Satisfied") return false;
      if (feedbackStatusFilter === "Not Satisfied" && c.feedbackStatus !== "Not Satisfied") return false;
      if (feedbackStatusFilter === "No Solution Received" && c.feedbackStatus !== "No Solution Received" && c.feedbackStatus !== "No solution Received") return false;
      if (feedbackStatusFilter === "Unreachable" && c.feedbackStatus !== "Customer Unreachable" && c.feedbackStatus !== "Unreachable") return false;
    }

    // Call Center Current Status filter
    if (callCenterStatusFilter !== "all") {
      if (callCenterStatusFilter === "Pending" && (c.callCenterContactedDate || c.status === "Resolved")) return false;
      if (callCenterStatusFilter === "Contacted" && (!c.callCenterContactedDate || c.status === "Resolved")) return false;
      if (callCenterStatusFilter === "Re-assigned" && c.stationResponseStatus !== "Rejected" && !c.finalStatus?.includes("Re-assigned")) return false;
      if (callCenterStatusFilter === "Resolved" && c.status !== "Resolved" && c.feedbackStatus !== "Satisfied") return false;
    }

    // Aging filter
    const ageDays = getCallCenterAgeInDays(c);
    const bucket = getAgingBucket(ageDays);
    if (agingFilter !== "all" && bucket !== agingFilter) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = c.customerName.toLowerCase().includes(q);
      const matchPhone = c.customerPhone.toLowerCase().includes(q);
      const matchWo = (c.woNo || "").toLowerCase().includes(q);
      const matchStation = c.station.toLowerCase().includes(q);
      const matchRemarks = (c.callCenterFinalRemarks || "").toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchWo && !matchStation && !matchRemarks) return false;
    }

    return true;
  });

  const totalCCWorkload = callCenterPerspectiveComplaints.length;
  const ccSlaBreached = callCenterPerspectiveComplaints.filter((c) => getCallCenterSLAStatus(c).isBreached).length;
  const ccSlaCompliant = totalCCWorkload - ccSlaBreached;
  const ccSlaRate = totalCCWorkload > 0 ? Math.round((ccSlaCompliant / totalCCWorkload) * 100) : 100;

  const count1stAttemptCC = callCenterPerspectiveComplaints.filter(
    (c) => c.stationResponseStatus !== "Rejected" && (!c.firstAttemptCallStatus || c.attemptCount === 0)
  ).length;

  const count2ndAttemptCC = callCenterPerspectiveComplaints.filter(
    (c) => c.stationResponseStatus !== "Rejected" && (!!c.firstAttemptCallStatus || (c.attemptCount && c.attemptCount >= 1))
  ).length;

  const countReassignedCC = callCenterPerspectiveComplaints.filter(
    (c) => c.stationResponseStatus === "Rejected" || c.finalStatus?.includes("Re-assigned")
  ).length;

  // Aging Counts
  const aging0to2 = callCenterPerspectiveComplaints.filter((c) => getAgingBucket(getCallCenterAgeInDays(c)) === "0-2").length;
  const aging3to5 = callCenterPerspectiveComplaints.filter((c) => getAgingBucket(getCallCenterAgeInDays(c)) === "3-5").length;
  const aging6to10 = callCenterPerspectiveComplaints.filter((c) => getAgingBucket(getCallCenterAgeInDays(c)) === "6-10").length;
  const aging11Plus = callCenterPerspectiveComplaints.filter((c) => getAgingBucket(getCallCenterAgeInDays(c)) === "11+").length;

  // Officer Breakdown Table
  const officerStats = availableOfficers.map((officer) => {
    const list = dateFilteredComplaints.filter((c) => {
      const isCcEligible = isStationContacted(c);
      return isCcEligible && (c.callCenterOfficer || c.callCenterContactedBy || c.updatedBy) === officer;
    });
    const total = list.length;
    const firstAttemptDone = list.filter((c) => !!c.firstAttemptCallStatus).length;
    const secondAttemptDone = list.filter((c) => !!c.secondAttemptFeedbackStatus).length;
    const satisfied = list.filter((c) => c.feedbackStatus === "Satisfied").length;
    const reassigned = list.filter((c) => c.stationResponseStatus === "Rejected" || c.finalStatus?.includes("Re-assigned")).length;
    const breached = list.filter((c) => getCallCenterSLAStatus(c).isBreached).length;
    const slaPercent = total > 0 ? Math.round(((total - breached) / total) * 100) : 100;

    return {
      officer,
      total,
      firstAttemptDone,
      secondAttemptDone,
      satisfied,
      reassigned,
      slaPercent
    };
  });

  // Export CSV Handler based on Perspective
  const handleExportCSV = () => {
    if (perspective === "station") {
      const headers = [
        "WO No",
        "Customer Name",
        "Phone",
        "Service Station",
        "Date Received",
        "Station Contacted Date",
        "Station Action Notes",
        "Workflow Status",
        "Feedback Status",
        "Station Response Status",
        "Final Status"
      ];

      const rows = stationPerspectiveComplaints.map((c) => [
        `"${c.woNo || c.id}"`,
        `"${c.customerName}"`,
        `"${c.customerPhone}"`,
        `"${c.station}"`,
        `"${c.date}"`,
        `"${c.stationContactedDate || "Pending"}"`,
        `"${(c.stationResolutionNotes || "").replace(/"/g, '""')}"`,
        `"${c.status || "Pending"}"`,
        `"${c.feedbackStatus || "Pending"}"`,
        `"${c.stationResponseStatus || "Submitted to Call Center"}"`,
        `"${c.finalStatus || "In Progress"}"`
      ].join(","));

      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
      const link = document.createElement("a");
      link.setAttribute("href", encodeURI(csvContent));
      link.setAttribute("download", `Service_Station_Performance_Report_${todayStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const headers = [
        "WO No",
        "Customer Name",
        "Phone",
        "Service Station",
        "Call Center Officer",
        "Date Received",
        "Station Contacted Date",
        "Call Center Contacted Date",
        "1st Attempt Status",
        "2nd Attempt Status",
        "Feedback Status",
        "Call Center SLA Status",
        "Aging (Days)",
        "Call Center Final Remarks"
      ];

      const rows = callCenterPerspectiveComplaints.map((c) => {
        const ageDays = getCallCenterAgeInDays(c);
        const sla = getCallCenterSLAStatus(c);
        return [
          `"${c.woNo || c.id}"`,
          `"${c.customerName}"`,
          `"${c.customerPhone}"`,
          `"${c.station}"`,
          `"${c.callCenterOfficer || c.callCenterContactedBy || "Unassigned"}"`,
          `"${c.date}"`,
          `"${c.stationContactedDate || "N/A"}"`,
          `"${c.callCenterContactedDate || "Pending"}"`,
          `"${c.firstAttemptCallStatus || "None"}"`,
          `"${c.secondAttemptFeedbackStatus || "None"}"`,
          `"${c.feedbackStatus || "Pending"}"`,
          `"${sla.isBreached ? "SLA Breached" : "On-Time SLA"}"`,
          ageDays,
          `"${(c.callCenterFinalRemarks || "").replace(/"/g, '""')}"`
        ].join(",");
      });

      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
      const link = document.createElement("a");
      link.setAttribute("href", encodeURI(csvContent));
      link.setAttribute("download", `Call_Center_SLA_Performance_Report_${todayStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 overflow-y-auto">
      <div className={`w-full max-w-6xl rounded-2xl shadow-2xl border flex flex-col max-h-[92vh] ${isDark ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-800"}`}>
        
        {/* MODAL HEADER */}
        <div className={`flex flex-col md:flex-row md:items-center justify-between px-6 py-4 border-b gap-3 ${isDark ? "border-slate-800 bg-slate-950/60" : "border-slate-200 bg-slate-50/80"}`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-md">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight">SLA & Performance Analytics Reports</h2>
                <span className="bg-blue-100 border border-blue-300 text-blue-800 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                  Management Dashboard
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Dual-perspective analytics for Service Stations and Call Center operation workflows.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* PERSPECTIVE SWITCHER TABS */}
            <div className="bg-slate-200/80 p-1 rounded-xl flex items-center gap-1 border border-slate-300/60">
              <button
                type="button"
                onClick={() => setPerspective("station")}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  perspective === "station"
                    ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Building2 className="h-3.5 w-3.5 text-blue-600" />
                <span>Service Station View</span>
              </button>

              <button
                type="button"
                onClick={() => setPerspective("callcenter")}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  perspective === "callcenter"
                    ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Headphones className="h-3.5 w-3.5 text-blue-600" />
                <span>Call Center View</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportGraphicalPDF}
              disabled={isGeneratingPDF}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-3 rounded-xl shadow-sm flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <Printer className="h-4 w-4" />
              <span>{isGeneratingPDF ? "Generating PDF..." : "Graphical PDF"}</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-3 rounded-xl shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Download className="h-4 w-4" />
              <span>Export CSV</span>
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

        {/* MODAL BODY (CONTENT CAPTURED BY GRAPHICAL PDF) */}
        <div id="sla-modal-report-content" className="p-6 overflow-y-auto space-y-6">

          {/* SLA & AGING FORMULAS REFERENCE BANNER */}
          <div className="bg-slate-900 text-slate-100 p-4 rounded-xl border border-slate-800 shadow-md">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-blue-400 font-black text-xs uppercase tracking-wider">
                <Calculator className="h-4 w-4" />
                SLA & Aging Formulas Reference
              </div>
              <span className="text-[10px] bg-blue-950 text-blue-300 border border-blue-800 px-2 py-0.5 rounded font-mono font-bold">
                Operational Metrics Standard
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
              <div className="bg-slate-800/90 p-2.5 rounded-lg border border-slate-700">
                <span className="font-bold text-amber-300 block mb-0.5">1. Station Initial Contact SLA</span>
                <p className="text-slate-300 font-mono text-[10px]">Contact SLA = Station Contact Date - Registration Date</p>
                <p className="text-slate-400 text-[10px] mt-1 font-semibold">Target: ≤ 2 Working Days (Excludes Sunday)</p>
              </div>
              <div className="bg-slate-800/90 p-2.5 rounded-lg border border-slate-700">
                <span className="font-bold text-emerald-300 block mb-0.5">2. Call Center Verification SLA</span>
                <p className="text-slate-300 font-mono text-[10px]">Call Center SLA = CC Contact Date - Station Response Date</p>
                <p className="text-slate-400 text-[10px] mt-1 font-semibold">Target: ≤ 24 Hours (1 Day)</p>
              </div>
              <div className="bg-slate-800/90 p-2.5 rounded-lg border border-slate-700">
                <span className="font-bold text-rose-300 block mb-0.5">3. Avg Aging Contacted to Escalated (Rejected)</span>
                <p className="text-slate-300 font-mono text-[10px]">Avg Escalation Age = Σ(Date Rejected Back to Station - Date Contacted) / Total Escalated</p>
                <p className="text-slate-400 text-[10px] mt-1 font-semibold">Note: Escalated = Complaints Rejected back to Service Station</p>
              </div>
            </div>
          </div>

          {/* TIME PERIOD SUMMARY PRESETS & DATE RANGE FILTER TOOLBAR */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600 shrink-0" />
              <span className="text-xs font-black uppercase text-slate-800 tracking-wider">
                Summary Timeframe:
              </span>
              <div className="flex items-center gap-1 bg-slate-200/80 p-0.5 rounded-lg border border-slate-300">
                <button
                  type="button"
                  onClick={() => setTimePreset("daily")}
                  className={`px-2.5 py-1 rounded text-[11px] font-black transition-all cursor-pointer ${
                    timePreset === "daily" ? "bg-blue-600 text-white shadow-xs" : "text-slate-700 hover:text-slate-900"
                  }`}
                >
                  Daily Summary
                </button>
                <button
                  type="button"
                  onClick={() => setTimePreset("weekly")}
                  className={`px-2.5 py-1 rounded text-[11px] font-black transition-all cursor-pointer ${
                    timePreset === "weekly" ? "bg-blue-600 text-white shadow-xs" : "text-slate-700 hover:text-slate-900"
                  }`}
                >
                  Weekly Summary
                </button>
                <button
                  type="button"
                  onClick={() => setTimePreset("monthly")}
                  className={`px-2.5 py-1 rounded text-[11px] font-black transition-all cursor-pointer ${
                    timePreset === "monthly" ? "bg-blue-600 text-white shadow-xs" : "text-slate-700 hover:text-slate-900"
                  }`}
                >
                  Monthly Summary
                </button>
                <button
                  type="button"
                  onClick={() => setTimePreset("all")}
                  className={`px-2.5 py-1 rounded text-[11px] font-black transition-all cursor-pointer ${
                    timePreset === "all" ? "bg-blue-600 text-white shadow-xs" : "text-slate-700 hover:text-slate-900"
                  }`}
                >
                  All Data
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Monthly Filter */}
              <div className="flex items-center gap-1.5">
                <label className="text-[10px] font-extrabold uppercase text-slate-500">Month:</label>
                <select
                  value={monthFilter}
                  onChange={(e) => {
                    setMonthFilter(e.target.value);
                    if (e.target.value !== "all") setTimePreset("monthly");
                  }}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs"
                >
                  <option value="all">All Months</option>
                  {availableMonths.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* Start Date */}
              <div className="flex items-center gap-1.5">
                <label className="text-[10px] font-extrabold uppercase text-slate-500">From Date:</label>
                <input
                  type="date"
                  value={startDateFilter}
                  onChange={(e) => setStartDateFilter(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs"
                />
              </div>

              {/* End Date */}
              <div className="flex items-center gap-1.5">
                <label className="text-[10px] font-extrabold uppercase text-slate-500">To Date:</label>
                <input
                  type="date"
                  value={endDateFilter}
                  onChange={(e) => setEndDateFilter(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 shadow-2xs"
                />
              </div>

              {(monthFilter !== "all" || startDateFilter || endDateFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setMonthFilter("all");
                    setStartDateFilter("");
                    setEndDateFilter("");
                  }}
                  className="text-[10px] font-extrabold text-rose-600 hover:text-rose-800 bg-rose-50 border border-rose-200 px-2 py-1 rounded-md transition-colors cursor-pointer"
                >
                  Reset Date Filters
                </button>
              )}
            </div>
          </div>

          {/* ========================================================= */}
          {/* PERSPECTIVE 1: SERVICE STATION PERSPECTIVE REPORT         */}
          {/* ========================================================= */}
          {perspective === "station" && (
            <div className="space-y-6">

              {/* METRICS SUMMARY BAR */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl shadow-2xs">
                  <span className="text-[9px] font-black text-blue-700 uppercase tracking-wider block mb-1">
                    Total Complaints
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-black text-blue-900">{totalStationCount}</span>
                  </div>
                  <p className="text-[9px] text-blue-600 mt-1 font-semibold">In selected range</p>
                </div>

                <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl shadow-2xs">
                  <span className="text-[9px] font-black text-amber-800 uppercase tracking-wider block mb-1">
                    Pending Action
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-black text-amber-900">{pendingStationActionCount}</span>
                  </div>
                  <p className="text-[9px] text-amber-700 mt-1 font-semibold">Unactioned</p>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl shadow-2xs">
                  <span className="text-[9px] font-black text-emerald-800 uppercase tracking-wider block mb-1">
                    Contacted Rate
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-black text-emerald-900">
                      {totalStationCount > 0 ? Math.round((contactedStationCount / totalStationCount) * 100) : 100}%
                    </span>
                  </div>
                  <p className="text-[9px] text-emerald-700 mt-1 font-semibold">{contactedStationCount} Contacted</p>
                </div>

                <div className="bg-purple-50 border border-purple-200 p-3 rounded-xl shadow-2xs">
                  <span className="text-[9px] font-black text-purple-800 uppercase tracking-wider block mb-1">
                    Resolution Rate
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-black text-purple-900">{stationResolutionRate}%</span>
                  </div>
                  <p className="text-[9px] text-purple-700 mt-1 font-semibold">{resolvedStationCount} Resolved</p>
                </div>

                <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl shadow-2xs">
                  <span className="text-[9px] font-black text-rose-800 uppercase tracking-wider block mb-1">
                    Re-Assigned / Esc.
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-black text-rose-900">{reassignedStationCount}</span>
                  </div>
                  <p className="text-[9px] text-rose-700 mt-1 font-bold">Rejected back</p>
                </div>

                {/* 3 AGING SLA SUMMARY CARDS */}
                <div className="bg-slate-900 border border-slate-800 text-slate-100 p-3 rounded-xl shadow-2xs">
                  <span className="text-[9px] font-black text-blue-400 uppercase tracking-wider block mb-1">
                    Avg Days to Contact Customer (Service Station)
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-black text-white">{overallStationAging.avgDaysStationContact} <span className="text-xs text-slate-400 font-normal">Days</span></span>
                  </div>
                  <p className="text-[9px] text-slate-400 mt-1 font-semibold">Registration &rarr; Station Contact</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 text-slate-100 p-3 rounded-xl shadow-2xs">
                  <span className="text-[9px] font-black text-amber-400 uppercase tracking-wider block mb-1">
                    Avg Days to Contact Customer (Call Center)
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-black text-white">{overallStationAging.avgDaysCallCenterContact} <span className="text-xs text-slate-400 font-normal">Days</span></span>
                  </div>
                  <p className="text-[9px] text-slate-400 mt-1 font-semibold">Registration &rarr; Call Center Contact</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 text-slate-100 p-3 rounded-xl shadow-2xs">
                  <span className="text-[9px] font-black text-emerald-400 uppercase tracking-wider block mb-1">
                    Average Days to Solve Case
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-black text-white">{overallStationAging.avgDaysToSolveCase} <span className="text-xs text-slate-400 font-normal">Days</span></span>
                  </div>
                  <p className="text-[9px] text-slate-400 mt-1 font-semibold">Registration &rarr; Resolution</p>
                </div>
              </div>

              {/* SERVICE STATION PERFORMANCE BREAKDOWN TABLE */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-blue-600" />
                    <span>Service Station Performance & SLA Aging Summary</span>
                  </h3>
                  <span className="text-[11px] font-bold text-slate-500">
                    Click row to filter list below
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold text-[10px] uppercase border-b border-slate-200">
                        <th className="py-2.5 px-3">Service Station</th>
                        <th className="py-2.5 px-2 text-center">Total Assigned</th>
                        <th className="py-2.5 px-2 text-center">Resolved</th>
                        <th className="py-2.5 px-2 text-center">Pending</th>
                        <th className="py-2.5 px-2 text-center">Re-assigned/Esc.</th>
                        <th className="py-2.5 px-2 text-center text-emerald-700">0-3d</th>
                        <th className="py-2.5 px-2 text-center text-amber-700">3-5d</th>
                        <th className="py-2.5 px-2 text-center text-orange-700">6-10d</th>
                        <th className="py-2.5 px-2 text-center text-rose-700">&gt;10d</th>
                        <th className="py-2.5 px-2 text-center">Res Rate</th>
                        <th className="py-2.5 px-2 text-center text-blue-700">Avg Days to Contact Customer (Service Station)</th>
                        <th className="py-2.5 px-2 text-center text-amber-700">Avg Days to Contact Customer (Call Center)</th>
                        <th className="py-2.5 px-2 text-center text-emerald-700">Average Days to Solve Case</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {stationBreakdownStats.map((st) => (
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
                          <td className="py-2.5 px-2 text-center font-black text-blue-900">{st.total}</td>
                          <td className="py-2.5 px-2 text-center font-bold text-emerald-700">{st.resolved}</td>
                          <td className="py-2.5 px-2 text-center font-bold text-amber-700">{st.pending}</td>
                          <td className="py-2.5 px-2 text-center font-bold text-rose-700">
                            {st.reassigned > 0 ? (
                              <span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded text-[10px] font-black">
                                {st.reassigned}
                              </span>
                            ) : (
                              <span className="text-slate-400">0</span>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-center font-bold text-emerald-700 text-[10px]">
                            {st.days0_3 || "-"}
                          </td>
                          <td className="py-2.5 px-2 text-center font-bold text-amber-700 text-[10px]">
                            {st.days3_5 || "-"}
                          </td>
                          <td className="py-2.5 px-2 text-center font-bold text-orange-700 text-[10px]">
                            {st.days6_10 || "-"}
                          </td>
                          <td className="py-2.5 px-2 text-center font-bold text-rose-700 text-[10px]">
                            {st.days10Plus || "-"}
                          </td>
                          <td className="py-2.5 px-2 text-center font-black">
                            <span className={`px-2 py-0.5 rounded text-[10px] ${st.resRate >= 80 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                              {st.resRate}%
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-center font-extrabold text-blue-700">
                            {st.avgDaysStationContact} {st.avgDaysStationContact === 1 ? "day" : "days"}
                          </td>
                          <td className="py-2.5 px-2 text-center font-extrabold text-amber-700">
                            {st.avgDaysCallCenterContact} {st.avgDaysCallCenterContact === 1 ? "day" : "days"}
                          </td>
                          <td className="py-2.5 px-2 text-center font-extrabold text-emerald-700">
                            {st.avgDaysToSolveCase} {st.avgDaysToSolveCase === 1 ? "day" : "days"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-900 text-white font-black text-xs border-t-2 border-slate-700">
                        <td className="py-3 px-3 uppercase tracking-wider">Overall Summary / Total</td>
                        <td className="py-3 px-2 text-center">{totalStationCount}</td>
                        <td className="py-3 px-2 text-center text-emerald-400">{resolvedStationCount}</td>
                        <td className="py-3 px-2 text-center text-amber-400">{pendingStationActionCount}</td>
                        <td className="py-3 px-2 text-center text-rose-400">{reassignedStationCount}</td>
                        <td className="py-3 px-2 text-center text-emerald-400">{stationBreakdownStats.reduce((a, b) => a + b.days0_3, 0)}</td>
                        <td className="py-3 px-2 text-center text-amber-400">{stationBreakdownStats.reduce((a, b) => a + b.days3_5, 0)}</td>
                        <td className="py-3 px-2 text-center text-orange-400">{stationBreakdownStats.reduce((a, b) => a + b.days6_10, 0)}</td>
                        <td className="py-3 px-2 text-center text-rose-400">{stationBreakdownStats.reduce((a, b) => a + b.days10Plus, 0)}</td>
                        <td className="py-3 px-2 text-center text-purple-300">{stationResolutionRate}%</td>
                        <td className="py-3 px-2 text-center text-blue-300">{overallStationAging.avgDaysStationContact} days</td>
                        <td className="py-3 px-2 text-center text-amber-300">{overallStationAging.avgDaysCallCenterContact} days</td>
                        <td className="py-3 px-2 text-center text-emerald-300">{overallStationAging.avgDaysToSolveCase} days</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* STATION DETAILED RECORDS TABLE & FILTERS */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-600" />
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                      Service Station Complaint Records ({stationPerspectiveComplaints.length})
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search customer, WO, notes..."
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

                    {/* Workflow Status Filter */}
                    <select
                      value={stationWorkflowStatusFilter}
                      onChange={(e) => setStationWorkflowStatusFilter(e.target.value)}
                      className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg px-2.5 py-1.5 focus:outline-none"
                    >
                      <option value="all">All Workflow Statuses</option>
                      <option value="Pending">Pending Action</option>
                      <option value="Contacted">Station Contacted</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Resolved">Resolved</option>
                    </select>

                    {/* Feedback Status Filter */}
                    <select
                      value={feedbackStatusFilter}
                      onChange={(e) => setFeedbackStatusFilter(e.target.value)}
                      className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg px-2.5 py-1.5 focus:outline-none"
                    >
                      <option value="all">All Feedback Statuses</option>
                      <option value="Satisfied">Satisfied</option>
                      <option value="Not Satisfied">Not Satisfied</option>
                      <option value="No Solution Received">No Solution Received</option>
                      <option value="Unreachable">Unreachable</option>
                    </select>

                    {(selectedStation !== "all" || stationWorkflowStatusFilter !== "all" || feedbackStatusFilter !== "all" || searchQuery) && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStation("all");
                          setStationWorkflowStatusFilter("all");
                          setFeedbackStatusFilter("all");
                          setSearchQuery("");
                        }}
                        className="text-xs text-rose-600 hover:text-rose-700 font-bold px-2 py-1 bg-rose-50 rounded-md"
                      >
                        Reset Filters
                      </button>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-slate-100 text-slate-700 font-bold text-[10px] uppercase shadow-2xs z-10">
                      <tr>
                        <th className="py-2.5 px-3">WO No / Customer</th>
                        <th className="py-2.5 px-3">Station</th>
                        <th className="py-2.5 px-3">Date Received</th>
                        <th className="py-2.5 px-3">Station Contact Date</th>
                        <th className="py-2.5 px-3">Station Action Notes</th>
                        <th className="py-2.5 px-3 text-center">Workflow Status</th>
                        <th className="py-2.5 px-3 text-center">Feedback Status</th>
                        <th className="py-2.5 px-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {stationPerspectiveComplaints.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-400 font-medium italic">
                            No station records found matching your filters.
                          </td>
                        </tr>
                      ) : (
                        stationPerspectiveComplaints.map((c) => (
                          <tr key={c.id} className="hover:bg-blue-50/40 transition-all font-medium">
                            <td className="py-2.5 px-3">
                              <span className="font-extrabold text-blue-900 block">{c.customerName}</span>
                              <span className="text-[10px] text-slate-500 font-mono">WO: {c.woNo || c.id} • {c.customerPhone}</span>
                            </td>

                            <td className="py-2.5 px-3">
                              <span className="bg-slate-100 text-slate-800 font-bold text-[10px] px-2 py-0.5 rounded border border-slate-200">
                                {c.station}
                              </span>
                            </td>

                            <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">{c.date}</td>

                            <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                              {c.stationContactedDate || <span className="text-amber-600 font-semibold">Pending</span>}
                            </td>

                            <td className="py-2.5 px-3 max-w-xs">
                              <p className="text-[11px] text-slate-600 line-clamp-2 italic">
                                "{c.stationResolutionNotes || c.notes || "No notes logged yet."}"
                              </p>
                            </td>

                            <td className="py-2.5 px-3 text-center">
                              <span className={`inline-block text-[10px] font-black px-2 py-0.5 rounded border ${
                                c.status === "Resolved" ? "bg-emerald-100 text-emerald-800 border-emerald-300" :
                                c.status === "Contacted" ? "bg-blue-100 text-blue-800 border-blue-300" :
                                "bg-amber-100 text-amber-800 border-amber-300"
                              }`}>
                                {c.status}
                              </span>
                            </td>

                            <td className="py-2.5 px-3 text-center">
                              <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded ${
                                c.feedbackStatus === "Satisfied" ? "bg-emerald-100 text-emerald-800" :
                                c.feedbackStatus === "Not Satisfied" ? "bg-rose-100 text-rose-800" :
                                c.feedbackStatus?.includes("No Solution") ? "bg-purple-100 text-purple-800" :
                                "bg-slate-100 text-slate-700"
                              }`}>
                                {c.feedbackStatus || "Pending"}
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
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* ========================================================= */}
          {/* PERSPECTIVE 2: CALL CENTER PERSPECTIVE REPORT             */}
          {/* ========================================================= */}
          {perspective === "callcenter" && (
            <div className="space-y-6">

              {/* METRICS SUMMARY BAR */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-xl shadow-2xs">
                  <span className="text-[10px] font-black text-blue-700 uppercase tracking-wider block mb-1">
                    Total Call Center Workload
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-black text-blue-900">{totalCCWorkload}</span>
                    <span className="text-[10px] bg-blue-200 text-blue-800 font-bold px-1.5 py-0.5 rounded">
                      Filtered Range
                    </span>
                  </div>
                  <p className="text-[10px] text-blue-600 mt-1 font-semibold">Total handled & pending</p>
                </div>

                <div className={`p-3.5 rounded-xl border shadow-2xs ${ccSlaRate >= 80 ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
                  <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider block mb-1">
                    24h SLA Compliance Rate
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className={`text-2xl font-black ${ccSlaRate >= 80 ? "text-emerald-800" : "text-amber-800"}`}>{ccSlaRate}%</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                      24h Target
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-600 mt-1 font-semibold">{ccSlaCompliant} On-Time / {ccSlaBreached} Breached</p>
                </div>

                <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-xl shadow-2xs">
                  <span className="text-[10px] font-black text-rose-800 uppercase tracking-wider block mb-1">
                    SLA Breached (&gt;24h Delay)
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-black text-rose-900">{ccSlaBreached}</span>
                    <span className="text-[10px] bg-rose-200 text-rose-900 font-black px-1.5 py-0.5 rounded">
                      Urgent Action
                    </span>
                  </div>
                  <p className="text-[10px] text-rose-700 mt-1 font-bold">Overdue call center follow-ups</p>
                </div>

                <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl shadow-2xs">
                  <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider block mb-1">
                    1st vs 2nd Attempt Needed
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-base font-black text-amber-900 flex items-center gap-1">
                      <span>1st: {count1stAttemptCC}</span>
                      <span className="text-slate-400 font-normal">|</span>
                      <span>2nd: {count2ndAttemptCC}</span>
                    </span>
                  </div>
                  <p className="text-[10px] text-amber-700 mt-1 font-semibold">1st Attempt vs 2nd Attempt</p>
                </div>

                <div className="bg-purple-50 border border-purple-200 p-3.5 rounded-xl shadow-2xs">
                  <span className="text-[10px] font-black text-purple-800 uppercase tracking-wider block mb-1">
                    Re-assigned to Station
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-black text-purple-900">{countReassignedCC}</span>
                    <span className="text-[10px] bg-purple-200 text-purple-900 font-extrabold px-1.5 py-0.5 rounded">
                      No Solution
                    </span>
                  </div>
                  <p className="text-[10px] text-purple-700 mt-1 font-semibold">Sent back to Service Station</p>
                </div>
              </div>

              {/* AGING BREAKDOWN CARDS */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <span>Call Center Pending SLA Aging Breakdown</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <div 
                    onClick={() => setAgingFilter(agingFilter === "0-2" ? "all" : "0-2")}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      agingFilter === "0-2" ? "ring-2 ring-emerald-500 bg-emerald-100/80" : "bg-emerald-50 border-emerald-200 hover:bg-emerald-100/50"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                      <span className="text-[10px] font-bold text-emerald-800 uppercase">0 - 2 Days (Fresh)</span>
                    </div>
                    <div className="text-xl font-black text-emerald-950 mt-1">{aging0to2} Customers</div>
                    <span className="text-[9px] text-emerald-700 font-medium">Within normal SLA timeline</span>
                  </div>

                  <div 
                    onClick={() => setAgingFilter(agingFilter === "3-5" ? "all" : "3-5")}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      agingFilter === "3-5" ? "ring-2 ring-amber-500 bg-amber-100/80" : "bg-amber-50 border-amber-200 hover:bg-amber-100/50"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                      <span className="text-[10px] font-bold text-amber-800 uppercase">3 - 5 Days (Moderate)</span>
                    </div>
                    <div className="text-xl font-black text-amber-950 mt-1">{aging3to5} Customers</div>
                    <span className="text-[9px] text-amber-700 font-medium">Follow-up priority</span>
                  </div>

                  <div 
                    onClick={() => setAgingFilter(agingFilter === "6-10" ? "all" : "6-10")}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      agingFilter === "6-10" ? "ring-2 ring-orange-500 bg-orange-100/80" : "bg-orange-50 border-orange-200 hover:bg-orange-100/50"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-orange-500 shrink-0" />
                      <span className="text-[10px] font-bold text-orange-800 uppercase">6 - 10 Days (Delayed)</span>
                    </div>
                    <div className="text-xl font-black text-orange-950 mt-1">{aging6to10} Customers</div>
                    <span className="text-[9px] text-orange-700 font-bold">High SLA breach risk</span>
                  </div>

                  <div 
                    onClick={() => setAgingFilter(agingFilter === "11+" ? "all" : "11+")}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      agingFilter === "11+" ? "ring-2 ring-rose-500 bg-rose-100/80" : "bg-rose-50 border-rose-200 hover:bg-rose-100/50"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
                      <span className="text-[10px] font-black text-rose-800 uppercase">11+ Days (Critical)</span>
                    </div>
                    <div className="text-xl font-black text-rose-950 mt-1">{aging11Plus} Customers</div>
                    <span className="text-[9px] text-rose-700 font-bold">Immediate supervisor review</span>
                  </div>
                </div>
              </div>

              {/* OFFICER PERFORMANCE SUMMARY TABLE */}
              {officerStats.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-blue-600" />
                      <span>Call Center Agent / Officer Performance Breakdown</span>
                    </h3>
                    <span className="text-[11px] font-bold text-slate-500">
                      Performance stats per agent
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold text-[10px] uppercase border-b border-slate-200">
                          <th className="py-2.5 px-3">Call Center Officer</th>
                          <th className="py-2.5 px-3 text-center">Total Handled</th>
                          <th className="py-2.5 px-3 text-center">1st Attempt Done</th>
                          <th className="py-2.5 px-3 text-center">2nd Attempt Done</th>
                          <th className="py-2.5 px-3 text-center">Satisfied Cases</th>
                          <th className="py-2.5 px-3 text-center">Re-assigned to Station</th>
                          <th className="py-2.5 px-3 text-center">SLA Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {officerStats.map((of) => (
                          <tr 
                            key={of.officer}
                            onClick={() => setSelectedOfficer(selectedOfficer === of.officer ? "all" : of.officer)}
                            className={`hover:bg-blue-50/50 transition-all cursor-pointer font-medium ${
                              selectedOfficer === of.officer ? "bg-blue-50 font-bold" : ""
                            }`}
                          >
                            <td className="py-2.5 px-3 font-bold text-slate-900">{of.officer}</td>
                            <td className="py-2.5 px-3 text-center font-black text-blue-900">{of.total}</td>
                            <td className="py-2.5 px-3 text-center font-bold text-slate-700">{of.firstAttemptDone}</td>
                            <td className="py-2.5 px-3 text-center font-bold text-amber-700">{of.secondAttemptDone}</td>
                            <td className="py-2.5 px-3 text-center font-bold text-emerald-700">{of.satisfied}</td>
                            <td className="py-2.5 px-3 text-center font-bold text-purple-700">{of.reassigned}</td>
                            <td className="py-2.5 px-3 text-center font-black">
                              <span className={`px-2 py-0.5 rounded text-[10px] ${of.slaPercent >= 80 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                                {of.slaPercent}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* CALL CENTER DETAILED RECORDS TABLE & FILTERS */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-600" />
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                      Call Center Customer Interaction List ({callCenterPerspectiveComplaints.length})
                    </h3>
                  </div>

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

                    {/* Call Center Officer Filter */}
                    <select
                      value={selectedOfficer}
                      onChange={(e) => setSelectedOfficer(e.target.value)}
                      className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg px-2.5 py-1.5 focus:outline-none"
                    >
                      <option value="all">All Officers / Agents</option>
                      {availableOfficers.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                      <option value="Unassigned">Unassigned</option>
                    </select>

                    {/* Call Center SLA Filter */}
                    <select
                      value={callCenterSlaFilter}
                      onChange={(e) => setCallCenterSlaFilter(e.target.value as any)}
                      className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg px-2.5 py-1.5 focus:outline-none"
                    >
                      <option value="all">All SLA Statuses</option>
                      <option value="compliant">On-Time SLA (&lt;24h)</option>
                      <option value="breached">SLA Breached (&gt;24h Delay)</option>
                    </select>

                    {/* Call Center Current Status Filter */}
                    <select
                      value={callCenterStatusFilter}
                      onChange={(e) => setCallCenterStatusFilter(e.target.value)}
                      className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg px-2.5 py-1.5 focus:outline-none"
                    >
                      <option value="all">All Call Center Statuses</option>
                      <option value="Pending">Pending Contact</option>
                      <option value="Contacted">Contacted</option>
                      <option value="Re-assigned">Re-assigned to Station</option>
                      <option value="Resolved">Resolved / Closed</option>
                    </select>

                    {(selectedOfficer !== "all" || callCenterSlaFilter !== "all" || callCenterStatusFilter !== "all" || agingFilter !== "all" || searchQuery) && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedOfficer("all");
                          setCallCenterSlaFilter("all");
                          setCallCenterStatusFilter("all");
                          setAgingFilter("all");
                          setSearchQuery("");
                        }}
                        className="text-xs text-rose-600 hover:text-rose-700 font-bold px-2 py-1 bg-rose-50 rounded-md"
                      >
                        Reset Filters
                      </button>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-slate-100 text-slate-700 font-bold text-[10px] uppercase shadow-2xs z-10">
                      <tr>
                        <th className="py-2.5 px-3">WO No / Customer</th>
                        <th className="py-2.5 px-3">Service Station</th>
                        <th className="py-2.5 px-3">Station Date</th>
                        <th className="py-2.5 px-3">CC Contact Date</th>
                        <th className="py-2.5 px-3 text-center">Diff (Days)</th>
                        <th className="py-2.5 px-3">Officer / Agent</th>
                        <th className="py-2.5 px-3">Attempt Status</th>
                        <th className="py-2.5 px-3 text-center">Feedback Status</th>
                        <th className="py-2.5 px-3 text-center">SLA Status</th>
                        <th className="py-2.5 px-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {callCenterPerspectiveComplaints.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="py-8 text-center text-slate-400 font-medium italic">
                            No call center customer records found matching your filters.
                          </td>
                        </tr>
                      ) : (
                        callCenterPerspectiveComplaints.map((c) => {
                          const ageDays = getCallCenterAgeInDays(c);
                          const sla = getCallCenterSLAStatus(c);

                          return (
                            <tr key={c.id} className="hover:bg-blue-50/40 transition-all font-medium">
                              <td className="py-2.5 px-3">
                                <span className="font-extrabold text-blue-900 block">{c.customerName}</span>
                                <span className="text-[10px] text-slate-500 font-mono">WO: {c.woNo || c.id} • {c.customerPhone}</span>
                              </td>

                              <td className="py-2.5 px-3">
                                <span className="bg-slate-100 text-slate-800 font-bold text-[10px] px-2 py-0.5 rounded border border-slate-200">
                                  {c.station}
                                </span>
                              </td>

                              <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                                {c.stationContactedDate || c.date || "N/A"}
                              </td>

                              <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                                {c.callCenterContactedDate || <span className="text-amber-600 font-semibold">Pending</span>}
                              </td>

                              <td className="py-2.5 px-3 text-center font-extrabold">
                                <span className={`px-2 py-0.5 rounded text-[10px] ${
                                  ageDays <= 1 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800 font-black"
                                }`}>
                                  {ageDays}d
                                </span>
                              </td>

                              <td className="py-2.5 px-3">
                                <span className="font-bold text-slate-800 text-[11px]">
                                  {c.callCenterOfficer || c.callCenterContactedBy || c.updatedBy || "Unassigned"}
                                </span>
                              </td>

                              <td className="py-2.5 px-3">
                                {c.stationResponseStatus === "Rejected" || c.finalStatus?.includes("Re-assigned") ? (
                                  <span className="inline-flex items-center text-[10px] bg-purple-100 text-purple-900 border border-purple-300 font-black px-2 py-0.5 rounded uppercase tracking-wider">
                                    Re-assigned to Station
                                  </span>
                                ) : c.secondAttemptFeedbackStatus ? (
                                  <span className="inline-flex items-center text-[10px] bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold px-2 py-0.5 rounded uppercase">
                                    2nd Attempt Complete
                                  </span>
                                ) : c.firstAttemptCallStatus ? (
                                  <span className="inline-flex items-center text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-bold px-2 py-0.5 rounded uppercase">
                                    1st Attempt ({c.firstAttemptCallStatus})
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center text-[10px] bg-blue-100 text-blue-900 border border-blue-300 font-bold px-2 py-0.5 rounded uppercase">
                                    1st Attempt Pending
                                  </span>
                                )}
                              </td>

                              <td className="py-2.5 px-3 text-center">
                                <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded ${
                                  c.feedbackStatus === "Satisfied" ? "bg-emerald-100 text-emerald-800" :
                                  c.feedbackStatus === "Not Satisfied" ? "bg-rose-100 text-rose-800" :
                                  c.feedbackStatus?.includes("No Solution") ? "bg-purple-100 text-purple-800" :
                                  "bg-slate-100 text-slate-700"
                                }`}>
                                  {c.feedbackStatus || "Pending"}
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
          )}

        </div>

        {/* MODAL FOOTER */}
        <div className={`px-6 py-3 border-t flex items-center justify-between ${isDark ? "border-slate-800 bg-slate-950/60" : "border-slate-200 bg-slate-50/80"}`}>
          <div className="text-xs text-slate-500 font-medium">
            Showing <strong className="text-slate-800">{perspective === "station" ? stationPerspectiveComplaints.length : callCenterPerspectiveComplaints.length}</strong> records for <strong className="text-slate-800">{perspective === "station" ? "Service Station View" : "Call Center View"}</strong>.
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
