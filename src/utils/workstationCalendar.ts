import { WorkstationCalendarDate } from "../types";

const CALENDAR_STORAGE_KEY = "ideal_workstation_calendar_v1";

// Initial default Sri Lanka public/company holidays
const DEFAULT_CALENDAR_DATES: WorkstationCalendarDate[] = [
  {
    id: "default-1",
    station: "All",
    date: "2026-08-15",
    type: "off_day",
    reason: "Company Annual Holiday / Nikini Full Moon Poya",
    createdAt: new Date().toISOString(),
    createdBy: "System Admin",
  },
  {
    id: "default-2",
    station: "All",
    date: "2026-09-16",
    type: "off_day",
    reason: "Milad-Un-Nabi (Holy Prophet's Birthday)",
    createdAt: new Date().toISOString(),
    createdBy: "System Admin",
  },
  {
    id: "default-3",
    station: "Colombo",
    date: "2026-08-20",
    type: "off_day",
    reason: "Colombo Workshop Scheduled Equipment Maintenance",
    createdAt: new Date().toISOString(),
    createdBy: "Admin",
  },
];

export const getStoredCalendarDates = (): WorkstationCalendarDate[] => {
  try {
    const raw = localStorage.getItem(CALENDAR_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(CALENDAR_STORAGE_KEY, JSON.stringify(DEFAULT_CALENDAR_DATES));
      return DEFAULT_CALENDAR_DATES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {
    console.error("Failed to parse workstation calendar state", e);
  }
  return DEFAULT_CALENDAR_DATES;
};

export const saveCalendarDates = (dates: WorkstationCalendarDate[]): void => {
  try {
    localStorage.setItem(CALENDAR_STORAGE_KEY, JSON.stringify(dates));
  } catch (e) {
    console.error("Failed to save workstation calendar state", e);
  }
};

/**
 * Checks if a date is a working day for a given station.
 * Standard logic:
 * - Sunday (getDay() === 0) is OFF by default.
 * - Mon-Sat is WORKING by default.
 * - Custom "working_day" overrides Sunday/Off days to make it a working day.
 * - Custom "off_day" overrides Mon-Sat to make it a non-working day.
 */
export const isDateWorkingDay = (
  date: Date,
  stationName?: string,
  calendarDates: WorkstationCalendarDate[] = getStoredCalendarDates()
): boolean => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const dateStr = `${year}-${month}-${day}`;

  // Find matches for this station or "All"
  const matched = calendarDates.filter(
    (item) => item.date === dateStr && (item.station === "All" || (stationName && item.station.toLowerCase() === stationName.toLowerCase()))
  );

  // If explicit off_day exists
  if (matched.some((item) => item.type === "off_day")) {
    return false;
  }

  // If explicit working_day exists (e.g. Sunday overtime shift)
  if (matched.some((item) => item.type === "working_day")) {
    return true;
  }

  // Default: Sunday is off (0), Mon-Sat working (1-6)
  return date.getDay() !== 0;
};
