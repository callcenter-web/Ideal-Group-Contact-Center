import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Complaint } from "../types";
import { calculateNationalReportSummary, calculateWeightedStationAverages, isComplaintResolved } from "./workflowTallyUtils";
import { isStationContacted } from "./stationUtils";
import { STATIONS } from "../demoData";
import { parseComplaintDate } from "./agingUtils";

export interface SLAPdfGenerationOptions {
  title?: string;
  stationFilter?: string;
  reportDate?: string;
}

export function generateSlaDashboardPdf(
  complaints: Complaint[],
  options: SLAPdfGenerationOptions = {}
): jsPDF {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 297;
  const pageHeight = 210;
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;

  // Calculate Source of Truth Summary from Complaints
  const summary = calculateNationalReportSummary(complaints);
  const weightedAverages = calculateWeightedStationAverages(summary.stationMetrics);

  const reportDateStr = options.reportDate || new Date().toISOString().split("T")[0];
  const stationFilterLabel = options.stationFilter && options.stationFilter !== "all" 
    ? options.stationFilter 
    : "All Service Stations";

  // Brand Colors
  const PRIMARY_NAVY = [15, 23, 42]; // #0F172A
  const SUCCESS_GREEN = [16, 185, 129]; // #10B981
  const PENDING_AMBER = [245, 158, 11]; // #F59E0B
  const ESCALATED_ORANGE = [234, 88, 12]; // #EA580C
  const CRITICAL_RED = [239, 68, 68]; // #EF4444
  const INFO_BLUE = [59, 130, 246]; // #3B82F6
  const SLATE_BG = [248, 250, 252]; // #F8FAFC
  const CARD_BORDER = [226, 232, 240]; // #CBD5E1

  // Header & Footer Helper
  const drawPageDecorations = (pageNum: number, totalPages: number, pageSubtitle: string) => {
    // Header Bar
    doc.setFillColor(PRIMARY_NAVY[0], PRIMARY_NAVY[1], PRIMARY_NAVY[2]);
    doc.rect(0, 0, pageWidth, 18, "F");

    // Header Accent Line
    doc.setFillColor(SUCCESS_GREEN[0], SUCCESS_GREEN[1], SUCCESS_GREEN[2]);
    doc.rect(0, 18, pageWidth, 1.2, "F");

    // Header Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text("IDEAL GROUP  |  CX PERFORMANCE & SLA RECOVERY DASHBOARD", margin, 9);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(203, 213, 225);
    doc.text(pageSubtitle, margin, 14.5);

    // Header Right
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text(`Scope: ${stationFilterLabel}  |  Date: ${reportDateStr}`, pageWidth - margin, 9, { align: "right" });
    doc.setTextColor(148, 163, 184);
    doc.text("Confidential Enterprise Business Intelligence", pageWidth - margin, 14.5, { align: "right" });

    // Footer
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(
      "Ideal Aftermarket Customer Experience Management  •  Single Source of Truth SLA Analytics Engine",
      margin,
      pageHeight - 5
    );
    doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin, pageHeight - 5, { align: "right" });
  };

  const totalPages = 3;

  // ==========================================================================
  // PAGE 1: EXECUTIVE DASHBOARD & SLA INTEGRITY SUMMARY
  // ==========================================================================
  drawPageDecorations(1, totalPages, "Executive Performance Overview, KPI Cards & Visual SLA Distribution");

  let curY = 24;

  // Row of 4 Core KPI Cards
  const kpiCardWidth = (contentWidth - 9) / 4;
  const kpiCardHeight = 24;

  const drawKpiCard = (
    x: number,
    y: number,
    w: number,
    h: number,
    title: string,
    val: string,
    sub: string,
    badgeBg: number[],
    badgeText: number[]
  ) => {
    doc.setFillColor(SLATE_BG[0], SLATE_BG[1], SLATE_BG[2]);
    doc.setDrawColor(CARD_BORDER[0], CARD_BORDER[1], CARD_BORDER[2]);
    doc.setLineWidth(0.4);
    doc.roundedRect(x, y, w, h, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(title.toUpperCase(), x + 4, y + 6);

    doc.setFontSize(14);
    doc.setTextColor(badgeText[0], badgeText[1], badgeText[2]);
    doc.text(val, x + 4, y + 15);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(71, 85, 105);
    doc.text(sub, x + 4, y + 20.5);
  };

  // Card 1: Total Received & Recovery Rate
  drawKpiCard(
    margin,
    curY,
    kpiCardWidth,
    kpiCardHeight,
    "1. Total Complaints Received",
    `${summary.total}`,
    `Recovery Rate: ${summary.resolutionRate} (${summary.resolved} Resolved)`,
    SLATE_BG,
    PRIMARY_NAVY
  );

  // Card 2: Service Center Contacted (Eligibility Base)
  drawKpiCard(
    margin + kpiCardWidth + 3,
    curY,
    kpiCardWidth,
    kpiCardHeight,
    "2. Service Center Contacted",
    `${summary.scContactedCount} (${summary.scContactedPercent}%)`,
    `CC Eligible Workload (${summary.ccExcludedCount} Excluded / Pending SC)`,
    SLATE_BG,
    SUCCESS_GREEN
  );

  // Card 3: Call Center SLA Achievement
  drawKpiCard(
    margin + (kpiCardWidth + 3) * 2,
    curY,
    kpiCardWidth,
    kpiCardHeight,
    "3. Call Center SLA (<=24h)",
    `${summary.ccSlaAchievementRate}% On-Time`,
    `${summary.ccSlaMetCount} Met / ${summary.ccEligibleCount} Eligible Contacted`,
    SLATE_BG,
    INFO_BLUE
  );

  // Card 4: Active Pending Aging
  drawKpiCard(
    margin + (kpiCardWidth + 3) * 3,
    curY,
    kpiCardWidth,
    kpiCardHeight,
    "4. Active Pending Queue",
    `${summary.pending} Cases`,
    `>10d Critical: ${summary.sla_gt_10} | Esc: ${summary.rejectedByCC}`,
    SLATE_BG,
    summary.sla_gt_10 > 0 ? CRITICAL_RED : PENDING_AMBER
  );

  curY += kpiCardHeight + 5;

  // Grid of 3 Visual Charts / Metric Blocks
  const blockW = (contentWidth - 6) / 3;
  const blockH = 68;

  // BLOCK 1: SLA Aging Distribution (Pending Cases)
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(CARD_BORDER[0], CARD_BORDER[1], CARD_BORDER[2]);
  doc.roundedRect(margin, curY, blockW, blockH, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(PRIMARY_NAVY[0], PRIMARY_NAVY[1], PRIMARY_NAVY[2]);
  doc.text("ACTIVE PENDING AGING SLA", margin + 5, curY + 7);
  doc.setDrawColor(241, 245, 249);
  doc.line(margin + 5, curY + 9.5, margin + blockW - 5, curY + 9.5);

  const agingBuckets = [
    { label: "0-3 Days (New)", count: summary.sla_0_3, color: SUCCESS_GREEN },
    { label: "3-5 Days (Pending)", count: summary.sla_3_5, color: PENDING_AMBER },
    { label: "6-10 Days (Escalated)", count: summary.sla_6_10, color: ESCALATED_ORANGE },
    { label: ">10 Days (Critical)", count: summary.sla_gt_10, color: CRITICAL_RED },
  ];

  let barY = curY + 16;
  agingBuckets.forEach((b) => {
    const pct = summary.pending > 0 ? Math.round((b.count / summary.pending) * 100) : 0;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(51, 65, 85);
    doc.text(`${b.label}: ${b.count} cases (${pct}%)`, margin + 5, barY);

    // Track
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margin + 5, barY + 2, blockW - 10, 3.5, 1, 1, "F");
    if (pct > 0) {
      doc.setFillColor(b.color[0], b.color[1], b.color[2]);
      doc.roundedRect(margin + 5, barY + 2, Math.max(2, (pct / 100) * (blockW - 10)), 3.5, 1, 1, "F");
    }
    barY += 12;
  });

  doc.setFont("helvetica", "italic");
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text("Strictly calculated on active Pending workload", margin + 5, curY + blockH - 4);

  // BLOCK 2: Case Lifecycle & Speed Benchmarks
  const block2X = margin + blockW + 3;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(CARD_BORDER[0], CARD_BORDER[1], CARD_BORDER[2]);
  doc.roundedRect(block2X, curY, blockW, blockH, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(PRIMARY_NAVY[0], PRIMARY_NAVY[1], PRIMARY_NAVY[2]);
  doc.text("OPERATIONAL SPEED & BENCHMARKS", block2X + 5, curY + 7);
  doc.setDrawColor(241, 245, 249);
  doc.line(block2X + 5, curY + 9.5, block2X + blockW - 5, curY + 9.5);

  const speedMetrics = [
    { name: "Avg Station Contact Speed", actual: summary.avgDaysStationContact, target: 2.0, unit: "Days" },
    { name: "Avg Call Center Contact Speed", actual: summary.avgDaysCallCenterContact, target: 1.0, unit: "Day" },
    { name: "Avg Total Case Solve Speed", actual: summary.avgDaysToSolveCase, target: 7.0, unit: "Days" },
  ];

  let speedY = curY + 16;
  speedMetrics.forEach((m) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(51, 65, 85);
    doc.text(m.name, block2X + 5, speedY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Target: <=${m.target} ${m.unit}`, block2X + blockW - 5, speedY, { align: "right" });

    // Progress
    const maxScale = 14;
    const actualWidth = Math.min(blockW - 10, (m.actual / maxScale) * (blockW - 10));
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(block2X + 5, speedY + 2, blockW - 10, 4, 1, 1, "F");

    const barColor = m.actual <= m.target ? SUCCESS_GREEN : (m.actual <= m.target * 1.5 ? PENDING_AMBER : CRITICAL_RED);
    doc.setFillColor(barColor[0], barColor[1], barColor[2]);
    doc.roundedRect(block2X + 5, speedY + 2, Math.max(2, actualWidth), 4, 1, 1, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(PRIMARY_NAVY[0], PRIMARY_NAVY[1], PRIMARY_NAVY[2]);
    doc.text(`${m.actual} working days`, block2X + 7, speedY + 5);

    speedY += 16;
  });

  // BLOCK 3: Call Center SLA Eligibility Standard Callout
  const block3X = margin + (blockW + 3) * 2;
  doc.setFillColor(SLATE_BG[0], SLATE_BG[1], SLATE_BG[2]);
  doc.setDrawColor(CARD_BORDER[0], CARD_BORDER[1], CARD_BORDER[2]);
  doc.roundedRect(block3X, curY, blockW, blockH, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(PRIMARY_NAVY[0], PRIMARY_NAVY[1], PRIMARY_NAVY[2]);
  doc.text("SLA ELIGIBILITY STANDARD", block3X + 5, curY + 7);
  doc.setDrawColor(CARD_BORDER[0], CARD_BORDER[1], CARD_BORDER[2]);
  doc.line(block3X + 5, curY + 9.5, block3X + blockW - 5, curY + 9.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(51, 65, 85);
  const eligibilityLines = [
    "• Overall Case Recovery Rate = (Resolved / Total Received) * 100%",
    `  Current Performance: ${summary.resolved} / ${summary.total} = ${summary.resolutionRate}`,
    "",
    "• Call Center SLA Achievement = (On-Time <=24h / SC Contacted) * 100%",
    `  Current Performance: ${summary.ccSlaMetCount} / ${summary.ccEligibleCount} = ${summary.ccSlaAchievementRate}%`,
    "",
    "• Row Balance Integrity Rule:",
    `  ${summary.total} Total = ${summary.resolved} Resolved + ${summary.pending} Pending + ${summary.rejectedByCC} Rejected`,
    `  Audit Status: ${summary.isFullyReconciled ? "100% Reconciled & Balanced" : "Warning: Needs Review"}`
  ];

  let elY = curY + 15;
  eligibilityLines.forEach((line) => {
    if (line.includes("100% Reconciled")) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(SUCCESS_GREEN[0], SUCCESS_GREEN[1], SUCCESS_GREEN[2]);
    } else {
      doc.setFont("helvetica", line.startsWith("•") ? "bold" : "normal");
      doc.setTextColor(51, 65, 85);
    }
    doc.text(line, block3X + 5, elY);
    elY += 5.5;
  });

  curY += blockH + 5;

  // Executive Management Key Findings Callout
  doc.setFillColor(219, 234, 254); // Blue BG
  doc.setDrawColor(INFO_BLUE[0], INFO_BLUE[1], INFO_BLUE[2]);
  doc.roundedRect(margin, curY, contentWidth, 24, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(30, 64, 175);
  doc.text("EXECUTIVE BI PERFORMANCE SUMMARY & ACTION DIRECTIVES", margin + 4, curY + 5.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `1. Call Center Contact Efficiency: 100% of released service center cases (${summary.ccContactedCount}/${summary.ccEligibleCount}) actioned with ${summary.ccSlaAchievementRate}% achieving on-time verification.`,
    margin + 4,
    curY + 11
  );
  doc.text(
    `2. Overall Case Recovery Rate is ${summary.resolutionRate} (${summary.resolved} of ${summary.total} complaints completed with customer satisfaction acceptance).`,
    margin + 4,
    curY + 16
  );
  doc.text(
    `3. Turnaround Speed: Service station average contact speed is ${summary.avgDaysStationContact} working days. High-volume stations with aging >10d require immediate regional monitoring.`,
    margin + 4,
    curY + 21
  );

  // ==========================================================================
  // PAGE 2: COMPLETE SERVICE STATION PERFORMANCE MATRIX TABLE (14 COLUMNS)
  // ==========================================================================
  doc.addPage();
  drawPageDecorations(2, totalPages, "Complete Service Station Breakdown & Reconciliation Scorecard (14 Columns)");

  const stationTableRows = summary.stationMetrics.map((sm) => {
    const scContStr = `${sm.scContactedCount}/${sm.total} (${sm.scContactedPercent}%)`;
    const ccContStr = `${sm.ccContactedCount}/${sm.ccEligibleCount || 1} (${sm.ccEligibleCount > 0 ? Math.round((sm.ccContactedCount / sm.ccEligibleCount) * 100) : 100}%)`;
    const ccSlaStr = `${sm.ccSlaAchievementRate}%`;

    return [
      sm.name,
      sm.total.toString(),
      sm.resolved.toString(),
      sm.pending.toString(),
      sm.escalated.toString(),
      sm.days0_3 > 0 ? sm.days0_3.toString() : "—",
      sm.days3_5 > 0 ? sm.days3_5.toString() : "—",
      sm.days6_10 > 0 ? sm.days6_10.toString() : "—",
      sm.days10Plus > 0 ? sm.days10Plus.toString() : "—",
      scContStr,
      ccContStr,
      ccSlaStr,
      `${sm.avgDaysStationContact}d`,
      `${sm.avgDaysToSolveCase}d`,
    ];
  });

  // Summary Grand Total Row
  const grandScStr = `${summary.scContactedCount}/${summary.total} (${summary.scContactedPercent}%)`;
  const grandCcStr = `${summary.ccContactedCount}/${summary.ccEligibleCount} (100%)`;
  const grandSlaStr = `${summary.ccSlaAchievementRate}%`;

  const summaryRow = [
    "OVERALL SUMMARY / GRAND TOTAL",
    summary.total.toString(),
    summary.resolved.toString(),
    summary.pending.toString(),
    summary.rejectedByCC.toString(),
    summary.sla_0_3.toString(),
    summary.sla_3_5.toString(),
    summary.sla_6_10.toString(),
    summary.sla_gt_10.toString(),
    grandScStr,
    grandCcStr,
    grandSlaStr,
    `${summary.avgDaysStationContact}d`,
    `${summary.avgDaysToSolveCase}d`,
  ];

  autoTable(doc, {
    startY: 23,
    margin: { left: margin, right: margin },
    head: [[
      "Service Station",
      "Total",
      "Resolved",
      "Pending",
      "Esc.",
      "0-3D",
      "3-5D",
      "6-10D",
      ">10D",
      "SC Contact %",
      "CC Contact %",
      "CC SLA %",
      "Avg Stn",
      "Avg Solve"
    ]],
    body: stationTableRows,
    foot: [summaryRow],
    theme: "grid",
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 7.2,
      fontStyle: "bold",
      halign: "center",
      cellPadding: 2,
    },
    columnStyles: {
      0: { halign: "left", fontStyle: "bold", cellWidth: 46 },
      1: { halign: "center", fontStyle: "bold", cellWidth: 14 },
      2: { halign: "center", textColor: [16, 185, 129], fontStyle: "bold", cellWidth: 16 },
      3: { halign: "center", textColor: [245, 158, 11], fontStyle: "bold", cellWidth: 16 },
      4: { halign: "center", textColor: [239, 68, 68], fontStyle: "bold", cellWidth: 14 },
      5: { halign: "center", cellWidth: 13 },
      6: { halign: "center", cellWidth: 13 },
      7: { halign: "center", cellWidth: 13 },
      8: { halign: "center", textColor: [239, 68, 68], fontStyle: "bold", cellWidth: 13 },
      9: { halign: "center", cellWidth: 28 },
      10: { halign: "center", cellWidth: 28 },
      11: { halign: "center", textColor: [16, 185, 129], fontStyle: "bold", cellWidth: 20 },
      12: { halign: "center", cellWidth: 19 },
      13: { halign: "center", cellWidth: 19 },
    },
    styles: {
      fontSize: 7.2,
      cellPadding: 2,
      textColor: [15, 23, 42],
      overflow: "linebreak",
    },
    footStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: "bold",
      halign: "center",
      cellPadding: 2.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  // Table note
  const lastTableY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 4 : 160;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(6.8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    "* Note: SC Contact % represents complaints contacted by service station. CC SLA % applies strictly to SC Contacted = YES cases with on-time follow-up <=24 hours.",
    margin,
    lastTableY
  );

  // ==========================================================================
  // PAGE 3: DETAILED CASE RECOVERY AUDIT LOGS
  // ==========================================================================
  doc.addPage();
  drawPageDecorations(3, totalPages, "Detailed Operational Recovery Tickets & Verification Log");

  // Top 22 records sorted by aging days descending
  const sortedComplaints = [...complaints].sort((a, b) => {
    const dA = parseComplaintDate(a.date || "").getTime();
    const dB = parseComplaintDate(b.date || "").getTime();
    return dA - dB; // Oldest first (highest aging)
  }).slice(0, 22);

  const logRows = sortedComplaints.map((c) => {
    const isResolved = isComplaintResolved(c);
    const isContacted = isStationContacted(c);
    const feedback = c.feedbackStatus || (isResolved ? "Satisfied" : "Pending Follow-up");
    const statusText = isResolved ? "Resolved" : (c.status || "In Progress");

    return [
      c.id,
      c.customerName.length > 22 ? c.customerName.substring(0, 20) + "..." : c.customerName,
      c.customerPhone || "N/A",
      c.station,
      c.category || "General",
      isContacted ? "YES" : "NO",
      feedback,
      statusText
    ];
  });

  autoTable(doc, {
    startY: 23,
    margin: { left: margin, right: margin },
    head: [[
      "Ticket ID",
      "Customer Name",
      "Phone",
      "Service Station",
      "Category",
      "SC Cont.",
      "Call Center Feedback",
      "Status"
    ]],
    body: logRows,
    theme: "grid",
    headStyles: {
      fillColor: [30, 64, 175],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: "bold",
      halign: "center",
      cellPadding: 2,
    },
    columnStyles: {
      0: { halign: "center", fontStyle: "bold", cellWidth: 26 },
      1: { halign: "left", fontStyle: "bold", cellWidth: 48 },
      2: { halign: "center", cellWidth: 28 },
      3: { halign: "left", cellWidth: 42 },
      4: { halign: "left", cellWidth: 42 },
      5: { halign: "center", fontStyle: "bold", cellWidth: 20 },
      6: { halign: "left", cellWidth: 42 },
      7: { halign: "center", fontStyle: "bold", cellWidth: 25 },
    },
    styles: {
      fontSize: 7.2,
      cellPadding: 2,
      textColor: [15, 23, 42],
      overflow: "linebreak",
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  return doc;
}
