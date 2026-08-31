import React, { useState, useMemo } from "react";
import { 
  Download, 
  FileText, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  FileSpreadsheet, 
  MapPin,
  Filter,
  BarChart3,
  Calendar,
  Search,
  RotateCcw,
  TrendingUp,
  Activity,
  ShieldAlert,
  Building2,
  Headphones,
  Calculator,
  Printer,
  Loader2,
  X,
  Eye,
  ExternalLink,
  Copy,
  Check,
  Phone,
  Car,
  AlertCircle,
  User,
  Hash,
  ArrowRight,
  ChevronRight,
  Info,
  Sparkles
} from "lucide-react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { Complaint, StationProfile, SatisfactionLevel } from "../types";
import { generateSlaDashboardPdf } from "../utils/slaPdfGenerator";
import { STATIONS } from "../demoData";
import { matchesStationCodeOrName, isStationContacted, getCallCenterSLAStatus, isCallCenterSlaEligible, isComplaintRejected, isContactedByCallCenterOrClosed } from "../utils/stationUtils";
import { parseComplaintDate, formatAndSanitizeDate, isComplaintTimeFrozen, getComplaintAgeInfo } from "../utils/agingUtils";
import { sanitizeDocOklch } from "../utils/pdfExportUtils";
import { getActiveCycleAgeInfo, isComplaintResolved as isComplaintResolvedUtil, calculateNationalReportSummary } from "../utils/workflowTallyUtils";

interface ReportsPanelProps {
  complaints: Complaint[];
  theme?: "light" | "dark";
  onOpenSLAReportModal?: () => void;
  onSelectComplaintInWorkspace?: (id: string) => void;
  onEditComplaint?: (complaint: Complaint) => void;
}

export default function ReportsPanel({ 
  complaints, 
  theme = "light", 
  onOpenSLAReportModal,
  onSelectComplaintInWorkspace,
  onEditComplaint
}: ReportsPanelProps) {
  const isDark = theme === "dark";
  const cardBg = isDark ? "bg-slate-900/90 border-slate-800 text-slate-100 shadow-inner" : "bg-white border-slate-200 text-slate-800 shadow-sm";
  const textTitle = isDark ? "text-slate-100" : "text-slate-800";
  const textSub = isDark ? "text-slate-400" : "text-slate-500";
  const bgSub = isDark ? "bg-slate-950/40 border-slate-800/60" : "bg-slate-50 border-slate-100";
  const borderCol = isDark ? "border-slate-800/80" : "border-slate-200";
  const textSec = isDark ? "text-slate-300" : "text-slate-700";
  const [stationFilter, setStationFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [feedbackStatusFilter, setFeedbackStatusFilter] = useState<string>("all");
  const [satisfactionFilter, setSatisfactionFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isGeneratingPDF, setIsGeneratingPDF] = useState<boolean>(false);
  const [isGeneratingStationPDF, setIsGeneratingStationPDF] = useState<boolean>(false);
  const [selectedStationCode, setSelectedStationCode] = useState<string>("Rathmalana");

  // Drill-down Modal State
  const [drilldown, setDrilldown] = useState<{
    isOpen: boolean;
    stationName: string;
    stationCode: string;
    metricLabel: string;
    badgeColor: "slate" | "emerald" | "amber" | "orange" | "rose" | "blue" | "indigo" | "sky" | "purple";
    complaints: Complaint[];
  } | null>(null);

  const [drilldownSearch, setDrilldownSearch] = useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeDetailComplaint, setActiveDetailComplaint] = useState<Complaint | null>(null);

  // Filter complaints inside the drill-down modal by search term
  const filteredDrilldownComplaints = useMemo(() => {
    if (!drilldown) return [];
    if (!drilldownSearch.trim()) return drilldown.complaints;
    const q = drilldownSearch.toLowerCase().trim();
    return drilldown.complaints.filter(c => 
      c.id.toLowerCase().includes(q) ||
      c.customerName.toLowerCase().includes(q) ||
      c.customerPhone.toLowerCase().includes(q) ||
      (c.customerEmail && c.customerEmail.toLowerCase().includes(q)) ||
      (c.vehicleRegNo && c.vehicleRegNo.toLowerCase().includes(q)) ||
      (c.woNo && c.woNo.toLowerCase().includes(q)) ||
      (c.category && c.category.toLowerCase().includes(q)) ||
      (c.description && c.description.toLowerCase().includes(q)) ||
      (c.station && c.station.toLowerCase().includes(q))
    );
  }, [drilldown, drilldownSearch]);

  const handleOpenDrilldown = (
    stationName: string, 
    stationCode: string, 
    metricLabel: string, 
    list: Complaint[], 
    badgeColor: "slate" | "emerald" | "amber" | "orange" | "rose" | "blue" | "indigo" | "sky" | "purple"
  ) => {
    setDrilldown({
      isOpen: true,
      stationName,
      stationCode,
      metricLabel,
      badgeColor,
      complaints: list
    });
    setDrilldownSearch("");
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportDrilldownCSV = () => {
    if (!drilldown || drilldown.complaints.length === 0) return;
    const headers = [
      "Complaint ID",
      "Work Order No",
      "Customer Name",
      "Customer Phone",
      "Vehicle Reg No",
      "Service Station",
      "Category",
      "Status",
      "Feedback Status",
      "Date Received",
      "Station Contacted Date",
      "Aging (Days)",
      "Customer Issue Description",
      "Station Resolution Notes",
      "Call Center Final Remarks"
    ];
    const rows = drilldown.complaints.map(c => [
      c.id,
      c.woNo || "N/A",
      c.customerName,
      c.customerPhone,
      c.vehicleRegNo || "N/A",
      c.station,
      c.category,
      c.status,
      c.feedbackStatus || "N/A",
      c.date || "N/A",
      c.stationContactedDate || "N/A",
      getComplaintAging(c).days.toString(),
      c.description || "N/A",
      c.stationResolutionNotes || "N/A",
      c.callCenterFinalRemarks || "N/A"
    ]);
    downloadCSV(headers, rows, `Scorecard_Drilldown_${drilldown.stationCode}_${drilldown.metricLabel.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleResetFilters = () => {
    setStationFilter("all");
    setCategoryFilter("all");
    setStatusFilter("all");
    setFeedbackStatusFilter("all");
    setSatisfactionFilter("all");
    setStartDate("");
    setEndDate("");
    setSearchQuery("");
  };

  // Helper: date difference in days
  const getDaysDiff = (startStr: string, endStr: string): number => {
    if (!startStr || !endStr) return 0;
    const start = parseComplaintDate(startStr);
    const end = parseComplaintDate(endStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    const diffTime = end.getTime() - start.getTime();
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  };

  // Helper: compute aging details for a single complaint using active cycle working days or frozen duration
  const getComplaintAging = (c: Complaint) => {
    if (isComplaintTimeFrozen(c)) {
      const ageInfo = getComplaintAgeInfo(c);
      const days = ageInfo.days;
      let colorClass = "";
      let textClass = "";
      let bgClass = "";
      let label = ageInfo.category;

      if (days <= 3) {
        colorClass = "border-emerald-200 text-emerald-700 bg-emerald-50";
        textClass = "text-emerald-600";
        bgClass = "bg-emerald-500";
      } else if (days <= 5) {
        colorClass = "border-amber-200 text-amber-700 bg-amber-50";
        textClass = "text-amber-600";
        bgClass = "bg-amber-500";
      } else if (days <= 10) {
        colorClass = "border-orange-200 text-orange-700 bg-orange-50";
        textClass = "text-orange-600";
        bgClass = "bg-orange-500";
      } else {
        colorClass = "border-rose-200 text-rose-700 bg-rose-50";
        textClass = "text-rose-600";
        bgClass = "bg-rose-500";
      }

      return { days, colorClass, textClass, bgClass, label, isFrozen: true };
    }

    const ageInfo = getActiveCycleAgeInfo(c, new Date());
    const days = ageInfo.workingDays;
    
    let colorClass = "";
    let textClass = "";
    let bgClass = "";
    let label = ageInfo.bucketLabel;

    if (days <= 3) {
      colorClass = "border-emerald-200 text-emerald-700 bg-emerald-50";
      textClass = "text-emerald-600";
      bgClass = "bg-emerald-500";
    } else if (days <= 5) {
      colorClass = "border-amber-200 text-amber-700 bg-amber-50";
      textClass = "text-amber-600";
      bgClass = "bg-amber-500";
    } else if (days <= 10) {
      colorClass = "border-orange-200 text-orange-700 bg-orange-50";
      textClass = "text-orange-600";
      bgClass = "bg-orange-500";
    } else {
      colorClass = "border-rose-200 text-rose-700 bg-rose-50";
      textClass = "text-rose-600";
      bgClass = "bg-rose-500";
    }

    return { days, colorClass, textClass, bgClass, label, isFrozen: false };
  };

  // Unique categories for filtering
  const categories = Array.from(new Set(complaints.map((c) => c.category))).filter(Boolean);

  // Unique feedback status values for filtering
  const feedbackStatuses = Array.from(new Set(complaints.map((c) => c.feedbackStatus))).filter(Boolean);

  // Filter complaints based on selection
  const filteredComplaints = complaints.filter((c) => {
    const matchesStation = matchesStationCodeOrName(c.station, stationFilter);
    const matchesCategory = categoryFilter === "all" || c.category === categoryFilter;
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    const matchesFeedbackStatus = feedbackStatusFilter === "all" || c.feedbackStatus === feedbackStatusFilter;
    const matchesSatisfaction = satisfactionFilter === "all" || c.currentSatisfaction === satisfactionFilter;
    
    let matchesStartDate = true;
    if (startDate) {
      matchesStartDate = c.date >= startDate;
    }
    
    let matchesEndDate = true;
    if (endDate) {
      matchesEndDate = c.date <= endDate;
    }
    
    let matchesSearch = true;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      matchesSearch = 
        c.customerName.toLowerCase().includes(q) ||
        c.customerPhone.toLowerCase().includes(q) ||
        (c.customerEmail && c.customerEmail.toLowerCase().includes(q)) ||
        (c.vehicleRegNo && c.vehicleRegNo.toLowerCase().includes(q)) ||
        (c.woNo && c.woNo.toLowerCase().includes(q)) ||
        (c.advisorName && c.advisorName.toLowerCase().includes(q)) ||
        c.id.toLowerCase().includes(q);
    }
    
    return matchesStation && 
           matchesCategory && 
           matchesStatus && 
           matchesFeedbackStatus && 
           matchesSatisfaction && 
           matchesStartDate && 
           matchesEndDate && 
           matchesSearch;
  });

  // Calculate high-level stats for the active filtered scope (scopes to selected table station)
  const activeStation = STATIONS.find(s => s.code === selectedStationCode);
  const activeScopeTitle = selectedStationCode === "all"
    ? "All Service Stations"
    : (activeStation ? `${activeStation.name} (${activeStation.code})` : selectedStationCode);

  const activeScopeComplaints = selectedStationCode === "all"
    ? filteredComplaints
    : filteredComplaints.filter(c => matchesStationCodeOrName(c.station, selectedStationCode));

  const totalInScope = activeScopeComplaints.length;
  
  // Filter activeScopeComplaints to only frozen times (resolved / closed / timer-frozen cases)
  const frozenComplaintsInScope = activeScopeComplaints.filter(c => isComplaintTimeFrozen(c));
  const totalFrozenInScope = frozenComplaintsInScope.length;

  let greenCount = 0; // 0-3 Days (Frozen)
  let yellowCount = 0; // 3-5 Days (Frozen)
  let orangeCount = 0; // 6-10 Days (Frozen)
  let redCount = 0; // >10 Days (Frozen)

  const greenList: Complaint[] = [];
  const yellowList: Complaint[] = [];
  const orangeList: Complaint[] = [];
  const redList: Complaint[] = [];

  frozenComplaintsInScope.forEach((c) => {
    const { days } = getComplaintAging(c);
    if (days <= 3) {
      greenCount++;
      greenList.push(c);
    } else if (days <= 5) {
      yellowCount++;
      yellowList.push(c);
    } else if (days <= 10) {
      orangeCount++;
      orangeList.push(c);
    } else {
      redCount++;
      redList.push(c);
    }
  });

  // Helper for overall list aging metrics
  const todayStr = new Date().toISOString().split("T")[0];

  // Dynamic Service Stations list extracted from database complaints and predefined STATIONS
  const dynamicStations = useMemo(() => {
    const stationMap = new Map<string, { code: string; name: string }>();
    STATIONS.forEach((s) => {
      stationMap.set(s.code.toLowerCase(), { code: s.code, name: s.name });
    });
    
    let hasUnassignedOrOther = false;
    complaints.forEach((c) => {
      if (!c.station || c.station.trim().length === 0 || c.station === "Unassigned" || c.station === "Other") {
        hasUnassignedOrOther = true;
        return;
      }
      const cleanSt = c.station.trim();
      const existing = Array.from(stationMap.values()).find(
        s => s.code.toLowerCase() === cleanSt.toLowerCase() || s.name.toLowerCase() === cleanSt.toLowerCase()
      );
      if (!existing) {
        stationMap.set(cleanSt.toLowerCase(), { code: cleanSt, name: cleanSt });
      }
    });

    if (hasUnassignedOrOther) {
      stationMap.set("other", { code: "Other", name: "Other / Head Office" });
    }

    return Array.from(stationMap.values());
  }, [complaints]);

  // Helper for calculating accurate timestamp differences for contact and solve metrics
  const getStationMetricsCalculations = (stationComplaints: Complaint[]) => {
    let stContactSum = 0, stContactCount = 0;
    let ccContactSum = 0, ccContactCount = 0;
    let solveSum = 0, solveCount = 0;

    stationComplaints.forEach((c) => {
      // 1. Avg Days to Contact Customer (Service Station) - only for cases with SC contact
      if (isStationContacted(c) || c.stationContactedDate) {
        const contactDate = c.stationContactedDate || c.updatedAt || c.date;
        const diff = getDaysDiff(c.date, contactDate);
        stContactSum += diff;
        stContactCount++;
      }

      // 2. Avg Days to Contact Customer (Call Center) - only for eligible cases where CC recorded contact
      if (isStationContacted(c) && c.callCenterContactedDate) {
        const startRef = c.stationContactedDate || c.date;
        const diff = getDaysDiff(startRef, c.callCenterContactedDate);
        ccContactSum += diff;
        ccContactCount++;
      }

      // 3. Avg Days to Solve Case - only for resolved cases
      const isResolved = 
        c.status === "Resolved" || 
        c.finalStatus === "Closed" || 
        c.finalStatus === "Completed" || 
        c.finalStatus === "Resolved" ||
        c.finalStatus === "Unreachable" ||
        c.finalStatus?.includes("Unreachable") ||
        c.feedbackStatus === "Satisfied" || 
        c.feedbackStatus === "Satisfied After Resolution" || 
        c.feedbackStatus === "Customer Unreachable" ||
        c.feedbackStatus === "Unreachable" ||
        c.currentSatisfaction === "Satisfied" || 
        c.currentSatisfaction === "Very Satisfied";

      if (isResolved) {
        const solveDate = c.solutionDate || c.callCenterContactedDate || c.updatedAt || c.stationContactedDate || c.date;
        const diff = getDaysDiff(c.date, solveDate);
        solveSum += diff;
        solveCount++;
      }
    });

    return {
      avgDaysStationContact: stContactCount > 0 ? Math.round(stContactSum / stContactCount) : 0,
      avgDaysCallCenterContact: ccContactCount > 0 ? Math.round(ccContactSum / ccContactCount) : 0,
      avgDaysToSolveCase: solveCount > 0 ? Math.round(solveSum / solveCount) : 0,
    };
  };

  // Dynamically calculate CX Recovery & Service Station Performance Metrics from raw database records
  // Single source of truth calculation engine from workflowTallyUtils
  const nationalSummary = useMemo(() => {
    return calculateNationalReportSummary(filteredComplaints);
  }, [filteredComplaints]);

  const stationMetrics = nationalSummary.stationMetrics;

  // Grand summary totals strictly aggregated from stationMetrics (guaranteed 100% tally)
  const grandTotal = nationalSummary.total;
  const grandTotalList = nationalSummary.totalList;

  const grandResolved = nationalSummary.resolved;
  const grandResolvedList = nationalSummary.resolvedList;

  const grandEscalated = nationalSummary.rejectedByCC;
  const grandEscalatedList = nationalSummary.rejectedByCCList;
  const grandRejectedByCC = nationalSummary.rejectedByCC;
  const grandRejectedByCCList = nationalSummary.rejectedByCCList;

  const grandPending = nationalSummary.pending;
  const grandPendingList = nationalSummary.pendingList;

  const grandScPendingUncontacted = nationalSummary.scPendingUncontacted;
  const grandScPendingUncontactedList = nationalSummary.scPendingUncontactedList;

  const grandScPendingAttempted = nationalSummary.scPendingAttempted;
  const grandScPendingAttemptedList = nationalSummary.scPendingAttemptedList;

  const grandUnclassified = 0;
  const grandUnclassifiedList: Complaint[] = [];

  // Grand Aging calculated exclusively from pending complaints
  const grandDays0_3 = nationalSummary.sla_0_3;
  const grandDays0_3List = nationalSummary.sla_0_3List;

  const grandDays3_5 = nationalSummary.sla_3_5;
  const grandDays3_5List = nationalSummary.sla_3_5List;

  const grandDays6_10 = nationalSummary.sla_6_10;
  const grandDays6_10List = nationalSummary.sla_6_10List;

  const grandDays10Plus = nationalSummary.sla_gt_10;
  const grandDays10PlusList = nationalSummary.sla_gt_10List;

  const grandScContactedList = nationalSummary.scContactedList;
  const grandScContacted = nationalSummary.scContactedCount;
  const grandScContactedRate = nationalSummary.scContactedPercent;

  const grandCcEligibleList = nationalSummary.ccEligibleList;
  const grandCcEligible = nationalSummary.ccEligibleCount;
  const grandCcExcluded = nationalSummary.ccExcludedCount;

  const grandCcContactedList = nationalSummary.ccContactedList;
  const grandCcContacted = nationalSummary.ccContactedCount;
  const grandCcContactedRate = nationalSummary.ccContactedPercent;

  const grandCcSlaMet = nationalSummary.ccSlaMetCount;
  const grandCcSlaBreached = nationalSummary.ccSlaBreachedCount;
  const grandCcSlaRate = nationalSummary.ccSlaAchievementRate;
  const grandResolutionRate = nationalSummary.resolutionRate;

  const overallReportAging = {
    avgDaysStationContact: nationalSummary.avgDaysStationContact,
    avgDaysCallCenterContact: nationalSummary.avgDaysCallCenterContact,
    avgDaysToSolveCase: nationalSummary.avgDaysToSolveCase,
  };

  // CSV Export: Detailed Aging Report
  const handleDownloadDetailedReport = () => {
    const headers = [
      "Complaint ID",
      "Customer Name",
      "Customer Phone",
      "Customer Email",
      "Service Station",
      "Category",
      "Status",
      "SLA Feedback Status",
      "Operational Final Status",
      "Received Date & Time (Created Date)",
      "Date Contacted by Call Center",
      "Date Forwarded to Aftermarket",
      "Solution Provided by Aftermarket",
      "Solution Date",
      "Follow-up Date",
      "Customer Feedback (Description)",
      "Final Remark",
      "Aging Days",
      "Aging Class",
      "Initial Satisfaction",
      "Current Satisfaction",
      "Work Order No",
      "Vehicle Reg No",
      "Advisor Name"
    ];

    const rows = filteredComplaints.map((c) => {
      const aging = getComplaintAging(c);
      return [
        c.id,
        c.customerName,
        c.customerPhone,
        c.customerEmail,
        c.station,
        c.category,
        c.status,
        c.feedbackStatus || "Follow-up Required",
        c.finalStatus || "Open",
        c.receivedDateTime || `${c.date} 08:00 AM`, // Received Date and Time
        c.callCenterContactedDate || "N/A", // Date Contacted by Call Center
        c.stationContactedDate || "N/A", // Date Forwarded to Aftermarket
        c.solutionProvidedByAftermarket || "N/A", // Solution Provided by Aftermarket
        c.solutionDate || "N/A", // Solution Date
        c.followUpDate || "N/A", // Follow-up Date
        c.description || "N/A", // Customer Feedback / complaint text
        c.callCenterFinalRemarks || "N/A", // Final Remark
        aging.days.toString(),
        aging.label,
        c.initialSatisfaction,
        c.currentSatisfaction,
        c.woNo || "N/A",
        c.vehicleRegNo || "N/A",
        c.advisorName || "N/A"
      ];
    });

    downloadCSV(headers, rows, `CX_Detailed_Aging_Report_${new Date().toISOString().split('T')[0]}.csv`);
  };

  // CSV Export: Service Station Wise Summary Report
  const handleDownloadStationReport = () => {
    const headers = [
      "Service Station Code",
      "Service Station Name",
      "Total Complaints (Received)",
      "Resolved Complaints (Contacted & Satisfied by CC)",
      "Pending/In-Progress (Not Contacted by Service Station)",
      "Rejected by Call Center (Escalated) (Showall)",
      "0-3 Days (New)(Get from Pending customers for service station)",
      "3-5 Days (Pending)(Get from Pending customers for service station)",
      "6-10 Days (Escalated)(Get from Pending customers for service station)",
      ">10 Days (Critical)(Get from Pending customers for service station)",
      "Avg Days to Contact Customer (Service Station)",
      "Avg Days to Contact Customer (Call Center)",
      "Average Days to Solve Case { Avg Days to Contact Customer (Service Station) + Avg Days to Contact Customer (Call Center) }/2"
    ];

    const rows = stationMetrics.map((sm) => {
      const rejectedCount = sm.escalated || sm.rejectedReAction || sm.rejectedByCC || 0;
      const scAvg = Math.round(sm.avgDaysStationContact || 0);
      const ccAvg = Math.round(sm.avgDaysCallCenterContact || 0);
      // Formula matching user specification: Avg Days SC + Math.round(Avg Days CC / 2)
      const solveAvg = scAvg > 0 || ccAvg > 0 
        ? Math.round(scAvg + ccAvg / 2) 
        : (sm.avgDaysToSolveCase > 0 ? Math.round(sm.avgDaysToSolveCase) : 0);

      return [
        sm.code,
        sm.name,
        sm.total.toString(),
        sm.resolved.toString(),
        sm.pending.toString(),
        rejectedCount.toString(),
        sm.days0_3 > 0 ? sm.days0_3.toString() : "0",
        sm.days3_5 > 0 ? sm.days3_5.toString() : "0",
        sm.days6_10 > 0 ? sm.days6_10.toString() : "0",
        sm.days10Plus > 0 ? sm.days10Plus.toString() : "0",
        scAvg.toString(),
        ccAvg.toString(),
        solveAvg.toString()
      ];
    });

    // Add overall summary total row
    const grandScAvg = Math.round(overallReportAging.avgDaysStationContact || 0);
    const grandCcAvg = Math.round(overallReportAging.avgDaysCallCenterContact || 0);
    const grandSolveAvg = grandScAvg > 0 || grandCcAvg > 0 
      ? Math.round(grandScAvg + grandCcAvg / 2)
      : (overallReportAging.avgDaysToSolveCase > 0 ? Math.round(overallReportAging.avgDaysToSolveCase) : 0);

    rows.push([
      "ALL",
      "Overall Summary / All Stations",
      grandTotal.toString(),
      grandResolved.toString(),
      grandPending.toString(),
      grandEscalated.toString(),
      grandDays0_3 > 0 ? grandDays0_3.toString() : "0",
      grandDays3_5 > 0 ? grandDays3_5.toString() : "0",
      grandDays6_10 > 0 ? grandDays6_10.toString() : "0",
      grandDays10Plus > 0 ? grandDays10Plus.toString() : "0",
      grandScAvg.toString(),
      grandCcAvg.toString(),
      grandSolveAvg.toString()
    ]);

    downloadCSV(headers, rows, `CX_Station_Performance_Report_${new Date().toISOString().split('T')[0]}.csv`);
  };

  // Executive 4-Page Graphical PDF Export for Service Station SLA & Scorecard
  const handleDownloadStationGraphicalPDF = async () => {
    setIsGeneratingStationPDF(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const doc = generateSlaDashboardPdf(filteredComplaints, {
        stationFilter: selectedStationCode,
        reportDate: today,
      });

      doc.save(`Executive_SLA_Performance_Report_${selectedStationCode}_${today}.pdf`);
    } catch (err) {
      console.error("Failed to export executive SLA PDF:", err);
      alert("Error generating PDF. Please try again.");
    } finally {
      setIsGeneratingStationPDF(false);
    }
  };

  // Shared download handler using Blob for robust client-side downloads
  const downloadCSV = (headers: string[], rows: string[][], filename: string) => {
    const csvString = [
      headers.join(","),
      ...rows.map(row => row.map(val => {
        const cleanVal = String(val || '').replace(/"/g, '""');
        return `"${cleanVal}"`;
      }).join(","))
    ].join("\n");

    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Satisfaction Level Breakdown
  const satisfactionLevels: SatisfactionLevel[] = ["Very Dissatisfied", "Dissatisfied", "Neutral", "Satisfied", "Very Satisfied"];
  const satisfactionCounts = satisfactionLevels.reduce((acc, level) => {
    acc[level] = filteredComplaints.filter(c => c.currentSatisfaction === level).length;
    return acc;
  }, {} as Record<SatisfactionLevel, number>);

  // Feedback Status Breakdown (Call Center Response - Evaluated on Service Station Contacted / Actioned cases)
  const feedbackStatusLevels = [
    "Satisfied After Resolution",
    "Still Dissatisfied",
    "No Solution Received",
    "Customer Unreachable",
    "Rejected Again to Service Station"
  ];

  const scContactedActiveScopeComplaints = activeScopeComplaints.filter(c => isStationContacted(c) || isComplaintRejected(c));
  const scContactedActiveScopeCount = scContactedActiveScopeComplaints.length;

  const feedbackStatusCounts = feedbackStatusLevels.reduce((acc, level) => {
    acc[level] = scContactedActiveScopeComplaints.filter(c => {
      const status = c.feedbackStatus;
      if (level === "Satisfied After Resolution") {
        return (
          status === "Satisfied After Resolution" ||
          status === "Satisfied" ||
          c.callCenterFinalSatisfaction === "Satisfied" ||
          c.callCenterFinalSatisfaction === "Very Satisfied" ||
          c.currentSatisfaction === "Satisfied" ||
          c.currentSatisfaction === "Very Satisfied"
        );
      }
      if (level === "Still Dissatisfied") {
        return (
          status === "Still Dissatisfied" ||
          status === "Not Satisfied" ||
          c.callCenterFinalSatisfaction === "Dissatisfied" ||
          c.callCenterFinalSatisfaction === "Very Dissatisfied" ||
          c.currentSatisfaction === "Dissatisfied" ||
          c.currentSatisfaction === "Very Dissatisfied"
        );
      }
      if (level === "No Solution Received") {
        return (
          status === "No Solution Received" ||
          status === "No solution Received"
        );
      }
      if (level === "Customer Unreachable") {
        return (
          status === "Customer Unreachable" ||
          status === "Unreachable"
        );
      }
      if (level === "Rejected Again to Service Station") {
        return (
          isComplaintRejected(c) ||
          status === "Rejected Again to Service Station" ||
          status === "Returned to Service Station" ||
          status === "Rejected" ||
          c.stationResponseStatus === "Rejected" ||
          c.stationResponseStatus === "Rejected by Call Center" ||
          c.stationResponseStatus === "Returned to Service Station" ||
          c.stationResponseStatus === "Returned to Call Center" ||
          c.finalStatus?.includes("Rejected") ||
          c.finalStatus?.includes("Returned") ||
          c.finalStatus?.includes("Re-assigned")
        );
      }
      return status === level;
    }).length;
    return acc;
  }, {} as Record<string, number>);

  // Status Breakdown
  const statusLevels = ["Pending", "In Progress", "Contacted", "Contacted — Still Dissatisfied", "Resolved"];
  const statusCounts = statusLevels.reduce((acc, level) => {
    acc[level] = activeScopeComplaints.filter(c => c.status === level).length;
    return acc;
  }, {} as Record<string, number>);

  // Graphical PDF generator - High fidelity native vector layout
  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true);
    try {
      const pdf = new jsPDF("p", "mm", "a4");
      
      const primaryBlue = [30, 64, 175];
      const darkSlate = [51, 65, 85];
      const borderSlate = [226, 232, 240];
      const textSlate = [71, 85, 105];

      // Draw Header for Page
      const drawPageHeader = (pageNum: number, totalPages: number) => {
        pdf.setFillColor(30, 64, 175); // Royal Blue
        pdf.rect(0, 0, 210, 24, "F");
        
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(13);
        pdf.setTextColor(255, 255, 255);
        pdf.text("IDEAL CUSTOMER EXPERIENCE RECOVERY REPORT", 12, 10);
        
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(191, 219, 254);
        pdf.text("SLA Metrics, Station Performance & Response Scorecards", 12, 16);
        
        pdf.setFontSize(8);
        pdf.setTextColor(255, 255, 255);
        pdf.text(`Page ${pageNum} of ${totalPages}`, 198, 13, { align: "right" });
      };

      const drawPageFooter = () => {
        pdf.setDrawColor(226, 232, 240);
        pdf.setLineWidth(0.3);
        pdf.line(12, 282, 198, 282);
        
        pdf.setFont("helvetica", "italic");
        pdf.setFontSize(7);
        pdf.setTextColor(148, 163, 184);
        pdf.text("Ideal Group Customer Experience Recovery Engine • Confidential Report", 12, 287);
        pdf.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 198, 287, { align: "right" });
      };

      const totalPages = 3;

      // ==========================================
      // PAGE 1: Executive KPI Summary & Visual Charts
      // ==========================================
      drawPageHeader(1, totalPages);

      // Section Title
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(51, 65, 85);
      pdf.text("EXECUTIVE PERFORMANCE SCORECARD", 12, 33);

      // Metadata card
      pdf.setFillColor(248, 250, 252); // light slate bg
      pdf.setDrawColor(226, 232, 240);
      pdf.rect(12, 37, 186, 24, "FD");

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      pdf.text("ACTIVE FILTER METADATA (CUSTOM PDF REPORT)", 16, 42);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(51, 65, 85);
      pdf.text(`Station: ${stationFilter === "all" ? "All Stations" : stationFilter}`, 16, 47);
      pdf.text(`Category: ${categoryFilter === "all" ? "All Categories" : categoryFilter}`, 16, 52);
      pdf.text(`Status: ${statusFilter === "all" ? "All Statuses" : statusFilter}`, 16, 57);

      pdf.text(`Feedback: ${feedbackStatusFilter === "all" ? "All Feedback" : feedbackStatusFilter}`, 85, 47);
      pdf.text(`Date Range: ${startDate || "Start"} to ${endDate || "Today"}`, 85, 52);
      pdf.text(`Search Keyword: ${searchQuery || "None"}`, 85, 57);

      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(30, 64, 175);
      pdf.text(`Total Records: ${totalInScope} Filtered Complaints`, 145, 47);

      // 4 KPI Cards at Y=64
      const cardW = 44;
      const cardH = 22;
      const cardY = 64;
      const gap = 3;

      // Card 1: New (0-3 Days)
      pdf.setFillColor(236, 253, 245);
      pdf.setDrawColor(167, 243, 208);
      pdf.rect(12, cardY, cardW, cardH, "FD");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.5);
      pdf.setTextColor(6, 95, 70);
      pdf.text("New (0-3 Days)", 15, cardY + 5);
      pdf.setFontSize(14);
      const greenPct = totalFrozenInScope > 0 ? Math.round((greenCount / totalFrozenInScope) * 100) : 0;
      pdf.text(`${greenCount}`, 15, cardY + 13);
      pdf.setFontSize(7);
      pdf.setFont("helvetica", "normal");
      pdf.text(`${greenPct}% of frozen`, 15, cardY + 18);

      // Card 2: Pending (3-5 Days)
      pdf.setFillColor(254, 243, 199);
      pdf.setDrawColor(253, 230, 138);
      pdf.rect(12 + cardW + gap, cardY, cardW, cardH, "FD");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.5);
      pdf.setTextColor(146, 64, 14);
      pdf.text("Pending (3-5 Days)", 12 + cardW + gap + 3, cardY + 5);
      pdf.setFontSize(14);
      const yellowPct = totalFrozenInScope > 0 ? Math.round((yellowCount / totalFrozenInScope) * 100) : 0;
      pdf.text(`${yellowCount}`, 12 + cardW + gap + 3, cardY + 13);
      pdf.setFontSize(7);
      pdf.setFont("helvetica", "normal");
      pdf.text(`${yellowPct}% of frozen`, 12 + cardW + gap + 3, cardY + 18);

      // Card 3: Escalated (6-10 Days)
      pdf.setFillColor(255, 247, 237);
      pdf.setDrawColor(254, 215, 170);
      pdf.rect(12 + (cardW + gap) * 2, cardY, cardW, cardH, "FD");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.5);
      pdf.setTextColor(194, 65, 12);
      pdf.text("Escalated (6-10 Days)", 12 + (cardW + gap) * 2 + 3, cardY + 5);
      pdf.setFontSize(14);
      const orangePct = totalFrozenInScope > 0 ? Math.round((orangeCount / totalFrozenInScope) * 100) : 0;
      pdf.text(`${orangeCount}`, 12 + (cardW + gap) * 2 + 3, cardY + 13);
      pdf.setFontSize(7);
      pdf.setFont("helvetica", "normal");
      pdf.text(`${orangePct}% of frozen`, 12 + (cardW + gap) * 2 + 3, cardY + 18);

      // Card 4: Critical (>10 Days)
      pdf.setFillColor(254, 242, 242);
      pdf.setDrawColor(254, 202, 202);
      pdf.rect(12 + (cardW + gap) * 3, cardY, cardW, cardH, "FD");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.5);
      pdf.setTextColor(153, 27, 27);
      pdf.text("Critical (>10 Days)", 12 + (cardW + gap) * 3 + 3, cardY + 5);
      pdf.setFontSize(14);
      const redPct = totalFrozenInScope > 0 ? Math.round((redCount / totalFrozenInScope) * 100) : 0;
      pdf.text(`${redCount}`, 12 + (cardW + gap) * 3 + 3, cardY + 13);
      pdf.setFontSize(7);
      pdf.setFont("helvetica", "normal");
      pdf.text(`${redPct}% of frozen`, 12 + (cardW + gap) * 3 + 3, cardY + 18);

      // Visual Graphical progress charts Section at Y=92
      const chartY = 92;
      const chartW = 58;
      const chartH = 75;

      // CHART A: SLA Proportions (x=12)
      pdf.setFillColor(255, 255, 255);
      pdf.setDrawColor(226, 232, 240);
      pdf.rect(12, chartY, chartW, chartH, "FD");
      
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(30, 41, 59);
      pdf.text("AGING SLA METRICS", 16, chartY + 6);
      pdf.line(16, chartY + 9, 12 + chartW - 4, chartY + 9);

      // Green bar (New)
      pdf.setFontSize(7);
      pdf.setTextColor(71, 85, 105);
      pdf.text(`New (0-3 Days): ${greenCount} (${greenPct}%)`, 16, chartY + 14);
      pdf.setFillColor(241, 245, 249);
      pdf.rect(16, chartY + 16, 50, 3, "F");
      if (greenPct > 0) {
        pdf.setFillColor(16, 185, 129); // emerald-500
        pdf.rect(16, chartY + 16, (greenPct / 100) * 50, 3, "F");
      }

      // Yellow bar (Pending)
      pdf.setTextColor(71, 85, 105);
      pdf.text(`Pending (3-5 Days): ${yellowCount} (${yellowPct}%)`, 16, chartY + 24);
      pdf.setFillColor(241, 245, 249);
      pdf.rect(16, chartY + 26, 50, 3, "F");
      if (yellowPct > 0) {
        pdf.setFillColor(245, 158, 11); // amber-500
        pdf.rect(16, chartY + 26, (yellowPct / 100) * 50, 3, "F");
      }

      // Orange bar (Escalated)
      pdf.setTextColor(71, 85, 105);
      pdf.text(`Escalated (6-10 Days): ${orangeCount} (${orangePct}%)`, 16, chartY + 34);
      pdf.setFillColor(241, 245, 249);
      pdf.rect(16, chartY + 36, 50, 3, "F");
      if (orangePct > 0) {
        pdf.setFillColor(249, 115, 22); // orange-500
        pdf.rect(16, chartY + 36, (orangePct / 100) * 50, 3, "F");
      }

      // Red bar (Critical)
      pdf.setTextColor(71, 85, 105);
      pdf.text(`Critical (>10 Days): ${redCount} (${redPct}%)`, 16, chartY + 44);
      pdf.setFillColor(241, 245, 249);
      pdf.rect(16, chartY + 46, 50, 3, "F");
      if (redPct > 0) {
        pdf.setFillColor(239, 68, 68); // red-500
        pdf.rect(16, chartY + 46, (redPct / 100) * 50, 3, "F");
      }

      // Small legend explanation
      pdf.setFontSize(7);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(148, 163, 184);
      pdf.text("Represents actual day differences", 16, chartY + 58);
      pdf.text("between data entry and resolution.", 16, chartY + 62);


      // CHART B: Call Center Feedback Breakdown (x=12+64=76) - SC Contacted Cases Only
      pdf.setFillColor(255, 255, 255);
      pdf.setDrawColor(226, 232, 240);
      pdf.rect(12 + chartW + 6, chartY, chartW, chartH, "FD");

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.5);
      pdf.setTextColor(30, 41, 59);
      pdf.text("FEEDBACK STATUS", 12 + chartW + 10, chartY + 6);
      pdf.setFontSize(5.8);
      pdf.setTextColor(79, 70, 229);
      pdf.text(`(SC Contacted: ${scContactedActiveScopeCount})`, 12 + chartW + 38, chartY + 6);
      pdf.setDrawColor(226, 232, 240);
      pdf.line(12 + chartW + 10, chartY + 9, 12 + chartW * 2 + 2, chartY + 9);

      pdf.setFontSize(6.2);
      feedbackStatusLevels.forEach((lvl, idx) => {
        const count = feedbackStatusCounts[lvl] || 0;
        const pct = scContactedActiveScopeCount > 0 ? Math.round((count / scContactedActiveScopeCount) * 100) : 0;
        const curY = chartY + 16 + idx * 11;
        
        pdf.setTextColor(71, 85, 105);
        const displayLabel = lvl.length > 25 ? lvl.substring(0, 22) + "..." : lvl;
        pdf.text(`${displayLabel}: ${count} (${pct}%)`, 12 + chartW + 10, curY);
        
        pdf.setFillColor(241, 245, 249);
        pdf.rect(12 + chartW + 10, curY + 2, 50, 3, "F");
        
        if (pct > 0) {
          let col = [59, 130, 246]; // blue-500
          if (lvl === "Satisfied After Resolution") col = [16, 185, 129]; // emerald-500
          else if (lvl === "Still Dissatisfied") col = [239, 68, 68]; // rose-500
          else if (lvl === "No Solution Received") col = [245, 158, 11]; // amber-500
          else if (lvl === "Customer Unreachable") col = [168, 85, 247]; // purple-500
          else if (lvl === "Rejected Again to Service Station") col = [234, 88, 12]; // orange-600
          
          pdf.setFillColor(col[0], col[1], col[2]);
          pdf.rect(12 + chartW + 10, curY + 2, (pct / 100) * 50, 3, "F");
        }
      });


      // CHART C: Resolution Velocity (x=12+128=140)
      pdf.setFillColor(255, 255, 255);
      pdf.setDrawColor(226, 232, 240);
      pdf.rect(12 + chartW * 2 + 12, chartY, chartW, chartH, "FD");

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(30, 41, 59);
      pdf.text("CURRENT STATUS", 12 + chartW * 2 + 16, chartY + 6);
      pdf.line(12 + chartW * 2 + 16, chartY + 9, 12 + chartW * 3 + 8, chartY + 9);

      pdf.setFontSize(7);
      const statusLevels = ["Pending", "In Progress", "Contacted", "Resolved"];
      statusLevels.forEach((status, idx) => {
        const count = statusCounts[status] || 0;
        const pct = totalInScope > 0 ? Math.round((count / totalInScope) * 100) : 0;
        const curY = chartY + 16 + idx * 13;

        pdf.setTextColor(71, 85, 105);
        pdf.text(`${status}: ${count} (${pct}%)`, 12 + chartW * 2 + 16, curY);

        pdf.setFillColor(241, 245, 249);
        pdf.rect(12 + chartW * 2 + 16, curY + 2, 50, 3.5, "F");

        if (pct > 0) {
          let col = [100, 116, 139];
          if (status === "Resolved") col = [16, 185, 129];
          else if (status === "Contacted") col = [14, 165, 233];
          else if (status === "In Progress") col = [245, 158, 11];
          else if (status === "Pending") col = [239, 68, 68];

          pdf.setFillColor(col[0], col[1], col[2]);
          pdf.rect(12 + chartW * 2 + 16, curY + 2, (pct / 100) * 50, 3.5, "F");
        }
      });


      // Summary Insights and Recovery Rate at Y=175
      const insightsY = 173;
      pdf.setFillColor(248, 250, 252);
      pdf.setDrawColor(226, 232, 240);
      pdf.rect(12, insightsY, 186, 100, "FD");

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(30, 41, 59);
      pdf.text("EXECUTIVE KEY INSIGHTS & SLA EVALUATIONS", 18, insightsY + 7);
      pdf.line(18, insightsY + 10, 192, insightsY + 10);

      const resolvedCount = statusCounts["Resolved"] || 0;
      const recoveryRate = totalInScope > 0 ? Math.round((resolvedCount / totalInScope) * 100) : 0;

      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(51, 65, 85);

      const bullets = [
        `• Total customer complaints identified and filtered within this reporting period: ${totalInScope}.`,
        `• Overall Recovery Rate is ${recoveryRate}% (${resolvedCount} cases fully resolved out of ${totalInScope}).`,
        `• Critical Overdue SLA alerts (> 10 days) are currently at ${redCount} unresolved cases.`,
        `• Customer satisfaction surveys indicate that ${satisfactionCounts["Very Satisfied"] + satisfactionCounts["Satisfied"]} customers are Satisfied/Very Satisfied,`,
        `  while ${satisfactionCounts["Very Dissatisfied"] + satisfactionCounts["Dissatisfied"]} customers remain Dissatisfied with the service station response.`,
        `• Average turnaround response speed: New Status (0-3 days) is achieved in ${greenPct}% of incoming logs.`,
        `• Station-level breakdowns and individual compliance tickets are outlined in detail on pages 2 and 3.`
      ];

      bullets.forEach((bullet, bidx) => {
        pdf.text(bullet, 18, insightsY + 18 + bidx * 9);
      });

      // Highlight Box on the right of insights
      pdf.setFillColor(30, 64, 175);
      pdf.rect(156, insightsY + 54, 36, 38, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.text(`${recoveryRate}%`, 174, insightsY + 72, { align: "center" });
      pdf.setFontSize(8);
      pdf.text("RECOVERY RATE", 174, insightsY + 82, { align: "center" });

      drawPageFooter();

      // ==========================================
      // PAGE 2: Service Station Performance Matrix
      // ==========================================
      pdf.addPage();
      drawPageHeader(2, totalPages);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(51, 65, 85);
      pdf.text("SERVICE STATION PERFORMANCE SCORECARD", 12, 33);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      pdf.setTextColor(71, 85, 105);
      pdf.text("This table outlines active complaint volume, recovery rates, and average resolution times for each Service Station.", 12, 38);

      // Station Performance Table
      let tableY = 44;
      
      // Draw Table Header Background
      pdf.setFillColor(51, 65, 85); // dark slate
      pdf.rect(12, tableY, 186, 8, "F");

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7);
      pdf.setTextColor(255, 255, 255);
      pdf.text("CODE", 14, tableY + 5);
      pdf.text("LOCATION NAME", 34, tableY + 5);
      pdf.text("TOTAL", 80, tableY + 5, { align: "center" });
      pdf.text("RESOLVED", 95, tableY + 5, { align: "center" });
      pdf.text("PENDING", 112, tableY + 5, { align: "center" });
      pdf.text("ESCALATED", 130, tableY + 5, { align: "center" });
      pdf.text("0-3d / 3-5d / 6-10d / >10d", 158, tableY + 5, { align: "center" });
      pdf.text("RES RATE", 182, tableY + 5, { align: "center" });
      pdf.text("AVG SLA", 195, tableY + 5, { align: "center" });

      tableY += 8;

      stationMetrics.forEach((sm, idx) => {
        // Alternating row color
        if (idx % 2 === 0) {
          pdf.setFillColor(248, 250, 252);
        } else {
          pdf.setFillColor(255, 255, 255);
        }
        pdf.rect(12, tableY, 186, 11, "F");
        
        pdf.setDrawColor(241, 245, 249);
        pdf.line(12, tableY + 11, 198, tableY + 11);

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7.5);
        pdf.setTextColor(15, 23, 42);
        pdf.text(sm.code, 14, tableY + 7);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7);
        pdf.setTextColor(71, 85, 105);
        const nameShort = sm.name.length > 22 ? sm.name.substring(0, 22) + "..." : sm.name;
        pdf.text(nameShort, 34, tableY + 7);

        pdf.setFont("helvetica", "bold");
        pdf.text(`${sm.total}`, 80, tableY + 7, { align: "center" });

        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(16, 185, 129);
        pdf.text(`${sm.resolved}`, 95, tableY + 7, { align: "center" });

        pdf.setTextColor(245, 158, 11);
        pdf.text(`${sm.pending}`, 112, tableY + 7, { align: "center" });

        pdf.setTextColor(239, 68, 68);
        pdf.text(`${sm.escalated}`, 130, tableY + 7, { align: "center" });

        pdf.setTextColor(71, 85, 105);
        pdf.setFontSize(6.5);
        pdf.text(`${sm.days0_3} / ${sm.days3_5} / ${sm.days6_10} / ${sm.days10Plus}`, 158, tableY + 7, { align: "center" });

        pdf.setFontSize(7.5);
        // Highlight Recovery Rate
        if (sm.rate >= 80) {
          pdf.setTextColor(5, 150, 105); // green
          pdf.setFont("helvetica", "bold");
        } else if (sm.rate < 50) {
          pdf.setTextColor(220, 38, 38); // red
          pdf.setFont("helvetica", "bold");
        } else {
          pdf.setTextColor(30, 41, 59); // dark text
        }
        pdf.text(`${sm.resolutionRate}`, 182, tableY + 7, { align: "center" });

        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(71, 85, 105);
        pdf.text(`${sm.avgDaysStationContact}d`, 195, tableY + 7, { align: "center" });

        tableY += 11;
      });

      drawPageFooter();

      // ==========================================
      // PAGE 3: Detailed Case Recovery Logs
      // ==========================================
      pdf.addPage();
      drawPageHeader(3, totalPages);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(51, 65, 85);
      pdf.text("DETAILED CASE RECOVERY ACTION LOGS", 12, 33);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      pdf.setTextColor(71, 85, 105);
      pdf.text("Below lists individual recovery tickets matching selected criteria, sorted by aging severity.", 12, 38);

      // Detailed Logs Table
      let logTableY = 44;
      pdf.setFillColor(30, 64, 175); // Royal Blue
      pdf.rect(12, logTableY, 186, 8, "F");

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.5);
      pdf.setTextColor(255, 255, 255);
      pdf.text("CASE ID", 15, logTableY + 5.5);
      pdf.text("CUSTOMER NAME", 38, logTableY + 5.5);
      pdf.text("SERVICE STATION", 80, logTableY + 5.5);
      pdf.text("SLA FEEDBACK STATUS", 112, logTableY + 5.5);
      pdf.text("AGING", 163, logTableY + 5.5, { align: "center" });
      pdf.text("STATUS", 186, logTableY + 5.5, { align: "center" });

      logTableY += 8;

      // Slice to list the top 20 complaints on Page 3 to fit perfectly on the page
      const sliceOfComplaints = filteredComplaints.slice(0, 19);

      sliceOfComplaints.forEach((c, idx) => {
        if (idx % 2 === 0) {
          pdf.setFillColor(248, 250, 252);
        } else {
          pdf.setFillColor(255, 255, 255);
        }
        pdf.rect(12, logTableY, 186, 11, "F");

        pdf.setDrawColor(241, 245, 249);
        pdf.line(12, logTableY + 11, 198, logTableY + 11);

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7.5);
        pdf.setTextColor(100, 116, 139);
        pdf.text(c.id, 15, logTableY + 7);

        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(15, 23, 42);
        // Truncate customer name if long
        const name = c.customerName.length > 20 ? c.customerName.substring(0, 20) + "..." : c.customerName;
        pdf.text(name, 38, logTableY + 7);

        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(71, 85, 105);
        pdf.text(c.station, 80, logTableY + 7);

        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(30, 64, 175);
        pdf.text(c.feedbackStatus || "Follow-up Required", 112, logTableY + 7);

        // Aging
        const agingInfo = getComplaintAging(c);
        if (agingInfo.days > 10) {
          pdf.setTextColor(220, 38, 38); // Critical (Red)
          pdf.setFont("helvetica", "bold");
        } else if (agingInfo.days > 5) {
          pdf.setTextColor(234, 88, 12); // Escalated (Orange)
          pdf.setFont("helvetica", "bold");
        } else if (agingInfo.days > 3) {
          pdf.setTextColor(217, 119, 6); // Pending (Amber)
          pdf.setFont("helvetica", "bold");
        } else {
          pdf.setTextColor(5, 150, 105); // New (Green)
          pdf.setFont("helvetica", "bold");
        }
        pdf.text(`${agingInfo.days} Days`, 163, logTableY + 7, { align: "center" });

        // Operational Status color
        if (c.status === "Resolved") {
          pdf.setFillColor(209, 250, 229); // green bg
          pdf.rect(176, logTableY + 2.5, 20, 6, "F");
          pdf.setTextColor(6, 95, 70);
        } else if (c.status === "In Progress") {
          pdf.setFillColor(254, 243, 199); // orange bg
          pdf.rect(176, logTableY + 2.5, 20, 6, "F");
          pdf.setTextColor(146, 64, 14);
        } else {
          pdf.setFillColor(254, 242, 242); // red bg
          pdf.rect(176, logTableY + 2.5, 20, 6, "F");
          pdf.setTextColor(153, 27, 27);
        }
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(6.5);
        pdf.text(c.status, 186, logTableY + 6.5, { align: "center" });

        logTableY += 11;
      });

      if (filteredComplaints.length > 19) {
        pdf.setFont("helvetica", "italic");
        pdf.setFontSize(7.5);
        pdf.setTextColor(148, 163, 184);
        pdf.text(`... and ${filteredComplaints.length - 19} more records matching filters (Download detailed CSV logs for all active records)`, 12, logTableY + 6);
      }

      drawPageFooter();

      // Save PDF
      pdf.save(`Ideal_CX_Graphical_Performance_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error("Error generating Native PDF:", error);
      alert("There was an issue generating your PDF. Please try again.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div className={`space-y-6 animate-fade-in transition-colors duration-500 ${isDark ? "text-slate-100" : "text-slate-800"}`}>
      
      {/* Upper Control Bar (Actions and Title) */}
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl border transition-all duration-500 ${cardBg}`}>
        <div>
          <h2 className={`text-base font-black uppercase tracking-wider flex items-center gap-2 ${textTitle}`}>
            <BarChart3 className="h-5 w-5 text-blue-600" />
            Ideal Customer Experience Analytics
          </h2>
          <p className={`text-xs font-bold mt-1 ${textSub}`}>
            Generate graphical performance scorecards, SLA metrics, and high-resolution PDF summaries.
          </p>
        </div>

        {/* Global Download Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={isGeneratingPDF}
            className="bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white font-extrabold text-[11px] py-2 px-4 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-sm hover:shadow-md uppercase tracking-wider"
          >
            {isGeneratingPDF ? (
              <>
                <span className="animate-spin inline-block h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                Generating PDF...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                Download Graphical PDF
              </>
            )}
          </button>
        </div>
      </div>

      {/* SLA & ANALYTICS REPORT CARD SECTION */}
      {onOpenSLAReportModal && (
        <div className={`p-5 rounded-2xl border shadow-xs transition-all duration-300 ${
          isDark 
            ? "bg-slate-900/90 border-slate-800 text-slate-100" 
            : "bg-slate-50/90 border-slate-200 text-slate-900"
        }`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5 max-w-3xl">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-xl shadow-xs ${isDark ? "bg-blue-600 text-white" : "bg-blue-600 text-white"}`}>
                  <ShieldAlert className="h-5 w-5 text-amber-300" />
                </div>
                <h3 className={`text-sm font-black uppercase tracking-wider ${isDark ? "text-white" : "text-slate-900"}`}>
                  Service Station & Call Center SLA Analytics Dashboard
                </h3>
                <span className="bg-blue-600 text-white font-black text-[9px] uppercase px-2 py-0.5 rounded-full">
                  Interactive Report
                </span>
              </div>
              <p className={`text-xs font-medium leading-relaxed ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                Generate dual-perspective analytics: <strong className={isDark ? "text-blue-400" : "text-blue-700"}>Service Station View</strong> (stations, workflow statuses, feedback statuses, and monthly dates) and <strong className={isDark ? "text-blue-400" : "text-blue-700"}>Call Center View</strong> (agents/officers, date SLAs, 24h targets, aging, and current statuses: Pending, Contacted, In Progress / Rejected, Resolved).
              </p>
            </div>

            <button
              id="btn-reports-sla-analytics-modal"
              type="button"
              onClick={onOpenSLAReportModal}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 border border-blue-500/30"
            >
              <ShieldAlert className="h-4 w-4 text-amber-300" />
              <span>SLA & Analytics Reports</span>
            </button>
          </div>
        </div>
      )}

      {/* Advanced Filter Control Panel (Interactive, hidden in PDF printout) */}
      <div className={`pdf-hide p-5 rounded-2xl border shadow-xs space-y-4 transition-all duration-500 ${
        isDark ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200"
      }`}>
        <div className={`flex items-center justify-between border-b pb-2.5 ${isDark ? "border-slate-800" : "border-slate-200"}`}>
          <h3 className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${textTitle}`}>
            <Filter className="h-4 w-4 text-blue-600" />
            Filter Database Engine
          </h3>
          {(stationFilter !== "all" || categoryFilter !== "all" || statusFilter !== "all" || feedbackStatusFilter !== "all" || satisfactionFilter !== "all" || startDate || endDate || searchQuery) && (
            <button
              onClick={handleResetFilters}
              className="text-slate-500 hover:text-blue-500 text-xs font-black flex items-center gap-1 cursor-pointer transition-all uppercase tracking-wider"
            >
              <RotateCcw className="h-3 w-3" />
              Reset All Filters
            </button>
          )}
        </div>

        {/* Row 1: Search and Main Categories */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="h-3.5 w-3.5 text-slate-400" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search customer, vehicle, WO..."
              className={`w-full rounded-lg py-1.5 pl-9 pr-3 text-xs focus:outline-none transition-all font-bold ${
                isDark 
                  ? "bg-slate-950 text-slate-100 border border-slate-800 focus:border-red-500 placeholder-slate-700" 
                  : "bg-white text-slate-700 border border-slate-200 focus:border-blue-500 placeholder-slate-400"
              }`}
            />
          </div>

          <div className={`flex items-center gap-1.5 border rounded-lg px-2.5 py-1.5 ${
            isDark ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200"
          }`}>
            <MapPin className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={stationFilter}
              onChange={(e) => setStationFilter(e.target.value)}
              className={`w-full bg-transparent text-xs font-bold focus:outline-none cursor-pointer ${
                isDark ? "text-slate-100" : "text-slate-700"
              }`}
            >
              <option value="all" className={isDark ? "bg-slate-950 text-slate-100" : "bg-white text-slate-700"}>All Service Stations</option>
              {STATIONS.map(st => (
                <option key={st.code} value={st.code} className={isDark ? "bg-slate-950 text-slate-100" : "bg-white text-slate-700"}>{st.name}</option>
              ))}
            </select>
          </div>

          <div className={`flex items-center gap-1.5 border rounded-lg px-2.5 py-1.5 ${
            isDark ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200"
          }`}>
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className={`w-full bg-transparent text-xs font-bold focus:outline-none cursor-pointer ${
                isDark ? "text-slate-100" : "text-slate-700"
              }`}
            >
              <option value="all" className={isDark ? "bg-slate-950 text-slate-100" : "bg-white text-slate-700"}>All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat} className={isDark ? "bg-slate-950 text-slate-100" : "bg-white text-slate-700"}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Statuses and Satisfaction */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className={`flex items-center gap-1.5 border rounded-lg px-2.5 py-1.5 ${
            isDark ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200"
          }`}>
            <Activity className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`w-full bg-transparent text-xs font-bold focus:outline-none cursor-pointer ${
                isDark ? "text-slate-100" : "text-slate-700"
              }`}
            >
              <option value="all" className={isDark ? "bg-slate-950 text-slate-100" : "bg-white text-slate-700"}>All Operational Statuses</option>
              <option value="Pending" className={isDark ? "bg-slate-950 text-slate-100" : "bg-white text-slate-700"}>Pending</option>
              <option value="In Progress" className={isDark ? "bg-slate-950 text-slate-100" : "bg-white text-slate-700"}>In Progress</option>
              <option value="Contacted" className={isDark ? "bg-slate-950 text-slate-100" : "bg-white text-slate-700"}>Contacted</option>
              <option value="Contacted — Still Dissatisfied" className={isDark ? "bg-slate-950 text-slate-100" : "bg-white text-slate-700"}>Contacted — Still Dissatisfied</option>
              <option value="Resolved" className={isDark ? "bg-slate-950 text-slate-100" : "bg-white text-slate-700"}>Resolved</option>
            </select>
          </div>

          <div className={`flex items-center gap-1.5 border rounded-lg px-2.5 py-1.5 ${
            isDark ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200"
          }`}>
            <TrendingUp className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={feedbackStatusFilter}
              onChange={(e) => setFeedbackStatusFilter(e.target.value)}
              className={`w-full bg-transparent text-xs font-bold focus:outline-none cursor-pointer ${
                isDark ? "text-slate-100" : "text-slate-700"
              }`}
            >
              <option value="all" className={isDark ? "bg-slate-950 text-slate-100" : "bg-white text-slate-700"}>All SLA Feedback Statuses</option>
              {feedbackStatuses.map(status => (
                <option key={status} value={status} className={isDark ? "bg-slate-950 text-slate-100" : "bg-white text-slate-700"}>{status}</option>
              ))}
            </select>
          </div>

          <div className={`flex items-center gap-1.5 border rounded-lg px-2.5 py-1.5 ${
            isDark ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200"
          }`}>
            <CheckCircle className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={satisfactionFilter}
              onChange={(e) => setSatisfactionFilter(e.target.value)}
              className={`w-full bg-transparent text-xs font-bold focus:outline-none cursor-pointer ${
                isDark ? "text-slate-100" : "text-slate-700"
              }`}
            >
              <option value="all" className={isDark ? "bg-slate-950 text-slate-100" : "bg-white text-slate-700"}>All Satisfaction Levels</option>
              <option value="Very Dissatisfied" className={isDark ? "bg-slate-950 text-slate-100" : "bg-white text-slate-700"}>Very Dissatisfied</option>
              <option value="Dissatisfied" className={isDark ? "bg-slate-950 text-slate-100" : "bg-white text-slate-700"}>Dissatisfied</option>
              <option value="Neutral" className={isDark ? "bg-slate-950 text-slate-100" : "bg-white text-slate-700"}>Neutral</option>
              <option value="Satisfied" className={isDark ? "bg-slate-950 text-slate-100" : "bg-white text-slate-700"}>Satisfied</option>
              <option value="Very Satisfied" className={isDark ? "bg-slate-950 text-slate-100" : "bg-white text-slate-700"}>Very Satisfied</option>
            </select>
          </div>
        </div>

        {/* Row 3: Dates */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className={`flex items-center gap-2 border rounded-lg px-2.5 py-1.5 col-span-1 md:col-span-2 ${
            isDark ? "bg-slate-950 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-700"
          }`}>
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            <span className={`text-[10px] font-black uppercase ${isDark ? "text-slate-500" : "text-slate-400"}`}>Range:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={`bg-transparent text-xs font-bold focus:outline-none cursor-pointer w-full ${isDark ? "text-slate-100" : "text-slate-700"}`}
              placeholder="Start Date"
            />
            <span className="text-slate-400 font-bold">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={`bg-transparent text-xs font-bold focus:outline-none cursor-pointer w-full ${isDark ? "text-slate-100" : "text-slate-700"}`}
              placeholder="End Date"
            />
          </div>
          
          <div className={`flex items-center justify-end px-1 text-[11px] font-extrabold uppercase ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            Filtered Match: <span className="text-blue-600 ml-1 bg-blue-50 border border-blue-200 rounded-md px-1.5 py-0.5">{totalInScope} records</span>
          </div>
        </div>
      </div>

      {/* RENDER VIEW CAPTURED BY PDF (Dashboard with high contrast white bg for printing) */}
      <div id="reports-dashboard-view" className={`p-6 rounded-2xl border shadow-xs space-y-6 transition-all duration-500 ${
        isDark ? "bg-slate-950/60 border-slate-900" : "bg-slate-50 border-slate-200"
      }`}>
        
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
              <span className="font-bold text-amber-300 block mb-0.5">1. Service Station Contact SLA</span>
              <p className="text-slate-300 font-mono text-[10px]">Avg Days to Contact Customer (Service Station) = Station Contact Date - Registration Date</p>
              <p className="text-slate-400 text-[10px] mt-1 font-semibold">Target: ≤ 2 Working Days (Excludes Sunday)</p>
            </div>
            <div className="bg-slate-800/90 p-2.5 rounded-lg border border-slate-700">
              <span className="font-bold text-emerald-300 block mb-0.5">2. Call Center Contact SLA</span>
              <p className="text-slate-300 font-mono text-[10px]">Avg Days to Contact Customer (Call Center) = Call Center Contact Date - Registration Date</p>
              <p className="text-slate-400 text-[10px] mt-1 font-semibold">Target: ≤ 24 Hours (1 Day)</p>
            </div>
            <div className="bg-slate-800/90 p-2.5 rounded-lg border border-slate-700">
              <span className="font-bold text-rose-300 block mb-0.5">3. Case Resolution SLA</span>
              <p className="text-slate-300 font-mono text-[10px]">Average Days to Solve Case = Resolution / Solution Date - Registration Date</p>
              <p className="text-slate-400 text-[10px] mt-1 font-semibold">Note: Speed of total case solution</p>
            </div>
          </div>
        </div>
        
        {/* PDF Heading Block (Only rendered clearly when downloaded) */}
        <div className="hidden border-b-2 border-slate-200 pb-4 mb-4" style={{ display: 'none' }} id="pdf-report-header">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-black uppercase text-slate-900 tracking-wider">CX Performance Scorecard</h1>
              <p className="text-xs text-slate-500 font-bold">Generated via Ideal Customer Experience Recovery Engine</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-700 font-black">Date: {new Date().toLocaleDateString()}</p>
              <p className="text-[10px] text-slate-400 font-bold">Confidential Enterprise Report</p>
            </div>
          </div>
        </div>

        {/* Filter Badges Bar (Shows active criteria in PDF printout) */}
        <div className={`flex flex-wrap items-center gap-1.5 p-3 rounded-xl border transition-all duration-500 ${
          isDark ? "bg-slate-900/90 border-slate-800" : "bg-white border-slate-100"
        }`}>
          <span className="text-[10px] font-black uppercase text-slate-400 mr-1 flex items-center gap-1">
            <Filter className="h-3 w-3 text-slate-400" /> Filter Criteria:
          </span>
          <span className={`${
            isDark ? "bg-slate-950 text-slate-300 border-slate-800" : "bg-slate-100 text-slate-700 border-slate-200"
          } font-bold text-[10px] px-2 py-0.5 rounded border`}>
            Station: {stationFilter === "all" ? "All Stations" : stationFilter}
          </span>
          <span className={`${
            isDark ? "bg-slate-950 text-slate-300 border-slate-800" : "bg-slate-100 text-slate-700 border-slate-200"
          } font-bold text-[10px] px-2 py-0.5 rounded border`}>
            Category: {categoryFilter === "all" ? "All Categories" : categoryFilter}
          </span>
          <span className={`${
            isDark ? "bg-slate-950 text-slate-300 border-slate-800" : "bg-slate-100 text-slate-700 border-slate-200"
          } font-bold text-[10px] px-2 py-0.5 rounded border`}>
            Status: {statusFilter === "all" ? "All Statuses" : statusFilter}
          </span>
          {feedbackStatusFilter !== "all" && (
            <span className={`${
              isDark ? "bg-slate-950 text-slate-300 border-slate-800" : "bg-slate-100 text-slate-700 border-slate-200"
            } font-bold text-[10px] px-2 py-0.5 rounded border`}>
              SLA: {feedbackStatusFilter}
            </span>
          )}
          {satisfactionFilter !== "all" && (
            <span className={`${
              isDark ? "bg-slate-950 text-slate-300 border-slate-800" : "bg-slate-100 text-slate-700 border-slate-200"
            } font-bold text-[10px] px-2 py-0.5 rounded border`}>
              CSAT: {satisfactionFilter}
            </span>
          )}
          {(startDate || endDate) && (
            <span className={`${
              isDark ? "bg-blue-950/40 text-blue-300 border-blue-900/30" : "bg-blue-50 text-blue-700 border-blue-200"
            } font-bold text-[10px] px-2 py-0.5 rounded border`}>
              Period: {startDate || "Beg"} to {endDate || "End"}
            </span>
          )}
          {searchQuery && (
            <span className={`${
              isDark ? "bg-amber-950/40 text-amber-300 border-amber-900/30" : "bg-amber-50 text-amber-700 border-amber-200"
            } font-bold text-[10px] px-2 py-0.5 rounded border`}>
              Search: "{searchQuery}"
            </span>
          )}
          <span className={`ml-auto text-[10px] font-black uppercase rounded px-2 py-0.5 border ${
            isDark ? "text-blue-400 bg-blue-950/40 border-blue-900/30" : "text-blue-600 bg-blue-50 border-blue-200"
          }`}>
            {totalInScope} Matching Case{totalInScope === 1 ? "" : "s"}
          </span>
        </div>

        {/* INTERACTIVE SERVICE STATION PERFORMANCE SCORECARD */}
        <div id="station-scorecard-section" className="col-span-12 space-y-6">
          {/* Top Block: Service Station Table List (Full Page Width) */}
          <div className={`w-full rounded-2xl border p-5 shadow-xs flex flex-col justify-between transition-all duration-500 ${cardBg}`}>
            <div>
              <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 mb-4 ${isDark ? "border-slate-800" : "border-slate-200"}`}>
                <div>
                  <h3 className={`text-sm font-black uppercase tracking-wider flex items-center gap-2 ${textTitle}`}>
                    <MapPin className="h-4 w-4 text-blue-600" />
                    Service Station Performance Scorecard
                  </h3>
                  <p className={`text-xs font-bold mt-0.5 ${textSub}`}>
                    Click any Service Station row to dynamically update the graphical breakdown and SLA metrics below.
                  </p>
                </div>
                
                <div className="flex items-center gap-2 pdf-hide">
                  <button
                    id="btn-download-station-csv"
                    type="button"
                    onClick={handleDownloadStationReport}
                    className={`border font-bold text-xs py-1.5 px-3 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                      isDark 
                        ? "bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-200" 
                        : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700"
                    }`}
                  >
                    <Download className="h-3.5 w-3.5 text-slate-500" />
                    Download CSV
                  </button>

                  <button
                    id="btn-download-station-graphical-pdf"
                    type="button"
                    onClick={handleDownloadStationGraphicalPDF}
                    disabled={isGeneratingStationPDF}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-1.5 px-3.5 rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isGeneratingStationPDF ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Generating PDF...
                      </>
                    ) : (
                      <>
                        <FileText className="h-3.5 w-3.5 text-blue-100" />
                        Download Graphical PDF
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Dynamic Database Recalculation & Integrity Bar */}
              <div className={`mb-4 px-4 py-2.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs ${
                isDark ? "bg-blue-950/30 border-blue-900/40 text-blue-300" : "bg-blue-50/80 border-blue-200 text-blue-900"
              }`}>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-extrabold uppercase tracking-wider text-[11px]">
                    Dynamic DB Engine:
                  </span>
                  <span className="font-medium text-slate-600 dark:text-slate-300">
                    Live calculated from {grandTotal} raw records across {stationMetrics.length} station{stationMetrics.length === 1 ? "" : "s"}.
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className={`px-2 py-0.5 rounded-md font-bold border ${
                    isDark ? "bg-slate-900 border-slate-700 text-slate-300" : "bg-white border-slate-200 text-slate-700"
                  }`}>
                    Reconciliation: {grandTotal} Total = {grandResolved} Res + {grandPending} Pnd + {grandEscalated} Rej{grandUnclassified > 0 ? ` + ${grandUnclassified} Unclassified` : ""}
                  </span>

                  <span className={`px-2 py-0.5 rounded-md font-bold border ${
                    isDark ? "bg-slate-900 border-slate-700 text-slate-300" : "bg-white border-slate-200 text-slate-700"
                  }`}>
                    Aging: {grandPending} Pending = {grandDays0_3} (0-3d) + {grandDays3_5} (3-5d) + {grandDays6_10} (6-10d) + {grandDays10Plus} (&gt;10d)
                  </span>

                  {Number(grandUnclassified) > 0 && (
                    <button
                      type="button"
                      onClick={() => handleOpenDrilldown("All Service Stations", "ALL", "Unclassified / Other Complaints", grandUnclassifiedList, "purple")}
                      className="px-2 py-0.5 rounded-md font-black bg-purple-600 hover:bg-purple-700 text-white cursor-pointer transition-all flex items-center gap-1 shadow-2xs"
                    >
                      <AlertTriangle className="h-3 w-3" />
                      {grandUnclassified} Unclassified Record{Number(grandUnclassified) === 1 ? "" : "s"}
                    </button>
                  )}
                </div>
              </div>

              {/* Table Container - Fits full width */}
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead>
                    <tr className={`border-b text-[10px] font-black uppercase tracking-wider transition-colors duration-500 ${
                      isDark ? "border-slate-800 bg-slate-950/90 text-slate-400" : "border-slate-200 bg-slate-50/90 text-slate-600"
                    }`}>
                      <th className="py-3.5 px-3 font-black text-center w-24">Code</th>
                      <th className="py-3.5 px-4 font-black">Service Station Name</th>
                      <th className="py-3.5 px-3 text-center">
                        <div>Total Complaints</div>
                        <div className="text-[8.5px] font-bold text-slate-400 lowercase">(received)</div>
                      </th>
                      <th className="py-3.5 px-3 text-center text-emerald-600 dark:text-emerald-400">
                        <div>Resolved Complaints</div>
                        <div className="text-[8.5px] font-bold text-emerald-500/80 lowercase">(contacted &amp; satisfied by cc)</div>
                      </th>
                      <th className={`py-3.5 px-3 text-center text-amber-600 dark:text-amber-400 ${isDark ? "bg-amber-950/20" : "bg-amber-50/50"}`}>
                        <div>Pending / In-Progress</div>
                        <div className="text-[8.5px] font-bold text-amber-600/80 dark:text-amber-400/80 lowercase">(not contacted by service station)</div>
                      </th>
                      <th className={`py-3.5 px-3 text-center text-rose-700 bg-rose-50/90 dark:bg-rose-950/40 dark:text-rose-300 border-x border-rose-200/80 dark:border-rose-900/50`}>
                        <div className="flex items-center justify-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                          <span className="font-black text-rose-700 dark:text-rose-300">Rejected by Call Center</span>
                        </div>
                        <div className="text-[8.5px] font-bold text-rose-600/90 dark:text-rose-400/90 lowercase">(escalated) (showall)</div>
                      </th>
                      <th className="py-3.5 px-3 text-center text-emerald-600 dark:text-emerald-400">
                        <div>0-3 Days</div>
                        <div className="text-[8.5px] font-bold text-emerald-500/80 lowercase">(new pending)</div>
                      </th>
                      <th className="py-3.5 px-3 text-center text-amber-600 dark:text-amber-400">
                        <div>3-5 Days</div>
                        <div className="text-[8.5px] font-bold text-amber-500/80 lowercase">(pending)</div>
                      </th>
                      <th className="py-3.5 px-3 text-center text-orange-600 dark:text-orange-400">
                        <div>6-10 Days</div>
                        <div className="text-[8.5px] font-bold text-orange-500/80 lowercase">(escalated)</div>
                      </th>
                      <th className="py-3.5 px-3 text-center text-rose-600 dark:text-rose-400">
                        <div>&gt;10 Days</div>
                        <div className="text-[8.5px] font-bold text-rose-500/80 lowercase">(critical)</div>
                      </th>
                      <th className="py-3.5 px-3 text-center text-blue-600 dark:text-blue-400">
                        <div>Avg Days to Contact</div>
                        <div className="text-[8.5px] font-bold text-blue-500/80 lowercase">(service station)</div>
                      </th>
                      <th className="py-3.5 px-3 text-center text-indigo-600 dark:text-indigo-400">
                        <div>Avg Days to Contact</div>
                        <div className="text-[8.5px] font-bold text-indigo-500/80 lowercase">(call center)</div>
                      </th>
                      <th 
                        title="Average Days to Solve Case: { Avg Days to Contact Customer (Service Station) + Avg Days to Contact Customer (Call Center) } / 2 (no decimals)"
                        className="py-3.5 px-3 text-center text-emerald-600 dark:text-emerald-400"
                      >
                        <div>Average Days to Solve Case</div>
                        <div className="text-[8.5px] font-bold text-emerald-500/80 lowercase">&#123; (sc) + (cc) &#125; / 2</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y text-xs transition-colors duration-500 ${isDark ? "divide-slate-800" : "divide-slate-100"}`}>
                    {stationMetrics.map((sm) => {
                      const isSelected = selectedStationCode === sm.code;
                      const rejectedCount = sm.escalated || sm.rejectedReAction || sm.rejectedByCC || 0;
                      const scAvg = Math.round(sm.avgDaysStationContact || 0);
                      const ccAvg = Math.round(sm.avgDaysCallCenterContact || 0);
                      const solveAvg = scAvg > 0 || ccAvg > 0 
                        ? Math.round(scAvg + ccAvg / 2) 
                        : (sm.avgDaysToSolveCase > 0 ? Math.round(sm.avgDaysToSolveCase) : 0);

                      return (
                        <tr 
                          key={sm.code} 
                          onClick={() => setSelectedStationCode(sm.code)}
                          className={`cursor-pointer transition-all ${
                            isSelected 
                              ? isDark 
                                ? "bg-blue-950/40 border-l-4 border-l-blue-500 text-blue-200" 
                                : "bg-blue-50/90 border-l-4 border-l-blue-600 text-blue-950 font-medium" 
                              : isDark 
                                ? "hover:bg-slate-950/30 text-slate-300" 
                                : "hover:bg-slate-50/70 text-slate-700"
                          }`}
                        >
                          <td className="py-3 px-3 text-center">
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono font-bold">{sm.code}</span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <p className={`font-bold ${isDark ? "text-slate-100" : "text-slate-900"}`}>{sm.name}</p>
                              {isSelected && (
                                <span className="text-[9px] bg-blue-600 text-white font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
                                  Selected
                                </span>
                              )}
                            </div>
                          </td>
                          {/* Total */}
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenDrilldown(sm.name, sm.code, "All Assigned Complaints (Received)", sm.totalList, "slate");
                              }}
                              title={`Click to view all ${sm.total} complaints for ${sm.name}`}
                              className={`font-black px-2.5 py-1 rounded-md border text-xs cursor-pointer hover:scale-105 transition-all shadow-2xs ${
                                isDark ? "text-slate-200 bg-slate-950 border-slate-800 hover:bg-slate-850 hover:border-slate-700" : "text-slate-800 bg-slate-100 border-slate-200 hover:bg-slate-200"
                              }`}
                            >
                              {sm.total}
                            </button>
                          </td>
                          {/* Resolved */}
                          <td className="py-3 px-3 text-center">
                            {sm.resolved > 0 ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenDrilldown(sm.name, sm.code, "Resolved Complaints (Contacted & Satisfied by CC)", sm.resolvedList, "emerald");
                                }}
                                title={`Click to view ${sm.resolved} resolved complaints for ${sm.name}`}
                                className="font-black px-2 py-0.5 rounded-md text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 cursor-pointer hover:underline hover:scale-105 transition-all"
                              >
                                {sm.resolved}
                              </button>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-600 font-bold">0</span>
                            )}
                          </td>
                          {/* Pending / In-Progress */}
                          <td className={`py-3 px-3 text-center ${isDark ? "bg-amber-950/10" : "bg-amber-50/30"}`}>
                            {sm.pending > 0 ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenDrilldown(sm.name, sm.code, "Pending / In-Progress (Not Contacted by Service Station)", sm.pendingList, "amber");
                                }}
                                title={`Click to view ${sm.pending} pending / in-progress complaints for ${sm.name}`}
                                className="font-black px-2.5 py-1 rounded-md text-xs text-amber-700 bg-amber-100 hover:bg-amber-200 dark:text-amber-300 dark:bg-amber-950/70 dark:border-amber-800/80 border border-amber-300 cursor-pointer hover:underline hover:scale-105 transition-all shadow-2xs"
                              >
                                {sm.pending}
                              </button>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-600 font-bold">0</span>
                            )}
                          </td>
                          {/* Escalated / Rejected by CC */}
                          <td className={`py-3 px-3 text-center border-x ${isDark ? "bg-rose-950/30 border-rose-900/40" : "bg-rose-50/60 border-rose-200/60"}`}>
                            {rejectedCount > 0 ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenDrilldown(sm.name, sm.code, "Rejected by Call Center / Escalated (Showall)", sm.escalatedList, "rose");
                                }}
                                title={`Click to view ${rejectedCount} rejected/escalated complaints for ${sm.name}`}
                                className="font-black px-2.5 py-1 rounded-md text-xs text-white bg-rose-600 hover:bg-rose-700 dark:bg-rose-700 dark:hover:bg-rose-600 cursor-pointer hover:scale-105 transition-all shadow-xs inline-flex items-center gap-1"
                              >
                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                <span>{rejectedCount}</span>
                              </button>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-600 font-bold">0</span>
                            )}
                          </td>
                          {/* 0-3d */}
                          <td className="py-3 px-3 text-center">
                            {sm.days0_3 > 0 ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenDrilldown(sm.name, sm.code, "0-3 Days (New)(Pending Customers for SC)", sm.days0_3List, "emerald");
                                }}
                                title={`Click to view ${sm.days0_3} new (0-3d) complaints for ${sm.name}`}
                                className="font-bold px-2 py-0.5 rounded-md text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 cursor-pointer hover:scale-105 transition-all"
                              >
                                {sm.days0_3}
                              </button>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-600 font-bold">0</span>
                            )}
                          </td>
                          {/* 3-5d */}
                          <td className="py-3 px-3 text-center">
                            {sm.days3_5 > 0 ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenDrilldown(sm.name, sm.code, "3-5 Days (Pending)(Pending Customers for SC)", sm.days3_5List, "amber");
                                }}
                                title={`Click to view ${sm.days3_5} pending (3-5d) complaints for ${sm.name}`}
                                className="font-bold px-2 py-0.5 rounded-md text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50 cursor-pointer hover:scale-105 transition-all"
                              >
                                {sm.days3_5}
                              </button>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-600 font-bold">0</span>
                            )}
                          </td>
                          {/* 6-10d */}
                          <td className="py-3 px-3 text-center">
                            {sm.days6_10 > 0 ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenDrilldown(sm.name, sm.code, "6-10 Days (Escalated)(Pending Customers for SC)", sm.days6_10List, "orange");
                                }}
                                title={`Click to view ${sm.days6_10} escalated (6-10d) complaints for ${sm.name}`}
                                className="font-bold px-2 py-0.5 rounded-md text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/50 cursor-pointer hover:scale-105 transition-all"
                              >
                                {sm.days6_10}
                              </button>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-600 font-bold">0</span>
                            )}
                          </td>
                          {/* >10d (Critical Aging) */}
                          <td className="py-3 px-3 text-center">
                            {sm.days10Plus > 0 ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenDrilldown(sm.name, sm.code, ">10 Days (Critical)(Pending Customers for SC)", sm.days10PlusList, "rose");
                                }}
                                title={`Click to inspect details of all ${sm.days10Plus} critical (>10d) complaints for ${sm.name}`}
                                className="inline-flex items-center justify-center font-black px-2.5 py-1 rounded-md text-xs bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/70 dark:text-rose-300 dark:hover:bg-rose-900 border border-rose-200 dark:border-rose-800/80 shadow-2xs hover:shadow-sm hover:scale-105 transition-all cursor-pointer group"
                              >
                                <span className="group-hover:underline">{sm.days10Plus}</span>
                                <span className="ml-1 text-[10px] opacity-75">🔍</span>
                              </button>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-600 font-bold">0</span>
                            )}
                          </td>
                          {/* Avg Days Station Contact (0 decimals) */}
                          <td className="py-3 px-3 text-center font-black text-blue-600 dark:text-blue-400 text-xs">
                            {scAvg}
                          </td>
                          {/* Avg Days Call Center Contact (0 decimals) */}
                          <td className="py-3 px-3 text-center font-black text-indigo-600 dark:text-indigo-400 text-xs">
                            {ccAvg}
                          </td>
                          {/* Avg Days to Solve Case (0 decimals) */}
                          <td 
                            title={`Average days to solve case: { ${scAvg} (SC) + ${ccAvg} (CC) } / 2 = ${solveAvg}`}
                            className="py-3 px-3 text-center font-black text-emerald-600 dark:text-emerald-400 text-xs"
                          >
                            {solveAvg}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr 
                      onClick={() => setSelectedStationCode("all")}
                      className={`font-black text-xs border-t-2 cursor-pointer transition-all ${
                        selectedStationCode === "all"
                          ? isDark ? "bg-blue-950 border-blue-600 text-blue-200" : "bg-blue-900 border-blue-500 text-white"
                          : isDark ? "bg-slate-950 border-slate-700 text-slate-100 hover:bg-slate-900" : "bg-slate-900 border-slate-800 text-white hover:bg-slate-800"
                      }`}
                      title="Click to view overall stats across all stations"
                    >
                      <td className="py-3.5 px-3 text-center text-slate-400 font-mono">ALL</td>
                      <td className="py-3.5 px-4 uppercase tracking-wider flex items-center gap-2">
                        <span>Overall Summary / All Stations</span>
                        {selectedStationCode === "all" && <span className="text-[10px] bg-blue-500 text-white font-black px-2 py-0.5 rounded">(Selected)</span>}
                      </td>
                      {/* Grand Total */}
                      <td className="py-3.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDrilldown("All Service Stations", "ALL", "All Assigned Complaints (Received)", grandTotalList, "slate");
                          }}
                          title={`Click to view all ${grandTotal} complaints across all stations`}
                          className="hover:underline font-black cursor-pointer"
                        >
                          {grandTotal}
                        </button>
                      </td>
                      {/* Grand Resolved */}
                      <td className="py-3.5 px-3 text-center text-emerald-400">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDrilldown("All Service Stations", "ALL", "Resolved Complaints (Contacted & Satisfied by CC)", grandResolvedList, "emerald");
                          }}
                          title={`Click to view ${grandResolved} resolved complaints across all stations`}
                          className="hover:underline font-black cursor-pointer"
                        >
                          {grandResolved}
                        </button>
                      </td>
                      {/* Grand Total Pending */}
                      <td className="py-3.5 px-3 text-center bg-amber-500/10 text-amber-400">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDrilldown("All Service Stations", "ALL", "Pending / In-Progress (Not Contacted by Service Station)", grandPendingList, "amber");
                          }}
                          title={`Click to view ${grandPending} pending complaints across all stations`}
                          className="font-black px-2.5 py-1 rounded-md text-xs bg-amber-400 text-slate-950 hover:bg-amber-300 shadow-2xs hover:scale-105 transition-all cursor-pointer"
                        >
                          {grandPending}
                        </button>
                      </td>
                      {/* Grand Escalated / Rejected by CC */}
                      <td className="py-3.5 px-3 text-center bg-rose-500/20 text-rose-300 border-x border-rose-500/30">
                        {grandEscalated > 0 ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDrilldown("All Service Stations", "ALL", "Rejected by Call Center / Escalated (Showall)", grandEscalatedList, "rose");
                            }}
                            title={`Click to view ${grandEscalated} rejected/escalated complaints across all stations`}
                            className="font-black px-2.5 py-1 rounded-md text-xs bg-rose-600 text-white hover:bg-rose-700 shadow-2xs hover:scale-105 transition-all cursor-pointer inline-flex items-center gap-1"
                          >
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            <span>{grandEscalated} Total Rejected</span>
                          </button>
                        ) : (
                          <span className="font-bold text-slate-400">0</span>
                        )}
                      </td>
                      {/* Grand 0-3d */}
                      <td className="py-3.5 px-3 text-center text-emerald-400">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDrilldown("All Service Stations", "ALL", "0-3 Days (New)(Pending Customers for SC)", grandDays0_3List, "emerald");
                          }}
                          title={`Click to view ${grandDays0_3} new (0-3d) complaints across all stations`}
                          className="hover:underline font-black cursor-pointer"
                        >
                          {grandDays0_3}
                        </button>
                      </td>
                      {/* Grand 3-5d */}
                      <td className="py-3.5 px-3 text-center text-amber-400">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDrilldown("All Service Stations", "ALL", "3-5 Days (Pending)(Pending Customers for SC)", grandDays3_5List, "amber");
                          }}
                          title={`Click to view ${grandDays3_5} pending (3-5d) complaints across all stations`}
                          className="hover:underline font-black cursor-pointer"
                        >
                          {grandDays3_5}
                        </button>
                      </td>
                      {/* Grand 6-10d */}
                      <td className="py-3.5 px-3 text-center text-orange-400">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDrilldown("All Service Stations", "ALL", "6-10 Days (Escalated)(Pending Customers for SC)", grandDays6_10List, "orange");
                          }}
                          title={`Click to view ${grandDays6_10} escalated (6-10d) complaints across all stations`}
                          className="hover:underline font-black cursor-pointer"
                        >
                          {grandDays6_10}
                        </button>
                      </td>
                      {/* Grand >10d */}
                      <td className="py-3.5 px-3 text-center text-rose-400">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDrilldown("All Service Stations", "ALL", ">10 Days (Critical)(Pending Customers for SC)", grandDays10PlusList, "rose");
                          }}
                          title={`Click to inspect details of all ${grandDays10Plus} critical (>10d) complaints across all stations`}
                          className="hover:underline font-black cursor-pointer inline-flex items-center gap-1"
                        >
                          <span>{grandDays10Plus}</span>
                          <span className="text-[10px]">🔍</span>
                        </button>
                      </td>
                      {/* Overall Avg Days SC Contact (0 decimals) */}
                      <td className="py-3.5 px-3 text-center text-blue-300">
                        {Math.round(overallReportAging.avgDaysStationContact || 0)}
                      </td>
                      {/* Overall Avg Days CC Contact (0 decimals) */}
                      <td className="py-3.5 px-3 text-center text-indigo-300">
                        {Math.round(overallReportAging.avgDaysCallCenterContact || 0)}
                      </td>
                      {/* Overall Avg Days to Solve Case (0 decimals) */}
                      <td 
                        title={`Overall average days to solve case across all stations: ${Math.round(overallReportAging.avgDaysStationContact || 0)} + ${Math.round(overallReportAging.avgDaysCallCenterContact || 0)}/2`}
                        className="py-3.5 px-3 text-center text-emerald-300"
                      >
                        {Math.round(overallReportAging.avgDaysStationContact || 0) > 0 || Math.round(overallReportAging.avgDaysCallCenterContact || 0) > 0
                          ? Math.round(Math.round(overallReportAging.avgDaysStationContact || 0) + Math.round(overallReportAging.avgDaysCallCenterContact || 0) / 2)
                          : Math.round(overallReportAging.avgDaysToSolveCase || 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="text-[10px] text-slate-400 font-bold mt-3 pt-2 border-t border-slate-100">
                Click any table row above or use the station buttons below to inspect graphical SLA breakdown.
              </p>
            </div>
          </div>

          {/* Bottom Block: Detailed Graphic Breakdown Panel (Full Page Width) */}
          <div className={`w-full rounded-2xl border p-5 shadow-xs transition-all duration-500 ${cardBg}`}>
            {(() => {
              const selectedStation = selectedStationCode === "all" 
                ? { code: "ALL", name: "Overall Summary (All Service Stations)" }
                : STATIONS.find(s => s.code === selectedStationCode) || STATIONS[0];
              
              const rawStationComplaints = selectedStationCode === "all"
                ? filteredComplaints
                : filteredComplaints.filter(c => matchesStationCodeOrName(c.station, selectedStation.code));
              
              // Only get contacted ones by call center and closed ones for the summary
              const activeStationComplaints = rawStationComplaints.filter(c => isContactedByCallCenterOrClosed(c));
              const activeStationTotal = activeStationComplaints.length;

              // Aging breakdown
              let stationNewCount = 0;
              let stationPendingCount = 0;
              let stationEscalatedCount = 0;
              let stationCriticalCount = 0;

              activeStationComplaints.forEach((c) => {
                const { days } = getComplaintAging(c);
                if (days <= 3) stationNewCount++;
                else if (days <= 5) stationPendingCount++;
                else if (days <= 10) stationEscalatedCount++;
                else stationCriticalCount++;
              });

              const stationNewPct = activeStationTotal > 0 ? Math.round((stationNewCount / activeStationTotal) * 100) : 0;
              const stationPendingPct = activeStationTotal > 0 ? Math.round((stationPendingCount / activeStationTotal) * 100) : 0;
              const stationEscalatedPct = activeStationTotal > 0 ? Math.round((stationEscalatedCount / activeStationTotal) * 100) : 0;
              const stationCriticalPct = activeStationTotal > 0 ? Math.round((stationCriticalCount / activeStationTotal) * 100) : 0;

              // Clean mutual satisfaction breakdown
              let stationSatisfiedTotal = 0;
              let stationDissatisfiedTotal = 0;
              let stationNeutralTotal = 0;

              activeStationComplaints.forEach((c) => {
                const isSatisfied = 
                  c.currentSatisfaction === "Satisfied" || 
                  c.currentSatisfaction === "Very Satisfied" || 
                  c.callCenterFinalSatisfaction === "Satisfied" ||
                  c.callCenterFinalSatisfaction === "Very Satisfied" ||
                  c.feedbackStatus === "Satisfied" || 
                  c.feedbackStatus === "Satisfied After Resolution" ||
                  c.firstAttemptCallStatus === "Satisfied" ||
                  c.secondAttemptFeedbackStatus === "Satisfied";

                const isDissatisfied = 
                  !isSatisfied && (
                    c.currentSatisfaction === "Dissatisfied" || 
                    c.currentSatisfaction === "Very Dissatisfied" || 
                    c.callCenterFinalSatisfaction === "Dissatisfied" ||
                    c.callCenterFinalSatisfaction === "Very Dissatisfied" ||
                    c.feedbackStatus === "Still Dissatisfied" ||
                    c.feedbackStatus === "Not Satisfied" ||
                    c.secondAttemptFeedbackStatus === "Not Satisfied" ||
                    c.secondAttemptFeedbackStatus === "No solution Received" ||
                    c.secondAttemptFeedbackStatus === "No Solution Received"
                  );

                const isNeutral = 
                  !isSatisfied && !isDissatisfied && (
                    c.currentSatisfaction === "Neutral" || 
                    c.callCenterFinalSatisfaction === "Neutral"
                  );

                if (isSatisfied) {
                  stationSatisfiedTotal++;
                } else if (isDissatisfied) {
                  stationDissatisfiedTotal++;
                } else if (isNeutral) {
                  stationNeutralTotal++;
                }
              });

              const stationSatisfactionRate = activeStationTotal > 0 ? Math.round((stationSatisfiedTotal / activeStationTotal) * 100) : 0;
              const stationDissatisfiedRate = activeStationTotal > 0 ? Math.round((stationDissatisfiedTotal / activeStationTotal) * 100) : 0;
              const stationNeutralRate = activeStationTotal > 0 ? Math.round((stationNeutralTotal / activeStationTotal) * 100) : 0;

              // Active station SLA contact and turnaround averages calculated specifically on the contacted & closed workload
              const stationTurnaround = getStationMetricsCalculations(activeStationComplaints);
              const stationAvgContact = stationTurnaround.avgDaysStationContact;
              const ccAvgContact = stationTurnaround.avgDaysCallCenterContact;
              const solveAvgDays = stationTurnaround.avgDaysToSolveCase;

              return (
                <div className="space-y-4">
                  {/* Header & Quick Selector Pills */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b pb-3 border-slate-200 dark:border-slate-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className={`text-sm font-black uppercase tracking-wider flex items-center gap-2 ${textTitle}`}>
                          <Activity className="h-4 w-4 text-blue-600" />
                          {selectedStation.code} Graphical SLA & Performance Analysis
                        </h4>
                        <span className="text-[9px] font-black text-blue-700 bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-full uppercase">
                          Contacted & Closed Only
                        </span>
                      </div>
                      <p className={`text-xs font-bold mt-0.5 ${textSub}`}>
                        {selectedStation.name} • Filtered to {activeStationTotal} Call Center Contacted and Closed cases (from {rawStationComplaints.length} Total Received)
                      </p>
                    </div>

                    {/* Quick Station Switcher Pills */}
                    <div className="flex flex-wrap items-center gap-1.5 pdf-hide">
                      <button
                        type="button"
                        onClick={() => setSelectedStationCode("all")}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-md border transition-all cursor-pointer ${
                          selectedStationCode === "all"
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300"
                        }`}
                      >
                        Overall Total
                      </button>
                      {STATIONS.map((st) => (
                        <button
                          key={st.code}
                          type="button"
                          onClick={() => setSelectedStationCode(st.code)}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-md border transition-all cursor-pointer ${
                            selectedStationCode === st.code
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {st.code}
                        </button>
                      ))}
                    </div>
                  </div>

                  {activeStationTotal === 0 ? (
                    <div className={`py-12 text-center rounded-xl border border-dashed my-4 ${
                      isDark ? "bg-slate-950/40 border-slate-800" : "bg-slate-50/50 border-slate-200"
                    }`}>
                      <p className="text-sm font-bold text-slate-400">No contacted or closed cases found for {selectedStation.name}.</p>
                      <p className="text-xs text-slate-400 mt-1">Try resetting search filters or selecting another station above.</p>
                    </div>
                  ) : (
                    /* 3-Column Responsive Graphical Grid */
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                      
                      {/* Column 1: Aging SLA Breakdown */}
                      <div className={`p-4 rounded-xl border space-y-3 ${bgSub}`}>
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-black uppercase tracking-wider ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                            Aging SLA Proportions
                          </span>
                          <span className="text-[10px] font-extrabold text-blue-600 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900/40">
                            {activeStationTotal} Cases
                          </span>
                        </div>

                        <div className="space-y-3">
                          {/* 0-3 Days */}
                          <div>
                            <div className={`flex justify-between text-xs font-bold ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                              <span>0-3 Days (New / On Track)</span>
                              <span className="font-black text-emerald-600">{stationNewCount} ({stationNewPct}%)</span>
                            </div>
                            <div className={`w-full ${isDark ? "bg-slate-950" : "bg-slate-200"} rounded-full h-2.5 mt-1`}>
                              <div 
                                className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500"
                                style={{ width: `${stationNewPct}%` }}
                              />
                            </div>
                          </div>

                          {/* 3-5 Days */}
                          <div>
                            <div className={`flex justify-between text-xs font-bold ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                              <span>3-5 Days (Pending Contact)</span>
                              <span className="font-black text-amber-600">{stationPendingCount} ({stationPendingPct}%)</span>
                            </div>
                            <div className={`w-full ${isDark ? "bg-slate-950" : "bg-slate-200"} rounded-full h-2.5 mt-1`}>
                              <div 
                                className="bg-amber-500 h-2.5 rounded-full transition-all duration-500"
                                style={{ width: `${stationPendingPct}%` }}
                              />
                            </div>
                          </div>

                          {/* 6-10 Days */}
                          <div>
                            <div className={`flex justify-between text-xs font-bold ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                              <span>6-10 Days (Escalated SLA)</span>
                              <span className="font-black text-orange-600">{stationEscalatedCount} ({stationEscalatedPct}%)</span>
                            </div>
                            <div className={`w-full ${isDark ? "bg-slate-950" : "bg-slate-200"} rounded-full h-2.5 mt-1`}>
                              <div 
                                className="bg-orange-500 h-2.5 rounded-full transition-all duration-500"
                                style={{ width: `${stationEscalatedPct}%` }}
                              />
                            </div>
                          </div>

                          {/* >10 Days */}
                          <div>
                            <div className={`flex justify-between text-xs font-bold ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                              <span>&gt;10 Days (Critical Overdue)</span>
                              <span className="font-black text-rose-600">{stationCriticalCount} ({stationCriticalPct}%)</span>
                            </div>
                            <div className={`w-full ${isDark ? "bg-slate-950" : "bg-slate-200"} rounded-full h-2.5 mt-1`}>
                              <div 
                                className="bg-rose-500 h-2.5 rounded-full transition-all duration-500"
                                style={{ width: `${stationCriticalPct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Column 2: CSAT & Dissatisfaction Rates */}
                      <div className={`p-4 rounded-xl border space-y-3 ${bgSub}`}>
                        <span className={`text-xs font-black uppercase tracking-wider block ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                          CSAT & Dissatisfaction Rates
                        </span>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 rounded-xl p-3 text-center">
                            <p className="text-[10px] font-black text-emerald-800 dark:text-emerald-300 uppercase">Satisfaction Rate</p>
                            <p className="text-xl font-black text-emerald-600 mt-0.5">{stationSatisfactionRate}%</p>
                            <p className="text-[9px] font-bold text-emerald-600/80">{stationSatisfiedTotal} cases</p>
                          </div>

                          <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-xl p-3 text-center">
                            <p className="text-[10px] font-black text-rose-800 dark:text-rose-300 uppercase">Dissatisfied Rate</p>
                            <p className="text-xl font-black text-rose-600 mt-0.5">{stationDissatisfiedRate}%</p>
                            <p className="text-[9px] font-bold text-rose-600/80">{stationDissatisfiedTotal} cases</p>
                          </div>
                        </div>

                        {/* CSAT Progress Bars */}
                        <div className="space-y-2 bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                          <div>
                            <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                              <span>Satisfied (CSAT)</span>
                              <span className="font-black text-emerald-600">{stationSatisfactionRate}%</span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 mt-1">
                              <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${stationSatisfactionRate}%` }} />
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                              <span>Dissatisfied</span>
                              <span className="font-black text-rose-600">{stationDissatisfiedRate}%</span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 mt-1">
                              <div className="bg-rose-500 h-2 rounded-full" style={{ width: `${stationDissatisfiedRate}%` }} />
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                              <span>Neutral</span>
                              <span className="font-black text-slate-500">{stationNeutralRate}%</span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 mt-1">
                              <div className="bg-slate-400 h-2 rounded-full" style={{ width: `${stationNeutralRate}%` }} />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Column 3: Operational SLA Speed Indicators */}
                      <div className={`p-4 rounded-xl border space-y-3 ${bgSub}`}>
                        <span className={`text-xs font-black uppercase tracking-wider block ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                          Operational Turnaround Speed
                        </span>

                        <div className="space-y-2.5">
                          <div className="bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <div>
                              <p className="text-[10px] font-black uppercase text-blue-600">Station Avg Contact</p>
                              <p className="text-xs font-bold text-slate-500">Target ≤ 2 Days</p>
                            </div>
                            <span className="text-lg font-black text-blue-600">
                              {stationAvgContact} {stationAvgContact === 1 ? "day" : "days"}
                            </span>
                          </div>

                          <div className="bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <div>
                              <p className="text-[10px] font-black uppercase text-amber-600">Call Center Avg Contact</p>
                              <p className="text-xs font-bold text-slate-500">Target ≤ 1 Day</p>
                            </div>
                            <span className="text-lg font-black text-amber-600">
                              {ccAvgContact} {ccAvgContact === 1 ? "day" : "days"}
                            </span>
                          </div>

                          <div className="bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <div>
                              <p className="text-[10px] font-black uppercase text-emerald-600">Avg Speed to Solve Case</p>
                              <p className="text-xs font-bold text-slate-500">Full Resolution Velocity</p>
                            </div>
                            <span className="text-lg font-black text-emerald-600">
                              {solveAvgDays} {solveAvgDays === 1 ? "day" : "days"}
                            </span>
                          </div>
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Aging Metric Summary Cards (Frozen Times Calculation) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: New */}
          <div className={`p-4 rounded-xl flex items-center justify-between border transition-all duration-300 hover:scale-[1.01] ${
            isDark 
              ? "bg-emerald-950/20 border-emerald-900/40 text-emerald-300 shadow-inner" 
              : "bg-emerald-50 border-emerald-200 text-emerald-900 shadow-xs"
          }`}>
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={`text-[10px] font-black uppercase tracking-wider ${isDark ? "text-emerald-400/80" : "text-emerald-800"}`}>
                  New (0-3 Days)
                </span>
                <span className={`text-[8px] font-extrabold px-1.5 py-0.2 rounded border truncate max-w-[100px] ${
                  isDark ? "text-emerald-300 bg-emerald-950/80 border-emerald-800" : "text-emerald-800 bg-emerald-100 border-emerald-300"
                }`} title={activeScopeTitle}>
                  {activeScopeTitle}
                </span>
                <span className="text-[7.5px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded bg-emerald-200/80 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-400/50">
                  Frozen
                </span>
              </div>
              <p className={`text-2xl font-black mt-1 ${isDark ? "text-emerald-400" : "text-emerald-900"}`}>{greenCount}</p>
              <p className={`text-[10px] font-bold mt-0.5 ${isDark ? "text-emerald-500" : "text-emerald-700"}`}>Frozen duration (≤3 days)</p>
            </div>
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center border ${
              isDark ? "bg-emerald-500/10 border-emerald-500/20" : "bg-emerald-500/10 border-emerald-500/20"
            }`}>
              <CheckCircle className="h-5 w-5 text-emerald-600" />
            </div>
          </div>

          {/* Card 2: Pending */}
          <div className={`p-4 rounded-xl flex items-center justify-between border transition-all duration-300 hover:scale-[1.01] ${
            isDark 
              ? "bg-amber-950/20 border-amber-900/40 text-amber-300 shadow-inner" 
              : "bg-amber-50 border-amber-200 text-amber-900 shadow-xs"
          }`}>
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={`text-[10px] font-black uppercase tracking-wider ${isDark ? "text-amber-400/80" : "text-amber-800"}`}>
                  Pending (3-5 Days)
                </span>
                <span className={`text-[8px] font-extrabold px-1.5 py-0.2 rounded border truncate max-w-[100px] ${
                  isDark ? "text-amber-300 bg-amber-950/80 border-amber-800" : "text-amber-800 bg-amber-100 border-amber-300"
                }`} title={activeScopeTitle}>
                  {activeScopeTitle}
                </span>
                <span className="text-[7.5px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded bg-amber-200/80 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-400/50">
                  Frozen
                </span>
              </div>
              <p className={`text-2xl font-black mt-1 ${isDark ? "text-amber-400" : "text-amber-900"}`}>{yellowCount}</p>
              <p className={`text-[10px] font-bold mt-0.5 ${isDark ? "text-amber-500" : "text-amber-700"}`}>Frozen duration (3-5 days)</p>
            </div>
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center border ${
              isDark ? "bg-amber-500/10 border-amber-500/20" : "bg-amber-500/10 border-amber-500/20"
            }`}>
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
          </div>

          {/* Card 3: Escalated */}
          <div className={`p-4 rounded-xl flex items-center justify-between border transition-all duration-300 hover:scale-[1.01] ${
            isDark 
              ? "bg-orange-950/20 border-orange-900/40 text-orange-300 shadow-inner" 
              : "bg-orange-50 border-orange-200 text-orange-900 shadow-xs"
          }`}>
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={`text-[10px] font-black uppercase tracking-wider ${isDark ? "text-orange-400/80" : "text-orange-850"}`}>
                  Escalated (6-10 Days)
                </span>
                <span className={`text-[8px] font-extrabold px-1.5 py-0.2 rounded border truncate max-w-[100px] ${
                  isDark ? "text-orange-300 bg-orange-950/80 border-orange-800" : "text-orange-800 bg-orange-100 border-orange-300"
                }`} title={activeScopeTitle}>
                  {activeScopeTitle}
                </span>
                <span className="text-[7.5px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded bg-orange-200/80 dark:bg-orange-900/60 text-orange-800 dark:text-orange-200 border border-orange-400/50">
                  Frozen
                </span>
              </div>
              <p className={`text-2xl font-black mt-1 ${isDark ? "text-orange-400" : "text-orange-900"}`}>{orangeCount}</p>
              <p className={`text-[10px] font-bold mt-0.5 ${isDark ? "text-orange-500" : "text-orange-700"}`}>Frozen duration (6-10 days)</p>
            </div>
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center border ${
              isDark ? "bg-orange-500/10 border-orange-500/20" : "bg-orange-500/10 border-orange-500/20"
            }`}>
              <Activity className="h-5 w-5 text-orange-600" />
            </div>
          </div>

          {/* Card 4: Critical */}
          <div className={`p-4 rounded-xl flex items-center justify-between border transition-all duration-300 hover:scale-[1.01] ${
            isDark 
              ? "bg-rose-950/20 border-rose-900/40 text-rose-300 shadow-inner" 
              : "bg-rose-50 border-rose-200 text-rose-900 shadow-xs"
          }`}>
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={`text-[10px] font-black uppercase tracking-wider ${isDark ? "text-rose-400/80" : "text-rose-800"}`}>
                  {"Critical (>10 Days)"}
                </span>
                <span className={`text-[8px] font-extrabold px-1.5 py-0.2 rounded border truncate max-w-[100px] ${
                  isDark ? "text-rose-300 bg-rose-950/80 border-rose-800" : "text-rose-800 bg-rose-100 border-rose-300"
                }`} title={activeScopeTitle}>
                  {activeScopeTitle}
                </span>
                <span className="text-[7.5px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded bg-rose-200/80 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 border border-rose-400/50">
                  Frozen
                </span>
              </div>
              <p className={`text-2xl font-black mt-1 ${isDark ? "text-rose-400" : "text-rose-900"}`}>{redCount}</p>
              <p className={`text-[10px] font-bold mt-0.5 ${isDark ? "text-rose-500" : "text-rose-700"}`}>Frozen duration (&gt;10 days)</p>
            </div>
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center border ${
              isDark ? "bg-rose-500/10 border-rose-500/20" : "bg-rose-500/10 border-rose-500/20"
            }`}>
              <AlertTriangle className="h-5 w-5 text-rose-600" />
            </div>
          </div>
        </div>

        {/* Graphical Insights Visual Charts Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          
          {/* Chart 1: Aging SLA Distribution (Horizontal Progress Bars) */}
          <div className={`p-4 rounded-xl border shadow-xs flex flex-col justify-between transition-all duration-500 ${cardBg}`}>
            <div>
              <div className={`flex items-center justify-between mb-3.5 border-b pb-1.5 ${isDark ? "border-slate-800" : "border-slate-100"}`}>
                <div>
                  <h4 className={`text-[11px] font-black uppercase tracking-wider ${textTitle}`}>
                    Aging SLA Proportions
                  </h4>
                  <span className="text-[9px] font-bold text-slate-400">
                    Frozen Times Only ({totalFrozenInScope} of {totalInScope})
                  </span>
                </div>
                <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded border truncate max-w-[120px] ${
                  isDark ? "text-blue-400 bg-blue-950/40 border-blue-900/30" : "text-blue-700 bg-blue-50 border-blue-200"
                }`} title={activeScopeTitle}>
                  {activeScopeTitle}
                </span>
              </div>
              <div className="space-y-3.5">
                {/* 0-3 Days (New) */}
                <div>
                  <div className={`flex justify-between text-xs font-bold mb-1 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    <span>0-3 Days (New)</span>
                    <span>{greenCount} ({totalFrozenInScope > 0 ? Math.round((greenCount / totalFrozenInScope) * 100) : 0}%)</span>
                  </div>
                  <div className={`w-full rounded-full h-2 ${isDark ? "bg-slate-950" : "bg-slate-100"}`}>
                    <div 
                      className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${totalFrozenInScope > 0 ? Math.round((greenCount / totalFrozenInScope) * 100) : 0}%` }}
                    />
                  </div>
                </div>

                {/* 3-5 Days (Pending) */}
                <div>
                  <div className={`flex justify-between text-xs font-bold mb-1 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    <span>3-5 Days (Pending)</span>
                    <span>{yellowCount} ({totalFrozenInScope > 0 ? Math.round((yellowCount / totalFrozenInScope) * 100) : 0}%)</span>
                  </div>
                  <div className={`w-full rounded-full h-2 ${isDark ? "bg-slate-950" : "bg-slate-100"}`}>
                    <div 
                      className="bg-amber-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${totalFrozenInScope > 0 ? Math.round((yellowCount / totalFrozenInScope) * 100) : 0}%` }}
                    />
                  </div>
                </div>

                {/* 6-10 Days (Escalated) */}
                <div>
                  <div className={`flex justify-between text-xs font-bold mb-1 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    <span>6-10 Days (Escalated)</span>
                    <span>{orangeCount} ({totalFrozenInScope > 0 ? Math.round((orangeCount / totalFrozenInScope) * 100) : 0}%)</span>
                  </div>
                  <div className={`w-full rounded-full h-2 ${isDark ? "bg-slate-950" : "bg-slate-100"}`}>
                    <div 
                      className="bg-orange-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${totalFrozenInScope > 0 ? Math.round((orangeCount / totalFrozenInScope) * 100) : 0}%` }}
                    />
                  </div>
                </div>

                {/* >10 Days (Critical) */}
                <div>
                  <div className={`flex justify-between text-xs font-bold mb-1 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    <span>&gt;10 Days (Critical)</span>
                    <span>{redCount} ({totalFrozenInScope > 0 ? Math.round((redCount / totalFrozenInScope) * 100) : 0}%)</span>
                  </div>
                  <div className={`w-full rounded-full h-2 ${isDark ? "bg-slate-950" : "bg-slate-100"}`}>
                    <div 
                      className="bg-rose-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${totalFrozenInScope > 0 ? Math.round((redCount / totalFrozenInScope) * 100) : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
            <p className={`text-[9px] font-bold mt-4 pt-1.5 border-t ${isDark ? "text-slate-500 border-slate-800" : "text-slate-400 border-slate-100"}`}>
              SLA levels calculated exclusively for frozen time records ({totalFrozenInScope} cases) for {activeScopeTitle}.
            </p>
          </div>

          {/* Chart 2: Call Center Feedback Status Breakdown (SC Contacted Customers Only) */}
          <div className={`p-4 rounded-xl border shadow-xs flex flex-col justify-between transition-all duration-500 ${cardBg}`}>
            <div>
              <div className={`flex items-start justify-between mb-3 border-b pb-2 ${isDark ? "border-slate-800" : "border-slate-100"}`}>
                <div>
                  <h4 className={`text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 ${textTitle}`}>
                    <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                    Call Center Feedback Status
                  </h4>
                  <div className="flex items-center gap-1 mt-1">
                    <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border ${
                      isDark 
                        ? "bg-indigo-950/60 text-indigo-300 border-indigo-800/60" 
                        : "bg-indigo-50 text-indigo-700 border-indigo-200"
                    }`}>
                      SC Contacted Only: {scContactedActiveScopeCount} Cases
                    </span>
                  </div>
                </div>
                <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded border truncate max-w-[110px] ${
                  isDark ? "text-blue-400 bg-blue-950/40 border-blue-900/30" : "text-blue-700 bg-blue-50 border-blue-200"
                }`} title={activeScopeTitle}>
                  {activeScopeTitle}
                </span>
              </div>

              {scContactedActiveScopeCount === 0 ? (
                <div className={`py-8 text-center rounded-lg border border-dashed my-2 ${
                  isDark ? "bg-slate-950/40 border-slate-800" : "bg-slate-50/60 border-slate-200"
                }`}>
                  <p className="text-xs font-bold text-slate-400">No service station contacted cases</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Feedback activates once station records customer contact.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {feedbackStatusLevels.map((level) => {
                    const count = feedbackStatusCounts[level] || 0;
                    const pct = scContactedActiveScopeCount > 0 ? Math.round((count / scContactedActiveScopeCount) * 100) : 0;
                    
                    let barColor = "bg-blue-500";
                    let badgeColor = isDark ? "text-blue-400 bg-blue-950/60 border-blue-900/40" : "text-blue-700 bg-blue-50 border-blue-200";
                    let dotColor = "bg-blue-500";

                    if (level === "Satisfied After Resolution") {
                      barColor = "bg-emerald-500";
                      badgeColor = isDark ? "text-emerald-400 bg-emerald-950/60 border-emerald-900/40" : "text-emerald-800 bg-emerald-50 border-emerald-200";
                      dotColor = "bg-emerald-500";
                    } else if (level === "Still Dissatisfied") {
                      barColor = "bg-rose-500";
                      badgeColor = isDark ? "text-rose-400 bg-rose-950/60 border-rose-900/40" : "text-rose-800 bg-rose-50 border-rose-200";
                      dotColor = "bg-rose-500";
                    } else if (level === "No Solution Received") {
                      barColor = "bg-amber-500";
                      badgeColor = isDark ? "text-amber-400 bg-amber-950/60 border-amber-900/40" : "text-amber-800 bg-amber-50 border-amber-200";
                      dotColor = "bg-amber-500";
                    } else if (level === "Customer Unreachable") {
                      barColor = "bg-purple-500";
                      badgeColor = isDark ? "text-purple-400 bg-purple-950/60 border-purple-900/40" : "text-purple-800 bg-purple-50 border-purple-200";
                      dotColor = "bg-purple-500";
                    } else if (level === "Rejected Again to Service Station") {
                      barColor = "bg-orange-600";
                      badgeColor = isDark ? "text-orange-400 bg-orange-950/60 border-orange-900/40" : "text-orange-800 bg-orange-50 border-orange-200";
                      dotColor = "bg-orange-600";
                    }

                    return (
                      <div key={level} className="flex items-center text-xs group">
                        <span className={`w-36 font-bold truncate text-[10px] flex items-center gap-1.5 transition-colors ${
                          isDark ? "text-slate-300 group-hover:text-white" : "text-slate-600 group-hover:text-slate-900"
                        }`} title={level}>
                          <span className={`w-1.5 h-1.5 rounded-full ${dotColor} shrink-0`} />
                          <span className="truncate">{level}</span>
                        </span>
                        <div className={`flex-1 rounded-full h-2 mx-2 ${isDark ? "bg-slate-950" : "bg-slate-100"}`}>
                          <div 
                            className={`${barColor} h-2 rounded-full transition-all duration-500`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className={`min-w-[62px] text-right font-black text-[10px] px-1.5 py-0.5 rounded border ${badgeColor}`}>
                          {count} <span className="font-semibold opacity-85">({pct}%)</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className={`mt-3 pt-2 border-t flex items-center justify-between text-[9px] font-bold ${isDark ? "text-slate-500 border-slate-800" : "text-slate-400 border-slate-100"}`}>
              <span>Evaluated on SC Contacted = YES only</span>
              <span className={`font-black ${isDark ? "text-indigo-400" : "text-indigo-600"}`}>
                {scContactedActiveScopeCount} / {totalInScope} ({totalInScope > 0 ? Math.round((scContactedActiveScopeCount / totalInScope) * 100) : 0}%)
              </span>
            </div>
          </div>

          {/* Chart 3: Operational Status Distribution */}
          <div className={`p-4 rounded-xl border shadow-xs flex flex-col justify-between transition-all duration-500 ${cardBg}`}>
            <div>
              <div className={`flex items-center justify-between mb-3.5 border-b pb-1.5 ${isDark ? "border-slate-800" : "border-slate-100"}`}>
                <h4 className={`text-[11px] font-black uppercase tracking-wider ${textTitle}`}>
                  Current Status
                </h4>
                <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded border truncate max-w-[120px] ${
                  isDark ? "text-blue-400 bg-blue-950/40 border-blue-900/30" : "text-blue-700 bg-blue-50 border-blue-200"
                }`} title={activeScopeTitle}>
                  {activeScopeTitle}
                </span>
              </div>
              <div className="space-y-3">
                {statusLevels.map((level) => {
                  const count = statusCounts[level] || 0;
                  const pct = totalInScope > 0 ? Math.round((count / totalInScope) * 100) : 0;

                  let barColor = "bg-slate-500";
                  if (level === "Resolved") barColor = "bg-emerald-500";
                  else if (level === "Contacted") barColor = "bg-sky-500";
                  else if (level === "In Progress") barColor = "bg-orange-500";
                  else if (level === "Pending") barColor = "bg-red-500";

                  return (
                    <div key={level}>
                      <div className={`flex justify-between text-[11px] font-bold mb-0.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                        <span className="flex items-center gap-1">
                          <span className={`inline-block w-2 h-2 rounded-full ${barColor}`} />
                          {level}
                        </span>
                        <span>{count} ({pct}%)</span>
                      </div>
                      <div className={`w-full rounded-full h-1.5 ${isDark ? "bg-slate-950" : "bg-slate-100"}`}>
                        <div 
                          className={`${barColor} h-1.5 rounded-full transition-all duration-500`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <p className={`text-[9px] font-bold mt-4 pt-1.5 border-t ${isDark ? "text-slate-500 border-slate-800" : "text-slate-400 border-slate-100"}`}>
              Resolution lifecycle velocity metrics.
            </p>
          </div>

        </div>

        {/* Tabular Reports */}
        <div className="grid grid-cols-1 gap-5">
          
          {/* Full-width Column: Detailed Aging Log & Download */}
          <div className={`rounded-xl border shadow-sm overflow-hidden flex flex-col transition-all duration-500 ${cardBg}`}>
            <div className={`px-5 py-4 border-b flex items-center justify-between transition-all duration-500 ${
              isDark ? "border-slate-800 bg-slate-950/40" : "border-slate-100 bg-slate-50/50"
            }`}>
              <div>
                <h3 className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${textTitle}`}>
                  <FileSpreadsheet className="h-4.5 w-4.5 text-blue-600" />
                  Detailed Aging Logs ({totalInScope})
                </h3>
                <p className={`text-[10px] font-bold mt-0.5 ${textSub}`}>
                  Individual complaint timestamps and color-coded SLA levels.
                </p>
              </div>
              <button
                id="btn-download-detailed-csv"
                type="button"
                onClick={handleDownloadDetailedReport}
                className="pdf-hide bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[11px] py-1.5 px-3 rounded-md transition-all flex items-center gap-1 cursor-pointer shadow-xs"
              >
                <Download className="h-3.5 w-3.5" />
                Download CSV
              </button>
            </div>

            <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className={`border-b text-[9px] font-black uppercase tracking-wider transition-colors duration-500 ${
                    isDark ? "border-slate-800 bg-slate-950/80 text-slate-400" : "border-slate-100 bg-slate-50/30 text-slate-500"
                  }`}>
                    <th className="py-3 px-4">ID</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Service Station</th>
                    <th className="py-3 px-4">Received Date & Time</th>
                    <th className="py-3 px-4">SLA Feedback</th>
                    <th className="py-3 px-4">Final Status</th>
                    <th className="py-3 px-4 text-center">Aging SLA</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className={`divide-y text-xs transition-colors duration-500 ${isDark ? "divide-slate-800" : "divide-slate-100"}`}>
                  {filteredComplaints.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-400 font-bold">
                        No complaints matching the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredComplaints.map((c) => {
                      const aging = getComplaintAging(c);
                      return (
                        <tr key={c.id} className={`transition-colors ${
                          isDark ? "hover:bg-slate-950/30 text-slate-300" : "hover:bg-slate-50/50 text-slate-700"
                        }`}>
                          <td className={`py-2.5 px-4 font-mono text-[10px] font-black ${isDark ? "text-slate-400" : "text-slate-500"}`}>{c.id}</td>
                          <td className={`py-2.5 px-4 font-bold ${isDark ? "text-slate-200" : "text-slate-800"}`}>{c.customerName}</td>
                          <td className="py-2.5 px-4">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                              isDark ? "text-slate-300 bg-slate-950 border-slate-800" : "text-slate-600 bg-slate-100 border-slate-200"
                            }`}>
                              {c.station}
                            </span>
                          </td>
                          <td className={`py-2.5 px-4 font-mono text-[10px] font-bold ${isDark ? "text-slate-400" : "text-slate-700"}`}>
                            {c.receivedDateTime || `${c.date} 08:00 AM`}
                          </td>
                          <td className="py-2.5 px-4">
                            <span className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full text-center border ${
                              isDark 
                                ? "text-blue-400 bg-blue-950/40 border-blue-900/30" 
                                : "text-blue-700 bg-blue-50 border-blue-200"
                            }`}>
                              {c.feedbackStatus || "Follow-up Required"}
                            </span>
                          </td>
                          <td className="py-2.5 px-4">
                            <span className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full text-center border ${
                              isDark 
                                ? "text-slate-300 bg-slate-950 border-slate-800" 
                                : "text-slate-700 bg-slate-100 border-slate-200"
                            }`}>
                              {c.finalStatus || "Open"}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <span className={`inline-block border font-black text-[9px] px-2 py-0.5 rounded-full ${aging.colorClass}`}>
                              {aging.days} {aging.days === 1 ? "Day" : "Days"}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <span className={`inline-block text-[9px] font-black rounded px-1.5 py-0.5 uppercase ${
                              c.status === "Resolved" 
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : c.status === "In Progress"
                                ? "bg-orange-50 text-orange-700 border border-orange-200"
                                : "bg-red-50 text-red-700 border border-red-200"
                            }`}>
                              {c.status}
                            </span>
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

      </div>

      {/* HIDDEN 4-PAGE EXECUTIVE SLA PDF ROOT CONTAINER */}
      <div
        id="executive-management-sla-pdf-root"
        className="bg-slate-100 text-slate-900 font-sans"
        style={{
          display: "none",
          position: "absolute",
          left: "-9999px",
          top: 0,
          width: "1122px",
          zIndex: -1
        }}
      >
        {/* ================= PAGE 1: MANAGEMENT SUMMARY & SLA ELIGIBILITY FLOWCHART ================= */}
        <div
          className="executive-pdf-page bg-white p-8 border border-slate-200 text-slate-900 flex flex-col justify-between"
          style={{ width: "1122px", minHeight: "793px", boxSizing: "border-box" }}
        >
          <div>
            {/* Header Bar */}
            <div className="bg-slate-900 text-white p-5 rounded-xl mb-5 flex items-center justify-between border-b-4 border-blue-600">
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-blue-600 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-wider">
                    Ideal CX Engine
                  </span>
                  <span className="text-xs font-bold text-slate-300">Executive Report</span>
                </div>
                <h1 className="text-xl font-black uppercase tracking-wider text-white mt-1">
                  SERVICE STATION &amp; CALL CENTER SLA PERFORMANCE SCORECARD
                </h1>
                <p className="text-xs text-slate-300 font-medium mt-0.5">
                  Page 1: Executive Management Summary &amp; SLA Eligibility Logic Standard
                </p>
              </div>
              <div className="text-right border-l border-slate-700 pl-4">
                <p className="text-xs font-bold text-blue-400">Date: {new Date().toLocaleDateString()}</p>
                <p className="text-[11px] font-bold text-slate-200">
                  Station Filter: {selectedStationCode === "all" ? "All Service Stations" : selectedStationCode}
                </p>
                <p className="text-[10px] text-slate-400">Confidential Corporate Scorecard</p>
              </div>
            </div>

            {/* KPI Metric Cards Grid (3x3 Grid) */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Total Complaints Volume</span>
                <div className="text-2xl font-black text-slate-900 mt-1">{filteredComplaints.length}</div>
                <span className="text-[10px] font-bold text-slate-500">All registered complaints</span>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl">
                <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider block">Service Center Contacted (YES)</span>
                <div className="text-2xl font-black text-emerald-900 mt-1">{grandScContacted} <span className="text-xs font-bold text-emerald-700">({grandScContactedRate}%)</span></div>
                <span className="text-[10px] font-bold text-emerald-700">Actioned by station</span>
              </div>

              <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-xl">
                <span className="text-[10px] font-black text-blue-800 uppercase tracking-wider block">Call Center SLA Eligible Queue</span>
                <div className="text-2xl font-black text-blue-900 mt-1">{grandCcEligible}</div>
                <span className="text-[10px] font-bold text-blue-700">Service Center Contacted = YES</span>
              </div>

              <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl">
                <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider block">Excluded from Call Center SLA</span>
                <div className="text-2xl font-black text-amber-900 mt-1">{grandCcExcluded}</div>
                <span className="text-[10px] font-bold text-amber-700">Service Center Not Contacted</span>
              </div>

              <div className="bg-purple-50 border border-purple-200 p-3.5 rounded-xl">
                <span className="text-[10px] font-black text-purple-800 uppercase tracking-wider block">Total Resolved Cases</span>
                <div className="text-2xl font-black text-purple-900 mt-1">{grandResolved} <span className="text-xs font-bold text-purple-700">({grandResolutionRate})</span></div>
                <span className="text-[10px] font-bold text-purple-700">Cases completed</span>
              </div>

              <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-xl">
                <span className="text-[10px] font-black text-rose-800 uppercase tracking-wider block">Pending &amp; Escalated Cases</span>
                <div className="text-2xl font-black text-rose-900 mt-1">{grandPending + grandEscalated}</div>
                <span className="text-[10px] font-bold text-rose-700">{grandPending} Pending / {grandEscalated} Escalated</span>
              </div>

              <div className="bg-blue-900 text-white p-3.5 rounded-xl border border-blue-800">
                <span className="text-[10px] font-black text-blue-300 uppercase tracking-wider block">Call Center SLA Achievement %</span>
                <div className="text-2xl font-black text-white mt-1">{grandCcSlaRate}%</div>
                <span className="text-[10px] text-blue-200">On-Time &lt;= 24h (Eligible Cases Only)</span>
              </div>

              <div className="bg-slate-900 text-white p-3.5 rounded-xl border border-slate-800">
                <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider block">Avg Service Center Contact Speed</span>
                <div className="text-2xl font-black text-white mt-1">{overallReportAging.avgDaysStationContact} <span className="text-xs text-slate-400 font-normal">Days</span></div>
                <span className="text-[10px] text-slate-300">Registration &rarr; SC Contact</span>
              </div>

              <div className="bg-slate-900 text-white p-3.5 rounded-xl border border-slate-800">
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider block">Avg Total Resolution Speed</span>
                <div className="text-2xl font-black text-white mt-1">{overallReportAging.avgDaysToSolveCase} <span className="text-xs text-slate-400 font-normal">Days</span></div>
                <span className="text-[10px] text-slate-300">Registration &rarr; Final Solution</span>
              </div>
            </div>

            {/* SLA ELIGIBILITY FLOWCHART GRAPHIC (REQUIREMENT 7) */}
            <div className="border border-slate-200 rounded-2xl p-5 bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
              <div className="flex items-center justify-between mb-3 border-b pb-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <span className="p-1 bg-blue-600 text-white rounded">
                    <ShieldAlert className="h-3.5 w-3.5" />
                  </span>
                  SLA Eligibility Decision Flowchart Architecture
                </h3>
                <span className="text-[10px] font-mono font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded border border-blue-200">
                  Rule Standard: Service Center Contact Filter
                </span>
              </div>

              {/* Visual Flowchart Elements */}
              <div className="flex flex-col items-center space-y-3 my-2">
                {/* Node 1: Total Volume */}
                <div className="w-full max-w-lg bg-slate-900 text-white p-2.5 rounded-xl text-center shadow-sm border border-slate-800">
                  <span className="text-[10px] text-blue-400 font-black uppercase tracking-wider block">1. Total Customer Complaints Received</span>
                  <span className="text-sm font-black">{filteredComplaints.length} Total Complaints in System Database</span>
                </div>

                {/* Arrow */}
                <div className="text-blue-600 font-black text-lg">&darr;</div>

                {/* Node 2: Decision Node */}
                <div className="w-full max-w-lg bg-blue-50 border-2 border-blue-300 p-2.5 rounded-xl text-center">
                  <span className="text-[10px] text-blue-900 font-black uppercase tracking-wider block">2. Service Center Contacted Status Filter Check</span>
                  <span className="text-xs font-bold text-slate-800">Has the Service Center contacted or actioned the customer?</span>
                </div>

                {/* Split Arrows */}
                <div className="grid grid-cols-2 gap-8 w-full max-w-2xl">
                  {/* Branch YES */}
                  <div className="flex flex-col items-center">
                    <div className="text-emerald-600 font-black text-xs uppercase bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300 mb-1">
                      YES (Service Center Contacted = YES) &darr;
                    </div>
                    <div className="bg-emerald-50 border-2 border-emerald-400 p-3 rounded-xl w-full text-center">
                      <span className="text-[10px] text-emerald-900 font-black uppercase block">Included in Call Center SLA</span>
                      <span className="text-sm font-black text-emerald-950 block">{grandCcEligible} Eligible Cases ({grandScContactedRate}%)</span>
                      <p className="text-[10px] text-emerald-800 mt-1">Included in Call Center SLA denominator &amp; achievement score ({grandCcSlaRate}% On-Time)</p>
                    </div>
                  </div>

                  {/* Branch NO */}
                  <div className="flex flex-col items-center">
                    <div className="text-amber-800 font-black text-xs uppercase bg-amber-100 px-3 py-1 rounded-full border border-amber-300 mb-1">
                      NO / BLANK (Not Contacted) &darr;
                    </div>
                    <div className="bg-amber-50 border-2 border-amber-300 p-3 rounded-xl w-full text-center">
                      <span className="text-[10px] text-amber-900 font-black uppercase block">Excluded from Call Center SLA</span>
                      <span className="text-sm font-black text-amber-950 block">{grandCcExcluded} Excluded Cases</span>
                      <p className="text-[10px] text-amber-800 mt-1">Excluded from SLA denominator. Retained in full table for operational tracking.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Page 1 */}
          <div className="border-t border-slate-200 pt-3 flex items-center justify-between text-[10px] text-slate-400 font-semibold">
            <span>Ideal Customer Experience Recovery Engine &bull; Management Summary</span>
            <span>Confidential Enterprise Report &bull; Page 1 of 4</span>
          </div>
        </div>

        {/* ================= PAGE 2: COMPLETE SERVICE STATION TABLE ================= */}
        <div
          className="executive-pdf-page bg-white p-8 border border-slate-200 text-slate-900 flex flex-col justify-between"
          style={{ width: "1122px", minHeight: "793px", boxSizing: "border-box" }}
        >
          <div>
            {/* Header Bar Page 2 */}
            <div className="bg-slate-900 text-white p-4 rounded-xl mb-4 flex items-center justify-between border-b-4 border-blue-600">
              <div>
                <h2 className="text-lg font-black uppercase tracking-wider text-white">
                  COMPLETE SERVICE STATION SLA PERFORMANCE MATRIX
                </h2>
                <p className="text-xs text-slate-300 font-medium">
                  Page 2: Full Service Station Breakdown (All Service Stations &amp; Operational Metrics)
                </p>
              </div>
              <div className="text-right">
                <span className="bg-blue-600 text-white text-[10px] font-black uppercase px-2.5 py-1 rounded">
                  All 12 Columns Included
                </span>
              </div>
            </div>

            {/* Full Width Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden mb-4">
              <table className="w-full text-left border-collapse text-[10px]">
                <thead>
                  <tr className="bg-slate-900 text-white font-black uppercase text-[8.5px] border-b border-slate-800">
                    <th className="py-2.5 px-3">Service Station</th>
                    <th className="py-2.5 px-2 text-center">Total</th>
                    <th className="py-2.5 px-2 text-center text-emerald-300">Resolved</th>
                    <th className="py-2.5 px-2 text-center text-amber-300">Pending</th>
                    <th className="py-2.5 px-2 text-center text-rose-300">Escalated</th>
                    <th className="py-2.5 px-2 text-center text-emerald-400">0-3d</th>
                    <th className="py-2.5 px-2 text-center text-amber-400">3-5d</th>
                    <th className="py-2.5 px-2 text-center text-orange-400">6-10d</th>
                    <th className="py-2.5 px-2 text-center text-rose-400">&gt;10d</th>
                    <th className="py-2.5 px-2 text-center text-blue-300">Avg SC Contact</th>
                    <th className="py-2.5 px-2 text-center text-indigo-300">Avg CC Contact</th>
                    <th className="py-2.5 px-2 text-center text-emerald-300">Avg Solve Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {stationMetrics.map((sm, idx) => (
                    <tr key={sm.code} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/70"}>
                      <td className="py-2 px-3">
                        <span className="font-bold text-slate-900 block">{sm.name}</span>
                        <span className="text-[8.5px] font-mono text-slate-500">{sm.code}</span>
                      </td>
                      <td className="py-2 px-2 text-center font-black text-slate-900">{sm.total}</td>
                      <td className="py-2 px-2 text-center font-bold text-emerald-700">{sm.resolved}</td>
                      <td className="py-2 px-2 text-center font-bold text-amber-700">{sm.pending}</td>
                      <td className="py-2 px-2 text-center font-bold text-rose-700">{sm.escalated}</td>
                      <td className="py-2 px-2 text-center font-bold text-emerald-600">{sm.days0_3 || "—"}</td>
                      <td className="py-2 px-2 text-center font-bold text-amber-600">{sm.days3_5 || "—"}</td>
                      <td className="py-2 px-2 text-center font-bold text-orange-600">{sm.days6_10 || "—"}</td>
                      <td className="py-2 px-2 text-center font-bold text-rose-600">{sm.days10Plus || "—"}</td>
                      <td className="py-2 px-2 text-center font-semibold text-blue-800">{sm.avgDaysStationContact}d</td>
                      <td className="py-2 px-2 text-center font-semibold text-indigo-800">{sm.avgDaysCallCenterContact}d</td>
                      <td className="py-2 px-2 text-center font-semibold text-emerald-800">{sm.avgDaysToSolveCase}d</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-900 text-white font-black text-[9.5px]">
                    <td className="py-2.5 px-3 uppercase">OVERALL SUMMARY / GRAND TOTAL</td>
                    <td className="py-2.5 px-2 text-center text-white">{grandTotal}</td>
                    <td className="py-2.5 px-2 text-center text-emerald-400">{grandResolved}</td>
                    <td className="py-2.5 px-2 text-center text-amber-400">{grandPending}</td>
                    <td className="py-2.5 px-2 text-center text-rose-400">{grandEscalated}</td>
                    <td className="py-2.5 px-2 text-center text-emerald-400">{grandDays0_3}</td>
                    <td className="py-2.5 px-2 text-center text-amber-400">{grandDays3_5}</td>
                    <td className="py-2.5 px-2 text-center text-orange-400">{grandDays6_10}</td>
                    <td className="py-2.5 px-2 text-center text-rose-400">{grandDays10Plus}</td>
                    <td className="py-2.5 px-2 text-center text-blue-300">{overallReportAging.avgDaysStationContact}d</td>
                    <td className="py-2.5 px-2 text-center text-indigo-300">{overallReportAging.avgDaysCallCenterContact}d</td>
                    <td className="py-2.5 px-2 text-center text-emerald-300">{overallReportAging.avgDaysToSolveCase}d</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Footer Page 2 */}
          <div className="border-t border-slate-200 pt-3 flex items-center justify-between text-[10px] text-slate-400 font-semibold">
            <span>Ideal Customer Experience Recovery Engine &bull; Station Scorecard Matrix</span>
            <span>Confidential Enterprise Report &bull; Page 2 of 4</span>
          </div>
        </div>

        {/* ================= PAGE 3: SLA GRAPHICS & CHARTS ================= */}
        <div
          className="executive-pdf-page bg-white p-8 border border-slate-200 text-slate-900 flex flex-col justify-between"
          style={{ width: "1122px", minHeight: "793px", boxSizing: "border-box" }}
        >
          <div>
            {/* Header Bar Page 3 */}
            <div className="bg-slate-900 text-white p-4 rounded-xl mb-4 flex items-center justify-between border-b-4 border-blue-600">
              <div>
                <h2 className="text-lg font-black uppercase tracking-wider text-white">
                  EXECUTIVE SLA PERFORMANCE &amp; ANALYTICS CHARTS
                </h2>
                <p className="text-xs text-slate-300 font-medium">
                  Page 3: Visual Analytics (Volume Distribution, SLA Meters, Aging Buckets, Contact Qualification)
                </p>
              </div>
              <div className="text-right">
                <span className="bg-blue-600 text-white text-[10px] font-black uppercase px-2.5 py-1 rounded">
                  6 Management Charts
                </span>
              </div>
            </div>

            {/* Grid of 6 Analytics Cards */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              {/* Chart 1: Case Volume by Station */}
              <div className="border border-slate-200 p-4 rounded-xl bg-slate-50">
                <h4 className="text-xs font-black uppercase text-slate-800 mb-2">1. Total Case Volume by Service Station</h4>
                <div className="space-y-1.5">
                  {stationMetrics.map((sm) => {
                    const pct = grandTotal > 0 ? Math.round((sm.total / grandTotal) * 100) : 0;
                    return (
                      <div key={sm.code} className="text-[10px]">
                        <div className="flex justify-between font-bold text-slate-700">
                          <span>{sm.name}</span>
                          <span>{sm.total} cases ({pct}%)</span>
                        </div>
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mt-0.5">
                          <div className="bg-blue-600 h-full rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Chart 2: Resolution Status Ratio */}
              <div className="border border-slate-200 p-4 rounded-xl bg-slate-50">
                <h4 className="text-xs font-black uppercase text-slate-800 mb-2">2. Case Resolution Progress Velocity</h4>
                <div className="space-y-2">
                  <div className="text-[10px] font-bold text-slate-700 flex justify-between">
                    <span>Resolved: {grandResolved}</span>
                    <span>Pending: {grandPending}</span>
                    <span>Escalated: {grandEscalated}</span>
                  </div>
                  <div className="w-full bg-slate-200 h-4 rounded-lg overflow-hidden flex">
                    <div className="bg-emerald-500 h-full" style={{ width: `${grandTotal > 0 ? (grandResolved/grandTotal)*100 : 0}%` }} title="Resolved" />
                    <div className="bg-amber-400 h-full" style={{ width: `${grandTotal > 0 ? (grandPending/grandTotal)*100 : 0}%` }} title="Pending" />
                    <div className="bg-rose-500 h-full" style={{ width: `${grandTotal > 0 ? (grandEscalated/grandTotal)*100 : 0}%` }} title="Escalated" />
                  </div>
                  <div className="flex text-[9px] gap-3 font-semibold text-slate-600 mt-2">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-emerald-500 rounded" /> Resolved ({grandResolutionRate})</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-amber-400 rounded" /> Pending ({grandTotal > 0 ? Math.round((grandPending/grandTotal)*100) : 0}%)</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-rose-500 rounded" /> Escalated ({grandTotal > 0 ? Math.round((grandEscalated/grandTotal)*100) : 0}%)</span>
                  </div>
                </div>
              </div>

              {/* Chart 3: Call Center SLA Performance % by Station */}
              <div className="border border-slate-200 p-4 rounded-xl bg-slate-50">
                <h4 className="text-xs font-black uppercase text-slate-800 mb-2">3. Call Center SLA Achievement Meter</h4>
                <div className="space-y-1.5">
                  {stationMetrics.map((sm) => (
                    <div key={sm.code} className="text-[10px]">
                      <div className="flex justify-between font-bold text-slate-700">
                        <span>{sm.name}</span>
                        <span className={sm.ccSlaAchievementRate >= 80 ? "text-emerald-700 font-extrabold" : "text-amber-700 font-extrabold"}>
                          {sm.ccSlaAchievementRate}% On-Time ({sm.ccEligibleCount} Eligible)
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mt-0.5">
                        <div
                          className={sm.ccSlaAchievementRate >= 80 ? "bg-emerald-500 h-full rounded-full" : "bg-amber-500 h-full rounded-full"}
                          style={{ width: `${sm.ccSlaAchievementRate}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chart 4: Aging SLA Distribution */}
              <div className="border border-slate-200 p-4 rounded-xl bg-slate-50">
                <h4 className="text-xs font-black uppercase text-slate-800 mb-2">4. Overall Case Aging SLA Distribution</h4>
                <div className="space-y-2">
                  <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
                    <div className="bg-emerald-100 p-2 rounded border border-emerald-300">
                      <span className="font-bold text-emerald-900 block">0–3 Days</span>
                      <span className="text-lg font-black text-emerald-950">{grandDays0_3}</span>
                    </div>
                    <div className="bg-amber-100 p-2 rounded border border-amber-300">
                      <span className="font-bold text-amber-900 block">3–5 Days</span>
                      <span className="text-lg font-black text-amber-950">{grandDays3_5}</span>
                    </div>
                    <div className="bg-orange-100 p-2 rounded border border-orange-300">
                      <span className="font-bold text-orange-900 block">6–10 Days</span>
                      <span className="text-lg font-black text-orange-950">{grandDays6_10}</span>
                    </div>
                    <div className="bg-rose-100 p-2 rounded border border-rose-300">
                      <span className="font-bold text-rose-900 block">&gt;10 Days</span>
                      <span className="text-lg font-black text-rose-950">{grandDays10Plus}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Chart 5: SC Contacted vs Not Contacted */}
              <div className="border border-slate-200 p-4 rounded-xl bg-slate-50">
                <h4 className="text-xs font-black uppercase text-slate-800 mb-2">5. Service Center Contact Qualification Rate</h4>
                <div className="flex items-center gap-4 text-xs font-bold my-2">
                  <div className="bg-emerald-100 border border-emerald-300 p-3 rounded-xl flex-1 text-center">
                    <span className="text-emerald-900 block text-[10px] font-black uppercase">SC Contacted = YES</span>
                    <span className="text-xl font-black text-emerald-950">{grandScContacted} Cases</span>
                    <span className="text-[10px] text-emerald-800 block font-semibold">{grandScContactedRate}% of total workload</span>
                  </div>
                  <div className="bg-amber-100 border border-amber-300 p-3 rounded-xl flex-1 text-center">
                    <span className="text-amber-900 block text-[10px] font-black uppercase">SC Contacted = NO</span>
                    <span className="text-xl font-black text-amber-950">{grandCcExcluded} Cases</span>
                    <span className="text-[10px] text-amber-800 block font-semibold">{100 - grandScContactedRate}% excluded from CC SLA</span>
                  </div>
                </div>
              </div>

              {/* Chart 6: CC SLA Eligible Flow */}
              <div className="border border-slate-200 p-4 rounded-xl bg-slate-50">
                <h4 className="text-xs font-black uppercase text-slate-800 mb-2">6. Call Center SLA Eligible vs Excluded Ratio</h4>
                <div className="space-y-2 text-[10px]">
                  <div className="flex justify-between font-bold text-slate-700">
                    <span>Eligible: {grandCcEligible} ({grandScContactedRate}%)</span>
                    <span>Excluded: {grandCcExcluded} ({100 - grandScContactedRate}%)</span>
                  </div>
                  <div className="w-full bg-amber-300 h-4 rounded-lg overflow-hidden flex">
                    <div className="bg-blue-600 h-full" style={{ width: `${grandScContactedRate}%` }} />
                  </div>
                  <p className="text-[9px] text-slate-500 font-semibold mt-1">
                    Call Center SLA denominator includes ONLY cases where Service Center Contacted = YES.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Page 3 */}
          <div className="border-t border-slate-200 pt-3 flex items-center justify-between text-[10px] text-slate-400 font-semibold">
            <span>Ideal Customer Experience Recovery Engine &bull; Executive SLA Analytics</span>
            <span>Confidential Enterprise Report &bull; Page 3 of 4</span>
          </div>
        </div>

        {/* ================= PAGE 4: SELECTED STATION DETAILS ================= */}
        <div
          className="executive-pdf-page bg-white p-8 border border-slate-200 text-slate-900 flex flex-col justify-between"
          style={{ width: "1122px", minHeight: "793px", boxSizing: "border-box" }}
        >
          <div>
            {/* Header Bar Page 4 */}
            <div className="bg-slate-900 text-white p-4 rounded-xl mb-4 flex items-center justify-between border-b-4 border-blue-600">
              <div>
                <h2 className="text-lg font-black uppercase tracking-wider text-white">
                  DETAILED SERVICE STATION DEEP DIVE ANALYSIS
                </h2>
                <p className="text-xs text-slate-300 font-medium">
                  Page 4: Focused Operational &amp; Customer Satisfaction Metrics for Selected Center
                </p>
              </div>
              <div className="text-right">
                <span className="bg-blue-600 text-white text-[11px] font-black uppercase px-3 py-1 rounded">
                  Station: {selectedStationCode === "all" ? "All Service Stations Overview" : selectedStationCode}
                </span>
              </div>
            </div>

            {/* Selected Station Detailed Analysis Grid */}
            <div className="grid grid-cols-3 gap-4 mb-5">
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
                <span className="text-[10px] font-black uppercase text-slate-500 block mb-1">Station Complaint Volume</span>
                <div className="text-3xl font-black text-slate-900">{totalInScope}</div>
                <span className="text-[10px] font-bold text-slate-500">Total complaints assigned</span>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
                <span className="text-[10px] font-black uppercase text-emerald-800 block mb-1">Service Center Contact Rate</span>
                <div className="text-3xl font-black text-emerald-900">
                  {totalInScope > 0 ? Math.round((activeScopeComplaints.filter(c => isStationContacted(c)).length / totalInScope) * 100) : 0}%
                </div>
                <span className="text-[10px] font-bold text-emerald-700">
                  {activeScopeComplaints.filter(c => isStationContacted(c)).length} of {totalInScope} contacted
                </span>
              </div>

              <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl">
                <span className="text-[10px] font-black uppercase text-blue-800 block mb-1">Call Center SLA Achievement</span>
                <div className="text-3xl font-black text-blue-900">
                  {(() => {
                    const eligible = activeScopeComplaints.filter(c => isStationContacted(c));
                    const met = eligible.filter(c => !getCallCenterSLAStatus(c).isBreached).length;
                    return eligible.length > 0 ? `${Math.round((met / eligible.length) * 100)}%` : "100%";
                  })()}
                </div>
                <span className="text-[10px] font-bold text-blue-700">Evaluated on SC Contacted = YES cases</span>
              </div>
            </div>

            {/* Operational Speed & Aging Summary */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="border border-slate-200 p-4 rounded-xl bg-slate-50">
                <h4 className="text-xs font-black uppercase text-slate-800 mb-3">Speed &amp; Resolution Velocity Benchmarks</h4>
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="font-bold text-slate-600">Avg Service Station Contact Speed:</span>
                    <span className="font-black text-slate-900">{overallReportAging.avgDaysStationContact} Working Days</span>
                  </div>
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="font-bold text-slate-600">Avg Call Center Verification Speed:</span>
                    <span className="font-black text-slate-900">{overallReportAging.avgDaysCallCenterContact} Working Days</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-600">Average Total Case Solve Speed:</span>
                    <span className="font-black text-emerald-700">{overallReportAging.avgDaysToSolveCase} Working Days</span>
                  </div>
                </div>
              </div>

              <div className="border border-slate-200 p-4 rounded-xl bg-slate-50">
                <h4 className="text-xs font-black uppercase text-slate-800 mb-3">Customer Satisfaction &amp; Feedback Breakdown</h4>
                <div className="space-y-2 text-xs font-bold">
                  <div className="flex justify-between items-center bg-emerald-100 text-emerald-900 p-2 rounded">
                    <span>Satisfied / Resolution Accepted</span>
                    <span>{activeScopeComplaints.filter(c => c.feedbackStatus === "Satisfied" || c.currentSatisfaction === "Satisfied").length} Cases</span>
                  </div>
                  <div className="flex justify-between items-center bg-amber-100 text-amber-900 p-2 rounded">
                    <span>Follow-Up / Solution In Progress</span>
                    <span>{activeScopeComplaints.filter(c => c.status === "In Progress" || c.status === "Contacted").length} Cases</span>
                  </div>
                  <div className="flex justify-between items-center bg-rose-100 text-rose-900 p-2 rounded">
                    <span>Unresolved / Escalated</span>
                    <span>{activeScopeComplaints.filter(c => c.stationResponseStatus === "Rejected" || c.feedbackStatus === "Escalated").length} Cases</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Operational Notes */}
            <div className="bg-slate-900 text-white p-4 rounded-xl text-xs">
              <span className="text-[10px] font-black text-blue-400 uppercase tracking-wider block mb-1">Management Performance Audit Note</span>
              <p className="text-slate-300 leading-relaxed font-normal">
                All calculations presented in this executive report strictly follow the Service Center Contact SLA Eligibility Standard.
                Cases where <span className="text-emerald-400 font-bold">Service Center Contacted = YES</span> are evaluated for Call Center SLA turn-around time.
                Uncontacted or pending cases remain fully visible across database tables for operational tracking and audit history.
              </p>
            </div>
          </div>

          {/* Footer Page 4 */}
          <div className="border-t border-slate-200 pt-3 flex items-center justify-between text-[10px] text-slate-400 font-semibold">
            <span>Ideal Customer Experience Recovery Engine &bull; Deep Dive Report</span>
            <span>Confidential Enterprise Report &bull; Page 4 of 4</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* INTERACTIVE SCORECARD METRIC DRILL-DOWN MODAL */}
      {/* ========================================================================= */}
      {drilldown && drilldown.isOpen && (
        <div 
          id="scorecard-drilldown-modal-backdrop"
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200"
          onClick={() => setDrilldown(null)}
        >
          <div 
            id="scorecard-drilldown-modal"
            className={`w-full max-w-6xl max-h-[92vh] flex flex-col rounded-2xl shadow-2xl border overflow-hidden ${
              isDark ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-200 text-slate-900"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className={`p-4 sm:p-5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              isDark ? "border-slate-800 bg-slate-950/60" : "border-slate-200 bg-slate-50/80"
            }`}>
              <div className="flex items-start sm:items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {drilldown.stationCode}
                    </span>
                    <h2 className="text-base sm:text-lg font-black tracking-tight">
                      {drilldown.stationName} &bull; {drilldown.metricLabel}
                    </h2>
                    <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-blue-600 text-white shadow-2xs">
                      {drilldown.complaints.length} Case{drilldown.complaints.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Live operational drill-down view of all matching complaint records contributing to this scorecard metric.
                  </p>
                </div>
              </div>

              {/* Action Buttons & Close */}
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={handleExportDrilldownCSV}
                  className="px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-2xs"
                  title="Export this filtered list as a CSV spreadsheet"
                >
                  <Download className="h-3.5 w-3.5 text-slate-500" />
                  <span>Export CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDrilldown(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  title="Close modal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Quick Metrics Bar & Search */}
            <div className={`px-4 sm:px-5 py-3 border-b flex flex-col md:flex-row md:items-center justify-between gap-3 ${
              isDark ? "border-slate-800/80 bg-slate-900/50" : "border-slate-100 bg-slate-50/50"
            }`}>
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter by ID, Customer, Phone, Vehicle, WO, Category..."
                  value={drilldownSearch}
                  onChange={(e) => setDrilldownSearch(e.target.value)}
                  className={`w-full pl-9 pr-8 py-1.5 text-xs rounded-lg border outline-hidden transition-all ${
                    isDark 
                      ? "bg-slate-950 border-slate-800 focus:border-blue-500 text-slate-200 placeholder-slate-500" 
                      : "bg-white border-slate-200 focus:border-blue-500 text-slate-800 placeholder-slate-400 shadow-2xs"
                  }`}
                />
                {drilldownSearch && (
                  <button
                    type="button"
                    onClick={() => setDrilldownSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Summary Stats Chips */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold text-slate-500 dark:text-slate-400">
                  Showing: <strong className="text-slate-900 dark:text-slate-100">{filteredDrilldownComplaints.length}</strong> of {drilldown.complaints.length} records
                </span>
                {drilldown.complaints.length > 0 && (
                  <>
                    <span className="text-slate-300 dark:text-slate-700">&bull;</span>
                    <span className="px-2 py-0.5 rounded-md font-bold text-[11px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                      {drilldown.complaints.filter(c => c.status === "Resolved" || c.feedbackStatus === "Satisfied").length} Resolved
                    </span>
                    <span className="px-2 py-0.5 rounded-md font-bold text-[11px] bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                      {drilldown.complaints.filter(c => c.status !== "Resolved" && c.feedbackStatus !== "Satisfied").length} Outstanding
                    </span>
                    <span className="px-2 py-0.5 rounded-md font-bold text-[11px] bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
                      {drilldown.complaints.filter(c => isStationContacted(c)).length} SC Contacted
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Modal Body: Complaints Table */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
              {filteredDrilldownComplaints.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <AlertCircle className="h-10 w-10 mx-auto mb-2 opacity-40 text-slate-500" />
                  <p className="text-sm font-bold">No complaints match the filter criteria</p>
                  <p className="text-xs text-slate-500 mt-1">Try clearing your search query to view all records in this metric.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className={`border-b text-[10px] font-black uppercase tracking-wider ${
                        isDark ? "border-slate-800 bg-slate-950/80 text-slate-400" : "border-slate-200 bg-slate-50 text-slate-600"
                      }`}>
                        <th className="py-2.5 px-3">Complaint ID &amp; WO</th>
                        <th className="py-2.5 px-3">Customer Information</th>
                        <th className="py-2.5 px-3">Vehicle / Model</th>
                        <th className="py-2.5 px-3">Category &amp; Issue Preview</th>
                        <th className="py-2.5 px-3 text-center">Aging Days</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3 text-center">SC Contacted</th>
                        <th className="py-2.5 px-3 text-center">Date Received</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDark ? "divide-slate-800/80" : "divide-slate-100"}`}>
                      {filteredDrilldownComplaints.map((c) => {
                        const aging = getComplaintAging(c);
                        const isOver10 = aging.days > 10;
                        const isStationCont = isStationContacted(c);

                        return (
                          <tr 
                            key={c.id} 
                            className={`transition-colors ${
                              isDark ? "hover:bg-slate-800/40" : "hover:bg-slate-50/80"
                            }`}
                          >
                            {/* ID & WO */}
                            <td className="py-3 px-3">
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-black text-blue-600 dark:text-blue-400">
                                    {c.id}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyText(c.id, `id-${c.id}`)}
                                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-0.5"
                                    title="Copy Complaint ID"
                                  >
                                    {copiedId === `id-${c.id}` ? (
                                      <Check className="h-3 w-3 text-emerald-500" />
                                    ) : (
                                      <Copy className="h-3 w-3" />
                                    )}
                                  </button>
                                </div>
                                {c.woNo && (
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    WO: {c.woNo}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Customer Info */}
                            <td className="py-3 px-3">
                              <div className="flex flex-col gap-0.5">
                                <span className="font-bold text-slate-900 dark:text-slate-100">
                                  {c.customerName}
                                </span>
                                <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                                  <Phone className="h-3 w-3 text-slate-400" />
                                  <span>{c.customerPhone}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyText(c.customerPhone, `phone-${c.id}`)}
                                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-0.5"
                                    title="Copy Phone Number"
                                  >
                                    {copiedId === `phone-${c.id}` ? (
                                      <Check className="h-3 w-3 text-emerald-500" />
                                    ) : (
                                      <Copy className="h-3 w-3" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            </td>

                            {/* Vehicle / Model */}
                            <td className="py-3 px-3">
                              <div className="flex flex-col gap-0.5">
                                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                  {c.vehicleRegNo || "N/A"}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {c.model || c.vehicleModel || "Vehicle Record"}
                                </span>
                              </div>
                            </td>

                            {/* Category & Issue Preview */}
                            <td className="py-3 px-3 max-w-xs">
                              <div className="space-y-1">
                                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                  {c.category}
                                </span>
                                <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 italic" title={c.description}>
                                  "{c.description}"
                                </p>
                              </div>
                            </td>

                            {/* Aging Days */}
                            <td className="py-3 px-3 text-center">
                              <span className={`inline-flex items-center gap-1 font-black px-2.5 py-1 rounded-md text-xs border ${
                                isOver10
                                  ? "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 animate-pulse"
                                  : aging.days > 5
                                    ? "bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-800"
                                    : aging.days > 3
                                      ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                                      : "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                              }`}>
                                {isOver10 && <span className="text-[10px]">🔥</span>}
                                {aging.days} {aging.days === 1 ? "day" : "days"}
                              </span>
                            </td>

                            {/* Status */}
                            <td className="py-3 px-3 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                  c.status === "Resolved" || c.feedbackStatus === "Satisfied"
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                    : isComplaintRejected(c)
                                      ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                                      : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                }`}>
                                  {c.status}
                                </span>
                                {c.feedbackStatus && (
                                  <span className="text-[9px] text-slate-500 font-medium">
                                    {c.feedbackStatus}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* SC Contacted */}
                            <td className="py-3 px-3 text-center">
                              <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                isStationCont 
                                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800" 
                                  : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                              }`}>
                                {isStationCont ? "YES" : "NO"}
                              </span>
                              {c.stationContactedDate && (
                                <span className="block text-[9px] text-slate-400 mt-0.5">
                                  {c.stationContactedDate}
                                </span>
                              )}
                            </td>

                            {/* Date Received */}
                            <td className="py-3 px-3 text-center text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                              {c.date}
                            </td>

                            {/* Actions */}
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setActiveDetailComplaint(c)}
                                  className="px-2 py-1 rounded text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                                  title="Inspect full technical complaint details"
                                >
                                  <Eye className="h-3 w-3" />
                                  <span>Inspect</span>
                                </button>

                                {onSelectComplaintInWorkspace && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onSelectComplaintInWorkspace(c.id);
                                      setDrilldown(null);
                                    }}
                                    className="px-2 py-1 rounded text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                                    title="Open and edit complaint in main Workspace"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    <span>Workspace</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className={`p-4 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
              isDark ? "border-slate-800 bg-slate-950/60 text-slate-400" : "border-slate-200 bg-slate-50/80 text-slate-600"
            }`}>
              <div className="flex items-center gap-2">
                <span className="font-bold">Total In Metric Scope:</span>
                <strong className="text-slate-900 dark:text-slate-100">{drilldown.complaints.length} complaints</strong>
              </div>
              <button
                type="button"
                onClick={() => setDrilldown(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold transition-colors cursor-pointer self-end sm:self-auto"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SINGLE COMPLAINT INSPECTOR SUB-MODAL */}
      {/* ========================================================================= */}
      {activeDetailComplaint && (
        <div 
          id="complaint-detail-inspector-backdrop"
          className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150"
          onClick={() => setActiveDetailComplaint(null)}
        >
          <div 
            id="complaint-detail-inspector-modal"
            className={`w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl border overflow-hidden ${
              isDark ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-200 text-slate-900"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`p-4 border-b flex items-center justify-between ${
              isDark ? "border-slate-800 bg-slate-950/80" : "border-slate-200 bg-slate-50"
            }`}>
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-sm bg-blue-600 text-white px-2 py-0.5 rounded">
                  {activeDetailComplaint.id}
                </span>
                <h3 className="font-black text-sm sm:text-base">
                  Complaint Record Details
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveDetailComplaint(null)}
                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
              {/* Customer & Vehicle Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className={`p-3 rounded-xl border ${isDark ? "border-slate-800 bg-slate-950/40" : "border-slate-100 bg-slate-50"}`}>
                  <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Customer Details</span>
                  <p className="font-bold text-sm text-slate-900 dark:text-slate-100">{activeDetailComplaint.customerName}</p>
                  <p className="text-slate-500 font-mono mt-0.5 flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {activeDetailComplaint.customerPhone}
                  </p>
                  {activeDetailComplaint.customerEmail && (
                    <p className="text-slate-500 mt-0.5">{activeDetailComplaint.customerEmail}</p>
                  )}
                </div>

                <div className={`p-3 rounded-xl border ${isDark ? "border-slate-800 bg-slate-950/40" : "border-slate-100 bg-slate-50"}`}>
                  <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Vehicle &amp; Station</span>
                  <p className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100">{activeDetailComplaint.vehicleRegNo || "N/A"}</p>
                  <p className="text-slate-600 dark:text-slate-300 mt-0.5">{activeDetailComplaint.station}</p>
                  {activeDetailComplaint.woNo && (
                    <p className="text-slate-500 font-mono text-[10px] mt-0.5">WO: {activeDetailComplaint.woNo}</p>
                  )}
                </div>
              </div>

              {/* Status and Aging Overview */}
              <div className={`p-3 rounded-xl border grid grid-cols-2 sm:grid-cols-4 gap-2 text-center ${
                isDark ? "border-slate-800 bg-slate-950/40" : "border-slate-100 bg-slate-50"
              }`}>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">Status</span>
                  <span className="font-black text-slate-900 dark:text-slate-100">{activeDetailComplaint.status}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">Aging Days</span>
                  <span className={`font-black ${getComplaintAging(activeDetailComplaint).days > 10 ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-slate-100"}`}>
                    {getComplaintAging(activeDetailComplaint).days} Days
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">SC Contacted</span>
                  <span className="font-black text-blue-600 dark:text-blue-400">
                    {isStationContacted(activeDetailComplaint) ? "YES" : "NO"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">Feedback SLA</span>
                  <span className="font-black text-slate-900 dark:text-slate-100">
                    {activeDetailComplaint.feedbackStatus || "Pending"}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div className={`p-3 rounded-xl border ${isDark ? "border-slate-800 bg-slate-950/40" : "border-slate-100 bg-slate-50"}`}>
                <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Customer Issue Description</span>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed italic whitespace-pre-wrap">
                  "{activeDetailComplaint.description}"
                </p>
              </div>

              {/* Station Notes & Remarks */}
              {activeDetailComplaint.stationResolutionNotes && (
                <div className={`p-3 rounded-xl border ${isDark ? "border-slate-800 bg-slate-950/40" : "border-slate-100 bg-slate-50"}`}>
                  <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 block mb-1">Service Station Action / Resolution Notes</span>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {activeDetailComplaint.stationResolutionNotes}
                  </p>
                </div>
              )}

              {activeDetailComplaint.callCenterFinalRemarks && (
                <div className={`p-3 rounded-xl border ${isDark ? "border-slate-800 bg-slate-950/40" : "border-slate-100 bg-slate-50"}`}>
                  <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 block mb-1">Call Center Verification Remarks</span>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {activeDetailComplaint.callCenterFinalRemarks}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className={`p-4 border-t flex items-center justify-between gap-3 ${
              isDark ? "border-slate-800 bg-slate-950/80" : "border-slate-200 bg-slate-50"
            }`}>
              <button
                type="button"
                onClick={() => setActiveDetailComplaint(null)}
                className="px-4 py-1.5 rounded-lg border text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Back to List
              </button>

              {onSelectComplaintInWorkspace && (
                <button
                  type="button"
                  onClick={() => {
                    onSelectComplaintInWorkspace(activeDetailComplaint.id);
                    setActiveDetailComplaint(null);
                    setDrilldown(null);
                  }}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Open in Workspace</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
