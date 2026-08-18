import React from "react";
import { CaseHistoryEntry, Complaint } from "../types";
import { Clock, User, AlertTriangle, CheckCircle, ArrowRight, CornerDownLeft, ShieldCheck, PhoneCall } from "lucide-react";

interface CaseHistoryTimelineProps {
  complaint: Complaint;
  compact?: boolean;
}

export default function CaseHistoryTimeline({ complaint, compact = false }: CaseHistoryTimelineProps) {
  // Build a comprehensive chronological history list
  const entries: CaseHistoryEntry[] = [];

  const addEntry = (entry: CaseHistoryEntry) => {
    if (!entries.some((existing) => existing.id === entry.id || (existing.action === entry.action && existing.timestamp === entry.timestamp))) {
      entries.push(entry);
    }
  };

  // 1. Initial creation entry
  addEntry({
    id: `hist-init-${complaint.id}`,
    timestamp: complaint.receivedDateTime || complaint.date || "Initial Date",
    actorName: complaint.agentName || "System / Registration",
    actorRole: "system",
    action: "Complaint Registered & Assigned to Service Station",
    notes: complaint.notes || `Assigned to ${complaint.station} Service Station`,
    stationName: complaint.station,
    newStatus: "Pending Station Contact"
  });

  // 2. Add real logged history if present
  if (Array.isArray(complaint.caseHistory) && complaint.caseHistory.length > 0) {
    complaint.caseHistory.forEach((e) => {
      if (e) addEntry(e);
    });
  } else {
    // Synthetic history derivation for legacy records with no array items
    if (complaint.stationContactedDate || complaint.stationResolutionNotes) {
      addEntry({
        id: `hist-station-${complaint.id}`,
        timestamp: complaint.stationContactedDate || complaint.date || "Station Action Date",
        actorName: complaint.agentName || `${complaint.station} Adviser`,
        actorRole: "agent",
        action: "Service Station Resolution Logged",
        notes: complaint.stationResolutionNotes || "Station contacted customer and performed resolution.",
        stationName: complaint.station,
        newStatus: complaint.stationResponseStatus || "Submitted to Call Center"
      });
    }

    if (complaint.stationResponseStatus === "Returned to Call Center" || complaint.stationResponseStatus === "Rejected" || complaint.stationResponseStatus === "Returned to Service Station") {
      addEntry({
        id: `hist-reject-${complaint.id}`,
        timestamp: complaint.stationResponseRejectedDate || complaint.updatedAt || "Rejection Date",
        actorName: complaint.stationResponseRejectedBy || "Call Center Officer",
        actorRole: complaint.stationResponseStatus === "Returned to Call Center" ? "agent" : "callcenter",
        action: complaint.stationResponseStatus === "Returned to Call Center"
          ? "Case Returned to Call Center by Service Station"
          : "Station Response Rejected by Call Center & Returned to Service Station",
        rejectionReason: complaint.stationResponseRejectionReason || "No detailed reason specified.",
        stationName: complaint.station,
        newStatus: complaint.stationResponseStatus
      });
    }

    if (complaint.firstAttemptCallStatus || complaint.firstAttemptDate) {
      addEntry({
        id: `hist-att1-${complaint.id}`,
        timestamp: complaint.firstAttemptDate || "1st Attempt Date",
        actorName: complaint.callCenterOfficer || "Call Center Officer",
        actorRole: "callcenter",
        action: `1st Follow-up Call Attempt: ${complaint.firstAttemptCallStatus || "Logged"}`,
        notes: complaint.firstAttemptNotes || complaint.callCenterFinalRemarks,
        newStatus: complaint.firstAttemptCallStatus
      });
    }

    if (complaint.secondAttemptFeedbackStatus || complaint.secondAttemptDate) {
      addEntry({
        id: `hist-att2-${complaint.id}`,
        timestamp: complaint.secondAttemptDate || "2nd Attempt Date",
        actorName: complaint.callCenterOfficer || "Call Center Officer",
        actorRole: "callcenter",
        action: `2nd Follow-up Call Attempt: ${complaint.secondAttemptFeedbackStatus || "Logged"}`,
        notes: complaint.secondAttemptNotes || complaint.callCenterFinalRemarks,
        newStatus: complaint.secondAttemptFeedbackStatus
      });
    }

    if (complaint.status === "Resolved" || complaint.finalStatus === "Closed" || complaint.finalStatus === "Completed") {
      addEntry({
        id: `hist-resolved-${complaint.id}`,
        timestamp: complaint.updatedAt || "Closure Date",
        actorName: complaint.callCenterOfficer || complaint.agentName || "Call Center / Station",
        actorRole: "callcenter",
        action: "Complaint Verified & Case Closed",
        notes: complaint.callCenterFinalRemarks || "Customer confirmed resolution.",
        newStatus: "Closed & Resolved"
      });
    }
  }

  // Sort entries chronologically
  const sortedEntries = entries.sort((a, b) => {
    const tA = new Date(a.timestamp || 0).getTime();
    const tB = new Date(b.timestamp || 0).getTime();
    return tA - tB;
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-3 shadow-2xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-600 shrink-0" />
          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
            Permanent Case History & Workflow Trail
          </h4>
        </div>
        <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
          Case ID: {complaint.id}
        </span>
      </div>

      <div className="relative pl-4 border-l-2 border-slate-200 space-y-3 my-1">
        {sortedEntries.map((entry, idx) => {
          const isRejection = entry.action.includes("Returned") || entry.action.includes("Rejected");
          const isResolution = entry.action.includes("Resolved") || entry.action.includes("Closed");
          const isCallCenter = entry.actorRole === "callcenter";
          const isStation = entry.actorRole === "agent";

          return (
            <div key={entry.id || idx} className="relative group">
              {/* Timeline marker icon */}
              <div
                className={`absolute -left-[23px] top-0.5 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                  isRejection
                    ? "bg-rose-500 border-rose-200 text-white"
                    : isResolution
                    ? "bg-green-500 border-green-200 text-white"
                    : isCallCenter
                    ? "bg-blue-500 border-blue-200 text-white"
                    : isStation
                    ? "bg-purple-500 border-purple-200 text-white"
                    : "bg-slate-400 border-slate-200 text-white"
                }`}
              />

              <div className="bg-slate-50 hover:bg-slate-100/80 p-2.5 rounded-lg border border-slate-200/80 transition-all space-y-1">
                <div className="flex items-center justify-between gap-2 text-[10px]">
                  <span className="font-black text-slate-800 uppercase tracking-wide flex items-center gap-1">
                    {isRejection && <CornerDownLeft className="h-3 w-3 text-rose-600 shrink-0" />}
                    {isResolution && <ShieldCheck className="h-3 w-3 text-green-600 shrink-0" />}
                    {isCallCenter && !isRejection && !isResolution && <PhoneCall className="h-3 w-3 text-blue-600 shrink-0" />}
                    {entry.action}
                  </span>
                  <span className="text-slate-400 font-mono font-medium shrink-0">
                    {entry.timestamp}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1 font-semibold">
                    <User className="h-3 w-3 text-slate-400 shrink-0" />
                    {entry.actorName} ({entry.actorRole === "agent" ? "Service Station" : entry.actorRole === "callcenter" ? "Call Center" : "System"})
                  </span>
                  {entry.stationName && (
                    <span className="bg-slate-200/70 text-slate-700 px-1.5 py-0.2 rounded font-bold">
                      {entry.stationName}
                    </span>
                  )}
                </div>

                {entry.rejectionReason && (
                  <div className="bg-rose-50 border border-rose-200 p-2 rounded text-[11px] font-bold text-rose-900 mt-1">
                    <span className="text-[9px] uppercase tracking-wider text-rose-700 block font-black">
                      Rejection / Return Reason:
                    </span>
                    "{entry.rejectionReason}"
                  </div>
                )}

                {entry.notes && !entry.rejectionReason && (
                  <p className="text-[11px] text-slate-700 font-medium italic bg-white p-1.5 rounded border border-slate-100 mt-0.5">
                    "{entry.notes}"
                  </p>
                )}

                {entry.newStatus && (
                  <div className="text-[9px] font-bold text-slate-500 flex items-center gap-1 pt-0.5">
                    <span>Status:</span>
                    <span className="text-slate-800 font-black uppercase bg-slate-200/80 px-1.5 py-0.2 rounded">
                      {entry.newStatus}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
