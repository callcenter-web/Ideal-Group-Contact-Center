import React, { useState } from "react";
import { Complaint, StationProfile, SystemicEmailLog, UserProfile, WorkstationCalendarDate } from "../types";
import { STATIONS } from "../demoData";
import { 
  Building2, 
  Mail, 
  Phone, 
  User, 
  MapPin, 
  Send, 
  CheckCircle2, 
  FileText, 
  X, 
  AlertCircle,
  Clock,
  ExternalLink,
  Info,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Layers,
  Filter,
  Calendar
} from "lucide-react";
import { dispatchSystemicEmailsForComplaints, generateSystemicEmailContent, getPendingCasesToContact } from "../utils/systemicEmailNotifier";
import { matchesStationCodeOrName, isStationContacted, isComplaintRejected } from "../utils/stationUtils";

interface StationDirectoryAndEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  complaints: Complaint[];
  emailLogs: SystemicEmailLog[];
  calendarDates?: WorkstationCalendarDate[];
  onRefreshEmailLogs?: () => void;
}

export const StationDirectoryAndEmailModal: React.FC<StationDirectoryAndEmailModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  complaints,
  emailLogs,
  calendarDates = [],
  onRefreshEmailLogs,
}) => {
  const [activeTab, setActiveTab] = useState<"directory" | "logs">("directory");
  const [selectedLog, setSelectedLog] = useState<SystemicEmailLog | null>(null);
  const [dispatchStatusMsg, setDispatchStatusMsg] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [expandedStationCode, setExpandedStationCode] = useState<string | null>(null);
  const [filterStationsWithPendingOnly, setFilterStationsWithPendingOnly] = useState<boolean>(false);
  const [includeCalendarNotice, setIncludeCalendarNotice] = useState<boolean>(true);
  const [includeErrorReportingNotice, setIncludeErrorReportingNotice] = useState<boolean>(true);

  if (!isOpen) return null;

  // Clipboard Fallback Helper
  const copyToClipboardFallback = (text: string): boolean => {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      textarea.style.top = "-9999px";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(textarea);
      return successful;
    } catch (err) {
      console.error("Fallback copy error:", err);
      return false;
    }
  };

  // Robust Copy Helper
  const handleCopyText = (text: string, key: string) => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          setCopiedKey(key);
          setTimeout(() => setCopiedKey(null), 2500);
        })
        .catch(() => {
          if (copyToClipboardFallback(text)) {
            setCopiedKey(key);
            setTimeout(() => setCopiedKey(null), 2500);
          }
        });
    } else {
      if (copyToClipboardFallback(text)) {
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2500);
      }
    }
  };

  const getAgingDays = (c: Complaint) => {
    if (!c.date) return 0;
    const t = new Date(c.date).getTime();
    if (isNaN(t)) return 0;
    return Math.max(0, Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24)));
  };

  // Build clean concise summary dispatch message for a station focusing purely on counts, newly appointed times and count for each
  const getStationDispatchMessage = (station: StationProfile) => {
    const stationComplaints = complaints.filter(
      (c) => matchesStationCodeOrName(c.station, station.code) || matchesStationCodeOrName(c.station, station.name)
    );

    const pendingCasesToContact = getPendingCasesToContact(stationComplaints);
    const count = pendingCasesToContact.length;

    const now = new Date();
    const dispatchTimeString = now.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }) + " " + now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const recipients = station.officers
      ? station.officers.map((o) => `${o.name} <${o.email}>`).join(", ")
      : station.email || "callcenter@idealgroup.lk";

    const newlyAppointedCount = pendingCasesToContact.filter((c) => getAgingDays(c) <= 1).length;
    const highPriorityCount = pendingCasesToContact.filter(
      (c) => c.initialSatisfaction === "Very Dissatisfied" || getAgingDays(c) > 3 || c.feedbackStatus === "Still Dissatisfied"
    ).length;

    const rejectedCount = pendingCasesToContact.filter((c) => isComplaintRejected(c)).length;
    const overdueCount = pendingCasesToContact.filter((c) => getAgingDays(c) > 3).length;

    // 1. Group pending cases by Appointed Date / Time with count for each
    const appointedTimesMap: Record<string, { count: number; sampleDate: string; isRecent: boolean }> = {};
    pendingCasesToContact.forEach((c) => {
      const rawDate = c.date || "Recent";
      let formattedDate = rawDate;
      try {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
          formattedDate = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
        }
      } catch {
        // keep rawDate
      }
      const aging = getAgingDays(c);
      if (!appointedTimesMap[formattedDate]) {
        appointedTimesMap[formattedDate] = { count: 0, sampleDate: rawDate, isRecent: aging <= 1 };
      }
      appointedTimesMap[formattedDate].count += 1;
    });

    // 2. Categories breakdown
    const categoryMap: Record<string, number> = {};
    pendingCasesToContact.forEach((c) => {
      const cat = c.category || c.mchCodeDescription || "General Service";
      categoryMap[cat] = (categoryMap[cat] || 0) + 1;
    });

    // 3. Aging distribution
    const aging01 = pendingCasesToContact.filter((c) => getAgingDays(c) <= 1).length;
    const aging23 = pendingCasesToContact.filter((c) => getAgingDays(c) >= 2 && getAgingDays(c) <= 3).length;
    const aging45 = pendingCasesToContact.filter((c) => getAgingDays(c) >= 4 && getAgingDays(c) <= 5).length;
    const agingOver5 = pendingCasesToContact.filter((c) => getAgingDays(c) > 5).length;

    const subject = count > 0
      ? `[Ideal Group Call Center] Action Required: ${count} Pending Case(s) to Contact - ${station.name}`
      : `[Ideal Group Call Center] Status Notice: 0 Pending Cases - ${station.name}`;

    let msg = `====================================================\n`;
    msg += `IDEAL GROUP CENTRAL CALL CENTER - WORKSTATION ACTION NOTICE\n`;
    msg += `====================================================\n`;
    msg += `SENDER: callcenter@idealgroup.lk\n`;
    msg += `TO: ${recipients}\n`;
    msg += `WORKSTATION: ${station.name} (${station.code || ""})\n`;
    msg += `SUBJECT: ${subject}\n`;
    msg += `DISPATCH TIME: ${dispatchTimeString}\n`;
    msg += `====================================================\n\n`;
    msg += `Dear ${station.name} Workshop & Service Management Team,\n\n`;
    
    if (count === 0) {
      msg += `All assigned complaints for ${station.name} are currently contacted and resolved. There are currently NO pending cases requiring station contact.\n\n`;
    } else {
      msg += `Central Call Center has recorded ${count} pending customer complaint case(s) assigned to ${station.name} requiring immediate customer phone contact and inspection.\n\n`;
      
      msg += `1. PENDING CONTACT COUNT SUMMARY:\n`;
      msg += `   * Total Cases to Contact by Service Center: ${count}\n`;
      msg += `   * Newly Appointed Cases (< 24 Hours): ${newlyAppointedCount}\n`;
      msg += `   * High Priority / Critical Dissatisfaction: ${highPriorityCount}\n`;
      msg += `   * Returned / Rejected Cases for Re-action: ${rejectedCount}\n`;
      msg += `   * Overdue SLA (> 3 Days): ${overdueCount}\n\n`;

      msg += `2. APPOINTED TIMES & CASE COUNT BREAKDOWN:\n`;
      if (Object.keys(appointedTimesMap).length > 0) {
        Object.entries(appointedTimesMap)
          .sort((a, b) => new Date(b[1].sampleDate).getTime() - new Date(a[1].sampleDate).getTime())
          .forEach(([dateLabel, info]) => {
            msg += `   * ${dateLabel}: ${info.count} case(s) ${info.isRecent ? "(Newly Appointed - Immediate Contact)" : ""}\n`;
          });
      } else {
        msg += `   * No pending intake records.\n`;
      }
      msg += `\n`;

      msg += `3. COUNT FOR EACH CATEGORY:\n`;
      if (Object.keys(categoryMap).length > 0) {
        Object.entries(categoryMap)
          .sort((a, b) => b[1] - a[1])
          .forEach(([cat, cCount]) => {
            const pct = count > 0 ? Math.round((cCount / count) * 100) : 0;
            msg += `   * ${cat}: ${cCount} case(s) (${pct}%)\n`;
          });
      } else {
        msg += `   * No active category records.\n`;
      }
      msg += `\n`;

      msg += `4. AGING DISTRIBUTION:\n`;
      msg += `   * 0 - 1 Day (New Intake): ${aging01} case(s)\n`;
      msg += `   * 2 - 3 Days (In SLA): ${aging23} case(s)\n`;
      msg += `   * 4 - 5 Days (Pending SLA): ${aging45} case(s)\n`;
      msg += `   * > 5 Days (Escalated): ${agingOver5} case(s)\n\n`;
    }

    // 5. Workstation Calendar & Scheduled Events Advisory
    if (includeCalendarNotice) {
      msg += `5. WORKSTATION CALENDAR & SCHEDULED EVENTS ADVISORY:\n`;
      msg += `   * Please ensure your workshop management and service advisors regularly check the Workstation Calendar & Events in the portal.\n`;
      msg += `   * Verify all operating days, scheduled holidays, and special working days that govern SLA deadlines.\n`;

      const stationNameLower = station.name.toLowerCase();
      const stationCodeLower = (station.code || "").toLowerCase();
      const relevantCalendarDates = (calendarDates || [])
        .filter(
          (cd) =>
            cd.station === "All" ||
            cd.station.toLowerCase() === stationNameLower ||
            cd.station.toLowerCase() === stationCodeLower ||
            cd.station.toLowerCase().includes(stationCodeLower)
        )
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      if (relevantCalendarDates.length > 0) {
        msg += `   * Upcoming Scheduled Dates & Events:\n`;
        relevantCalendarDates.slice(0, 5).forEach((cd) => {
          const typeLabel = cd.type === "off_day" ? "[Off Day / Holiday]" : "[Special Working Day]";
          const stLabel = cd.station === "All" ? "All Stations" : cd.station;
          msg += `     - ${cd.date}: ${typeLabel} ${cd.reason} (${stLabel})\n`;
        });
      } else {
        msg += `   * Standard operational schedule currently applies.\n`;
      }
      msg += `\n`;
    }

    // 6. Error & Discrepancy Reporting Directive
    if (includeErrorReportingNotice) {
      msg += `6. DISCREPANCY & ERROR REPORTING DIRECTIVE:\n`;
      msg += `   * Notice an error or discrepancy? Please feel free to let us know immediately if there are any errors or discrepancies in complaint allocations, vehicle registrations, customer contact details, or assigned SLA dates.\n`;
      msg += `   * If any case has been assigned to ${station.name} in error, reply directly to callcenter@idealgroup.lk or phone Central Call Center so we can rectify the system records promptly.\n\n`;
    }

    msg += `HOW TO TAKE ACTION:\n`;
    msg += `Please log into the Ideal Group Complaint System Portal to view individual vehicle numbers, customer contact numbers, and complaint descriptions. After contacting the customer and providing a solution, submit 'Date Contacted' and 'Solution Provided' in the system.\n\n`;
    msg += `For central support: callcenter@idealgroup.lk\n\n`;
    msg += `Best Regards,\n`;
    msg += `Central Call Center Operations Team\n`;
    msg += `Ideal Group Sri Lanka\n`;

    return msg;
  };

  // Copy all station emails across all stations
  const handleCopyAllStationEmails = () => {
    const allEmails: string[] = [];
    STATIONS.forEach((s) => {
      if (s.officers) {
        s.officers.forEach((o) => {
          if (o.email && !allEmails.includes(o.email)) allEmails.push(o.email);
        });
      } else if (s.email) {
        s.email.split(",").forEach((e) => {
          const trimmed = e.trim();
          if (trimmed && !allEmails.includes(trimmed)) allEmails.push(trimmed);
        });
      }
    });
    const combined = allEmails.join(", ");
    handleCopyText(combined, "ALL_STATION_EMAILS");
  };

  // Copy all station dispatch messages combined
  const handleCopyAllStationMessages = () => {
    let combinedMsg = `====================================================\n`;
    combinedMsg += `ALL WORKSTATIONS PENDING CASES DISPATCH SUMMARY\n`;
    combinedMsg += `SENDER: callcenter@idealgroup.lk\n`;
    combinedMsg += `TIMESTAMP: ${new Date().toLocaleString()}\n`;
    combinedMsg += `====================================================\n\n`;

    STATIONS.forEach((s) => {
      combinedMsg += getStationDispatchMessage(s) + `\n\n----------------------------------------------------\n\n`;
    });

    handleCopyText(combinedMsg, "ALL_STATION_MESSAGES");
  };

  const handleManualDispatchForStation = (station: StationProfile) => {
    // Filter complaints for this station
    const stationComplaints = complaints.filter(
      (c) => matchesStationCodeOrName(c.station, station.code) || matchesStationCodeOrName(c.station, station.name)
    );

    const pendingCases = getPendingCasesToContact(stationComplaints);
    const targetList = pendingCases.length > 0 ? pendingCases : stationComplaints;
    const newLogs = dispatchSystemicEmailsForComplaints(targetList, {
      includeCalendarNotice,
      includeErrorReportingNotice,
      calendarDates,
    });

    setDispatchStatusMsg(`✅ Email successfully dispatched to ${station.name} (${pendingCases.length} pending cases to contact) from callcenter@idealgroup.lk`);
    if (onRefreshEmailLogs) onRefreshEmailLogs();

    setTimeout(() => {
      setDispatchStatusMsg(null);
    }, 4500);
  };

  // Build mailto link for direct sending via desktop email client (Outlook/Gmail) with concise counts format
  const getStationMailtoLink = (station: StationProfile) => {
    const stationComplaints = complaints.filter(
      (c) => matchesStationCodeOrName(c.station, station.code) || matchesStationCodeOrName(c.station, station.name)
    );
    const pendingCasesToContact = getPendingCasesToContact(stationComplaints);
    const count = pendingCasesToContact.length;

    const recipients = station.officers
      ? station.officers.map((o) => o.email).join(",")
      : station.email || "callcenter@idealgroup.lk";

    const subject = encodeURIComponent(
      count > 0
        ? `[Ideal Group Call Center] Action Required: ${count} Pending Case(s) to Contact - ${station.name}`
        : `[Ideal Group Call Center] Status Notice: 0 Pending Cases - ${station.name}`
    );

    const newlyAppointedCount = pendingCasesToContact.filter((c) => getAgingDays(c) <= 1).length;

    let bodyText = `From: callcenter@idealgroup.lk\nTo: ${recipients}\nStation: ${station.name}\n\n`;
    if (count === 0) {
      bodyText += `Dear Station Team,\n\nAll complaints assigned to ${station.name} are currently contacted and resolved. No pending cases requiring contact.\n\n`;
      if (includeCalendarNotice) {
        bodyText += `* CALENDAR & EVENTS: Please check your portal Workstation Calendar & Events for scheduled holidays and operational dates impacting SLA.\n`;
      }
      if (includeErrorReportingNotice) {
        bodyText += `* ERROR REPORTING: Please feel free to let us know if there are any errors or discrepancies by replying to this email.\n`;
      }
      bodyText += `\nRegards,\nCentral Call Center\ncallcenter@idealgroup.lk`;
    } else {
      bodyText += `Dear ${station.name} Workshop Team,\n\nPlease note the following summary of cases requiring customer contact:\n\n`;
      bodyText += `* Total Cases Pending Contact: ${count}\n`;
      bodyText += `* Newly Appointed (Last 24h): ${newlyAppointedCount}\n\n`;
      if (includeCalendarNotice) {
        bodyText += `* CALENDAR & EVENTS: Please review the Workstation Calendar & Events in the portal to verify operating days & holiday SLA timelines.\n`;
      }
      if (includeErrorReportingNotice) {
        bodyText += `* ERROR REPORTING: Please feel free to let us know immediately if there are any errors or discrepancies in allocations or details.\n\n`;
      }
      bodyText += `Please log into the Ideal Group Complaint System Portal to view individual customer records and record Date Contacted and Solution Provided.\n\nRegards,\nCentral Call Center\nIdeal Group Sri Lanka\ncallcenter@idealgroup.lk`;
    }

    return `mailto:${recipients}?subject=${subject}&body=${encodeURIComponent(bodyText)}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      {/* Crisp Pure Light Modal Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden max-w-5xl w-full mx-auto my-auto text-left text-slate-800">
        
        {/* Clean Light Header */}
        <div className="bg-white border-b border-slate-200 p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl">
              <Mail className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-slate-900 flex items-center gap-2">
                Workstation Contact Directory & Systemic Email Matrix
              </h2>
              <p className="text-xs text-slate-500">
                Central Call Center (<a href="mailto:callcenter@idealgroup.lk" className="text-blue-600 font-semibold hover:underline">callcenter@idealgroup.lk</a>) &bull; Summaries, newly appointed times & pending contact counts
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Switcher & Status banner */}
        <div className="p-4 sm:p-6 space-y-5 bg-slate-50/50">
          {dispatchStatusMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2 shadow-2xs">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              {dispatchStatusMsg}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab("directory")}
                className={`px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  activeTab === "directory"
                    ? "bg-white text-blue-700 shadow-xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                📍 Service Stations ({STATIONS.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("logs")}
                className={`px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "logs"
                    ? "bg-white text-blue-700 shadow-xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                <span>Dispatched Email Logs ({emailLogs.length})</span>
              </button>
            </div>

            {/* Filter Toggle & Copy All Messages / Emails */}
            <div className="flex flex-wrap items-center gap-2">
              {activeTab === "directory" && (
                <button
                  type="button"
                  onClick={() => setFilterStationsWithPendingOnly(!filterStationsWithPendingOnly)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer border ${
                    filterStationsWithPendingOnly
                      ? "bg-amber-600 text-white border-amber-700"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <Filter className="h-3.5 w-3.5" />
                  <span>{filterStationsWithPendingOnly ? "Showing Stations with Pending Only" : "Show Pending Only"}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleCopyAllStationMessages}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                title="Copy complete summary dispatch text for all workstations"
              >
                {copiedKey === "ALL_STATION_MESSAGES" ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-300" />
                    <span className="text-emerald-100">Copied All Summaries!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-blue-200" />
                    <span>Copy All Summaries</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleCopyAllStationEmails}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                title="Copy all workstation email addresses to clipboard"
              >
                {copiedKey === "ALL_STATION_EMAILS" ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-emerald-300">Copied All Station Emails!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-slate-300" />
                    <span>Copy Station Emails</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* TAB 1: WORKSTATION DIRECTORY */}
          {activeTab === "directory" && (
            <div className="space-y-4">
              {/* Configurable Email Content & Directives Options Bar */}
              <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
                      <Mail className="h-3.5 w-3.5 text-blue-600" />
                      Email Content & Notice Options
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
                      &bull; Customize operational notices included in station emails & mailto links
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIncludeCalendarNotice(true);
                        setIncludeErrorReportingNotice(true);
                      }}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded cursor-pointer transition-colors"
                    >
                      Enable Both
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIncludeCalendarNotice(false);
                        setIncludeErrorReportingNotice(false);
                      }}
                      className="text-[10px] font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded cursor-pointer transition-colors"
                    >
                      Disable Both
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {/* Option 1: Calendar & Events Notice */}
                  <label
                    id="email-option-calendar-events"
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                      includeCalendarNotice
                        ? "bg-blue-50/70 border-blue-200 text-blue-950 shadow-2xs"
                        : "bg-slate-50/60 border-slate-200 text-slate-500 hover:bg-slate-100/60"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={includeCalendarNotice}
                      onChange={(e) => setIncludeCalendarNotice(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 font-bold">
                        <span className="flex items-center gap-1.5 text-blue-900">
                          <Calendar className="h-3.5 w-3.5 text-blue-600" />
                          <span>Review Workstation Calendar & Events</span>
                        </span>
                        <span
                          className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                            includeCalendarNotice
                              ? "bg-blue-600 text-white"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {includeCalendarNotice ? "INCLUDED" : "EXCLUDED"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                        Tells the service station to check the Workstation Calendar & scheduled events (holidays, off-days & extra working days) that impact SLA deadlines.
                      </p>
                      {calendarDates && calendarDates.length > 0 && (
                        <div className="mt-1.5 text-[10px] text-blue-700 font-semibold flex items-center gap-1">
                          <span>📌 {calendarDates.length} calendar schedule date(s) registered in portal</span>
                        </div>
                      )}
                    </div>
                  </label>

                  {/* Option 2: Error Reporting Notice */}
                  <label
                    id="email-option-error-reporting"
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                      includeErrorReportingNotice
                        ? "bg-amber-50/70 border-amber-200 text-amber-950 shadow-2xs"
                        : "bg-slate-50/60 border-slate-200 text-slate-500 hover:bg-slate-100/60"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={includeErrorReportingNotice}
                      onChange={(e) => setIncludeErrorReportingNotice(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 font-bold">
                        <span className="flex items-center gap-1.5 text-amber-900">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                          <span>Report Errors & Discrepancies</span>
                        </span>
                        <span
                          className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                            includeErrorReportingNotice
                              ? "bg-amber-600 text-white"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {includeErrorReportingNotice ? "INCLUDED" : "EXCLUDED"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                        Directs station: <em>"Please feel free to let us know if there are any errors or discrepancies"</em> in complaint allocations, vehicle numbers, or details by contacting Central Call Center.
                      </p>
                      <div className="mt-1.5 text-[10px] text-amber-700 font-semibold flex items-center gap-1">
                        <span>✉️ Direct reply to callcenter@idealgroup.lk</span>
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl text-xs text-blue-950 flex items-start justify-between gap-2.5">
                <div className="flex items-start gap-2.5">
                  <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Systemic Email Dispatch Specification</p>
                    <p className="text-slate-600 leading-relaxed mt-0.5">
                      All dispatch emails sent to workstations contain clean, concise <strong>summary counts, newly appointed times and count for each, and the total count of pending cases to contact</strong>. Individual case details are managed inside the portal dashboard.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {STATIONS.filter((station) => {
                  if (!filterStationsWithPendingOnly) return true;
                  const stComplaints = complaints.filter(
                    (c) => matchesStationCodeOrName(c.station, station.code) || matchesStationCodeOrName(c.station, station.name)
                  );
                  return getPendingCasesToContact(stComplaints).length > 0;
                }).map((station) => {
                  const stationComplaints = complaints.filter(
                    (c) => matchesStationCodeOrName(c.station, station.code) || matchesStationCodeOrName(c.station, station.name)
                  );

                  const pendingCasesToContact = getPendingCasesToContact(stationComplaints);
                  const isExpanded = expandedStationCode === station.code;

                  const newlyAppointedCount = pendingCasesToContact.filter((c) => getAgingDays(c) <= 1).length;

                  // Group pending cases by Appointed Date / Time
                  const appointedTimesMap: Record<string, number> = {};
                  pendingCasesToContact.forEach((c) => {
                    const rawDate = c.date || "Recent";
                    let formattedDate = rawDate;
                    try {
                      const d = new Date(rawDate);
                      if (!isNaN(d.getTime())) {
                        formattedDate = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
                      }
                    } catch {
                      // keep
                    }
                    appointedTimesMap[formattedDate] = (appointedTimesMap[formattedDate] || 0) + 1;
                  });

                  // Category counts
                  const categoryMap: Record<string, number> = {};
                  pendingCasesToContact.forEach((c) => {
                    const cat = c.category || c.mchCodeDescription || "General Service";
                    categoryMap[cat] = (categoryMap[cat] || 0) + 1;
                  });

                  const stationEmailsList = station.officers
                    ? station.officers.map((o) => o.email).join(", ")
                    : station.email || "";

                  const copyKey = `STATION_${station.code}`;

                  return (
                    <div
                      key={station.name}
                      className={`bg-white rounded-xl border p-4 shadow-xs hover:shadow-md transition-all space-y-3 flex flex-col justify-between ${
                        pendingCasesToContact.length > 0
                          ? "border-amber-300 bg-amber-50/10"
                          : "border-slate-200"
                      }`}
                    >
                      <div className="space-y-2">
                        {/* Header & Complaint Count Badge */}
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-blue-600" />
                            {station.name}
                          </h3>
                          <div className="flex items-center gap-1.5">
                            {pendingCasesToContact.length > 0 ? (
                              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3 text-amber-600" />
                                {pendingCasesToContact.length} to Contact
                              </span>
                            ) : (
                              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                0 Pending Contact
                              </span>
                            )}
                            <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                              {stationComplaints.length} Total
                            </span>
                          </div>
                        </div>

                        {/* Physical Address */}
                        <div className="flex items-start gap-2 text-xs text-slate-600">
                          <MapPin className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-0.5" />
                          <span>{station.address || "Ideal Group Workshop Location"}</span>
                        </div>

                        {/* Officers List */}
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                              Designated Workshop Personnel:
                            </p>
                            <button
                              type="button"
                              onClick={() => handleCopyText(stationEmailsList, copyKey)}
                              className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                              title="Copy email list for this station"
                            >
                              {copiedKey === copyKey ? (
                                <span className="text-emerald-600 font-bold flex items-center gap-0.5">
                                  <Check className="h-3 w-3" /> Copied Emails
                                </span>
                              ) : (
                                <span className="flex items-center gap-0.5">
                                  <Copy className="h-3 w-3" /> Copy Emails
                                </span>
                              )}
                            </button>
                          </div>

                          {station.officers && station.officers.length > 0 ? (
                            station.officers.map((officer, idx) => (
                              <div key={idx} className="text-xs space-y-0.5 border-b border-slate-200/60 pb-1.5 last:border-none last:pb-0">
                                <div className="font-extrabold text-slate-800 flex items-center gap-1.5">
                                  <User className="h-3 w-3 text-blue-500" />
                                  <span>{officer.name}</span>
                                  <span className="text-[10px] font-normal text-slate-500">({officer.role})</span>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
                                  <a
                                    href={`mailto:${officer.email}?subject=Ideal%20Group%20Complaint%20Follow-up%20(${station.name})&body=Dear%20${encodeURIComponent(officer.name)},%0A%0A`}
                                    className="flex items-center gap-1 text-blue-600 hover:underline font-mono"
                                    title="Send direct email"
                                  >
                                    <Mail className="h-3 w-3" />
                                    {officer.email}
                                  </a>
                                  <span className="flex items-center gap-1 text-emerald-600 font-mono">
                                    <Phone className="h-3 w-3" />
                                    {officer.phone}
                                  </span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-xs text-slate-600 font-mono">
                              {station.email} &bull; {station.phone}
                            </div>
                          )}
                        </div>

                        {/* Expandable Counts & Appointed Times Summary Breakdown */}
                        {pendingCasesToContact.length > 0 && (
                          <div className="border border-blue-200 rounded-lg overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setExpandedStationCode(isExpanded ? null : station.code)}
                              className="w-full bg-blue-50 hover:bg-blue-100 p-2 text-left text-xs font-bold text-blue-900 flex items-center justify-between transition-colors cursor-pointer"
                            >
                              <span className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5 text-blue-600" />
                                <span>View Appointed Times & Category Counts ({pendingCasesToContact.length} Pending)</span>
                              </span>
                              {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            </button>

                            {isExpanded && (
                              <div className="p-3 bg-white space-y-3 text-xs divide-y divide-slate-100">
                                <div>
                                  <div className="font-bold text-slate-700 mb-1.5 flex items-center gap-1 text-[11px] uppercase tracking-wider">
                                    <Calendar className="h-3 w-3 text-blue-600" /> Appointed Times & Daily Intake:
                                  </div>
                                  <div className="grid grid-cols-2 gap-1.5">
                                    {Object.entries(appointedTimesMap).map(([dt, cCount]) => (
                                      <div key={dt} className="p-1.5 bg-slate-50 rounded border border-slate-200 flex items-center justify-between text-[11px]">
                                        <span className="font-semibold text-slate-700">{dt}</span>
                                        <span className="font-extrabold text-blue-700 bg-blue-100 px-1.5 py-0.2 rounded text-[10px]">
                                          {cCount} case{cCount === 1 ? "" : "s"}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div className="pt-2">
                                  <div className="font-bold text-slate-700 mb-1.5 flex items-center gap-1 text-[11px] uppercase tracking-wider">
                                    <Layers className="h-3 w-3 text-blue-600" /> Category Breakdown:
                                  </div>
                                  <div className="grid grid-cols-2 gap-1.5">
                                    {Object.entries(categoryMap).map(([cat, cCount]) => (
                                      <div key={cat} className="p-1.5 bg-slate-50 rounded border border-slate-200 flex items-center justify-between text-[11px]">
                                        <span className="font-medium text-slate-700 truncate pr-1">{cat}</span>
                                        <span className="font-extrabold text-slate-900 bg-slate-200 px-1.5 py-0.2 rounded text-[10px]">
                                          {cCount}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Manual Dispatch Trigger, Direct Mailto & Copy Message */}
                      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleCopyText(getStationDispatchMessage(station), `MSG_${station.code}`)}
                            className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-black transition-all flex items-center gap-1 cursor-pointer"
                            title="Copy concise summary dispatch email text for this station"
                          >
                            {copiedKey === `MSG_${station.code}` ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-600" />
                                <span className="text-emerald-600 font-bold">Copied Summary!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3 text-blue-600" />
                                <span>Copy Summary</span>
                              </>
                            )}
                          </button>

                          <a
                            href={getStationMailtoLink(station)}
                            className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                            title="Open default email client (Outlook/Gmail) with pre-filled summary notice"
                          >
                            <ExternalLink className="h-3 w-3 text-slate-500" />
                            <span>Open in Mail App</span>
                          </a>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleManualDispatchForStation(station)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs hover:shadow flex items-center gap-1.5 cursor-pointer"
                        >
                          <Send className="h-3 w-3" />
                          <span>Dispatch Email ({pendingCasesToContact.length})</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: SYSTEMIC EMAIL LOGS */}
          {activeTab === "logs" && (
            <div className="space-y-4">
              {emailLogs.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
                  <Mail className="h-10 w-10 mx-auto text-slate-400 mb-2" />
                  <p className="text-xs font-bold text-slate-600">No systemic dispatch email logs recorded yet.</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Systemic emails are automatically logged whenever batch complaints are imported or manually dispatched.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
                    <table className="w-full text-xs text-left text-slate-700">
                      <thead className="bg-slate-100 text-slate-900 font-black uppercase text-[10px] tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="p-3">Dispatch Time</th>
                          <th className="p-3">Workstation</th>
                          <th className="p-3">Recipients</th>
                          <th className="p-3">Subject</th>
                          <th className="p-3 text-center">Cases to Contact</th>
                          <th className="p-3 text-center">Status</th>
                          <th className="p-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {emailLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 font-mono text-[11px] text-slate-500">
                              {new Date(log.sentAt).toLocaleString()}
                            </td>
                            <td className="p-3 font-bold text-slate-900">
                              {log.station}
                            </td>
                            <td className="p-3 font-mono text-[11px] text-blue-600 max-w-[200px] truncate">
                              {log.recipients.join(", ")}
                            </td>
                            <td className="p-3 font-medium text-slate-800 max-w-[250px] truncate">
                              {log.subject}
                            </td>
                            <td className="p-3 text-center font-bold">
                              <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-[10px] border border-amber-300">
                                {log.complaintCount} to contact
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                {log.status}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <button
                                type="button"
                                onClick={() => setSelectedLog(log)}
                                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded text-[11px] font-bold transition-all cursor-pointer"
                              >
                                View Email
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* FULL EMAIL HTML PREVIEW MODAL */}
      {selectedLog && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200">
            <div className="bg-white text-slate-900 p-4 flex items-center justify-between border-b border-slate-200">
              <div className="flex items-center gap-2 text-xs font-bold">
                <Mail className="h-4 w-4 text-blue-600" />
                <span>Email Preview - {selectedLog.subject}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyText(selectedLog.recipients.join(", "), "LOG_RECIPIENTS")}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer border border-slate-300"
                >
                  {copiedKey === "LOG_RECIPIENTS" ? (
                    <span className="text-emerald-600 flex items-center gap-1"><Check className="h-3 w-3" /> Copied!</span>
                  ) : (
                    <span className="flex items-center gap-1"><Copy className="h-3 w-3" /> Copy Recipients</span>
                  )}
                </button>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto flex-1 bg-slate-100">
              <div
                dangerouslySetInnerHTML={{ __html: selectedLog.bodyHtml }}
                className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden text-left"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};



