import { Complaint, WorkstationCalendarDate } from "../types";
import { STATIONS } from "../demoData";
import { calculateNonSundayMs, parseComplaintDate } from "./agingUtils";
import { matchesStationCodeOrName } from "./stationUtils";

/**
 * Robust date parser supporting ISO strings, YYYY-MM-DD, DD/MM/YYYY, Excel serial numbers,
 * timestamps with AM/PM, and JS Date instances.
 * Returns a valid Date object or null if unparseable.
 */
export function parseValidDate(val: any): Date | null {
  if (val === null || val === undefined || val === "") return null;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }

  // Handle Excel serial date numbers (e.g. 45500.5)
  if (typeof val === "number" || (!isNaN(Number(val)) && !String(val).includes("-") && !String(val).includes("/"))) {
    const num = Number(val);
    if (num > 30000 && num < 70000) {
      const excelEpoch = new Date(1899, 11, 30);
      const ms = Math.round(num * 86400 * 1000);
      const parsed = new Date(excelEpoch.getTime() + ms);
      if (!isNaN(parsed.getTime())) return parsed;
    }
  }

  const str = String(val).trim();
  if (!str) return null;

  // Try standard parse
  const direct = new Date(str);
  if (!isNaN(direct.getTime())) {
    return direct;
  }

  // Try parsing custom format strings e.g. "DD/MM/YYYY", "DD-MM-YYYY", "YYYY/MM/DD"
  const dateMatch = str.match(/^(\d{1,4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,4})(.*)$/);
  if (dateMatch) {
    const p1 = parseInt(dateMatch[1], 10);
    const p2 = parseInt(dateMatch[2], 10);
    const p3 = parseInt(dateMatch[3], 10);
    const rest = dateMatch[4] ? dateMatch[4].trim() : "";

    let y = 0;
    let m = 0;
    let d = 0;

    if (p1 > 1000) {
      // YYYY-MM-DD
      y = p1;
      m = p2 - 1;
      d = p3;
    } else if (p3 > 1000) {
      // DD-MM-YYYY
      d = p1;
      m = p2 - 1;
      y = p3;
    }

    if (y > 1970 && m >= 0 && m <= 11 && d >= 1 && d <= 31) {
      let hours = 0;
      let minutes = 0;
      let seconds = 0;

      if (rest) {
        const timeMatch = rest.match(/(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?\s*(AM|PM|am|pm)?/i);
        if (timeMatch) {
          hours = parseInt(timeMatch[1], 10);
          minutes = parseInt(timeMatch[2], 10);
          seconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
          const ampm = timeMatch[4] ? timeMatch[4].toUpperCase() : null;
          if (ampm === "PM" && hours < 12) hours += 12;
          if (ampm === "AM" && hours === 12) hours = 0;
        }
      }

      const candidate = new Date(y, m, d, hours, minutes, seconds);
      if (!isNaN(candidate.getTime())) return candidate;
    }
  }

  return null;
}

/**
 * Deduplicate complaints array by unique complaint ID before calculations.
 * Merges any duplicate entries safely to avoid losing data or double-counting.
 */
export function deduplicateComplaints(complaints: Complaint[]): Complaint[] {
  if (!Array.isArray(complaints)) return [];
  const map = new Map<string, Complaint>();
  
  for (const c of complaints) {
    if (!c) continue;
    const id = String(c.id || "").trim();
    if (!id) continue;
    
    if (!map.has(id)) {
      map.set(id, { ...c });
    } else {
      const existing = map.get(id)!;
      // Merge records, favoring non-empty latest values
      map.set(id, {
        ...existing,
        ...c,
        status: c.status || existing.status,
        feedbackStatus: c.feedbackStatus || existing.feedbackStatus,
        currentSatisfaction: c.currentSatisfaction || existing.currentSatisfaction,
        stationContactedDate: c.stationContactedDate || existing.stationContactedDate,
        callCenterContactedDate: c.callCenterContactedDate || existing.callCenterContactedDate,
        solutionDate: c.solutionDate || existing.solutionDate,
        date: c.date || existing.date,
        receivedDateTime: c.receivedDateTime || existing.receivedDateTime
      });
    }
  }

  return Array.from(map.values());
}

/**
 * Checks if a complaint is truly resolved in its current state.
 * CRITICAL RECONCILIATION RULE:
 * A historical rejection does NOT permanently prevent a complaint from being resolved.
 * If the issue was solved and the customer is satisfied / case is closed, it is RESOLVED.
 */
export function isComplaintResolved(c: Complaint | null | undefined): boolean {
  if (!c) return false;

  // 1. Explicit Customer Satisfaction Indicators
  const isSatisfied = 
    c.currentSatisfaction === "Satisfied" || 
    c.currentSatisfaction === "Very Satisfied" || 
    c.callCenterFinalSatisfaction === "Satisfied" ||
    c.callCenterFinalSatisfaction === "Very Satisfied" ||
    c.firstAttemptCallStatus === "Satisfied" ||
    c.secondAttemptCallStatus === "Satisfied" ||
    c.secondAttemptFeedbackStatus === "Satisfied" ||
    (c.secondAttemptCallStatus === "Connected" && c.secondAttemptFeedbackStatus === "Satisfied") ||
    (c.firstAttemptCallStatus === "Connected" && c.feedbackStatus === "Satisfied");

  // 2. Explicit Workflow Resolution Statuses
  const isResolvedStatus = 
    c.status === "Resolved" || 
    c.feedbackStatus === "Satisfied" || 
    c.feedbackStatus === "Satisfied After Resolution";

  // 3. Final Lifecycle Closed / Completed Statuses
  const isFinalClosed = 
    c.finalStatus === "Closed" || 
    c.finalStatus === "Completed" || 
    c.finalStatus === "Resolved";

  // 4. Customer Unreachable verified closure
  const isUnreachableClosed = 
    c.finalStatus === "Unreachable" || 
    (typeof c.finalStatus === "string" && c.finalStatus.toLowerCase().includes("unreachable")) || 
    c.feedbackStatus === "Customer Unreachable" || 
    c.feedbackStatus === "Unreachable";

  return !!(isSatisfied || isResolvedStatus || isFinalClosed || isUnreachableClosed);
}

/**
 * Checks if a complaint is classified as "Contacted — Still Dissatisfied".
 * This means the Call Center has completed its follow-up/contact with the customer,
 * but the customer confirmed they are still dissatisfied after the service station's solution.
 * It is NOT pending active recovery, and the SLA timer is frozen at contact.
 */
export function isComplaintContactedStillDissatisfied(c: Complaint | null | undefined): boolean {
  if (!c) return false;
  if (isComplaintResolved(c)) return false;

  if (c.status === "Contacted — Still Dissatisfied" || c.status === "Contacted - Still Dissatisfied") {
    return true;
  }
  if (c.finalStatus === "Contacted — Still Dissatisfied" || c.finalStatus === "Contacted - Still Dissatisfied") {
    return true;
  }

  const isUnreachable = 
    c.feedbackStatus === "Customer Unreachable" || 
    c.firstAttemptCallStatus === "Customer Unreachable" || 
    c.firstAttemptCallStatus === "Customer Busy" || 
    c.firstAttemptCallStatus === "No Answer" ||
    c.secondAttemptCallStatus === "Customer Unreachable" || 
    c.secondAttemptCallStatus === "Customer Busy" || 
    c.secondAttemptCallStatus === "No Answer";

  const hasCCContact = !!(c.callCenterContactedDate && c.callCenterContactedDate.trim().length > 0) ||
    c.firstAttemptCallStatus === "Connected" ||
    c.secondAttemptCallStatus === "Connected";

  const isDissatisfiedFeedback = 
    c.feedbackStatus === "Still Dissatisfied" ||
    c.feedbackStatus === "Not Satisfied" ||
    c.secondAttemptFeedbackStatus === "Not Satisfied" ||
    c.secondAttemptFeedbackStatus === "No solution Received" ||
    c.callCenterFinalSatisfaction === "Dissatisfied" ||
    c.callCenterFinalSatisfaction === "Very Dissatisfied";

  if (hasCCContact && !isUnreachable && (c.callCenterFinalRemarks || isDissatisfiedFeedback)) {
    return true;
  }

  return false;
}

/**
 * Checks if a complaint is actively pending in the current workflow cycle.
 * CRITICAL RECONCILIATION RULE:
 * A complaint has exactly ONE primary classification:
 * 1. Resolved (Satisfied / Closed)
 * 2. Contacted — Still Dissatisfied (Verified by CC, timer frozen, customer dissatisfied)
 * 3. Pending (Active recovery needed)
 * Total Complaints = Resolved + Contacted Still Dissatisfied + Pending.
 */
export function isComplaintPending(c: Complaint | null | undefined): boolean {
  if (!c) return false;
  return !isComplaintResolved(c) && !isComplaintContactedStillDissatisfied(c);
}

/**
 * Backward compatibility alias for isComplaintPending.
 */
export function isComplaintActivePending(c: Complaint | null | undefined): boolean {
  return isComplaintPending(c);
}

/**
 * Checks if a complaint is CURRENTLY in an active Call Center rejection / escalation state.
 * CRITICAL RECONCILIATION RULES:
 * 1. Resolved complaints can NEVER be counted as active rejected.
 * 2. "Contacted — Still Dissatisfied" complaints are completed CC contacts, not active station returns.
 * 3. Only active pending complaints with an explicit unresolved rejection/return status are counted.
 */
export function isActiveCCRejectionRequired(c: Complaint | null | undefined): boolean {
  if (!c) return false;
  if (isComplaintResolved(c)) return false;
  if (isComplaintContactedStillDissatisfied(c)) return false;

  return !!(
    c.stationResponseStatus === "Rejected" ||
    c.stationResponseStatus === "Returned to Service Station" ||
    c.stationResponseStatus === "Rejected by Call Center" ||
    c.stationResponseStatus === "Returned to Call Center" ||
    c.feedbackStatus === "Returned to Service Station" ||
    c.feedbackStatus === "Rejected Again to Service Station" ||
    c.feedbackStatus === "Escalated" ||
    c.finalStatus === "Returned to Service Station" ||
    c.finalStatus === "Pending with Aftermarket (Re-contact Required)" ||
    c.finalStatus === "Escalated" ||
    (typeof c.finalStatus === "string" && (c.finalStatus.includes("Re-assigned") || c.finalStatus.includes("Rejected"))) ||
    (typeof c.stationResponseStatus === "string" && (c.stationResponseStatus.toLowerCase().includes("reject") || c.stationResponseStatus.toLowerCase().includes("returned")))
  );
}

/**
 * Alias for isActiveCCRejectionRequired
 */
export function isComplaintRejected(c: Complaint | null | undefined): boolean {
  return isActiveCCRejectionRequired(c);
}

/**
 * Gets the complaint's original received Date.
 */
export function getComplaintReceivedDate(c: Complaint): Date {
  if (!c) return new Date();
  const d = parseValidDate(c.receivedDateTime) || parseValidDate(c.date) || parseValidDate((c as any).created_at);
  return d || new Date();
}

/**
 * Gets the start timestamp for SLA calculation.
 * CRITICAL SLA RULE:
 * Calculate complaint ageing from the original Complaint Received Date.
 * Do NOT reset the ageing clock when assigned, contacted, rejected, reopened, escalated, or followed up.
 */
export function getActiveCycleStartDate(c: Complaint): Date {
  return getComplaintReceivedDate(c);
}

/**
 * Calculates exact age in calendar days for a complaint relative to referenceDate (default now).
 */
export function getComplaintAgingDays(c: Complaint, referenceDate: Date = new Date()): number {
  const startDate = getActiveCycleStartDate(c);
  const diffMs = Math.max(0, referenceDate.getTime() - startDate.getTime());
  return diffMs / (1000 * 60 * 60 * 24);
}

/**
 * Full active cycle age information including working days and SLA bucket label.
 */
export function getActiveCycleAgeInfo(
  c: Complaint,
  referenceDate: Date = new Date(),
  calendarDates?: WorkstationCalendarDate[]
): {
  workingDays: number;
  totalHours: number;
  isBreached: boolean;
  cycleStartDate: Date;
  isReActionCycle: boolean;
  bucketLabel: string;
  bucketKey: "0_3" | "3_5" | "6_10" | "gt_10";
} {
  const cycleStartDate = getActiveCycleStartDate(c);
  const isReActionCycle = isActiveCCRejectionRequired(c);

  const exactDays = getComplaintAgingDays(c, referenceDate);
  const totalHours = Math.round(exactDays * 24);

  // Exact non-overlapping SLA buckets:
  // 0-3 DAYS: age >= 0 AND age <= 3
  // 3-5 DAYS: age > 3 AND age <= 5
  // 6-10 DAYS: age > 5 AND age <= 10
  // > 10 DAYS: age > 10
  let bucketKey: "0_3" | "3_5" | "6_10" | "gt_10";
  let bucketLabel: string;

  if (exactDays <= 3) {
    bucketKey = "0_3";
    bucketLabel = "0-3 Days (New)";
  } else if (exactDays <= 5) {
    bucketKey = "3_5";
    bucketLabel = "3-5 Days (Pending)";
  } else if (exactDays <= 10) {
    bucketKey = "6_10";
    bucketLabel = "6-10 Days (Escalated)";
  } else {
    bucketKey = "gt_10";
    bucketLabel = ">10 Days (Critical)";
  }

  return {
    workingDays: Math.round(exactDays * 10) / 10,
    totalHours,
    isBreached: exactDays > 3,
    cycleStartDate,
    isReActionCycle,
    bucketLabel,
    bucketKey
  };
}

/**
 * Returns the FIRST valid Call Center contact/action Date.
 * Missing contact dates return null.
 */
export function getFirstCallCenterContactDate(c: Complaint): Date | null {
  if (!c) return null;
  const dates: Date[] = [];

  const d1 = parseValidDate(c.callCenterContactedDate);
  if (d1) dates.push(d1);

  const d2 = parseValidDate(c.firstAttemptDate);
  if (d2) dates.push(d2);

  const d3 = parseValidDate(c.followUpDate);
  if (d3) dates.push(d3);

  if (Array.isArray(c.contactAttempts)) {
    c.contactAttempts.forEach((att) => {
      if (att && att.timestamp && att.actorRole === "callcenter") {
        const dAtt = parseValidDate(att.timestamp);
        if (dAtt) dates.push(dAtt);
      }
    });
  }

  if (dates.length === 0) return null;
  return new Date(Math.min(...dates.map((d) => d.getTime())));
}

/**
 * Returns the FIRST valid Service Station contact/action Date.
 * Missing contact dates return null.
 */
export function getFirstStationContactDate(c: Complaint): Date | null {
  if (!c) return null;
  const dates: Date[] = [];

  const d1 = parseValidDate(c.serviceStationContactedAt);
  if (d1) dates.push(d1);

  const d2 = parseValidDate((c as any).service_station_contacted_at);
  if (d2) dates.push(d2);

  const d3 = parseValidDate(c.stationContactedDate);
  if (d3) dates.push(d3);

  if (Array.isArray(c.contactAttempts)) {
    c.contactAttempts.forEach((att) => {
      if (att && att.timestamp) {
        const isStationActor =
          att.actorRole === "agent" ||
          !att.actorRole ||
          att.outcome === "CONTACTED" ||
          att.outcome === "CONTACT_ATTEMPTED";
        if (isStationActor) {
          const dAtt = parseValidDate(att.timestamp);
          if (dAtt) dates.push(dAtt);
        }
      }
    });
  }

  if (dates.length === 0) return null;
  return new Date(Math.min(...dates.map((d) => d.getTime())));
}

/**
 * Returns the final resolution Date for a resolved complaint.
 * Unresolved complaints or missing dates return null.
 */
export function getComplaintResolutionDate(c: Complaint): Date | null {
  if (!c || !isComplaintResolved(c)) return null;
  const dates: Date[] = [];

  const d1 = parseValidDate(c.solutionDate);
  if (d1) dates.push(d1);

  const d2 = parseValidDate(c.finishDate);
  if (d2) dates.push(d2);

  const d3 = parseValidDate(c.updatedAt);
  if (d3) dates.push(d3);

  const d4 = parseValidDate(c.callCenterContactedDate);
  if (d4 && (c.feedbackStatus === "Satisfied" || c.callCenterFinalSatisfaction === "Satisfied")) {
    dates.push(d4);
  }

  if (dates.length === 0) {
    const dFallback = parseValidDate(c.stationContactedDate) || parseValidDate(c.date);
    return dFallback || null;
  }

  return new Date(Math.min(...dates.map((d) => d.getTime())));
}

/**
 * Calculates exact date difference in days between two Date objects.
 */
export function getDaysDifference(startDate: Date | null, endDate: Date | null): number | null {
  if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return null;
  }
  const diffMs = endDate.getTime() - startDate.getTime();
  return Math.max(0, diffMs / (1000 * 60 * 60 * 24));
}

export interface StationReportMetrics {
  code: string;
  name: string;
  stationCode: string;
  stationName: string;
  total: number;
  totalList: Complaint[];
  resolved: number;
  resolvedList: Complaint[];
  contactedStillDissatisfied: number;
  contactedStillDissatisfiedList: Complaint[];
  pending: number;
  pendingList: Complaint[];
  rejectedByCC: number; // Current active rejected count
  rejectedByCCList: Complaint[];

  // SLA Aging Buckets (Active Pending Only)
  sla_0_3: number;
  sla_0_3List: Complaint[];
  sla_3_5: number;
  sla_3_5List: Complaint[];
  sla_6_10: number;
  sla_6_10List: Complaint[];
  sla_gt_10: number;
  sla_gt_10List: Complaint[];

  // Compatibility aliases
  days0_3: number;
  days0_3List: Complaint[];
  days3_5: number;
  days3_5List: Complaint[];
  days6_10: number;
  days6_10List: Complaint[];
  days10Plus: number;
  days10PlusList: Complaint[];
  escalated: number;
  escalatedList: Complaint[];
  unclassified: number;
  unclassifiedList: Complaint[];
  notContacted: number;
  contacted: number;
  attempted: number;
  rejectedReAction: number;
  recoveryRate: number;
  slaTotal: number;

  // Service Station Contact Days
  stationContactCount: number;
  stationContactTotalDays: number;
  avgDaysStationContact: number;

  // Call Center Contact Days
  ccContactCount: number;
  ccContactTotalDays: number;
  avgDaysCallCenterContact: number;

  // Days to Solve Case
  solveCount: number;
  solveTotalDays: number;
  avgDaysToSolveCase: number;

  resolutionRate: string;
  rate: number;

  // Operational breakdown
  scContactedCount: number;
  scContactedList: Complaint[];
  scContactedPercent: number;

  ccEligibleCount: number;
  ccEligibleList: Complaint[];
  ccExcludedCount: number;
  ccContactedCount: number;
  ccContactedList: Complaint[];
  ccContactedPercent: number;

  ccSlaMetCount: number;
  ccSlaBreachedCount: number;
  ccSlaAchievementRate: number;

  avgAging: number;
  avgAgingColor?: string;

  isReconciled: boolean;
  reconciliationErrors: string[];
}

export interface NationalReportSummary {
  total: number;
  totalList: Complaint[];
  resolved: number;
  resolvedList: Complaint[];
  contactedStillDissatisfied: number;
  contactedStillDissatisfiedList: Complaint[];
  pending: number;
  pendingList: Complaint[];
  rejectedByCC: number;
  rejectedByCCList: Complaint[];

  // Compatibility aliases for overview
  totalComplaints: number;
  totalPending: number;
  totalResolved: number;
  totalContactedStillDissatisfied: number;
  totalNotContacted: number;
  totalContacted: number;
  totalRejectedReAction: number;
  overallRecoveryRate: number;

  sla_0_3: number;
  sla_0_3List: Complaint[];
  sla_3_5: number;
  sla_3_5List: Complaint[];
  sla_6_10: number;
  sla_6_10List: Complaint[];
  sla_gt_10: number;
  sla_gt_10List: Complaint[];

  // National Averages (calculated directly from underlying records)
  stationContactCount: number;
  stationContactTotalDays: number;
  avgDaysStationContact: number;

  ccContactCount: number;
  ccContactTotalDays: number;
  avgDaysCallCenterContact: number;

  solveCount: number;
  solveTotalDays: number;
  avgDaysToSolveCase: number;

  resolutionRate: string;
  rate: number;

  scContactedCount: number;
  scContactedList: Complaint[];
  scContactedPercent: number;

  ccEligibleCount: number;
  ccEligibleList: Complaint[];
  ccExcludedCount: number;
  ccContactedCount: number;
  ccContactedList: Complaint[];
  ccContactedPercent: number;

  ccSlaMetCount: number;
  ccSlaBreachedCount: number;
  ccSlaAchievementRate: number;

  stationMetrics: StationReportMetrics[];
  isFullyReconciled: boolean;
  reconciliationErrors: string[];
}

/**
 * Calculates complete, reconciled report metrics for a single station.
 */
export function calculateStationReportMetrics(
  stationComplaints: Complaint[],
  stationCode: string,
  stationName: string,
  referenceDate: Date = new Date()
): StationReportMetrics {
  // Deduplicate before calculating
  const complaints = deduplicateComplaints(stationComplaints);

  const total = complaints.length;
  const totalList = complaints;

  const resolvedList: Complaint[] = [];
  const contactedStillDissatisfiedList: Complaint[] = [];
  const pendingList: Complaint[] = [];
  const rejectedByCCList: Complaint[] = [];

  const sla_0_3List: Complaint[] = [];
  const sla_3_5List: Complaint[] = [];
  const sla_6_10List: Complaint[] = [];
  const sla_gt_10List: Complaint[] = [];

  let stationContactCount = 0;
  let stationContactTotalDays = 0;

  let ccContactCount = 0;
  let ccContactTotalDays = 0;

  let solveCount = 0;
  let solveTotalDays = 0;

  const scContactedList: Complaint[] = [];
  const ccContactedList: Complaint[] = [];
  const ccEligibleList: Complaint[] = [];

  let ccSlaMetCount = 0;
  let ccSlaBreachedCount = 0;
  let totalPendingAgingDays = 0;

  for (const c of complaints) {
    const receivedDate = getComplaintReceivedDate(c);

    // 1. Station Contact Calculation
    const firstStationDate = getFirstStationContactDate(c);
    if (firstStationDate) {
      const diffDays = getDaysDifference(receivedDate, firstStationDate);
      if (diffDays !== null) {
        stationContactCount++;
        stationContactTotalDays += diffDays;
        scContactedList.push(c);
      }
    }

    // 2. Call Center Contact Calculation
    const firstCCDate = getFirstCallCenterContactDate(c);
    if (firstCCDate) {
      const diffDays = getDaysDifference(receivedDate, firstCCDate);
      if (diffDays !== null) {
        ccContactCount++;
        ccContactTotalDays += diffDays;
        ccContactedList.push(c);
      }
    }

    // 3. CC SLA Eligibility (Service Center Contacted = YES)
    const isSCEligible = !!firstStationDate || !!c.stationContactedDate || c.status === "Contacted" || c.status === "Contacted — Still Dissatisfied" || c.status === "Contacted - Still Dissatisfied" || c.stationResponseStatus === "Submitted to Call Center";
    if (isSCEligible) {
      ccEligibleList.push(c);
      if (firstCCDate && firstStationDate) {
        const ccDelayDays = getDaysDifference(firstStationDate, firstCCDate);
        if (ccDelayDays !== null && ccDelayDays <= 1) {
          ccSlaMetCount++;
        } else {
          ccSlaBreachedCount++;
        }
      }
    }

    // 4. Resolution vs Contacted Still Dissatisfied vs Pending Classification
    if (isComplaintResolved(c)) {
      resolvedList.push(c);

      // Solve Lifecycle Days for Resolved Cases
      const resDate = getComplaintResolutionDate(c);
      if (resDate) {
        const diffDays = getDaysDifference(receivedDate, resDate);
        if (diffDays !== null) {
          solveCount++;
          solveTotalDays += diffDays;
        }
      }
    } else if (isComplaintContactedStillDissatisfied(c)) {
      // Completed Call Center follow-up but customer remains dissatisfied
      contactedStillDissatisfiedList.push(c);
    } else {
      // Active Pending Case
      pendingList.push(c);

      // Active CC Rejection / Escalation
      if (isActiveCCRejectionRequired(c)) {
        rejectedByCCList.push(c);
      }

      // SLA Aging for Pending Case
      const ageDays = getComplaintAgingDays(c, referenceDate);
      totalPendingAgingDays += ageDays;

      if (ageDays <= 3) {
        sla_0_3List.push(c);
      } else if (ageDays <= 5) {
        sla_3_5List.push(c);
      } else if (ageDays <= 10) {
        sla_6_10List.push(c);
      } else {
        sla_gt_10List.push(c);
      }
    }
  }

  const resolved = resolvedList.length;
  const contactedStillDissatisfied = contactedStillDissatisfiedList.length;
  const pending = pendingList.length;
  const rejectedByCC = rejectedByCCList.length;

  const sla_0_3 = sla_0_3List.length;
  const sla_3_5 = sla_3_5List.length;
  const sla_6_10 = sla_6_10List.length;
  const sla_gt_10 = sla_gt_10List.length;

  // Averages (rounded to 1 decimal place, 0 if no eligible records)
  const avgDaysStationContact = stationContactCount > 0 ? Math.round((stationContactTotalDays / stationContactCount) * 10) / 10 : 0;
  const avgDaysCallCenterContact = ccContactCount > 0 ? Math.round((ccContactTotalDays / ccContactCount) * 10) / 10 : 0;
  const avgDaysToSolveCase = solveCount > 0 ? Math.round((solveTotalDays / solveCount) * 10) / 10 : 0;

  const rate = total > 0 ? Math.round((resolved / total) * 100) : 0;
  const resolutionRate = `${rate}%`;

  const scContactedCount = scContactedList.length;
  const scContactedPercent = total > 0 ? Math.round((scContactedCount / total) * 100) : 0;

  const ccEligibleCount = ccEligibleList.length;
  const ccExcludedCount = total - ccEligibleCount;
  const ccContactedCount_val = ccContactedList.length;
  const ccContactedPercent = total > 0 ? Math.round((ccContactedCount_val / total) * 100) : 0;

  const ccSlaAchievementRate = ccEligibleCount > 0 ? Math.round((ccSlaMetCount / ccEligibleCount) * 100) : 100;

  const avgAging = pending > 0 ? Math.round((totalPendingAgingDays / pending) * 10) / 10 : 0;
  let avgAgingColor = "text-slate-700 dark:text-slate-300";
  if (avgAging > 10) avgAgingColor = "text-rose-600 dark:text-rose-400 font-extrabold";
  else if (avgAging > 5) avgAgingColor = "text-orange-600 dark:text-orange-400 font-bold";
  else if (avgAging > 3) avgAgingColor = "text-amber-600 dark:text-amber-400 font-medium";
  else if (avgAging > 0) avgAgingColor = "text-emerald-600 dark:text-emerald-400";

  // Reconciliation Audit
  const reconciliationErrors: string[] = [];
  if (total !== resolved + contactedStillDissatisfied + pending) {
    reconciliationErrors.push(`Total (${total}) != Resolved (${resolved}) + Contacted Still Dissatisfied (${contactedStillDissatisfied}) + Pending (${pending})`);
  }
  if (pending !== sla_0_3 + sla_3_5 + sla_6_10 + sla_gt_10) {
    reconciliationErrors.push(`Pending (${pending}) != Sum of SLA Buckets (${sla_0_3 + sla_3_5 + sla_6_10 + sla_gt_10})`);
  }

  return {
    code: stationCode,
    name: stationName,
    stationCode,
    stationName,
    total,
    totalList,
    resolved,
    resolvedList,
    contactedStillDissatisfied,
    contactedStillDissatisfiedList,
    pending,
    pendingList,
    rejectedByCC,
    rejectedByCCList,
    sla_0_3,
    sla_0_3List,
    sla_3_5,
    sla_3_5List,
    sla_6_10,
    sla_6_10List,
    sla_gt_10,
    sla_gt_10List,
    days0_3: sla_0_3,
    days0_3List: sla_0_3List,
    days3_5: sla_3_5,
    days3_5List: sla_3_5List,
    days6_10: sla_6_10,
    days6_10List: sla_6_10List,
    days10Plus: sla_gt_10,
    days10PlusList: sla_gt_10List,
    escalated: rejectedByCC,
    escalatedList: rejectedByCCList,
    unclassified: 0,
    unclassifiedList: [],
    notContacted: Math.max(0, total - scContactedCount),
    contacted: scContactedCount,
    attempted: 0,
    rejectedReAction: rejectedByCC,
    recoveryRate: rate,
    slaTotal: pending,
    stationContactCount,
    stationContactTotalDays,
    avgDaysStationContact,
    ccContactCount,
    ccContactTotalDays,
    avgDaysCallCenterContact,
    solveCount,
    solveTotalDays,
    avgDaysToSolveCase,
    resolutionRate,
    rate,
    scContactedCount,
    scContactedList,
    scContactedPercent,
    ccEligibleCount,
    ccEligibleList,
    ccExcludedCount,
    ccContactedCount: ccContactedCount_val,
    ccContactedList,
    ccContactedPercent,
    ccSlaMetCount,
    ccSlaBreachedCount,
    ccSlaAchievementRate,
    avgAging,
    avgAgingColor,
    isReconciled: reconciliationErrors.length === 0,
    reconciliationErrors
  };
}

/**
 * Calculates complete, dynamically reconciled National Report Summary across all service stations.
 */
export function calculateNationalReportSummary(
  allComplaints: Complaint[],
  referenceDate: Date = new Date()
): NationalReportSummary {
  // Deduplicate before calculation
  const complaints = deduplicateComplaints(allComplaints);

  // Discover all distinct stations
  const stationMap = new Map<string, { code: string; name: string }>();

  // 1. Add predefined stations
  for (const st of STATIONS) {
    stationMap.set(st.code.toLowerCase(), { code: st.code, name: st.name });
  }

  // 2. Discover any additional station names from complaints
  for (const c of complaints) {
    if (c && c.station) {
      const trimmed = c.station.trim();
      const lower = trimmed.toLowerCase();
      if (!stationMap.has(lower)) {
        // Find match in STATIONS or use as new station
        const matched = STATIONS.find((s) => matchesStationCodeOrName(trimmed, s.code));
        if (matched) {
          stationMap.set(lower, { code: matched.code, name: matched.name });
        } else {
          stationMap.set(lower, { code: trimmed, name: trimmed });
        }
      }
    }
  }

  // Group complaints by station
  const stationBuckets = new Map<string, Complaint[]>();
  for (const st of STATIONS) {
    stationBuckets.set(st.code, []);
  }

  const unassigned: Complaint[] = [];

  for (const c of complaints) {
    let matchedStationCode: string | null = null;
    for (const st of STATIONS) {
      if (matchesStationCodeOrName(c.station, st.code)) {
        matchedStationCode = st.code;
        break;
      }
    }

    if (matchedStationCode) {
      stationBuckets.get(matchedStationCode)!.push(c);
    } else if (c.station && c.station.trim()) {
      const customCode = c.station.trim();
      if (!stationBuckets.has(customCode)) {
        stationBuckets.set(customCode, []);
      }
      stationBuckets.get(customCode)!.push(c);
    } else {
      unassigned.push(c);
    }
  }

  if (unassigned.length > 0) {
    stationBuckets.set("Other / Unassigned", unassigned);
  }

  // Calculate metrics for each station
  const stationMetrics: StationReportMetrics[] = [];

  stationBuckets.forEach((cList, sCode) => {
    const stObj = STATIONS.find((s) => s.code === sCode);
    const sName = stObj ? stObj.name : sCode;
    const metrics = calculateStationReportMetrics(cList, sCode, sName, referenceDate);
    stationMetrics.push(metrics);
  });

  // Aggregate National Totals
  let total = 0;
  const totalList: Complaint[] = [];

  let resolved = 0;
  const resolvedList: Complaint[] = [];

  let contactedStillDissatisfied = 0;
  const contactedStillDissatisfiedList: Complaint[] = [];

  let pending = 0;
  const pendingList: Complaint[] = [];

  let rejectedByCC = 0;
  const rejectedByCCList: Complaint[] = [];

  let sla_0_3 = 0;
  const sla_0_3List: Complaint[] = [];

  let sla_3_5 = 0;
  const sla_3_5List: Complaint[] = [];

  let sla_6_10 = 0;
  const sla_6_10List: Complaint[] = [];

  let sla_gt_10 = 0;
  const sla_gt_10List: Complaint[] = [];

  let nationalStationContactCount = 0;
  let nationalStationContactTotalDays = 0;

  let nationalCCContactCount = 0;
  let nationalCCContactTotalDays = 0;

  let nationalSolveCount = 0;
  let nationalSolveTotalDays = 0;

  let scContactedCount = 0;
  const scContactedList: Complaint[] = [];

  let ccEligibleCount = 0;
  const ccEligibleList: Complaint[] = [];

  let ccContactedCount = 0;
  const ccContactedList: Complaint[] = [];

  let ccSlaMetCount = 0;
  let ccSlaBreachedCount = 0;

  for (const sm of stationMetrics) {
    total += sm.total;
    totalList.push(...sm.totalList);

    resolved += sm.resolved;
    resolvedList.push(...sm.resolvedList);

    contactedStillDissatisfied += sm.contactedStillDissatisfied;
    contactedStillDissatisfiedList.push(...sm.contactedStillDissatisfiedList);

    pending += sm.pending;
    pendingList.push(...sm.pendingList);

    rejectedByCC += sm.rejectedByCC;
    rejectedByCCList.push(...sm.rejectedByCCList);

    sla_0_3 += sm.sla_0_3;
    sla_0_3List.push(...sm.sla_0_3List);

    sla_3_5 += sm.sla_3_5;
    sla_3_5List.push(...sm.sla_3_5List);

    sla_6_10 += sm.sla_6_10;
    sla_6_10List.push(...sm.sla_6_10List);

    sla_gt_10 += sm.sla_gt_10;
    sla_gt_10List.push(...sm.sla_gt_10List);

    // Sum up contact days directly from records for national averages
    nationalStationContactCount += sm.stationContactCount;
    nationalStationContactTotalDays += sm.stationContactTotalDays;

    nationalCCContactCount += sm.ccContactCount;
    nationalCCContactTotalDays += sm.ccContactTotalDays;

    nationalSolveCount += sm.solveCount;
    nationalSolveTotalDays += sm.solveTotalDays;

    scContactedCount += sm.scContactedCount;
    scContactedList.push(...sm.scContactedList);

    ccEligibleCount += sm.ccEligibleCount;
    ccEligibleList.push(...sm.ccEligibleList);

    ccContactedCount += sm.ccContactedCount;
    ccContactedList.push(...sm.ccContactedList);

    ccSlaMetCount += sm.ccSlaMetCount;
    ccSlaBreachedCount += sm.ccSlaBreachedCount;
  }

  // National averages calculated directly from eligible records across all stations
  const avgDaysStationContact =
    nationalStationContactCount > 0
      ? Math.round((nationalStationContactTotalDays / nationalStationContactCount) * 10) / 10
      : 0;

  const avgDaysCallCenterContact =
    nationalCCContactCount > 0
      ? Math.round((nationalCCContactTotalDays / nationalCCContactCount) * 10) / 10
      : 0;

  const avgDaysToSolveCase =
    nationalSolveCount > 0
      ? Math.round((nationalSolveTotalDays / nationalSolveCount) * 10) / 10
      : 0;

  const rate = total > 0 ? Math.round((resolved / total) * 100) : 0;
  const resolutionRate = `${rate}%`;

  const scContactedPercent = total > 0 ? Math.round((scContactedCount / total) * 100) : 0;
  const ccExcludedCount = total - ccEligibleCount;
  const ccContactedPercent = total > 0 ? Math.round((ccContactedCount / total) * 100) : 0;
  const ccSlaAchievementRate = ccEligibleCount > 0 ? Math.round((ccSlaMetCount / ccEligibleCount) * 100) : 100;

  // Global Reconciliation Checks
  const reconciliationErrors: string[] = [];
  if (total !== resolved + contactedStillDissatisfied + pending) {
    reconciliationErrors.push(`National Total (${total}) != Resolved (${resolved}) + Contacted Still Dissatisfied (${contactedStillDissatisfied}) + Pending (${pending})`);
  }
  if (pending !== sla_0_3 + sla_3_5 + sla_6_10 + sla_gt_10) {
    reconciliationErrors.push(
      `National Pending (${pending}) != SLA Buckets Sum (${sla_0_3 + sla_3_5 + sla_6_10 + sla_gt_10})`
    );
  }

  return {
    total,
    totalList,
    resolved,
    resolvedList,
    contactedStillDissatisfied,
    contactedStillDissatisfiedList,
    pending,
    pendingList,
    rejectedByCC,
    rejectedByCCList,
    totalComplaints: total,
    totalPending: pending,
    totalResolved: resolved,
    totalContactedStillDissatisfied: contactedStillDissatisfied,
    totalNotContacted: Math.max(0, total - scContactedCount),
    totalContacted: scContactedCount,
    totalRejectedReAction: rejectedByCC,
    overallRecoveryRate: rate,
    sla_0_3,
    sla_0_3List,
    sla_3_5,
    sla_3_5List,
    sla_6_10,
    sla_6_10List,
    sla_gt_10,
    sla_gt_10List,
    stationContactCount: nationalStationContactCount,
    stationContactTotalDays: nationalStationContactTotalDays,
    avgDaysStationContact,
    ccContactCount: nationalCCContactCount,
    ccContactTotalDays: nationalCCContactTotalDays,
    avgDaysCallCenterContact,
    solveCount: nationalSolveCount,
    solveTotalDays: nationalSolveTotalDays,
    avgDaysToSolveCase,
    resolutionRate,
    rate,
    scContactedCount,
    scContactedList,
    scContactedPercent,
    ccEligibleCount,
    ccEligibleList,
    ccExcludedCount,
    ccContactedCount,
    ccContactedList,
    ccContactedPercent,
    ccSlaMetCount,
    ccSlaBreachedCount,
    ccSlaAchievementRate,
    stationMetrics,
    isFullyReconciled: reconciliationErrors.length === 0,
    reconciliationErrors
  };
}

export interface DiagnosticAuditItem {
  complaintId: string;
  customerName: string;
  station: string;
  status: string;
  isResolved: boolean;
  isContactedStillDissatisfied: boolean;
  isPending: boolean;
  isRejected: boolean;
  stationContacted: boolean;
  agingDays: number;
  cycleContactStatus: string;
  slaWorkingDays: number;
  slaBucket: string;
  issues: string[];
}

export interface ReconciliationAuditResult {
  totalAudited: number;
  cleanCasesCount: number;
  issueCasesCount: number;
  auditItems: DiagnosticAuditItem[];
}

export function getReconciliationAudit(
  complaints: Complaint[],
  referenceDate: Date = new Date(),
  calendarDates?: WorkstationCalendarDate[]
): ReconciliationAuditResult {
  const deduplicated = deduplicateComplaints(complaints);
  const auditItems: DiagnosticAuditItem[] = [];
  let issueCasesCount = 0;

  for (const c of deduplicated) {
    const isRes = isComplaintResolved(c);
    const isStillDissatisfied = isComplaintContactedStillDissatisfied(c);
    const isPend = isComplaintPending(c);
    const isRej = isActiveCCRejectionRequired(c);
    const aging = Math.round(getComplaintAgingDays(c, referenceDate) * 10) / 10;
    const ageInfo = getActiveCycleAgeInfo(c, referenceDate, calendarDates);
    const contactStatus = getComplaintCycleContactStatus(c);
    const issues: string[] = [];

    const stateCount = (isRes ? 1 : 0) + (isStillDissatisfied ? 1 : 0) + (isPend ? 1 : 0);
    if (stateCount !== 1) {
      issues.push(`Conflict: Case has invalid primary status configuration (Resolved: ${isRes}, StillDissatisfied: ${isStillDissatisfied}, Pending: ${isPend})`);
    }

    if (issues.length > 0) {
      issueCasesCount++;
    }

    auditItems.push({
      complaintId: c.id || "N/A",
      customerName: c.customerName || "N/A",
      station: c.station || "Unassigned",
      status: c.status || "Unknown",
      isResolved: isRes,
      isContactedStillDissatisfied: isStillDissatisfied,
      isPending: isPend,
      isRejected: isRej,
      stationContacted: contactStatus.isContacted,
      agingDays: aging,
      cycleContactStatus: contactStatus.statusLabel,
      slaWorkingDays: ageInfo.workingDays,
      slaBucket: ageInfo.bucketLabel,
      issues
    });
  }

  return {
    totalAudited: deduplicated.length,
    cleanCasesCount: deduplicated.length - issueCasesCount,
    issueCasesCount,
    auditItems
  };
}

/**
 * Backward compatibility wrappers for StationOverview and ServiceStationContactMonitor
 */
export function calculateStationMetrics(
  stationComplaints: Complaint[],
  stationCode: string,
  stationName: string,
  calendarDates?: WorkstationCalendarDate[],
  referenceDate: Date = new Date()
): StationReportMetrics {
  return calculateStationReportMetrics(stationComplaints, stationCode, stationName, referenceDate);
}

export function calculateNationalSummary(
  allComplaints: Complaint[],
  referenceDate?: Date | WorkstationCalendarDate[],
  calendarDates?: WorkstationCalendarDate[]
): NationalReportSummary {
  const refDate = referenceDate instanceof Date ? referenceDate : new Date();
  return calculateNationalReportSummary(allComplaints, refDate);
}

/**
 * Helper to determine cycle contact status
 */
export function getComplaintCycleContactStatus(c: Complaint): {
  isContacted: boolean;
  contactDate: string | null;
  statusLabel: string;
  isActionRequired: boolean;
} {
  const isResolved = isComplaintResolved(c);
  const isRejected = isActiveCCRejectionRequired(c);
  const contactDate = c.stationContactedDate || c.serviceStationContactedAt || null;
  const isContacted = !!(contactDate && contactDate.trim().length > 0);

  if (isResolved) {
    return {
      isContacted: true,
      contactDate,
      statusLabel: "Resolved / Satisfied",
      isActionRequired: false
    };
  }

  if (isRejected) {
    return {
      isContacted: false,
      contactDate: null,
      statusLabel: "Re-action Required (Returned to Station)",
      isActionRequired: true
    };
  }

  if (isContacted) {
    return {
      isContacted: true,
      contactDate,
      statusLabel: "Contacted by Station",
      isActionRequired: false
    };
  }

  return {
    isContacted: false,
    contactDate: null,
    statusLabel: "Not Contacted",
    isActionRequired: true
  };
}
