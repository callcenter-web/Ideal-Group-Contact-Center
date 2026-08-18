import React from "react";
import { 
  X, 
  History, 
  PhoneCall, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  PhoneOff, 
  PhoneMissed,
  User,
  Calendar,
  MessageSquare,
  FileText
} from "lucide-react";
import { Complaint, ContactAttemptEvent } from "../types";

interface ContactHistoryModalProps {
  complaint: Complaint | null;
  isOpen: boolean;
  onClose: () => void;
  theme?: "light" | "dark";
}

export default function ContactHistoryModal({
  complaint,
  isOpen,
  onClose,
  theme = "light"
}: ContactHistoryModalProps) {
  const isDark = theme === "dark";

  if (!isOpen || !complaint) return null;

  const attempts: ContactAttemptEvent[] = Array.isArray(complaint.contactAttempts) 
    ? complaint.contactAttempts 
    : [];

  const caseHistory = Array.isArray(complaint.caseHistory)
    ? complaint.caseHistory
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className={`w-full max-w-2xl rounded-2xl shadow-2xl border overflow-hidden transition-all duration-300 max-h-[85vh] flex flex-col ${
        isDark ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-900"
      }`}>
        
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/10 text-blue-600 border border-blue-200 dark:border-blue-900">
              <History className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black uppercase tracking-wider">
                  Contact Attempt & Audit History
                </h3>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {complaint.id}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Customer: <strong className="text-slate-800 dark:text-slate-200">{complaint.customerName}</strong> ({complaint.customerPhone}) • Station: <strong className="text-blue-600">{complaint.station}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          
          {/* Summary Overview */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 text-center">
              <span className="text-[10px] font-black uppercase text-slate-500 block">Total Attempts</span>
              <span className="text-lg font-black text-slate-900 dark:text-slate-100 mt-0.5 block">
                {attempts.length > 0 ? attempts.length : (complaint.contactAttemptCount || (complaint.serviceStationContactedAt ? 1 : 0))}
              </span>
            </div>
            <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 text-center">
              <span className="text-[10px] font-black uppercase text-slate-500 block">Current Status</span>
              <span className={`text-xs font-black px-2 py-0.5 rounded-full inline-block mt-1 ${
                complaint.serviceStationContactStatus === "CONTACTED"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                  : complaint.serviceStationContactStatus === "NOT_CONTACTED"
                    ? "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300"
                    : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
              }`}>
                {complaint.serviceStationContactStatus || "NOT_CONTACTED"}
              </span>
            </div>
            <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 text-center">
              <span className="text-[10px] font-black uppercase text-slate-500 block">Last Attempt</span>
              <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 mt-1 block truncate">
                {complaint.lastContactAttemptAt || complaint.serviceStationContactedAt || complaint.stationContactedDate || "None"}
              </span>
            </div>
          </div>

          {/* Contact Attempts Timeline */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <PhoneCall className="h-3.5 w-3.5 text-blue-600" />
              <span>Contact Attempts Log</span>
            </h4>

            {attempts.length === 0 ? (
              <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400">
                <PhoneOff className="h-6 w-6 mx-auto mb-2 opacity-50" />
                <p className="text-xs font-bold">No individual contact attempts logged yet.</p>
                {complaint.stationContactedDate && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    Legacy contact recorded on: {complaint.stationContactedDate} by {complaint.advisorName || "Station"}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {attempts.map((att, idx) => {
                  const isContacted = att.outcome === "CONTACTED";
                  const isAttempted = att.outcome === "CONTACT_ATTEMPTED";
                  const isUnreachable = att.outcome === "CUSTOMER_UNREACHABLE";

                  return (
                    <div
                      key={att.id || idx}
                      className={`p-3 rounded-xl border transition-all ${
                        isContacted
                          ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900"
                          : isAttempted
                            ? "bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900"
                            : isUnreachable
                              ? "bg-orange-50/40 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900"
                              : "bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                            Attempt #{attempts.length - idx}
                          </span>
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                            isContacted
                              ? "bg-emerald-100 text-emerald-800"
                              : isAttempted
                                ? "bg-amber-100 text-amber-800"
                                : "bg-orange-100 text-orange-800"
                          }`}>
                            {att.outcome}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500">
                            via {att.contactMethod || "Phone Call"}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 font-semibold">
                          {att.timestamp}
                        </span>
                      </div>

                      <div className="mt-2 space-y-1 text-xs">
                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                          <User className="h-3 w-3" />
                          <span className="font-semibold">Actioned By:</span>
                          <strong className="text-slate-800 dark:text-slate-200">{att.actorName}</strong>
                          <span className="text-[10px] text-slate-400">({att.actorRole})</span>
                        </div>

                        {att.customerResponse && (
                          <div className="flex items-start gap-1.5 text-slate-700 dark:text-slate-300 bg-white/60 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800">
                            <MessageSquare className="h-3.5 w-3.5 text-blue-600 shrink-0 mt-0.5" />
                            <div>
                              <span className="text-[10px] font-black uppercase text-slate-400 block">Customer Response:</span>
                              <span className="font-medium italic">"{att.customerResponse}"</span>
                            </div>
                          </div>
                        )}

                        {att.remarks && (
                          <div className="flex items-start gap-1.5 text-slate-700 dark:text-slate-300 bg-white/60 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800">
                            <FileText className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5" />
                            <div>
                              <span className="text-[10px] font-black uppercase text-slate-400 block">Action / Resolution Notes:</span>
                              <span className="font-medium leading-relaxed">{att.remarks}</span>
                            </div>
                          </div>
                        )}

                        {att.nextFollowUpDate && (
                          <div className="text-[10px] font-bold text-amber-700 dark:text-amber-400 pt-0.5">
                            📅 Next Follow-Up Scheduled: <strong>{att.nextFollowUpDate}</strong>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Workflow & Rejection History */}
          {caseHistory.length > 0 && (
            <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <History className="h-3.5 w-3.5 text-slate-500" />
                <span>Workflow & Status Transitions</span>
              </h4>
              <div className="space-y-1.5">
                {caseHistory.map((h, i) => (
                  <div key={h.id || i} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 text-xs">
                    <div className="flex items-center justify-between text-[10px]">
                      <strong className="text-slate-800 dark:text-slate-200">{h.action}</strong>
                      <span className="text-slate-400 font-mono">{h.timestamp}</span>
                    </div>
                    {h.rejectionReason && (
                      <p className="text-[11px] text-rose-700 dark:text-rose-400 font-medium italic mt-1 bg-rose-50 dark:bg-rose-950/50 p-1.5 rounded">
                        Rejection: "{h.rejectionReason}"
                      </p>
                    )}
                    {h.notes && !h.rejectionReason && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">{h.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
