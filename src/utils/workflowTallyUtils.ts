import { Complaint, WorkstationCalendarDate } from "../types";
import { STATIONS } from "../demoData";
import { calculateNonSundayMs, parseComplaintDate } from "./agingUtils";
import { matchesStationCodeOrName } from "./stationUtils";

/**
 * Checks if a complaint has been rejected by Call Center / returned to Service Station
 * and requires re-action by the station.
 */
export function isComplaintRejected(c: Complaint | null | undefined): boolean {
  if (!c) return false;
  return !!(
    c.stationResponseStatus === "Rejected" ||
    c.stationResponseStatus === "Returned to Service Station" ||
    c.stationResponseStatus === "Rejected by Call Center" ||
    c.stationResponseStatus === "Returned to Call Center" ||
    c.feedbackStatus === "Returned to Service Station" ||
    c.finalStatus === "Returned to Service Station" ||
    c.finalStatus === "Pending with Aftermarket (Re-contact Required)" ||
    c.finalStatus?.includes("Re-assigned") ||
    c.finalStatus?.includes("Rejected") ||
    (typeof c.stationResponseStatus === "string" && c.stationResponseStatus.toLowerCase().includes("reject")) ||
    (typeof c.stationResponseStatus === "string" && c.stationResponseStatus.toLowerCase().includes("returned"))
  );
}

/**
 * Checks if a complaint is truly resolved in the current cycle.
 * CRITICAL RULE: A rejected / returned complaint CANNOT be counted as resolved.
 */
export function isComplaintResolved(c: Complaint | null | undefined): boolean {
  if (!c) return false;
  // If actively rejected/returned to station, it cannot be considered resolved
  if (isComplaintRejected(c)) return false;

  return !!(
    c.status === "Resolved" ||
    c.feedbackStatus === "Satisfied" ||
    c.currentSatisfaction === "Satisfied" ||
    c.currentSatisfaction === "Very Satisfied" ||
    c.callCenterFinalSatisfaction === "Satisfied" ||
    c.finalStatus === "Closed" ||
    c.finalStatus === "Completed"
  );
}

/**
 * Checks if a complaint is actively pending action in the current workflow cycle.
 */
export function isComplaintActivePending(c: Complaint | null | undefined): boolean {
  if (!c) return false;
  return !isComplaintResolved(c);
}

/**
 * Determines operational contact status in the CURRENT workflow cycle.
 */
export function getComplaintCycleContactStatus(
  c: Complaint | null | undefined
): "NOT_CONTACTED" | "CONTACTED" | "CONTACT_ATTEMPTED" | "CUSTOMER_UNREACHABLE" {
  if (!c) return "NOT_CONTACTED";

  const isRej = isComplaintRejected(c);

  if (isRej) {
    // If rejected, check if new contact occurred AFTER rejection date
    const explicit = c.serviceStationContactStatus || (c as any).service_station_contact_status;
    const contactTime = c.serviceStationContactedAt || (c as any).service_station_contacted_at || c.stationContactedDate;
    const rejTime = c.stationResponseRejectedDate;

    if (explicit === "CONTACTED" && contactTime && rejTime) {
      const ct = new Date(contactTime).getTime();
      const rt = new Date(rejTime).getTime();
      if (!isNaN(ct) && !isNaN(rt) && ct > rt) {
        return "CONTACTED";
      }
    }
    if (explicit === "CONTACT_ATTEMPTED" || explicit === "CUSTOMER_UNREACHABLE") {
      return explicit;
    }
    return "NOT_CONTACTED";
  }

  const explicit = c.serviceStationContactStatus || (c as any).service_station_contact_status;
  if (explicit) {
    const norm = String(explicit).toUpperCase().trim();
    if (norm === "CONTACTED") return "CONTACTED";
    if (norm === "CONTACT_ATTEMPTED" || norm === "ATTEMPTED") return "CONTACT_ATTEMPTED";
    if (norm === "CUSTOMER_UNREACHABLE" || norm === "UNREACHABLE") return "CUSTOMER_UNREACHABLE";
    if (norm === "NOT_CONTACTED") return "NOT_CONTACTED";
  }

  if (c.feedbackStatus === "Customer Unreachable" || c.firstAttemptCallStatus === "Customer Unreachable") {
    return "CUSTOMER_UNREACHABLE";
  }

  const hasStationContactRecorded = !!(
    (c.serviceStationContactedAt && String(c.serviceStationContactedAt).trim().length > 0) ||
    (c.stationContactedDate && String(c.stationContactedDate).trim().length > 0) ||
    (c.stationResolutionNotes && String(c.stationResolutionNotes).trim().length > 0) ||
    c.stationResponseStatus === "Submitted to Call Center"
  );

  if (hasStationContactRecorded) {
    return "CONTACTED";
  }

  if (c.contactAttemptCount && c.contactAttemptCount > 0) {
    return "CONTACT_ATTEMPTED";
  }

  return "NOT_CONTACTED";
}

/**
 * Gets the starting date for SLA calculation in the CURRENT active cycle.
 * For newly assigned case: receivedDateTime / date / created_at.
 * For rejected / returned case: stationResponseRejectedDate.
 */
export function getActiveCycleStartDate(c: Complaint): Date {
  if (isComplaintRejected(c) && c.stationResponseRejectedDate) {
    const rejDate = parseComplaintDate(c.stationResponseRejectedDate);
    if (!isNaN(rejDate.getTime())) return rejDate;
  }
  return parseComplaintDate(c.date, c.receivedDateTime || (c as any).created_at);
}

export type SLABucket = "0-3 Days" | "3-5 Days" | "6-10 Days" | ">10 Days";

export interface CycleAgingInfo {
  workingDays: number;
  hours: number;
  minutes: number;
  seconds: number;
  formattedTimeString: string;
  bucket: SLABucket;
  bucketLabel: string;
  badgeColorClass: string;
  textColorClass: string;
  cycleStartDate: Date;
  isResolved: boolean;
}

/**
 * Calculates SLA ageing information strictly for the active cycle.
 */
export function getActiveCycleAgeInfo(
  c: Complaint,
  referenceDate: Date = new Date(),
  calendarDates?: WorkstationCalendarDate[]
): CycleAgingInfo {
  const cycleStartDate = getActiveCycleStartDate(c);
  const isResolved = isComplaintResolved(c);

  let effectiveRef = referenceDate;
  if (isResolved) {
    const resDateStr = c.callCenterContactedDate || c.solutionDate || c.updatedAt || c.date;
    const parsedRes = parseComplaintDate(resDateStr);
    if (!isNaN(parsedRes.getTime()) && parsedRes.getTime() >= cycleStartDate.getTime()) {
      effectiveRef = parsedRes;
    }
  }

  const diffMs = calculateNonSundayMs(cycleStartDate, effectiveRef, c.station, calendarDates);
  const workingDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

  let bucket: SLABucket;
  let bucketLabel: string;
  let badgeColorClass: string;
  let textColorClass: string;

  if (workingDays <= 3) {
    bucket = "0-3 Days";
    bucketLabel = "0-3 Days (New)";
    badgeColorClass = "bg-emerald-50 text-emerald-800 border-emerald-300";
    textColorClass = "text-emerald-700";
  } else if (workingDays <= 5) {
    bucket = "3-5 Days";
    bucketLabel = "3-5 Days (Pending)";
    badgeColorClass = "bg-amber-50 text-amber-800 border-amber-300";
    textColorClass = "text-amber-700";
  } else if (workingDays <= 10) {
    bucket = "6-10 Days";
    bucketLabel = "6-10 Days (Escalated)";
    badgeColorClass = "bg-orange-50 text-orange-800 border-orange-300";
    textColorClass = "text-orange-700";
  } else {
    bucket = ">10 Days";
    bucketLabel = ">10 Days (Critical)";
    badgeColorClass = "bg-rose-50 text-rose-800 border-rose-300";
    textColorClass = "text-rose-700";
  }

  return {
    workingDays,
    hours,
    minutes,
    seconds,
    formattedTimeString: `${workingDays}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`,
    bucket,
    bucketLabel,
    badgeColorClass,
    textColorClass,
    cycleStartDate,
    isResolved,
  };
}

export interface StationPerformanceMetrics {
  stationCode: string;
  stationName: string;
  total: number;
  pending: number;
  resolved: number;
  notContacted: number;
  contacted: number;
  attempted: number;
  unreachable: number;
  rejectedReAction: number;
  recoveryRate: number; // 0.0 to 100.0
  sla_0_3: number;
  sla_3_5: number;
  sla_6_10: number;
  sla_gt_10: number;
  slaTotal: number; // STRICT IDENTITY: must equal pending
  isReconciled: boolean;
  reconciliationErrors: string[];
  activeCases: Complaint[];
  resolvedCases: Complaint[];
  allCases: Complaint[];
}

/**
 * Calculates complete, verified metrics for a single service station.
 * All metrics are calculated dynamically from actual complaint records.
 */
export function calculateStationMetrics(
  complaints: Complaint[],
  stationIdentifier: string,
  referenceDate: Date = new Date(),
  calendarDates?: WorkstationCalendarDate[]
): StationPerformanceMetrics {
  // Find station info or fallback
  const matchedStationInfo = STATIONS.find(
    (st) =>
      st.code.toLowerCase() === stationIdentifier.toLowerCase() ||
      st.name.toLowerCase() === stationIdentifier.toLowerCase()
  );
  const stationCode = matchedStationInfo ? matchedStationInfo.code : stationIdentifier;
  const stationName = matchedStationInfo ? matchedStationInfo.name : stationIdentifier;

  // Filter complaints strictly belonging to this station
  const stationComplaints = complaints.filter((c) =>
    matchesStationCodeOrName(c.station, stationCode)
  );

  const total = stationComplaints.length;
  let resolved = 0;
  let pending = 0;

  let notContacted = 0;
  let contacted = 0;
  let attempted = 0;
  let unreachable = 0;
  let rejectedReAction = 0;

  let sla_0_3 = 0;
  let sla_3_5 = 0;
  let sla_6_10 = 0;
  let sla_gt_10 = 0;

  const activeCases: Complaint[] = [];
  const resolvedCases: Complaint[] = [];

  stationComplaints.forEach((c) => {
    const isRes = isComplaintResolved(c);
    const isRej = isComplaintRejected(c);

    if (isRej) {
      rejectedReAction++;
    }

    if (isRes) {
      resolved++;
      resolvedCases.push(c);
    } else {
      pending++;
      activeCases.push(c);

      // Contact status in current cycle
      const cycleStatus = getComplaintCycleContactStatus(c);
      if (cycleStatus === "NOT_CONTACTED") notContacted++;
      else if (cycleStatus === "CONTACTED") contacted++;
      else if (cycleStatus === "CONTACT_ATTEMPTED") attempted++;
      else if (cycleStatus === "CUSTOMER_UNREACHABLE") unreachable++;

      // SLA Ageing for ACTIVE PENDING case
      const ageInfo = getActiveCycleAgeInfo(c, referenceDate, calendarDates);
      if (ageInfo.bucket === "0-3 Days") sla_0_3++;
      else if (ageInfo.bucket === "3-5 Days") sla_3_5++;
      else if (ageInfo.bucket === "6-10 Days") sla_6_10++;
      else if (ageInfo.bucket === ">10 Days") sla_gt_10++;
    }
  });

  const slaTotal = sla_0_3 + sla_3_5 + sla_6_10 + sla_gt_10;
  const recoveryRate = total > 0 ? parseFloat(((resolved / total) * 100).toFixed(1)) : 0.0;

  // Reconciliation checks
  const errors: string[] = [];
  if (total !== pending + resolved) {
    errors.push(`Total (${total}) ≠ Pending (${pending}) + Resolved (${resolved})`);
  }
  if (pending !== slaTotal) {
    errors.push(`Pending (${pending}) ≠ SLA Total (${slaTotal})`);
  }
  const pendingContactTotal = notContacted + contacted + attempted + unreachable;
  if (pending !== pendingContactTotal) {
    errors.push(`Pending (${pending}) ≠ Contact breakdown sum (${pendingContactTotal})`);
  }

  return {
    stationCode,
    stationName,
    total,
    pending,
    resolved,
    notContacted,
    contacted,
    attempted,
    unreachable,
    rejectedReAction,
    recoveryRate,
    sla_0_3,
    sla_3_5,
    sla_6_10,
    sla_gt_10,
    slaTotal,
    isReconciled: errors.length === 0,
    reconciliationErrors: errors,
    activeCases,
    resolvedCases,
    allCases: stationComplaints,
  };
}

export interface NationalPerformanceSummary {
  totalComplaints: number;
  totalPending: number;
  totalResolved: number;
  totalNotContacted: number;
  totalContacted: number;
  totalAttempted: number;
  totalUnreachable: number;
  totalRejectedReAction: number;
  overallRecoveryRate: number;
  totalSLA_0_3: number;
  totalSLA_3_5: number;
  totalSLA_6_10: number;
  totalSLA_gt_10: number;
  totalSLACases: number;
  stationMetrics: StationPerformanceMetrics[];
  isFullyReconciled: boolean;
  unassignedCasesCount: number;
}

/**
 * Calculates national overall summary and station breakdown across all database records.
 * Supports dynamically discovering any station present in the database.
 */
export function calculateNationalSummary(
  complaints: Complaint[],
  referenceDate: Date = new Date(),
  calendarDates?: WorkstationCalendarDate[]
): NationalPerformanceSummary {
  // Discover all distinct stations from predefined STATIONS + any stations in complaints
  const stationCodesSet = new Set<string>();
  STATIONS.forEach((st) => stationCodesSet.add(st.code));

  complaints.forEach((c) => {
    if (c.station && c.station.trim().length > 0) {
      // Find matching code if any
      const match = STATIONS.find(
        (st) =>
          st.code.toLowerCase() === c.station.trim().toLowerCase() ||
          st.name.toLowerCase() === c.station.trim().toLowerCase()
      );
      if (match) {
        stationCodesSet.add(match.code);
      } else {
        stationCodesSet.add(c.station.trim());
      }
    }
  });

  const stationList = Array.from(stationCodesSet);
  const stationMetrics = stationList.map((stCode) =>
    calculateStationMetrics(complaints, stCode, referenceDate, calendarDates)
  );

  let totalComplaints = 0;
  let totalPending = 0;
  let totalResolved = 0;
  let totalNotContacted = 0;
  let totalContacted = 0;
  let totalAttempted = 0;
  let totalUnreachable = 0;
  let totalRejectedReAction = 0;

  let totalSLA_0_3 = 0;
  let totalSLA_3_5 = 0;
  let totalSLA_6_10 = 0;
  let totalSLA_gt_10 = 0;

  stationMetrics.forEach((sm) => {
    totalComplaints += sm.total;
    totalPending += sm.pending;
    totalResolved += sm.resolved;
    totalNotContacted += sm.notContacted;
    totalContacted += sm.contacted;
    totalAttempted += sm.attempted;
    totalUnreachable += sm.unreachable;
    totalRejectedReAction += sm.rejectedReAction;

    totalSLA_0_3 += sm.sla_0_3;
    totalSLA_3_5 += sm.sla_3_5;
    totalSLA_6_10 += sm.sla_6_10;
    totalSLA_gt_10 += sm.sla_gt_10;
  });

  const totalSLACases = totalSLA_0_3 + totalSLA_3_5 + totalSLA_6_10 + totalSLA_gt_10;
  const overallRecoveryRate =
    totalComplaints > 0 ? parseFloat(((totalResolved / totalComplaints) * 100).toFixed(1)) : 0.0;

  // Check if any complaints have no station assigned
  const unassigned = complaints.filter(
    (c) => !c.station || c.station.trim().length === 0 || c.station === "Unassigned"
  );

  const isFullyReconciled =
    totalComplaints === complaints.length &&
    totalComplaints === totalPending + totalResolved &&
    totalPending === totalSLACases &&
    stationMetrics.every((sm) => sm.isReconciled);

  return {
    totalComplaints,
    totalPending,
    totalResolved,
    totalNotContacted,
    totalContacted,
    totalAttempted,
    totalUnreachable,
    totalRejectedReAction,
    overallRecoveryRate,
    totalSLA_0_3,
    totalSLA_3_5,
    totalSLA_6_10,
    totalSLA_gt_10,
    totalSLACases,
    stationMetrics,
    isFullyReconciled,
    unassignedCasesCount: unassigned.length,
  };
}

export interface DiagnosticAuditItem {
  complaintId: string;
  customerName: string;
  station: string;
  status: string;
  feedbackStatus?: string | null;
  stationResponseStatus?: string | null;
  isResolved: boolean;
  isActivePending: boolean;
  isRejected: boolean;
  cycleContactStatus: string;
  activeCycleStartDate: string;
  slaWorkingDays: number;
  slaBucket: string;
  issues: string[];
}

/**
 * Diagnostic reconciliation auditor to verify every record in the database
 * and expose any inconsistencies or edge cases with exact IDs.
 */
export function getReconciliationAudit(
  complaints: Complaint[],
  referenceDate: Date = new Date(),
  calendarDates?: WorkstationCalendarDate[]
): {
  totalAudited: number;
  cleanCasesCount: number;
  issueCasesCount: number;
  auditItems: DiagnosticAuditItem[];
} {
  const auditItems: DiagnosticAuditItem[] = complaints.map((c) => {
    const isRes = isComplaintResolved(c);
    const isPending = isComplaintActivePending(c);
    const isRej = isComplaintRejected(c);
    const cycleStatus = getComplaintCycleContactStatus(c);
    const ageInfo = getActiveCycleAgeInfo(c, referenceDate, calendarDates);
    const cycleStartDateStr = ageInfo.cycleStartDate.toISOString().split("T")[0];

    const issues: string[] = [];

    // Rule: Cannot be both resolved and rejected
    if (isRes && isRej) {
      issues.push("Conflict: Case marked resolved but stationResponseStatus is Rejected/Returned");
    }

    // Rule: Missing station
    if (!c.station || c.station.trim().length === 0) {
      issues.push("Warning: Station is empty or unassigned");
    }

    // Rule: Active pending must have valid SLA bucket
    if (isPending && !ageInfo.bucket) {
      issues.push("Error: Active pending case failed SLA bucket assignment");
    }

    return {
      complaintId: c.id,
      customerName: c.customerName || "Unknown Customer",
      station: c.station || "Unassigned",
      status: c.status,
      feedbackStatus: c.feedbackStatus,
      stationResponseStatus: c.stationResponseStatus,
      isResolved: isRes,
      isActivePending: isPending,
      isRejected: isRej,
      cycleContactStatus: cycleStatus,
      activeCycleStartDate: cycleStartDateStr,
      slaWorkingDays: ageInfo.workingDays,
      slaBucket: ageInfo.bucket,
      issues,
    };
  });

  const issueCases = auditItems.filter((i) => i.issues.length > 0);

  return {
    totalAudited: complaints.length,
    cleanCasesCount: auditItems.length - issueCases.length,
    issueCasesCount: issueCases.length,
    auditItems,
  };
}
