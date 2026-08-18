import { STATIONS } from "../demoData";
import { Complaint } from "../types";

/**
 * Robustly checks if a complaint's station matches a station code or name filter.
 * Handles cases where station is stored as code ("Rathmalana") or name ("Rathmalana (CWS)").
 */
export function matchesStationCodeOrName(complaintStation: string | undefined | null, filterStation: string): boolean {
  if (!filterStation || filterStation === "All" || filterStation === "all") return true;
  if (!complaintStation) return false;

  const cSt = complaintStation.trim().toLowerCase();
  const fSt = filterStation.trim().toLowerCase();

  if (cSt === fSt) return true;
  if (cSt.includes(fSt) || fSt.includes(cSt)) return true;

  // Match against STATIONS definitions
  const targetStation = STATIONS.find(
    (st) => st.code.toLowerCase() === fSt || st.name.toLowerCase() === fSt
  );

  if (targetStation) {
    const code = targetStation.code.toLowerCase();
    const name = targetStation.name.toLowerCase();
    if (cSt === code || cSt === name) return true;
    if (cSt.includes(code) || name.includes(cSt) || cSt.includes(name)) return true;
  }

  return false;
}

/**
 * Robustly checks if a complaint has been returned/rejected to the Service Station or Call Center.
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
    c.finalStatus?.includes("Re-assigned") ||
    c.finalStatus?.includes("Rejected") ||
    (typeof c.stationResponseStatus === "string" && c.stationResponseStatus.toLowerCase().includes("reject")) ||
    (typeof c.stationResponseStatus === "string" && c.stationResponseStatus.toLowerCase().includes("returned"))
  );
}

/**
 * Helper to check if a complaint has been contacted/actioned by the Service Station/Center.
 * Returns true ONLY IF Contacted by Service Center = YES.
 */
export function isStationContacted(c: Complaint | null | undefined): boolean {
  if (!c) return false;
  if (isComplaintRejected(c)) return false;
  return !!(
    (c.stationContactedDate && c.stationContactedDate.trim().length > 0) ||
    (c.stationResolutionNotes && c.stationResolutionNotes.trim().length > 0) ||
    c.status === "Contacted" ||
    c.stationResponseStatus === "Submitted to Call Center"
  );
}

/**
 * CALL CENTER SLA ELIGIBILITY CRITICAL RULE:
 * IF Service Center Contacted = YES (isStationContacted(c) === true)
 *     -> Include the case in Call Center SLA calculation (Eligible)
 * ELSE (NO / Blank / Not Contacted)
 *     -> Exclude the case from Call Center SLA calculation
 */
export function isCallCenterSlaEligible(c: Complaint | null | undefined): boolean {
  return isStationContacted(c);
}

/**
 * Calculates Call Center SLA status (Target <= 24 hours / 1 Day after Service Station contact).
 * Returns isBreached = false if on-time or eligible without delay.
 */
export function getCallCenterSLAStatus(c: Complaint | null | undefined): {
  isEligible: boolean;
  isBreached: boolean;
  label: string;
  delayDays: number;
  color: string;
} {
  if (!c || !isCallCenterSlaEligible(c)) {
    return {
      isEligible: false,
      isBreached: false,
      label: "Excluded (Service Center Not Contacted)",
      delayDays: 0,
      color: "text-slate-500 bg-slate-100 border-slate-300 font-normal"
    };
  }

  const stationDateStr = c.stationContactedDate || c.date || "2026-08-05";
  const ccDateStr = c.callCenterContactedDate || "2026-08-05";

  const stationDate = new Date(stationDateStr);
  const ccDate = new Date(ccDateStr);

  if (isNaN(stationDate.getTime()) || isNaN(ccDate.getTime())) {
    return {
      isEligible: true,
      isBreached: false,
      label: "On-Time (<24h SLA)",
      delayDays: 0,
      color: "text-emerald-700 bg-emerald-50 border-emerald-200 font-bold"
    };
  }

  const diffMs = Math.max(0, ccDate.getTime() - stationDate.getTime());
  const delayDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (c.callCenterContactedDate) {
    if (delayDays <= 1) {
      return {
        isEligible: true,
        isBreached: false,
        label: "On-Time (<24h SLA)",
        delayDays,
        color: "text-emerald-700 bg-emerald-50 border-emerald-200 font-bold"
      };
    }
    return {
      isEligible: true,
      isBreached: true,
      label: `Delay (${delayDays}d diff)`,
      delayDays,
      color: "text-amber-800 bg-amber-50 border-amber-300 font-bold"
    };
  }

  if (delayDays <= 1) {
    return {
      isEligible: true,
      isBreached: false,
      label: "On-Time (<24h SLA)",
      delayDays,
      color: "text-emerald-700 bg-emerald-50 border-emerald-200 font-bold"
    };
  }

  return {
    isEligible: true,
    isBreached: true,
    label: `SLA Breached (${delayDays}d diff)`,
    delayDays,
    color: "text-rose-700 bg-rose-50 border-rose-300 font-extrabold"
  };
}

