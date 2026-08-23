import React, { useState } from "react";
import { Complaint, StationProfile, SystemicEmailLog, UserProfile } from "../types";
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
  Car,
  Filter
} from "lucide-react";
import { dispatchSystemicEmailsForComplaints, generateSystemicEmailContent, getPendingCasesToContact } from "../utils/systemicEmailNotifier";
import { matchesStationCodeOrName, isStationContacted, isComplaintRejected } from "../utils/stationUtils";

interface StationDirectoryAndEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  complaints: Complaint[];
  emailLogs: SystemicEmailLog[];
  onRefreshEmailLogs?: () => void;
}

export const StationDirectoryAndEmailModal: React.FC<StationDirectoryAndEmailModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  complaints,
  emailLogs,
  onRefreshEmailLogs,
}) => {
  const [activeTab, setActiveTab] = useState<"directory" | "logs">("directory");
  const [selectedLog, setSelectedLog] = useState<SystemicEmailLog | null>(null);
  const [dispatchStatusMsg, setDispatchStatusMsg] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [expandedStationCode, setExpandedStationCode] = useState<string | null>(null);
  const [filterStationsWithPendingOnly, setFilterStationsWithPendingOnly] = useState<boolean>(false);

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

  // Build full structured dispatch message for a station focusing on pending cases to contact
  const getStationDispatchMessage = (station: StationProfile) => {
    const stationComplaints = complaints.filter(
      (c) => matchesStationCodeOrName(c.station, station.code) || matchesStationCodeOrName(c.station, station.name)
    );

    const pendingCasesToContact = getPendingCasesToContact(stationComplaints);
    const count = pendingCasesToContact.length;

    const recipients = station.officers
      ? station.officers.map((o) => `${o.name} <${o.email}>`).join(", ")
      : station.email || "callcenter@idealgroup.lk";

    const highPriorityCount = pendingCasesToContact.filter(
      (c) => c.initialSatisfaction === "Very Dissatisfied" || getAgingDays(c) > 3 || c.feedbackStatus === "Still Dissatisfied"
    ).length;

    const rejectedCount = pendingCasesToContact.filter((c) => isComplaintRejected(c)).length;
    const overdueCount = pendingCasesToContact.filter((c) => getAgingDays(c) > 3).length;

    // Categories breakdown
    const categoryMap: Record<string, number> = {};
    pendingCasesToContact.forEach((c) => {
      const cat = c.category || c.mchCodeDescription || "General Service";
      categoryMap[cat] = (categoryMap[cat] || 0) + 1;
    });

    const subject = count > 0
      ? `[Ideal Aftermarket] Action Required: ${count} Pending Case(s) for ${station.name} to Contact`
      : `[Ideal Aftermarket] Status Notice: No Pending Cases to Contact - ${station.name}`;

    let msg = `====================================================\n`;
    msg += `IDEAL GROUP CENTRAL CALL CENTER - WORKSTATION DISPATCH NOTICE\n`;
    msg += `====================================================\n`;
    msg += `SENDER: callcenter@idealgroup.lk\n`;
    msg += `TO: ${recipients}\n`;
    msg += `STATION: ${station.name}\n`;
    msg += `SUBJECT: ${subject}\n`;
    msg += `DISPATCH DATE: ${new Date().toLocaleString()}\n`;
    msg += `====================================================\n\n`;
    msg += `Dear ${station.name} Workshop & Service Management Team,\n\n`;
    
    if (count === 0) {
      msg += `All assigned complaints for ${station.name} have been contacted and resolved. There are currently NO pending cases requiring station contact.\n\n`;
    } else {
      msg += `Central Call Center has recorded ${count} pending customer complaint case(s) that require your immediate customer contact, workshop inspection, and status update in the portal.\n\n`;
      
      msg += `1. PENDING CASES ACTION SUMMARY:\n`;
      msg += `   - Cases Requiring Station Contact: ${count}\n`;
      msg += `   - Critical / High Dissatisfaction: ${highPriorityCount}\n`;
      msg += `   - Returned / Rejected for Re-action: ${rejectedCount}\n`;
      msg += `   - Overdue SLA (> 3 Days): ${overdueCount}\n\n`;

      msg += `2. ITEMIZED LIST OF PENDING CASES TO CONTACT:\n`;
      msg += `----------------------------------------------------\n`;
      pendingCasesToContact.forEach((c, idx) => {
        const aging = getAgingDays(c);
        const isRej = isComplaintRejected(c);
        const statusLabel = isRej ? "⚠️ Returned to Station (Re-action Required)" : "⏳ Pending Station Contact & Inspection";
        
        msg += `[${idx + 1}] Case ID: ${c.id}${c.woNo ? ` | WO: ${c.woNo}` : ""}\n`;
        msg += `    * Vehicle Reg No: ${c.vehicleRegNo || "N/A"}${c.chassiNo ? ` (Chassis: ${c.chassiNo})` : ""}\n`;
        msg += `    * Customer Name: ${c.customerName || "Valued Customer"}\n`;
        msg += `    * Customer Phone: ${c.customerPhone || "N/A"}${c.customerEmail ? ` | Email: ${c.customerEmail}` : ""}\n`;
        msg += `    * Category / Issue: ${c.category || c.mchCodeDescription || "General Service"}\n`;
        msg += `    * Customer Voice / Complaint: ${c.description || c.notes || "No complaint notes"}\n`;
        msg += `    * Date Logged: ${c.date || "N/A"} (${aging} day${aging === 1 ? "" : "s"} aging)\n`;
        msg += `    * Satisfaction: ${c.initialSatisfaction || "Dissatisfied"}\n`;
        msg += `    * Current Action Status: ${statusLabel}\n`;
        if (c.stationResponseRejectionReason) {
          msg += `    * Rejection Reason: ${c.stationResponseRejectionReason}\n`;
        }
        if (c.advisorName) {
          msg += `    * Assigned Advisor: ${c.advisorName}\n`;
        }
        msg += `----------------------------------------------------\n`;
      });
      msg += `\n`;

      msg += `3. PENDING CATEGORY BREAKDOWN:\n`;
      if (Object.keys(categoryMap).length > 0) {
        Object.entries(categoryMap).forEach(([cat, cCount]) => {
          const pct = count > 0 ? Math.round((cCount / count) * 100) : 0;
          msg += `   * ${cat}: ${cCount} case(s) (${pct}%)\n`;
        });
      } else {
        msg += `   * No active category records.\n`;
      }
      msg += `\n`;
    }

    msg += `MANDATORY ACTION REQUIRED:\n`;
    msg += `Please contact the above customer(s) directly on their provided phone numbers. After conducting the call and inspection, log into the Ideal Group Complaint System portal to record 'Date Contacted' and 'Solution Provided'.\n\n`;
    msg += `For support or re-assignments, contact: callcenter@idealgroup.lk\n\n`;
    msg += `Best Regards,\n`;
    msg += `Central Call Center Operations Team\n`;
    msg += `Ideal Group Sri Lanka\n`;
    msg += `Email: callcenter@idealgroup.lk\n`;

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
    const newLogs = dispatchSystemicEmailsForComplaints(targetList);

    setDispatchStatusMsg(`✅ Email successfully dispatched to ${station.name} (${pendingCases.length} pending cases to contact) from callcenter@idealgroup.lk`);
    if (onRefreshEmailLogs) onRefreshEmailLogs();

    setTimeout(() => {
      setDispatchStatusMsg(null);
    }, 4500);
  };

  // Build mailto link for direct sending via desktop email client (Outlook/Gmail)
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
        ? `[Ideal Aftermarket] Action Required: ${count} Pending Case(s) for ${station.name} to Contact`
        : `[Ideal Aftermarket] Status Notice: No Pending Cases to Contact - ${station.name}`
    );

    let bodyText = `From: callcenter@idealgroup.lk\nTo: ${recipients}\nStation: ${station.name}\n\n`;
    if (count === 0) {
      bodyText += `Dear Station Team,\n\nAll complaints assigned to ${station.name} are currently contacted and resolved. No pending cases requiring contact.\n\nRegards,\nCentral Call Center\ncallcenter@idealgroup.lk`;
    } else {
      bodyText += `Dear ${station.name} Workshop Team,\n\nPlease find the ${count} pending complaint case(s) requiring immediate customer contact and inspection:\n\n`;
      pendingCasesToContact.forEach((c, idx) => {
        bodyText += `${idx + 1}. [${c.id}] Vehicle: ${c.vehicleRegNo || "N/A"} | Customer: ${c.customerName} (Tel: ${c.customerPhone}) | Category: ${c.category || "Service"} | Note: ${c.description || "N/A"}\n`;
      });
      bodyText += `\nPlease log into the Ideal Group Complaint System portal to record Date Contacted and Solution Provided.\n\nRegards,\nCentral Call Center\nIdeal Group Sri Lanka\ncallcenter@idealgroup.lk`;
    }

    return `mailto:${recipients}?subject=${subject}&body=${encodeURIComponent(bodyText)}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden max-w-5xl w-full mx-auto my-auto text-left">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/30 border border-blue-400/30 rounded-xl">
              <Mail className="h-6 w-6 text-blue-300" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                Workstation Contact Directory & Pending Cases Dispatch
              </h2>
              <p className="text-xs text-slate-300">
                Central Call Center (<a href="mailto:callcenter@idealgroup.lk" className="underline text-blue-300 hover:text-white">callcenter@idealgroup.lk</a>) &bull; Only includes pending cases service station must contact
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Switcher & Status banner */}
        <div className="p-4 sm:p-6 space-y-5">
          {dispatchStatusMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2 shadow-2xs">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              {dispatchStatusMsg}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab("directory")}
                className={`px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  activeTab === "directory"
                    ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                📍 Service Stations ({STATIONS.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("logs")}
                className={`px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "logs"
                    ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
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
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-200"
                  }`}
                >
                  <Filter className="h-3.5 w-3.5" />
                  <span>{filterStationsWithPendingOnly ? "Showing Stations with Pending Only" : "Show Pending Only"}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleCopyAllStationMessages}
                className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                title="Copy complete dispatch message text for all workstations with pending cases list"
              >
                {copiedKey === "ALL_STATION_MESSAGES" ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-300" />
                    <span className="text-emerald-200">Copied All Messages!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-blue-200" />
                    <span>Copy All Dispatch Texts</span>
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
                    <span className="text-emerald-400">Copied All Station Emails!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-blue-300" />
                    <span>Copy All Station Emails</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* TAB 1: WORKSTATION DIRECTORY */}
          {activeTab === "directory" && (
            <div className="space-y-4">
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-3 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start justify-between gap-2.5">
                <div className="flex items-start gap-2.5">
                  <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Automated Email Dispatch - Pending Cases Scope</p>
                    <p className="text-slate-700 dark:text-amber-300/90 leading-relaxed mt-0.5">
                      All dispatch emails sent to service stations exclusively contain <strong>pending cases that the service station has to contact</strong> (including cases not yet contacted and cases returned by the Call Center for re-action). Click <strong>"Preview Cases to Contact"</strong> on any station to view the exact customer and vehicle records before dispatching.
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

                  const stationEmailsList = station.officers
                    ? station.officers.map((o) => o.email).join(", ")
                    : station.email || "";

                  const copyKey = `STATION_${station.code}`;

                  return (
                    <div
                      key={station.name}
                      className={`bg-white dark:bg-slate-900 rounded-xl border p-4 shadow-sm hover:shadow-md transition-all space-y-3 flex flex-col justify-between ${
                        pendingCasesToContact.length > 0
                          ? "border-amber-300 dark:border-amber-700/60 bg-amber-50/20 dark:bg-amber-950/10"
                          : "border-slate-200 dark:border-slate-800"
                      }`}
                    >
                      <div className="space-y-2">
                        {/* Header & Complaint Count Badge */}
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                          <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-blue-600" />
                            {station.name}
                          </h3>
                          <div className="flex items-center gap-1.5">
                            {pendingCasesToContact.length > 0 ? (
                              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300 animate-pulse flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3 text-amber-600" />
                                {pendingCasesToContact.length} to Contact
                              </span>
                            ) : (
                              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 border border-emerald-300 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                0 Pending Contact
                              </span>
                            )}
                            <span className="text-[9px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                              {stationComplaints.length} Total
                            </span>
                          </div>
                        </div>

                        {/* Physical Address */}
                        <div className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
                          <MapPin className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-0.5" />
                          <span>{station.address || "Ideal Group Workshop Location"}</span>
                        </div>

                        {/* Officers List */}
                        <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-700 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                              Designated Workshop Personnel:
                            </p>
                            <button
                              type="button"
                              onClick={() => handleCopyText(stationEmailsList, copyKey)}
                              className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                              title="Copy email list for this station"
                            >
                              {copiedKey === copyKey ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
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
                              <div key={idx} className="text-xs space-y-0.5 border-b border-slate-200/50 dark:border-slate-700/50 pb-1.5 last:border-none last:pb-0">
                                <div className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                  <User className="h-3 w-3 text-blue-500" />
                                  <span>{officer.name}</span>
                                  <span className="text-[10px] font-normal text-slate-500">({officer.role})</span>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600 dark:text-slate-400">
                                  <a
                                    href={`mailto:${officer.email}?subject=Ideal%20Group%20Complaint%20Follow-up%20(${station.name})&body=Dear%20${encodeURIComponent(officer.name)},%0A%0A`}
                                    className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-mono"
                                    title="Send direct email"
                                  >
                                    <Mail className="h-3 w-3" />
                                    {officer.email}
                                  </a>
                                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-mono">
                                    <Phone className="h-3 w-3" />
                                    {officer.phone}
                                  </span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-xs text-slate-600 dark:text-slate-400 font-mono">
                              {station.email} &bull; {station.phone}
                            </div>
                          )}
                        </div>

                        {/* Expandable Preview of Pending Cases to Contact */}
                        {pendingCasesToContact.length > 0 && (
                          <div className="border border-amber-200 dark:border-amber-800 rounded-lg overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setExpandedStationCode(isExpanded ? null : station.code)}
                              className="w-full bg-amber-100/70 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-900/50 p-2 text-left text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center justify-between transition-colors cursor-pointer"
                            >
                              <span className="flex items-center gap-1.5">
                                <Car className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400" />
                                <span>Preview {pendingCasesToContact.length} Pending Case(s) Included in Email</span>
                              </span>
                              {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            </button>

                            {isExpanded && (
                              <div className="p-2 bg-white dark:bg-slate-900 space-y-2 max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                                {pendingCasesToContact.map((pc) => {
                                  const aging = getAgingDays(pc);
                                  const isRej = isComplaintRejected(pc);
                                  return (
                                    <div key={pc.id} className="pt-2 first:pt-0 text-[11px] space-y-1">
                                      <div className="flex items-center justify-between font-bold">
                                        <span className="text-blue-700 dark:text-blue-400 font-mono">{pc.id} {pc.woNo ? `(WO: ${pc.woNo})` : ""}</span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-black ${
                                          aging > 5 ? "bg-red-100 text-red-700" : aging > 3 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                                        }`}>
                                          {aging}d aging
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between text-slate-800 dark:text-slate-200">
                                        <span className="font-extrabold text-slate-900 dark:text-slate-100">🚗 {pc.vehicleRegNo || "No Reg"}</span>
                                        <span className="text-emerald-700 dark:text-emerald-400 font-semibold">📞 {pc.customerPhone || "No Tel"}</span>
                                      </div>
                                      <div className="text-slate-600 dark:text-slate-400 truncate">
                                        <span className="font-semibold text-slate-700 dark:text-slate-300">{pc.customerName}:</span> {pc.description || pc.category}
                                      </div>
                                      {isRej && (
                                        <div className="text-[10px] text-rose-700 font-bold bg-rose-50 dark:bg-rose-950/40 p-1 rounded">
                                          ⚠️ Returned to Station: {pc.stationResponseRejectionReason || "Re-action required"}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Manual Dispatch Trigger, Direct Mailto & Copy Message */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleCopyText(getStationDispatchMessage(station), `MSG_${station.code}`)}
                            className="px-2.5 py-1.5 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-black transition-all flex items-center gap-1 cursor-pointer"
                            title="Copy complete structured dispatch email text for this station with pending cases"
                          >
                            {copiedKey === `MSG_${station.code}` ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">Copied Text!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                                <span>Copy Notice Text</span>
                              </>
                            )}
                          </button>

                          <a
                            href={getStationMailtoLink(station)}
                            className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                            title="Open default email client (Outlook/Gmail) with pre-filled pending cases list from callcenter@idealgroup.lk"
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
                <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                  <Mail className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-bold text-slate-500">No systemic dispatch email logs recorded yet.</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Systemic emails are automatically logged whenever batch complaints are imported or manually dispatched.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                    <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300">
                      <thead className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-black uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
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
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {emailLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="p-3 font-mono text-[11px] text-slate-500">
                              {new Date(log.sentAt).toLocaleString()}
                            </td>
                            <td className="p-3 font-bold text-slate-900 dark:text-slate-100">
                              {log.station}
                            </td>
                            <td className="p-3 font-mono text-[11px] text-blue-600 dark:text-blue-400 max-w-[200px] truncate">
                              {log.recipients.join(", ")}
                            </td>
                            <td className="p-3 font-medium text-slate-800 dark:text-slate-200 max-w-[250px] truncate">
                              {log.subject}
                            </td>
                            <td className="p-3 text-center font-bold">
                              <span className="bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 px-2 py-0.5 rounded-full text-[10px] border border-amber-300">
                                {log.complaintCount} to contact
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 border border-emerald-300 px-2 py-0.5 rounded-full text-[10px] font-bold">
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
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-slate-700">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2 text-xs font-bold">
                <Mail className="h-4 w-4 text-blue-400" />
                <span>Email Preview - {selectedLog.subject}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyText(selectedLog.recipients.join(", "), "LOG_RECIPIENTS")}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  {copiedKey === "LOG_RECIPIENTS" ? (
                    <span className="text-emerald-400 flex items-center gap-1"><Check className="h-3 w-3" /> Copied!</span>
                  ) : (
                    <span className="flex items-center gap-1"><Copy className="h-3 w-3" /> Copy Recipients</span>
                  )}
                </button>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto flex-1 bg-slate-100 dark:bg-slate-950">
              <div
                dangerouslySetInnerHTML={{ __html: selectedLog.bodyHtml }}
                className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden text-left"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


