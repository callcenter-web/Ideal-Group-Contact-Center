import { Complaint } from "../types";

export interface AgingInfo {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  formattedTimeString: string;
  category: "0-3 Days (New)" | "3-5 Days (Pending)" | "6-10 Days (Escalated)" | ">10 Days (Critical)";
  deadlineStatus: string;
  nextMilestoneText: string;
  badgeColorClass: string;
  textColorClass: string;
  bgColorClass: string;
}

export const parseComplaintDate = (dateStr?: string, dateTimeStr?: string): Date => {
  const str = dateTimeStr || dateStr;
  if (!str) return new Date();

  // Try standard parsing
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;

  // Try YYYY-MM-DD or DD-MM-YYYY
  const clean = str.trim();
  const parts = clean.split(/[\/\-\s]/);
  if (parts.length >= 3) {
    if (parts[0].length === 4) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      let hour = 0;
      let min = 0;
      if (parts.length >= 5) {
        hour = parseInt(parts[3], 10) || 0;
        min = parseInt(parts[4], 10) || 0;
      }
      const dateObj = new Date(year, month, day, hour, min);
      if (!isNaN(dateObj.getTime())) return dateObj;
    } else {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      let year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;
      let hour = 0;
      let min = 0;
      if (parts.length >= 5) {
        hour = parseInt(parts[3], 10) || 0;
        min = parseInt(parts[4], 10) || 0;
      }
      const dateObj = new Date(year, month, day, hour, min);
      if (!isNaN(dateObj.getTime())) return dateObj;
    }
  }

  return new Date();
};

export const getComplaintAgeInfo = (c: Complaint, referenceDate: Date = new Date()): AgingInfo => {
  if (!c) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      formattedTimeString: "00d 00h 00m 00s",
      category: "0-3 Days (New)",
      deadlineStatus: "On Track - 3-Day SLA Target",
      nextMilestoneText: "03d 00h 00m left for 3-Day SLA Target",
      badgeColorClass: "bg-emerald-50 text-emerald-800 border-emerald-300",
      textColorClass: "text-emerald-700",
      bgColorClass: "bg-emerald-500",
    };
  }

  const compDate = parseComplaintDate(c.date, c.receivedDateTime);
  const diffTime = Math.max(0, referenceDate.getTime() - compDate.getTime());

  const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffTime % (1000 * 60)) / 1000);

  const formattedTimeString = `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;

  let category: "0-3 Days (New)" | "3-5 Days (Pending)" | "6-10 Days (Escalated)" | ">10 Days (Critical)";
  let badgeColorClass = "";
  let textColorClass = "";
  let bgColorClass = "";
  let deadlineStatus = "";
  let nextMilestoneText = "";

  if (days <= 3) {
    category = "0-3 Days (New)";
    badgeColorClass = "bg-emerald-50 text-emerald-800 border-emerald-300";
    textColorClass = "text-emerald-700";
    bgColorClass = "bg-emerald-500";
    deadlineStatus = "On Track (Initial 3-Day SLA)";

    const targetMs = compDate.getTime() + 3 * 24 * 60 * 60 * 1000;
    const remMs = Math.max(0, targetMs - referenceDate.getTime());
    const remD = Math.floor(remMs / (1000 * 60 * 60 * 24));
    const remH = Math.floor((remMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const remM = Math.floor((remMs % (1000 * 60 * 60)) / (1000 * 60));
    const remS = Math.floor((remMs % (1000 * 60)) / 1000);
    nextMilestoneText = `${remD}d ${String(remH).padStart(2, "0")}h ${String(remM).padStart(2, "0")}m ${String(remS).padStart(2, "0")}s remaining to 3-Day SLA Deadline`;
  } else if (days <= 5) {
    category = "3-5 Days (Pending)";
    badgeColorClass = "bg-amber-50 text-amber-800 border-amber-300";
    textColorClass = "text-amber-700";
    bgColorClass = "bg-amber-500";
    deadlineStatus = "Warning (3-5 Day Pending Review)";

    const targetMs = compDate.getTime() + 5 * 24 * 60 * 60 * 1000;
    const remMs = Math.max(0, targetMs - referenceDate.getTime());
    const remD = Math.floor(remMs / (1000 * 60 * 60 * 24));
    const remH = Math.floor((remMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const remM = Math.floor((remMs % (1000 * 60 * 60)) / (1000 * 60));
    const remS = Math.floor((remMs % (1000 * 60)) / 1000);
    nextMilestoneText = `${remD}d ${String(remH).padStart(2, "0")}h ${String(remM).padStart(2, "0")}m ${String(remS).padStart(2, "0")}s remaining to Escalation Deadline`;
  } else if (days <= 10) {
    category = "6-10 Days (Escalated)";
    badgeColorClass = "bg-orange-50 text-orange-800 border-orange-300";
    textColorClass = "text-orange-700";
    bgColorClass = "bg-orange-500";
    deadlineStatus = "Escalated (6-10 Day Management Review)";

    const targetMs = compDate.getTime() + 10 * 24 * 60 * 60 * 1000;
    const remMs = Math.max(0, targetMs - referenceDate.getTime());
    const remD = Math.floor(remMs / (1000 * 60 * 60 * 24));
    const remH = Math.floor((remMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const remM = Math.floor((remMs % (1000 * 60 * 60)) / (1000 * 60));
    const remS = Math.floor((remMs % (1000 * 60)) / 1000);
    nextMilestoneText = `${remD}d ${String(remH).padStart(2, "0")}h ${String(remM).padStart(2, "0")}m ${String(remS).padStart(2, "0")}s remaining to Critical SLA Breach`;
  } else {
    category = ">10 Days (Critical)";
    badgeColorClass = "bg-rose-50 text-rose-800 border-rose-300";
    textColorClass = "text-rose-700";
    bgColorClass = "bg-rose-500";
    deadlineStatus = "CRITICAL SLA BREACH (>10 Days Overdue)";
    nextMilestoneText = `Critical SLA Deadline Breached by ${days - 10} days! Urgent Executive Action Required.`;
  }

  return { days, hours, minutes, seconds, formattedTimeString, category, deadlineStatus, nextMilestoneText, badgeColorClass, textColorClass, bgColorClass };
};

export interface AgeBreakdownItem {
  category: string;
  count: number;
  percentage: number;
  badgeColorClass: string;
  textColorClass: string;
}

export const getAgeFormulaBreakdown = (complaints: Complaint[], referenceDate: Date = new Date()): AgeBreakdownItem[] => {
  let cat0_3 = 0;
  let cat3_5 = 0;
  let cat6_10 = 0;
  let cat10_plus = 0;

  complaints.forEach((c) => {
    const age = getComplaintAgeInfo(c, referenceDate);
    if (age.category === "0-3 Days (New)") cat0_3++;
    else if (age.category === "3-5 Days (Pending)") cat3_5++;
    else if (age.category === "6-10 Days (Escalated)") cat6_10++;
    else cat10_plus++;
  });

  const total = complaints.length || 1;

  return [
    {
      category: "0-3 Days (New)",
      count: cat0_3,
      percentage: Math.round((cat0_3 / total) * 100),
      badgeColorClass: "bg-emerald-50 text-emerald-800 border-emerald-300",
      textColorClass: "text-emerald-700",
    },
    {
      category: "3-5 Days (Pending)",
      count: cat3_5,
      percentage: Math.round((cat3_5 / total) * 100),
      badgeColorClass: "bg-amber-50 text-amber-800 border-amber-300",
      textColorClass: "text-amber-700",
    },
    {
      category: "6-10 Days (Escalated)",
      count: cat6_10,
      percentage: Math.round((cat6_10 / total) * 100),
      badgeColorClass: "bg-orange-50 text-orange-800 border-orange-300",
      textColorClass: "text-orange-700",
    },
    {
      category: ">10 Days (Critical)",
      count: cat10_plus,
      percentage: Math.round((cat10_plus / total) * 100),
      badgeColorClass: "bg-rose-50 text-rose-800 border-rose-300",
      textColorClass: "text-rose-700",
    },
  ];
};
