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
 * Helper to check if a complaint has been contacted/actioned by the Service Station/Center.
 * Returns true ONLY IF Contacted by Service Center = YES.
 */
export function isStationContacted(c: Complaint | null | undefined): boolean {
  if (!c) return false;
  if (c.stationResponseStatus === "Rejected") return false;
  return !!(
    (c.stationContactedDate && c.stationContactedDate.trim().length > 0) ||
    (c.stationResolutionNotes && c.stationResolutionNotes.trim().length > 0) ||
    c.status === "Contacted" ||
    c.stationResponseStatus === "Submitted to Call Center"
  );
}
