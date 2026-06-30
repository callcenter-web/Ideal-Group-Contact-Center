import React, { useState } from "react";
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
  Activity
} from "lucide-react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { Complaint, StationProfile, SatisfactionLevel } from "../types";
import { STATIONS } from "../demoData";

interface ReportsPanelProps {
  complaints: Complaint[];
}

export default function ReportsPanel({ complaints }: ReportsPanelProps) {
  const [stationFilter, setStationFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [feedbackStatusFilter, setFeedbackStatusFilter] = useState<string>("all");
  const [satisfactionFilter, setSatisfactionFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isGeneratingPDF, setIsGeneratingPDF] = useState<boolean>(false);
  const [selectedStationCode, setSelectedStationCode] = useState<string>("Rathmalana");

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
    const start = new Date(startStr);
    const end = new Date(endStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    const diffTime = end.getTime() - start.getTime();
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  };

  // Helper: compute aging details for a single complaint
  const getComplaintAging = (c: Complaint) => {
    const todayStr = "2026-06-24"; // Consistent anchor date representing current system time
    let days = 0;
    
    if (c.status === "Resolved") {
      // Solved duration: from registration to final verification/contact
      const resolveDate = c.callCenterContactedDate || c.stationContactedDate || c.updatedAt || todayStr;
      days = getDaysDiff(c.date, resolveDate);
    } else {
      // Outstanding duration: from registration to today
      days = getDaysDiff(c.date, todayStr);
    }

    let colorClass = "";
    let textClass = "";
    let bgClass = "";
    let label = "";

    if (days <= 5) {
      colorClass = "border-emerald-200 text-emerald-700 bg-emerald-50";
      textClass = "text-emerald-600";
      bgClass = "bg-emerald-500";
      label = "0-5 Days (Green)";
    } else if (days <= 14) {
      colorClass = "border-amber-200 text-amber-700 bg-amber-50";
      textClass = "text-amber-600";
      bgClass = "bg-amber-500";
      label = "5-14 Days (Yellow)";
    } else {
      colorClass = "border-rose-200 text-rose-700 bg-rose-50";
      textClass = "text-rose-600";
      bgClass = "bg-rose-500";
      label = "14+ Days (Red)";
    }

    return { days, colorClass, textClass, bgClass, label };
  };

  // Unique categories for filtering
  const categories = Array.from(new Set(complaints.map((c) => c.category))).filter(Boolean);

  // Unique feedback status values for filtering
  const feedbackStatuses = Array.from(new Set(complaints.map((c) => c.feedbackStatus))).filter(Boolean);

  // Filter complaints based on selection
  const filteredComplaints = complaints.filter((c) => {
    const matchesStation = stationFilter === "all" || c.station === stationFilter;
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

  // Calculate high-level stats for the active filtered scope
  const totalInScope = filteredComplaints.length;
  
  let greenCount = 0;
  let yellowCount = 0;
  let redCount = 0;

  filteredComplaints.forEach((c) => {
    const { days } = getComplaintAging(c);
    if (days <= 5) greenCount++;
    else if (days <= 14) yellowCount++;
    else redCount++;
  });

  // Calculate Service Station Wise Metrics
  const stationMetrics = STATIONS.map((station) => {
    const stationComplaints = filteredComplaints.filter(c => c.station === station.code);
    const total = stationComplaints.length;
    const resolved = stationComplaints.filter(c => c.status === "Resolved").length;
    const pending = total - resolved;
    const rate = total > 0 ? Math.round((resolved / total) * 100) : 0;
    
    // Average aging
    let totalAgingDays = 0;
    stationComplaints.forEach((c) => {
      totalAgingDays += getComplaintAging(c).days;
    });
    const avgAging = total > 0 ? Math.round(totalAgingDays / total) : 0;

    let avgAgingColor = "text-emerald-600 font-bold bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded text-[10px]";
    if (avgAging > 5 && avgAging <= 14) avgAgingColor = "text-amber-600 font-bold bg-amber-50 border border-amber-100 px-2 py-0.5 rounded text-[10px]";
    else if (avgAging > 14) avgAgingColor = "text-rose-600 font-bold bg-rose-50 border border-rose-100 px-2 py-0.5 rounded text-[10px]";

    return {
      code: station.code,
      name: station.name,
      total,
      resolved,
      pending,
      rate,
      avgAging,
      avgAgingColor
    };
  });

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
        c.feedbackStatus || "Follow Up Required",
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
      "Total Complaints",
      "Resolved Complaints",
      "Pending/In-Progress Complaints",
      "Resolution Rate (%)",
      "Average Aging (Days)"
    ];

    const rows = stationMetrics.map((sm) => [
      sm.code,
      sm.name,
      sm.total.toString(),
      sm.resolved.toString(),
      sm.pending.toString(),
      `${sm.rate}%`,
      sm.avgAging.toString()
    ]);

    downloadCSV(headers, rows, `CX_Station_Performance_Report_${new Date().toISOString().split('T')[0]}.csv`);
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

  // Status Breakdown
  const statusLevels = ["Pending", "In Progress", "Contacted", "Resolved"];
  const statusCounts = statusLevels.reduce((acc, level) => {
    acc[level] = filteredComplaints.filter(c => c.status === level).length;
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
      pdf.rect(12, 37, 186, 22, "FD");

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      pdf.text("REPORT FILTER METADATA", 16, 42);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(51, 65, 85);
      pdf.text(`Station Filter:  ${stationFilter === "all" ? "All Service Stations" : stationFilter}`, 16, 47);
      pdf.text(`Category Filter: ${categoryFilter === "all" ? "All Categories" : categoryFilter}`, 16, 52);
      pdf.text(`Status Filter:   ${statusFilter === "all" ? "All Operational Statuses" : statusFilter}`, 90, 47);
      pdf.text(`Date Range:     ${startDate || "Beginning of time"} to ${endDate || "Today"}`, 90, 52);
      pdf.text(`Total Records:  ${totalInScope} complaints`, 150, 47);

      // 3 KPI Cards at Y=65
      const cardW = 58;
      const cardH = 22;
      const cardY = 64;

      // Card 1: Quick Resolution (Green)
      pdf.setFillColor(236, 253, 245);
      pdf.setDrawColor(167, 243, 208);
      pdf.rect(12, cardY, cardW, cardH, "FD");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(6, 95, 70);
      pdf.text("Quick (0-5 Days)", 16, cardY + 5);
      pdf.setFontSize(16);
      const greenPct = totalInScope > 0 ? Math.round((greenCount / totalInScope) * 100) : 0;
      pdf.text(`${greenCount}`, 16, cardY + 13);
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.text(`${greenPct}% of total complaints`, 16, cardY + 18);

      // Card 2: Standard Processing (Yellow)
      pdf.setFillColor(254, 243, 199);
      pdf.setDrawColor(253, 230, 138);
      pdf.rect(12 + cardW + 6, cardY, cardW, cardH, "FD");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(146, 64, 14);
      pdf.text("Standard (5-14 Days)", 12 + cardW + 10, cardY + 5);
      pdf.setFontSize(16);
      const yellowPct = totalInScope > 0 ? Math.round((yellowCount / totalInScope) * 100) : 0;
      pdf.text(`${yellowCount}`, 12 + cardW + 10, cardY + 13);
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.text(`${yellowPct}% of total complaints`, 12 + cardW + 10, cardY + 18);

      // Card 3: Critical Overdue (Red)
      pdf.setFillColor(254, 242, 242);
      pdf.setDrawColor(254, 202, 202);
      pdf.rect(12 + cardW * 2 + 12, cardY, cardW, cardH, "FD");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(153, 27, 27);
      pdf.text("Critical (14+ Days)", 12 + cardW * 2 + 16, cardY + 5);
      pdf.setFontSize(16);
      const redPct = totalInScope > 0 ? Math.round((redCount / totalInScope) * 100) : 0;
      pdf.text(`${redCount}`, 12 + cardW * 2 + 16, cardY + 13);
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.text(`${redPct}% high-priority overdue`, 12 + cardW * 2 + 16, cardY + 18);

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
      pdf.text("SLA AGING METRICS", 16, chartY + 6);
      pdf.line(16, chartY + 9, 12 + chartW - 4, chartY + 9);

      // Green bar
      pdf.setFontSize(7);
      pdf.setTextColor(71, 85, 105);
      pdf.text(`Quick (0-5 Days): ${greenCount} (${greenPct}%)`, 16, chartY + 16);
      pdf.setFillColor(241, 245, 249);
      pdf.rect(16, chartY + 18, 50, 4, "F");
      if (greenPct > 0) {
        pdf.setFillColor(16, 185, 129); // emerald-500
        pdf.rect(16, chartY + 18, (greenPct / 100) * 50, 4, "F");
      }

      // Yellow bar
      pdf.setTextColor(71, 85, 105);
      pdf.text(`Standard (5-14 Days): ${yellowCount} (${yellowPct}%)`, 16, chartY + 28);
      pdf.setFillColor(241, 245, 249);
      pdf.rect(16, chartY + 30, 50, 4, "F");
      if (yellowPct > 0) {
        pdf.setFillColor(245, 158, 11); // amber-500
        pdf.rect(16, chartY + 30, (yellowPct / 100) * 50, 4, "F");
      }

      // Red bar
      pdf.setTextColor(71, 85, 105);
      pdf.text(`Critical (14+ Days): ${redCount} (${redPct}%)`, 16, chartY + 40);
      pdf.setFillColor(241, 245, 249);
      pdf.rect(16, chartY + 42, 50, 4, "F");
      if (redPct > 0) {
        pdf.setFillColor(239, 68, 68); // red-500
        pdf.rect(16, chartY + 42, (redPct / 100) * 50, 4, "F");
      }

      // Small legend explanation
      pdf.setFontSize(7);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(148, 163, 184);
      pdf.text("Represents actual day differences", 16, chartY + 58);
      pdf.text("between data entry and resolution.", 16, chartY + 62);


      // CHART B: CSAT Breakdown (x=12+64=76)
      pdf.setFillColor(255, 255, 255);
      pdf.setDrawColor(226, 232, 240);
      pdf.rect(12 + chartW + 6, chartY, chartW, chartH, "FD");

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(30, 41, 59);
      pdf.text("CSAT BREAKDOWN", 12 + chartW + 10, chartY + 6);
      pdf.line(12 + chartW + 10, chartY + 9, 12 + chartW * 2 + 2, chartY + 9);

      pdf.setFontSize(7);
      const levels: SatisfactionLevel[] = ["Very Dissatisfied", "Dissatisfied", "Neutral", "Satisfied", "Very Satisfied"];
      levels.forEach((lvl, idx) => {
        const count = satisfactionCounts[lvl] || 0;
        const pct = totalInScope > 0 ? Math.round((count / totalInScope) * 100) : 0;
        const curY = chartY + 16 + idx * 11;
        
        pdf.setTextColor(71, 85, 105);
        pdf.text(`${lvl}: ${count} (${pct}%)`, 12 + chartW + 10, curY);
        
        pdf.setFillColor(241, 245, 249);
        pdf.rect(12 + chartW + 10, curY + 2, 50, 3, "F");
        
        if (pct > 0) {
          let col = [148, 163, 184]; // neutral gray
          if (lvl.includes("Very Satisfied")) col = [5, 150, 105]; // dark green
          else if (lvl.includes("Satisfied")) col = [16, 185, 129]; // green
          else if (lvl.includes("Very Dissatisfied")) col = [220, 38, 38]; // red
          else if (lvl.includes("Dissatisfied")) col = [245, 158, 11]; // orange
          
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
        `• Critical Overdue SLA alerts (> 14 days) are currently at ${redCount} unresolved cases.`,
        `• Customer satisfaction surveys indicate that ${satisfactionCounts["Very Satisfied"] + satisfactionCounts["Satisfied"]} customers are Satisfied/Very Satisfied,`,
        `  while ${satisfactionCounts["Very Dissatisfied"] + satisfactionCounts["Dissatisfied"]} customers remain Dissatisfied with the service station response.`,
        `• Average turnaround response speed: Quick Resolution (0-5 days) is achieved in ${greenPct}% of incoming logs.`,
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
      pdf.setFontSize(8);
      pdf.setTextColor(255, 255, 255);
      pdf.text("SERVICE STATION", 16, tableY + 5);
      pdf.text("LOCATION NAME", 45, tableY + 5);
      pdf.text("CASE COUNT", 105, tableY + 5, { align: "center" });
      pdf.text("RESOLVED", 130, tableY + 5, { align: "center" });
      pdf.text("RECOVERY RATE", 160, tableY + 5, { align: "center" });
      pdf.text("AVG SLA (DAYS)", 188, tableY + 5, { align: "center" });

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
        pdf.setFontSize(8.5);
        pdf.setTextColor(15, 23, 42);
        pdf.text(sm.code, 16, tableY + 7);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(71, 85, 105);
        pdf.text(sm.name, 45, tableY + 7);

        pdf.setFont("helvetica", "bold");
        pdf.text(`${sm.total}`, 105, tableY + 7, { align: "center" });

        pdf.setFont("helvetica", "normal");
        pdf.text(`${sm.resolved}`, 130, tableY + 7, { align: "center" });

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
        pdf.text(`${sm.rate}%`, 160, tableY + 7, { align: "center" });

        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(71, 85, 105);
        pdf.text(`${sm.avgAging}`, 188, tableY + 7, { align: "center" });

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
        pdf.text(c.feedbackStatus || "Follow Up Required", 112, logTableY + 7);

        // Aging
        const agingInfo = getComplaintAging(c);
        if (agingInfo.days >= 14) {
          pdf.setTextColor(220, 38, 38);
          pdf.setFont("helvetica", "bold");
        } else if (agingInfo.days >= 5) {
          pdf.setTextColor(217, 119, 6);
          pdf.setFont("helvetica", "bold");
        } else {
          pdf.setTextColor(5, 150, 105);
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
    <div className="space-y-6 animate-fade-in text-slate-800">
      
      {/* Upper Control Bar (Actions and Title) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-base font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            Ideal Customer Experience Analytics
          </h2>
          <p className="text-xs text-slate-500 font-bold mt-1">
            Generate graphical performance scorecards, SLA metrics, and high-resolution PDF summaries.
          </p>
        </div>

        {/* Global Download Actions */}
        <div className="flex flex-wrap items-center gap-2">
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

      {/* Advanced Filter Control Panel (Interactive, hidden in PDF printout) */}
      <div className="pdf-hide bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Filter className="h-4 w-4 text-blue-600" />
            Filter Database Engine
          </h3>
          {(stationFilter !== "all" || categoryFilter !== "all" || statusFilter !== "all" || feedbackStatusFilter !== "all" || satisfactionFilter !== "all" || startDate || endDate || searchQuery) && (
            <button
              onClick={handleResetFilters}
              className="text-slate-500 hover:text-blue-600 text-xs font-black flex items-center gap-1 cursor-pointer transition-all uppercase tracking-wider"
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
              className="w-full bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 rounded-lg py-1.5 pl-9 pr-3 text-xs text-slate-700 focus:outline-none transition-all font-bold"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
            <MapPin className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={stationFilter}
              onChange={(e) => setStationFilter(e.target.value)}
              className="w-full bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">All Service Stations</option>
              {STATIONS.map(st => (
                <option key={st.code} value={st.code}>{st.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Statuses and Satisfaction */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
            <Activity className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">All Operational Statuses</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Contacted">Contacted</option>
              <option value="Resolved">Resolved</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={feedbackStatusFilter}
              onChange={(e) => setFeedbackStatusFilter(e.target.value)}
              className="w-full bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">All SLA Feedback Statuses</option>
              {feedbackStatuses.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
            <CheckCircle className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={satisfactionFilter}
              onChange={(e) => setSatisfactionFilter(e.target.value)}
              className="w-full bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">All Satisfaction Levels</option>
              <option value="Very Dissatisfied">Very Dissatisfied</option>
              <option value="Dissatisfied">Dissatisfied</option>
              <option value="Neutral">Neutral</option>
              <option value="Satisfied">Satisfied</option>
              <option value="Very Satisfied">Very Satisfied</option>
            </select>
          </div>
        </div>

        {/* Row 3: Dates */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 col-span-1 md:col-span-2">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-[10px] font-black uppercase text-slate-400">Range:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer w-full"
              placeholder="Start Date"
            />
            <span className="text-slate-300 font-bold">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer w-full"
              placeholder="End Date"
            />
          </div>
          
          <div className="flex items-center justify-end px-1 text-[11px] text-slate-500 font-extrabold uppercase">
            Filtered Match: <span className="text-blue-600 ml-1 bg-blue-50 border border-blue-200 rounded-md px-1.5 py-0.5">{totalInScope} records</span>
          </div>
        </div>
      </div>

      {/* RENDER VIEW CAPTURED BY PDF (Dashboard with high contrast white bg for printing) */}
      <div id="reports-dashboard-view" className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
        
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
        <div className="flex flex-wrap items-center gap-1.5 bg-white p-3 rounded-xl border border-slate-100">
          <span className="text-[10px] font-black uppercase text-slate-400 mr-1 flex items-center gap-1">
            <Filter className="h-3 w-3 text-slate-400" /> Filter Criteria:
          </span>
          <span className="bg-slate-100 text-slate-700 font-bold text-[10px] px-2 py-0.5 rounded border border-slate-200">
            Station: {stationFilter === "all" ? "All Stations" : stationFilter}
          </span>
          <span className="bg-slate-100 text-slate-700 font-bold text-[10px] px-2 py-0.5 rounded border border-slate-200">
            Category: {categoryFilter === "all" ? "All Categories" : categoryFilter}
          </span>
          <span className="bg-slate-100 text-slate-700 font-bold text-[10px] px-2 py-0.5 rounded border border-slate-200">
            Status: {statusFilter === "all" ? "All Statuses" : statusFilter}
          </span>
          {feedbackStatusFilter !== "all" && (
            <span className="bg-slate-100 text-slate-700 font-bold text-[10px] px-2 py-0.5 rounded border border-slate-200">
              SLA: {feedbackStatusFilter}
            </span>
          )}
          {satisfactionFilter !== "all" && (
            <span className="bg-slate-100 text-slate-700 font-bold text-[10px] px-2 py-0.5 rounded border border-slate-200">
              CSAT: {satisfactionFilter}
            </span>
          )}
          {(startDate || endDate) && (
            <span className="bg-blue-50 text-blue-700 font-bold text-[10px] px-2 py-0.5 rounded border border-blue-200">
              Period: {startDate || "Beg"} to {endDate || "End"}
            </span>
          )}
          {searchQuery && (
            <span className="bg-amber-50 text-amber-700 font-bold text-[10px] px-2 py-0.5 rounded border border-amber-200">
              Search: "{searchQuery}"
            </span>
          )}
          <span className="ml-auto text-[10px] font-black uppercase text-blue-600 bg-blue-50 border border-blue-200 rounded px-2 py-0.5">
            {totalInScope} Matching Case{totalInScope === 1 ? "" : "s"}
          </span>
        </div>

        {/* INTERACTIVE SERVICE STATION PERFORMANCE SCORECARD */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-100/50 p-4 rounded-2xl border border-slate-200">
          {/* Left Column: Service Station Table List */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                <div>
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-blue-600" />
                    Service Station Performance
                  </h3>
                  <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                    Click any Service Station below to view its dynamic aging graphics & customer satisfaction score.
                  </p>
                </div>
                <button
                  id="btn-download-station-csv"
                  type="button"
                  onClick={handleDownloadStationReport}
                  className="pdf-hide bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold text-[10px] py-1 px-2.5 rounded transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Download className="h-3 w-3" />
                  Download CSV
                </button>
              </div>

              <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[9px] font-black text-slate-500 uppercase tracking-wider">
                      <th className="py-2.5 px-3">Service Station</th>
                      <th className="py-2.5 px-3 text-center">Case Count</th>
                      <th className="py-2.5 px-3 text-center">Recovery Rate</th>
                      <th className="py-2.5 px-3 text-right">Avg SLA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {stationMetrics.map((sm) => {
                      const isSelected = selectedStationCode === sm.code;
                      return (
                        <tr 
                          key={sm.code} 
                          onClick={() => setSelectedStationCode(sm.code)}
                          className={`cursor-pointer transition-all ${
                            isSelected 
                              ? "bg-blue-50/70 border-l-4 border-l-blue-600" 
                              : "hover:bg-slate-50/50"
                          }`}
                        >
                          <td className="py-2.5 px-3">
                            <p className="font-bold text-slate-800">{sm.code}</p>
                            <p className="text-[9px] text-slate-400 font-bold">{sm.name}</p>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="font-black text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200 text-[11px]">{sm.total}</span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <p className="font-black text-blue-600 text-[11px]">{sm.rate}%</p>
                            <p className="text-[9px] text-slate-400 font-semibold">{sm.resolved} of {sm.total}</p>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <span className={sm.avgAgingColor}>
                              {sm.avgAging} {sm.avgAging === 1 ? "day" : "days"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="text-[9px] text-slate-400 font-bold mt-2.5 pt-2 border-t border-slate-100">
              Select other filters above to slice data across all service stations dynamically.
            </p>
          </div>

          {/* Right Column: Detailed Graphic Breakdown Panel */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col justify-between">
            {(() => {
              const selectedStation = STATIONS.find(s => s.code === selectedStationCode) || STATIONS[0];
              const activeStationComplaints = filteredComplaints.filter(c => c.station === selectedStation.code);
              const activeStationTotal = activeStationComplaints.length;

              // Aging breakdown
              let stationGreenCount = 0;
              let stationYellowCount = 0;
              let stationRedCount = 0;

              activeStationComplaints.forEach((c) => {
                const { days } = getComplaintAging(c);
                if (days <= 5) stationGreenCount++;
                else if (days <= 14) stationYellowCount++;
                else stationRedCount++;
              });

              const stationGreenPct = activeStationTotal > 0 ? Math.round((stationGreenCount / activeStationTotal) * 100) : 0;
              const stationYellowPct = activeStationTotal > 0 ? Math.round((stationYellowCount / activeStationTotal) * 100) : 0;
              const stationRedPct = activeStationTotal > 0 ? Math.round((stationRedCount / activeStationTotal) * 100) : 0;

              // Satisfaction breakdown
              const stationVerySatisfied = activeStationComplaints.filter(c => c.currentSatisfaction === "Very Satisfied").length;
              const stationSatisfied = activeStationComplaints.filter(c => c.currentSatisfaction === "Satisfied").length;
              const stationNeutral = activeStationComplaints.filter(c => c.currentSatisfaction === "Neutral").length;
              const stationDissatisfied = activeStationComplaints.filter(c => c.currentSatisfaction === "Dissatisfied").length;
              const stationVeryDissatisfied = activeStationComplaints.filter(c => c.currentSatisfaction === "Very Dissatisfied").length;

              const stationSatisfiedTotal = stationVerySatisfied + stationSatisfied;
              const stationDissatisfiedTotal = stationVeryDissatisfied + stationDissatisfied;

              const stationSatisfactionRate = activeStationTotal > 0 ? Math.round((stationSatisfiedTotal / activeStationTotal) * 100) : 0;
              const stationDissatisfiedRate = activeStationTotal > 0 ? Math.round((stationDissatisfiedTotal / activeStationTotal) * 100) : 0;
              const stationNeutralRate = activeStationTotal > 0 ? Math.round((stationNeutral / activeStationTotal) * 100) : 0;

              return (
                <div className="space-y-4 h-full flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2">
                      <div>
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1">
                          <Activity className="h-3.5 w-3.5 text-blue-600" />
                          {selectedStation.code} Graphics Breakdown
                        </h4>
                        <p className="text-[9px] text-slate-400 font-bold">{selectedStation.name}</p>
                      </div>
                      <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 border border-blue-200 rounded px-2 py-0.5">
                        {activeStationTotal} Case{activeStationTotal === 1 ? "" : "s"}
                      </span>
                    </div>

                    {activeStationTotal === 0 ? (
                      <div className="py-12 text-center bg-slate-50/50 rounded-lg border border-dashed border-slate-200 my-4">
                        <p className="text-xs font-bold text-slate-400">No matching cases for this station.</p>
                        <p className="text-[9px] text-slate-400 mt-1">Adjust filters or select another station.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        
                        {/* SLA Aging Graphic Bar Chart */}
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                            SLA Aging breakdown
                          </p>
                          <div className="space-y-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                            {/* Green */}
                            <div>
                              <div className="flex justify-between text-[10px] font-bold text-slate-700">
                                <span>0-5 Days (Quick)</span>
                                <span className="font-black text-emerald-600">{stationGreenCount} ({stationGreenPct}%)</span>
                              </div>
                              <div className="w-full bg-slate-200 rounded-full h-2 mt-0.5">
                                <div 
                                  className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                                  style={{ width: `${stationGreenPct}%` }}
                                />
                              </div>
                            </div>

                            {/* Yellow */}
                            <div>
                              <div className="flex justify-between text-[10px] font-bold text-slate-700">
                                <span>5-14 Days (Standard)</span>
                                <span className="font-black text-amber-600">{stationYellowCount} ({stationYellowPct}%)</span>
                              </div>
                              <div className="w-full bg-slate-200 rounded-full h-2 mt-0.5">
                                <div 
                                  className="bg-amber-500 h-2 rounded-full transition-all duration-500"
                                  style={{ width: `${stationYellowPct}%` }}
                                />
                              </div>
                            </div>

                            {/* Red */}
                            <div>
                              <div className="flex justify-between text-[10px] font-bold text-slate-700">
                                <span>14+ Days (Critical)</span>
                                <span className="font-black text-rose-600">{stationRedCount} ({stationRedPct}%)</span>
                              </div>
                              <div className="w-full bg-slate-200 rounded-full h-2 mt-0.5">
                                <div 
                                  className="bg-rose-500 h-2 rounded-full transition-all duration-500"
                                  style={{ width: `${stationRedPct}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Satisfaction & Dissatisfied Rates */}
                        <div className="pt-2 border-t border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                            CSAT & Dissatisfaction Metrics
                          </p>
                          <div className="grid grid-cols-2 gap-2 mb-2">
                            <div className="bg-emerald-50/50 border border-emerald-100 rounded-lg p-2 text-center">
                              <p className="text-[9px] font-black text-emerald-800 uppercase">Satisfaction Rate</p>
                              <p className="text-base font-black text-emerald-600 mt-0.5">{stationSatisfactionRate}%</p>
                              <p className="text-[8px] font-bold text-emerald-500">{stationSatisfiedTotal} cases</p>
                            </div>

                            <div className="bg-rose-50/50 border border-rose-100 rounded-lg p-2 text-center">
                              <p className="text-[9px] font-black text-rose-800 uppercase">Dissatisfied Rate</p>
                              <p className="text-base font-black text-rose-600 mt-0.5">{stationDissatisfiedRate}%</p>
                              <p className="text-[8px] font-bold text-rose-500">{stationDissatisfiedTotal} cases</p>
                            </div>
                          </div>

                          {/* Satisfaction/Dissatisfied Graphical Progress Meter */}
                          <div className="space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                            {/* Satisfaction rate bar */}
                            <div>
                              <div className="flex justify-between text-[9px] font-bold text-slate-600">
                                <span>Satisfied (CSAT)</span>
                                <span className="font-black text-emerald-600">{stationSatisfactionRate}%</span>
                              </div>
                              <div className="w-full bg-slate-200 rounded-full h-1.5 mt-0.5">
                                <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${stationSatisfactionRate}%` }} />
                              </div>
                            </div>

                            {/* Dissatisfied rate bar */}
                            <div>
                              <div className="flex justify-between text-[9px] font-bold text-slate-600">
                                <span>Dissatisfied</span>
                                <span className="font-black text-rose-600">{stationDissatisfiedRate}%</span>
                              </div>
                              <div className="w-full bg-slate-200 rounded-full h-1.5 mt-0.5">
                                <div className="bg-rose-500 h-1.5 rounded-full" style={{ width: `${stationDissatisfiedRate}%` }} />
                              </div>
                            </div>

                            {/* Neutral rate bar */}
                            <div>
                              <div className="flex justify-between text-[9px] font-bold text-slate-600">
                                <span>Neutral</span>
                                <span className="font-black text-slate-500">{stationNeutralRate}%</span>
                              </div>
                              <div className="w-full bg-slate-200 rounded-full h-1.5 mt-0.5">
                                <div className="bg-slate-400 h-1.5 rounded-full" style={{ width: `${stationNeutralRate}%` }} />
                              </div>
                            </div>
                          </div>
                        </div>

                      </div>
                    )}
                  </div>
                  <div className="text-[8px] text-slate-400 font-bold border-t border-slate-100 pt-1.5 mt-2">
                    Data updates reactively with filters. Click any station in the table to swap metrics.
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Aging Metric Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center justify-between shadow-xs">
            <div>
              <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">
                Quick Resolutions (0-5 Days)
              </span>
              <p className="text-2xl font-black text-emerald-900 mt-1">{greenCount}</p>
              <p className="text-[10px] text-emerald-700 font-bold mt-0.5">Satisfactory speed recovery</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center justify-between shadow-xs">
            <div>
              <span className="text-[10px] font-black uppercase text-amber-800 tracking-wider">
                Standard Processing (5-14 Days)
              </span>
              <p className="text-2xl font-black text-amber-900 mt-1">{yellowCount}</p>
              <p className="text-[10px] text-amber-700 font-bold mt-0.5">Intermediate resolution duration</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
          </div>

          <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-center justify-between shadow-xs">
            <div>
              <span className="text-[10px] font-black uppercase text-rose-800 tracking-wider">
                Critical Overdue (14+ Days)
              </span>
              <p className="text-2xl font-black text-rose-900 mt-1">{redCount}</p>
              <p className="text-[10px] text-rose-700 font-bold mt-0.5">High-priority aging cases</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
            </div>
          </div>
        </div>

        {/* Graphical Insights Visual Charts Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          
          {/* Chart 1: SLA Aging Distribution (Horizontal Progress Bars) */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wider mb-3.5 border-b border-slate-100 pb-1.5">
                SLA Aging Proportions
              </h4>
              <div className="space-y-3.5">
                {/* 0-5 Days */}
                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                    <span>0-5 Days (Quick)</span>
                    <span>{greenCount} ({totalInScope > 0 ? Math.round((greenCount / totalInScope) * 100) : 0}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div 
                      className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${totalInScope > 0 ? Math.round((greenCount / totalInScope) * 100) : 0}%` }}
                    />
                  </div>
                </div>

                {/* 5-14 Days */}
                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                    <span>5-14 Days (Standard)</span>
                    <span>{yellowCount} ({totalInScope > 0 ? Math.round((yellowCount / totalInScope) * 100) : 0}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div 
                      className="bg-amber-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${totalInScope > 0 ? Math.round((yellowCount / totalInScope) * 100) : 0}%` }}
                    />
                  </div>
                </div>

                {/* 14+ Days */}
                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                    <span>14+ Days (Critical)</span>
                    <span>{redCount} ({totalInScope > 0 ? Math.round((redCount / totalInScope) * 100) : 0}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div 
                      className="bg-rose-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${totalInScope > 0 ? Math.round((redCount / totalInScope) * 100) : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
            <p className="text-[9px] text-slate-400 font-bold mt-4 pt-1.5 border-t border-slate-100">
              SLA levels represent date-to-date aging analysis thresholds.
            </p>
          </div>

          {/* Chart 2: Customer Satisfaction Breakdown */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wider mb-3.5 border-b border-slate-100 pb-1.5">
                Current Satisfaction Breakdown (CSAT)
              </h4>
              <div className="space-y-2">
                {satisfactionLevels.map((level) => {
                  const count = satisfactionCounts[level] || 0;
                  const pct = totalInScope > 0 ? Math.round((count / totalInScope) * 100) : 0;
                  
                  let barColor = "bg-blue-500";
                  if (level.includes("Very Satisfied")) barColor = "bg-emerald-600";
                  else if (level.includes("Satisfied")) barColor = "bg-emerald-400";
                  else if (level.includes("Neutral")) barColor = "bg-slate-400";
                  else if (level.includes("Very Dissatisfied")) barColor = "bg-rose-600";
                  else if (level.includes("Dissatisfied")) barColor = "bg-orange-400";

                  return (
                    <div key={level} className="flex items-center text-xs">
                      <span className="w-24 font-bold text-slate-600 truncate text-[10px]">{level}</span>
                      <div className="flex-1 bg-slate-100 rounded-full h-2 mx-2">
                        <div 
                          className={`${barColor} h-2 rounded-full transition-all duration-500`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-10 text-right font-black text-slate-700 text-[10px]">{count} ({pct}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <p className="text-[9px] text-slate-400 font-bold mt-3 pt-1.5 border-t border-slate-100">
              Evaluates final call-center follow-up satisfaction levels.
            </p>
          </div>

          {/* Chart 3: Operational Status Distribution */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wider mb-3.5 border-b border-slate-100 pb-1.5">
                Current Status
              </h4>
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
                      <div className="flex justify-between text-[11px] font-bold text-slate-700 mb-0.5">
                        <span className="flex items-center gap-1">
                          <span className={`inline-block w-2 h-2 rounded-full ${barColor}`} />
                          {level}
                        </span>
                        <span>{count} ({pct}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5">
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
            <p className="text-[9px] text-slate-400 font-bold mt-4 pt-1.5 border-t border-slate-100">
              Resolution lifecycle velocity metrics.
            </p>
          </div>

        </div>

        {/* Tabular Reports */}
        <div className="grid grid-cols-1 gap-5">
          
          {/* Full-width Column: Detailed Aging Log & Download */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <FileSpreadsheet className="h-4.5 w-4.5 text-blue-600" />
                  Detailed Aging Logs ({totalInScope})
                </h3>
                <p className="text-[10px] text-slate-500 font-bold mt-0.5">
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
                  <tr className="border-b border-slate-100 bg-slate-50/30 text-[9px] font-black text-slate-500 uppercase tracking-wider">
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
                <tbody className="divide-y divide-slate-100 text-xs">
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
                        <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-2.5 px-4 font-mono text-[10px] font-black text-slate-500">{c.id}</td>
                          <td className="py-2.5 px-4 font-bold text-slate-800">{c.customerName}</td>
                          <td className="py-2.5 px-4">
                            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                              {c.station}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-slate-700 font-mono text-[10px] font-bold">{c.receivedDateTime || `${c.date} 08:00 AM`}</td>
                          <td className="py-2.5 px-4">
                            <span className="inline-block text-[10px] font-extrabold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full text-center">
                              {c.feedbackStatus || "Follow Up Required"}
                            </span>
                          </td>
                          <td className="py-2.5 px-4">
                            <span className="inline-block text-[10px] font-extrabold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full text-center">
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

    </div>
  );
}
