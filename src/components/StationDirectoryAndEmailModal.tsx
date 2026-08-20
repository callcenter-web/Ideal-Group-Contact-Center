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
  Check
} from "lucide-react";
import { dispatchSystemicEmailsForComplaints, generateSystemicEmailContent } from "../utils/systemicEmailNotifier";

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

  // Build full structured dispatch message for a station (counts only, no individual detail rows)
  const getStationDispatchMessage = (station: StationProfile) => {
    const stationComplaints = complaints.filter(
      (c) => c.station === station.name || c.station === station.code || c.station.toLowerCase().includes(station.code.toLowerCase())
    );

    const recipients = station.officers
      ? station.officers.map((o) => `${o.name} <${o.email}>`).join(", ")
      : station.email || "callcenter@idealgroup.lk";

    const count = stationComplaints.length;
    const toContactCount = stationComplaints.filter(
      (c) => c.status === "Pending" || !c.status || c.stationResponseStatus === "Pending" || !c.stationContactedDate
    ).length;
    const inProgressCount = stationComplaints.filter(
      (c) => c.status === "In Progress" || c.status === "Contacted"
    ).length;
    const resolvedCount = stationComplaints.filter((c) => c.status === "Resolved").length;
    const rejectedCount = stationComplaints.filter(
      (c) =>
        c.stationResponseStatus === "Rejected" ||
        c.stationResponseStatus === "Rejected by Call Center" ||
        c.stationResponseStatus === "Returned to Service Station" ||
        c.feedbackStatus === "Rejected Again to Service Station" ||
        c.feedbackStatus === "Returned to Service Station"
    ).length;
    const getAgingDays = (c: Complaint) => {
      if (!c.date) return 0;
      const t = new Date(c.date).getTime();
      if (isNaN(t)) return 0;
      return Math.max(0, Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24)));
    };

    const highPriorityCount = stationComplaints.filter(
      (c) => c.initialSatisfaction === "Very Dissatisfied" || getAgingDays(c) > 5 || c.feedbackStatus === "Still Dissatisfied"
    ).length;

    // Categories breakdown
    const categoryMap: Record<string, number> = {};
    stationComplaints.forEach((c) => {
      const cat = c.category || c.mchCodeDescription || "General Service";
      categoryMap[cat] = (categoryMap[cat] || 0) + 1;
    });

    const subject = `[Ideal Aftermarket] Complaint Summary Notice - ${count} Assigned Case(s) for ${station.name}`;

    let msg = `====================================================\n`;
    msg += `IDEAL GROUP CENTRAL CALL CENTER - COMPLAINT SUMMARY NOTICE\n`;
    msg += `====================================================\n`;
    msg += `SENDER: callcenter@idealgroup.lk\n`;
    msg += `TO: ${recipients}\n`;
    msg += `STATION: ${station.name}\n`;
    msg += `SUBJECT: ${subject}\n`;
    msg += `DISPATCH DATE: ${new Date().toLocaleString()}\n`;
    msg += `====================================================\n\n`;
    msg += `Dear ${station.name} Workshop & Service Management Team,\n\n`;
    msg += `Central Call Center has registered ${count} total assigned customer complaint case(s) for your workstation.\n\n`;
    
    msg += `1. EXECUTIVE COUNTS SUMMARY:\n`;
    msg += `   - Total Assigned Complaints: ${count}\n`;
    msg += `   - Pending Station Contact (To Contact): ${toContactCount}\n`;
    msg += `   - In Progress / Contacted: ${inProgressCount}\n`;
    msg += `   - Resolved Cases: ${resolvedCount}\n`;
    msg += `   - Returned / Rejected for Re-action: ${rejectedCount}\n`;
    msg += `   - High / Critical Priority: ${highPriorityCount}\n\n`;

    msg += `2. CATEGORY BREAKDOWN COUNTS:\n`;
    if (Object.keys(categoryMap).length > 0) {
      Object.entries(categoryMap).forEach(([cat, cCount]) => {
        const pct = count > 0 ? Math.round((cCount / count) * 100) : 0;
        msg += `   * ${cat}: ${cCount} case(s) (${pct}%)\n`;
      });
    } else {
      msg += `   * No active category records.\n`;
    }
    msg += `\n`;

    const aging03 = stationComplaints.filter((c) => getAgingDays(c) <= 3).length;
    const aging35 = stationComplaints.filter((c) => getAgingDays(c) > 3 && getAgingDays(c) <= 5).length;
    const aging610 = stationComplaints.filter((c) => getAgingDays(c) > 5 && getAgingDays(c) <= 10).length;
    const agingOver10 = stationComplaints.filter((c) => getAgingDays(c) > 10).length;

    msg += `3. AGING / SLA COMPLIANCE COUNTS:\n`;
    msg += `   * 0 - 3 Days (Normal SLA): ${aging03}\n`;
    msg += `   * 3 - 5 Days (Pending SLA): ${aging35}\n`;
    msg += `   * 6 - 10 Days (Escalated SLA): ${aging610}\n`;
    msg += `   * > 10 Days (Critical Overdue): ${agingOver10}\n\n`;

    msg += `MANDATORY ACTION REQUIRED:\n`;
    msg += `Please log in to the Ideal Group Complaint System portal to inspect customer contact details, contact the customers, and update 'Date Contacted' and 'Solution Provided'.\n\n`;
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
    combinedMsg += `ALL WORKSTATIONS MASTER CALL CENTER DISPATCH SUMMARY\n`;
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
      (c) => c.station === station.name || c.station === station.code || c.station.toLowerCase().includes(station.code.toLowerCase())
    );

    const targetList = stationComplaints.length > 0 ? stationComplaints : complaints.slice(0, 2);
    const newLogs = dispatchSystemicEmailsForComplaints(targetList);

    setDispatchStatusMsg(`✅ Summary Email successfully dispatched to ${station.name} from callcenter@idealgroup.lk`);
    if (onRefreshEmailLogs) onRefreshEmailLogs();

    setTimeout(() => {
      setDispatchStatusMsg(null);
    }, 4500);
  };

  // Build mailto link for direct sending via desktop email client (Outlook/Gmail)
  const getStationMailtoLink = (station: StationProfile) => {
    const stationComplaints = complaints.filter(
      (c) => c.station === station.name || c.station === station.code || c.station.toLowerCase().includes(station.code.toLowerCase())
    );
    const recipients = station.officers
      ? station.officers.map((o) => o.email).join(",")
      : station.email || "callcenter@idealgroup.lk";

    const count = stationComplaints.length;
    const toContactCount = stationComplaints.filter(
      (c) => c.status === "Pending" || !c.status || c.stationResponseStatus === "Pending" || !c.stationContactedDate
    ).length;
    const getAgingDays = (c: Complaint) => {
      if (!c.date) return 0;
      const t = new Date(c.date).getTime();
      if (isNaN(t)) return 0;
      return Math.max(0, Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24)));
    };

    const highPriorityCount = stationComplaints.filter(
      (c) => c.initialSatisfaction === "Very Dissatisfied" || getAgingDays(c) > 5 || c.feedbackStatus === "Still Dissatisfied"
    ).length;
    const rejectedCount = stationComplaints.filter(
      (c) =>
        c.stationResponseStatus === "Rejected" ||
        c.stationResponseStatus === "Rejected by Call Center" ||
        c.stationResponseStatus === "Returned to Service Station" ||
        c.feedbackStatus === "Rejected Again to Service Station" ||
        c.feedbackStatus === "Returned to Service Station"
    ).length;

    const subject = encodeURIComponent(`[Ideal Aftermarket] Complaint Summary Notice - ${count} Assigned Case(s) for ${station.name}`);

    let bodyText = `From: callcenter@idealgroup.lk\nTo: ${recipients}\nStation: ${station.name}\n\nDear Station Team,\n\nPlease find the summary counts of assigned complaints for ${station.name}:\n\n- Total Assigned Cases: ${count}\n- Pending Customer Contact: ${toContactCount}\n- High / Urgent Priority: ${highPriorityCount}\n- Returned / Rejected for Re-action: ${rejectedCount}\n\nPlease log in to the Central Call Center portal to access full customer details and record date contacted and solutions.\n\nRegards,\nCentral Call Center\nIdeal Group Sri Lanka\ncallcenter@idealgroup.lk`;

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
                Workstation Contact Directory & Systemic Dispatch
              </h2>
              <p className="text-xs text-slate-300">
                Central Call Center (<a href="mailto:callcenter@idealgroup.lk" className="underline text-blue-300 hover:text-white">callcenter@idealgroup.lk</a>) automated workshop dispatch & contacts
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
                📍 Service Station Directory ({STATIONS.length})
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
                <span>Dispatch Email Logs ({emailLogs.length})</span>
              </button>
            </div>

            {/* Copy All Emails, Copy All Messages & Call Center Email Connection */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopyAllStationMessages}
                className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                title="Copy complete dispatch message text for all workstations to clipboard"
              >
                {copiedKey === "ALL_STATION_MESSAGES" ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-300" />
                    <span className="text-emerald-200">Copied All Messages!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-blue-200" />
                    <span>Copy All Dispatch Messages</span>
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

              <a
                href="mailto:callcenter@idealgroup.lk"
                className="text-xs text-slate-700 dark:text-slate-300 font-medium flex items-center gap-1 bg-blue-50 dark:bg-blue-950/40 px-3 py-1.5 rounded-lg border border-blue-200/60 dark:border-blue-800 hover:border-blue-400 transition-colors"
              >
                <Mail className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                <span>Sender: <strong className="text-blue-700 dark:text-blue-400">callcenter@idealgroup.lk</strong></span>
              </a>
            </div>
          </div>

          {/* TAB 1: WORKSTATION DIRECTORY */}
          {activeTab === "directory" && (
            <div className="space-y-4">
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-3 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start justify-between gap-2.5">
                <div className="flex items-start gap-2.5">
                  <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Automated Systemic Email Dispatch Protocol</p>
                    <p className="text-slate-700 dark:text-amber-300/90 leading-relaxed mt-0.5">
                      When complaints are imported or updated, an automated systemic dispatch is generated from <strong>callcenter@idealgroup.lk</strong>. You can also click <strong>"Direct Open Email App"</strong> to launch your default mail client with pre-filled details.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {STATIONS.map((station) => {
                  const stationComplaints = complaints.filter(
                    (c) => c.station === station.name || c.station === station.code || c.station.toLowerCase().includes(station.code.toLowerCase())
                  );

                  const stationEmailsList = station.officers
                    ? station.officers.map((o) => o.email).join(", ")
                    : station.email || "";

                  const copyKey = `STATION_${station.code}`;

                  return (
                    <div
                      key={station.name}
                      className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm hover:shadow-md transition-all space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        {/* Header & Complaint Count Badge */}
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                          <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-blue-600" />
                            {station.name}
                          </h3>
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 border border-blue-200">
                            {stationComplaints.length} Pending Complaints
                          </span>
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
                      </div>

                      {/* Manual Dispatch Trigger, Direct Mailto & Copy Message */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleCopyText(getStationDispatchMessage(station), `MSG_${station.code}`)}
                            className="px-2.5 py-1.5 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-black transition-all flex items-center gap-1 cursor-pointer"
                            title="Copy complete structured dispatch email text for this station"
                          >
                            {copiedKey === `MSG_${station.code}` ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">Copied Message!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                                <span>Copy Dispatch Message</span>
                              </>
                            )}
                          </button>

                          <a
                            href={getStationMailtoLink(station)}
                            className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                            title="Open default email client (Outlook/Gmail) with pre-filled content from callcenter@idealgroup.lk"
                          >
                            <ExternalLink className="h-3 w-3 text-slate-500" />
                            <span>Open Email App</span>
                          </a>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleManualDispatchForStation(station)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs hover:shadow flex items-center gap-1.5 cursor-pointer"
                        >
                          <Send className="h-3 w-3" />
                          <span>Systemic Dispatch Email</span>
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
                          <th className="p-3 text-center">Complaints</th>
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
                              <span className="bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded-full text-[10px]">
                                {log.complaintCount} items
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
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-slate-700">
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

