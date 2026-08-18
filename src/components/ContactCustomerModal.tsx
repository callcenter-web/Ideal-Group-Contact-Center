import React, { useState, useEffect } from "react";
import { 
  X, 
  PhoneCall, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Send, 
  User, 
  MapPin, 
  Calendar, 
  MessageSquare,
  FileText,
  PhoneOff,
  History
} from "lucide-react";
import { Complaint, ContactAttemptEvent, ServiceStationContactStatus, UserProfile } from "../types";
import { getFormattedDateTime } from "../utils/agingUtils";

interface ContactCustomerModalProps {
  complaint: Complaint | null;
  currentUser: UserProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveContactAttempt: (updatedComplaint: Complaint, attempt: ContactAttemptEvent) => Promise<void>;
  onOpenHistory?: () => void;
  theme?: "light" | "dark";
}

export default function ContactCustomerModal({
  complaint,
  currentUser,
  isOpen,
  onClose,
  onSaveContactAttempt,
  onOpenHistory,
  theme = "light"
}: ContactCustomerModalProps) {
  const isDark = theme === "dark";

  // Form states
  const [outcome, setOutcome] = useState<ServiceStationContactStatus>("CONTACTED");
  const [contactMethod, setContactMethod] = useState<string>("Phone Call");
  const [contactDateTime, setContactDateTime] = useState<string>("");
  const [actionedOfficer, setActionedOfficer] = useState<string>("");
  const [customerResponse, setCustomerResponse] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("");
  const [nextFollowUpDate, setNextFollowUpDate] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && complaint) {
      const nowFormatted = getFormattedDateTime();
      setContactDateTime(nowFormatted);
      
      const defaultOfficer = currentUser?.name || 
        (currentUser?.role === "agent" ? `${currentUser.station} Service Advisor` : "Service Station Officer");
      setActionedOfficer(defaultOfficer);

      // Default outcome based on rejected status or current status
      const isRej = complaint.stationResponseStatus === "Rejected" || 
                    complaint.stationResponseStatus === "Returned to Service Station" ||
                    complaint.stationResponseStatus === "Rejected by Call Center";
      
      if (isRej) {
        setOutcome("CONTACTED");
      } else if (complaint.serviceStationContactStatus === "CUSTOMER_UNREACHABLE") {
        setOutcome("CONTACT_ATTEMPTED");
      } else {
        setOutcome("CONTACTED");
      }

      setContactMethod("Phone Call");
      setCustomerResponse("");
      setRemarks("");
      
      // Default next follow up date to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setNextFollowUpDate(tomorrow.toISOString().split("T")[0]);
      setValidationError(null);
    }
  }, [isOpen, complaint, currentUser]);

  if (!isOpen || !complaint) return null;

  const isRejected = complaint.stationResponseStatus === "Rejected" || 
                     complaint.stationResponseStatus === "Returned to Service Station" ||
                     complaint.stationResponseStatus === "Rejected by Call Center" ||
                     complaint.feedbackStatus === "Returned to Service Station";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Validation rules to enforce operational compliance
    if (!actionedOfficer.trim()) {
      setValidationError("Please enter the name of the Service Advisor / Officer logging this contact.");
      return;
    }

    if (!remarks.trim() || remarks.trim().length < 5) {
      setValidationError("Please provide detailed resolution/action remarks (minimum 5 characters).");
      return;
    }

    if (outcome === "CONTACTED" && (!customerResponse.trim() || customerResponse.trim().length < 3)) {
      setValidationError("For successful contact, please record the customer's response or feedback.");
      return;
    }

    if ((outcome === "CONTACT_ATTEMPTED" || outcome === "CUSTOMER_UNREACHABLE") && !nextFollowUpDate) {
      setValidationError("Please specify the next follow-up date for queued attempts.");
      return;
    }

    setIsSubmitting(true);

    try {
      const attemptId = `ATT-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const nowIso = new Date().toISOString();

      const newAttempt: ContactAttemptEvent = {
        id: attemptId,
        timestamp: contactDateTime || getFormattedDateTime(),
        actorName: actionedOfficer.trim(),
        actorRole: (currentUser?.role as any) || "agent",
        contactMethod: contactMethod,
        outcome: outcome,
        customerResponse: customerResponse.trim() || undefined,
        remarks: remarks.trim(),
        nextFollowUpDate: (outcome !== "CONTACTED" && nextFollowUpDate) ? nextFollowUpDate : undefined
      };

      const existingAttempts = Array.isArray(complaint.contactAttempts) ? complaint.contactAttempts : [];
      const updatedAttempts = [...existingAttempts, newAttempt];
      const attemptCount = updatedAttempts.length;

      // Construct case history entry
      const historyEntry = {
        id: `HIST-CONT-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: contactDateTime || getFormattedDateTime(),
        actorName: actionedOfficer.trim(),
        actorRole: (currentUser?.role as any) || "agent",
        action: `Customer Contact Logged (${outcome}) via ${contactMethod}`,
        notes: `Outcome: ${outcome}. Method: ${contactMethod}. Response: ${customerResponse || "N/A"}. Remarks: ${remarks}`,
        stationName: complaint.station,
        previousStatus: complaint.serviceStationContactStatus || "NOT_CONTACTED",
        newStatus: outcome
      };

      const existingHistory = Array.isArray(complaint.caseHistory) ? complaint.caseHistory : [];

      // Determine updated complaint state
      let updatedComplaint: Complaint = {
        ...complaint,
        serviceStationContactStatus: outcome,
        serviceStationContactedAt: outcome === "CONTACTED" ? contactDateTime : (complaint.serviceStationContactedAt || ""),
        serviceStationContactedBy: actionedOfficer.trim(),
        serviceStationContactMethod: contactMethod,
        serviceStationContactRemark: remarks.trim(),
        serviceStationCustomerResponse: customerResponse.trim(),
        nextFollowUpDate: nextFollowUpDate || "",
        lastContactAttemptAt: contactDateTime || getFormattedDateTime(),
        contactAttemptCount: attemptCount,
        contactAttempts: updatedAttempts,
        updatedAt: nowIso,
        caseHistory: [...existingHistory, historyEntry]
      };

      if (outcome === "CONTACTED") {
        updatedComplaint.stationContactedDate = contactDateTime;
        updatedComplaint.stationResolutionNotes = remarks.trim();
        updatedComplaint.stationResponseStatus = "Submitted to Call Center";
        updatedComplaint.status = "Contacted";
        if (updatedComplaint.feedbackStatus === "Customer Unreachable" || updatedComplaint.feedbackStatus === "Returned to Service Station") {
          updatedComplaint.feedbackStatus = "Follow Up Required";
        }
      } else if (outcome === "CUSTOMER_UNREACHABLE") {
        updatedComplaint.feedbackStatus = "Customer Unreachable";
        updatedComplaint.finalStatus = "Unreachable";
        updatedComplaint.status = "Pending";
      } else if (outcome === "CONTACT_ATTEMPTED") {
        updatedComplaint.feedbackStatus = "Follow Up Required";
        updatedComplaint.status = "Pending";
      }

      await onSaveContactAttempt(updatedComplaint, newAttempt);
      onClose();
    } catch (err: any) {
      console.error("Failed to save contact attempt:", err);
      setValidationError(err.message || "Failed to save contact attempt. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className={`w-full max-w-xl rounded-2xl shadow-2xl border overflow-hidden transition-all duration-300 max-h-[90vh] flex flex-col ${
        isDark ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-900"
      }`}>
        
        {/* Modal Header */}
        <div className={`p-4 border-b flex items-start justify-between ${
          isRejected 
            ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900" 
            : "bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800"
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${
              isRejected 
                ? "bg-rose-600 text-white" 
                : "bg-blue-600 text-white"
            }`}>
              <PhoneCall className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black uppercase tracking-wider">
                  {isRejected ? "Re-Contact Customer (Returned Case)" : "Record Service Station Customer Contact"}
                </h3>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {complaint.id}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Customer: <strong className="text-slate-800 dark:text-slate-200">{complaint.customerName}</strong> ({complaint.customerPhone})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {onOpenHistory && (
              <button
                type="button"
                onClick={onOpenHistory}
                className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="View Contact History"
              >
                <History className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto flex-1">
          
          {/* Rejection Warning Banner if case was returned */}
          {isRejected && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 space-y-1.5 text-xs text-rose-900 dark:text-rose-200">
              <div className="flex items-center gap-1.5 font-black uppercase text-[10px] tracking-wider text-rose-700 dark:text-rose-400">
                <AlertTriangle className="h-4 w-4" />
                <span>Call Center Rejection Reason:</span>
              </div>
              <p className="font-semibold italic bg-white dark:bg-slate-900 p-2 rounded border border-rose-200 dark:border-rose-900">
                "{complaint.stationResponseRejectionReason || "Customer follow-up required by Service Station."}"
              </p>
              <p className="text-[10px] text-rose-700 dark:text-rose-300 font-medium">
                Log the new contact conversation and resolution action below to re-submit this complaint.
              </p>
            </div>
          )}

          {/* Validation Error Message */}
          {validationError && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-xs font-bold text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Contact Outcome Selector */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
              Contact Outcome *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { value: "CONTACTED", label: "Contacted", color: "emerald", icon: CheckCircle },
                { value: "CONTACT_ATTEMPTED", label: "Attempted", color: "amber", icon: PhoneCall },
                { value: "CUSTOMER_UNREACHABLE", label: "Unreachable", color: "orange", icon: PhoneOff },
                { value: "PENDING_CONTACT", label: "Pending", color: "slate", icon: Clock }
              ].map((opt) => {
                const Icon = opt.icon;
                const isSelected = outcome === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setOutcome(opt.value as ServiceStationContactStatus)}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      isSelected
                        ? opt.color === "emerald"
                          ? "bg-emerald-600 border-emerald-700 text-white shadow-sm"
                          : opt.color === "amber"
                            ? "bg-amber-600 border-amber-700 text-white shadow-sm"
                            : opt.color === "orange"
                              ? "bg-orange-600 border-orange-700 text-white shadow-sm"
                              : "bg-slate-700 border-slate-800 text-white shadow-sm"
                        : isDark
                          ? "bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Contact Method & Officer Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Contact Method *
              </label>
              <select
                value={contactMethod}
                onChange={(e) => setContactMethod(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 text-xs text-slate-800 dark:text-slate-100 font-semibold focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="Phone Call">📞 Phone Call</option>
                <option value="Workshop In-Person">🏢 Workshop In-Person</option>
                <option value="WhatsApp / SMS">💬 WhatsApp / SMS</option>
                <option value="Email">✉️ Email</option>
                <option value="Field Visit">🚗 Field Visit</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Actioned Advisor / Officer Name *
              </label>
              <input
                type="text"
                required
                value={actionedOfficer}
                onChange={(e) => setActionedOfficer(e.target.value)}
                placeholder="e.g. S. Priyantha (Advisor)"
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 text-xs text-slate-800 dark:text-slate-100 font-semibold focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Contact Date / Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Date & Time of Contact (Auto-Captured)
              </label>
              <input
                type="text"
                value={contactDateTime}
                onChange={(e) => setContactDateTime(e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 text-xs text-slate-700 dark:text-slate-300 font-mono font-bold focus:outline-none focus:border-blue-500"
              />
            </div>

            {outcome !== "CONTACTED" && (
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-1">
                  Next Follow-Up Date *
                </label>
                <input
                  type="date"
                  required
                  value={nextFollowUpDate}
                  onChange={(e) => setNextFollowUpDate(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-lg py-2 px-3 text-xs text-slate-800 dark:text-slate-100 font-bold focus:outline-none focus:border-blue-500"
                />
              </div>
            )}
          </div>

          {/* Customer Response Input */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
              Customer Response / Statement {outcome === "CONTACTED" ? "*" : "(Optional)"}
            </label>
            <input
              type="text"
              value={customerResponse}
              onChange={(e) => setCustomerResponse(e.target.value)}
              placeholder={outcome === "CONTACTED" ? "e.g. Customer stated brake noise has disappeared; agreed to Call Center verification." : "e.g. Phone rang continuously with no answer; customer busy."}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 text-xs text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Action Taken & Resolution Remarks */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
              Action Taken & Station Resolution Notes *
            </label>
            <textarea
              rows={3}
              required
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Describe the action taken by the service station to resolve this case (e.g. Inspected vehicle at workshop, replaced faulty clip, test driven with customer)..."
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-xs text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:border-blue-500 leading-relaxed resize-none"
            />
          </div>

          {/* Modal Actions */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-black transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{isSubmitting ? "Saving Action..." : outcome === "CONTACTED" ? "Save & Submit to Call Center" : "Save Contact Attempt"}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
