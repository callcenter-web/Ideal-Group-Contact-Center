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
    const stationComplaints = complaints.filter(c => c.station === station.code);
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

    let avgAgingColor = "text-emerald-600 font-bold";
    if (avgAging > 5 && avgAging <= 14) avgAgingColor = "text-amber-600 font-bold";
    else if (avgAging > 14) avgAgingColor = "text-rose-600 font-bold";

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

  // Graphical PDF generator
  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true);
    try {
      const element = document.getElementById("reports-dashboard-view");
      if (!element) {
        alert("Dashboard element not found");
        return;
      }
      
      // Selectively hide buttons and controls that should not appear in a printed PDF report
      const elementsToHide = element.querySelectorAll(".pdf-hide");
      elementsToHide.forEach(el => el.classList.add("hidden"));
      
      // Temporarily expand height or make scrollable containers fully visible so everything is captured
      const scrollableTables = element.querySelectorAll(".overflow-y-auto");
      scrollableTables.forEach(el => {
        const htmlEl = el as HTMLElement;
        htmlEl.classList.add("overflow-visible");
        htmlEl.style.maxHeight = "none";
      });
      
      const canvas = await html2canvas(element, {
        scale: 2, // High resolution
        useCORS: true,
        logging: false,
        backgroundColor: "#f8fafc", // nice slate bg
      });
      
      // Restore hidden elements and scroll heights
      elementsToHide.forEach(el => el.classList.remove("hidden"));
      scrollableTables.forEach(el => {
        const htmlEl = el as HTMLElement;
        htmlEl.classList.remove("overflow-visible");
        htmlEl.style.maxHeight = "";
      });
      
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 295; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      
      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      pdf.save(`CX_Graphical_Performance_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
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
                Operational Resolution Velocity
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* Left Column: Detailed Aging Log & Download */}
          <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
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
                    <th className="py-3 px-4">Station</th>
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

          {/* Right Column: Station-wise Summary & Download */}
          <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="h-4.5 w-4.5 text-blue-600" />
                  Service Station Performance
                </h3>
                <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                  Total volumes, recovery rates, and averages.
                </p>
              </div>
              <button
                id="btn-download-station-csv"
                type="button"
                onClick={handleDownloadStationReport}
                className="pdf-hide bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold text-[10px] py-1 px-2 rounded transition-all flex items-center gap-1 cursor-pointer"
              >
                <Download className="h-3 w-3" />
                Download CSV
              </button>
            </div>

            <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/30 text-[9px] font-black text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Station</th>
                    <th className="py-3 px-4 text-center">Volume</th>
                    <th className="py-3 px-4 text-center">Recovery</th>
                    <th className="py-3 px-4 text-right">Avg SLA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {stationMetrics.map((sm) => (
                    <tr key={sm.code} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-800">{sm.code}</p>
                        <p className="text-[9px] text-slate-400 font-semibold">{sm.name}</p>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-bold text-slate-700">{sm.total}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <p className="font-black text-blue-600 text-[11px]">{sm.rate}%</p>
                        <p className="text-[9px] text-slate-400 font-bold">{sm.resolved} of {sm.total}</p>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={sm.avgAgingColor}>
                          {sm.avgAging} {sm.avgAging === 1 ? "day" : "days"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
