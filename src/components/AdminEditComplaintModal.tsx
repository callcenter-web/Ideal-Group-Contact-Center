import React, { useState } from "react";
import { X, Save, Edit3, Calendar, Phone, Mail, User, ShieldAlert, CheckCircle, MapPin, Wrench, AlertTriangle, FileText } from "lucide-react";
import { Complaint, FollowUpStatus, SatisfactionLevel } from "../types";
import { STATIONS } from "../demoData";

interface AdminEditComplaintModalProps {
  complaint: Complaint;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedComplaint: Complaint) => void;
}

export default function AdminEditComplaintModal({
  complaint,
  isOpen,
  onClose,
  onSave,
}: AdminEditComplaintModalProps) {
  if (!isOpen || !complaint) return null;

  // Form State initialized with complaint details
  const [customerName, setCustomerName] = useState(complaint.customerName || "");
  const [customerPhone, setCustomerPhone] = useState(complaint.customerPhone || "");
  const [customerEmail, setCustomerEmail] = useState(complaint.customerEmail || "");
  const [date, setDate] = useState(complaint.date || "");
  const [receivedDateTime, setReceivedDateTime] = useState(complaint.receivedDateTime || "");
  const [woNo, setWoNo] = useState(complaint.woNo || "");
  const [vehicleRegNo, setVehicleRegNo] = useState(complaint.vehicleRegNo || "");
  const [chassiNo, setChassiNo] = useState(complaint.chassiNo || "");
  const [station, setStation] = useState(complaint.station || "");
  const [category, setCategory] = useState(complaint.category || "");
  const [advisorName, setAdvisorName] = useState(complaint.advisorName || "");
  const [mileage, setMileage] = useState(complaint.mileage || "");
  const [description, setDescription] = useState(complaint.description || "");
  const [initialSatisfaction, setInitialSatisfaction] = useState<"Very Dissatisfied" | "Dissatisfied">(complaint.initialSatisfaction || "Dissatisfied");
  const [status, setStatus] = useState<FollowUpStatus>(complaint.status || "Pending");
  const [feedbackStatus, setFeedbackStatus] = useState(complaint.feedbackStatus || "Pending");
  const [finalStatus, setFinalStatus] = useState(complaint.finalStatus || "Open");
  const [stationContactedDate, setStationContactedDate] = useState(complaint.stationContactedDate || "");
  const [stationResolutionNotes, setStationResolutionNotes] = useState(complaint.stationResolutionNotes || "");
  const [callCenterContactedDate, setCallCenterContactedDate] = useState(complaint.callCenterContactedDate || "");
  const [callCenterFinalRemarks, setCallCenterFinalRemarks] = useState(complaint.callCenterFinalRemarks || "");

  const [savedAlert, setSavedAlert] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const isStationChanged = station.trim() !== (complaint.station || "").trim();

    // If station changed and user didn't manually edit stationContactedDate, clear it so new station sees it as pending contact
    const newStationContactedDate = isStationChanged && stationContactedDate === complaint.stationContactedDate
      ? ""
      : stationContactedDate.trim();

    const newStationResolutionNotes = isStationChanged && stationResolutionNotes === complaint.stationResolutionNotes
      ? `Re-assigned to new service station: ${station.trim()}`
      : stationResolutionNotes.trim();

    const updated: Complaint = {
      ...complaint,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerEmail: customerEmail.trim(),
      date: date.trim(),
      receivedDateTime: receivedDateTime.trim() || `${date.trim()} 08:00 AM`,
      woNo: woNo.trim(),
      vehicleRegNo: vehicleRegNo.trim(),
      chassiNo: chassiNo.trim(),
      station: station.trim(),
      category: category.trim(),
      advisorName: advisorName.trim(),
      mileage: mileage.trim(),
      description: description.trim(),
      initialSatisfaction,
      status: isStationChanged ? "Pending" : status,
      feedbackStatus: isStationChanged ? "Pending" : feedbackStatus,
      finalStatus: isStationChanged ? "Open" : finalStatus,
      stationResponseStatus: isStationChanged ? "Submitted to Call Center" : (complaint.stationResponseStatus || "Submitted to Call Center"),
      stationContactedDate: newStationContactedDate,
      stationResolutionNotes: newStationResolutionNotes,
      callCenterContactedDate: callCenterContactedDate.trim(),
      callCenterFinalRemarks: callCenterFinalRemarks.trim(),
      updatedAt: new Date().toISOString().split("T")[0],
    };

    onSave(updated);
    setSavedAlert(true);
    setTimeout(() => {
      setSavedAlert(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-6 py-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600/30 rounded-xl border border-indigo-400/30 text-amber-300">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight">Admin Master Edit: Complaint Details</h3>
                <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                  System Admin Access
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium">
                Editing Record ID: <span className="font-mono text-amber-300 font-bold">#{complaint.id}</span> • Customer: <span className="font-bold">{complaint.customerName}</span>
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

        {/* Scrollable Form Content */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
          
          {savedAlert && (
            <div className="bg-emerald-50 border-2 border-emerald-400 p-3 rounded-xl flex items-center gap-2 text-emerald-800 font-bold text-xs animate-bounce">
              <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Complaint details updated & saved to database successfully!</span>
            </div>
          )}

          {/* SECTION 1: Customer Contact Info */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-200">
              <User className="h-4 w-4 text-blue-600" />
              1. Customer Profile & Contact Info
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Customer Name *</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg py-2 px-3 pl-8 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <User className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Customer Phone No *</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg py-2 px-3 pl-8 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <Phone className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Customer Email</label>
                <div className="relative">
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg py-2 px-3 pl-8 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <Mail className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: Dates, Work Order & Vehicle Details */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-200">
              <Calendar className="h-4 w-4 text-indigo-600" />
              2. Dates, Timestamps, Work Order & Vehicle Metadata
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Date Received (YYYY-MM-DD)</label>
                <input
                  type="text"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  placeholder="2026-08-05"
                  className="w-full bg-white border border-slate-300 rounded-lg py-2 px-3 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Full Received Date & Time</label>
                <input
                  type="text"
                  value={receivedDateTime}
                  onChange={(e) => setReceivedDateTime(e.target.value)}
                  placeholder="2026-08-05 08:30 AM"
                  className="w-full bg-white border border-slate-300 rounded-lg py-2 px-3 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Work Order # (WO No)</label>
                <input
                  type="text"
                  value={woNo}
                  onChange={(e) => setWoNo(e.target.value)}
                  placeholder="WO-10923"
                  className="w-full bg-white border border-slate-300 rounded-lg py-2 px-3 text-xs font-bold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Vehicle Reg No</label>
                <input
                  type="text"
                  value={vehicleRegNo}
                  onChange={(e) => setVehicleRegNo(e.target.value)}
                  placeholder="CBA-1234"
                  className="w-full bg-white border border-slate-300 rounded-lg py-2 px-3 text-xs font-bold text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Chassis No</label>
                <input
                  type="text"
                  value={chassiNo}
                  onChange={(e) => setChassiNo(e.target.value)}
                  placeholder="MA3..."
                  className="w-full bg-white border border-slate-300 rounded-lg py-2 px-3 text-xs font-bold text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Service Advisor</label>
                <input
                  type="text"
                  value={advisorName}
                  onChange={(e) => setAdvisorName(e.target.value)}
                  placeholder="Service Advisor Name"
                  className="w-full bg-white border border-slate-300 rounded-lg py-2 px-3 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Mileage (KM)</label>
                <input
                  type="text"
                  value={mileage}
                  onChange={(e) => setMileage(e.target.value)}
                  placeholder="45000"
                  className="w-full bg-white border border-slate-300 rounded-lg py-2 px-3 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Assigned Station *</label>
                <select
                  value={station}
                  onChange={(e) => setStation(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg py-2 px-3 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {STATIONS.map((st) => (
                    <option key={st.code} value={st.code}>
                      {st.name} ({st.code})
                    </option>
                  ))}
                </select>
                {station.trim() !== (complaint.station || "").trim() && (
                  <div className="mt-1.5 p-2 bg-amber-50 border border-amber-300 rounded-lg text-[10px] text-amber-900 font-bold flex items-start gap-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      Re-assigning from <strong className="text-slate-900">{complaint.station}</strong> to <strong className="text-blue-700">{station}</strong>. Record will pass to the new station's queue for contact & resolution.
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 3: Category & Description */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-200">
              <FileText className="h-4 w-4 text-emerald-600" />
              3. Category & Customer Complaint Reason
            </h4>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Complaint Category</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Noise, Service Delay, Mechanical..."
                  className="w-full bg-white border border-slate-300 rounded-lg py-2 px-3 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Customer Complaint Description / Feedback</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg py-2 px-3 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed resize-none"
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: Statuses & Follow-up Logs */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-200">
              <Wrench className="h-4 w-4 text-amber-600" />
              4. Complaint Status & Operational Logs
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Main Workflow Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as FollowUpStatus)}
                  className="w-full bg-white border border-slate-300 rounded-lg py-2 px-3 text-xs font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Contacted">Contacted</option>
                  <option value="Contacted — Still Dissatisfied">Contacted — Still Dissatisfied (Timer Frozen)</option>
                  <option value="Resolved">Resolved (Timer Frozen)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Feedback Status</label>
                <input
                  type="text"
                  value={feedbackStatus}
                  onChange={(e) => setFeedbackStatus(e.target.value)}
                  placeholder="Satisfied, Not Satisfied, Customer Unreachable..."
                  className="w-full bg-white border border-slate-300 rounded-lg py-2 px-3 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase mb-1">Final Operational Status</label>
                <input
                  type="text"
                  value={finalStatus}
                  onChange={(e) => setFinalStatus(e.target.value)}
                  placeholder="Open, Closed, Solution Received..."
                  className="w-full bg-white border border-slate-300 rounded-lg py-2 px-3 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div className="space-y-2 bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-[11px] font-extrabold text-blue-800 uppercase block">Service Station Contact & Action</span>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase">Station Contacted Date</label>
                  <input
                    type="text"
                    value={stationContactedDate}
                    onChange={(e) => setStationContactedDate(e.target.value)}
                    placeholder="YYYY-MM-DD"
                    className="w-full bg-slate-50 border border-slate-200 rounded py-1 px-2 text-xs font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase">Station Action Notes</label>
                  <textarea
                    rows={2}
                    value={stationResolutionNotes}
                    onChange={(e) => setStationResolutionNotes(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded py-1 px-2 text-xs font-medium text-slate-800 resize-none"
                  />
                </div>
              </div>

              <div className="space-y-2 bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-[11px] font-extrabold text-indigo-800 uppercase block">Call Center Follow-Up & Verification</span>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase">Call Center Contacted Date (Resolution Date)</label>
                  <input
                    type="text"
                    value={callCenterContactedDate}
                    onChange={(e) => setCallCenterContactedDate(e.target.value)}
                    placeholder="YYYY-MM-DD"
                    className="w-full bg-slate-50 border border-slate-200 rounded py-1 px-2 text-xs font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase">Call Center Final Remarks</label>
                  <textarea
                    rows={2}
                    value={callCenterFinalRemarks}
                    onChange={(e) => setCallCenterFinalRemarks(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded py-1 px-2 text-xs font-medium text-slate-800 resize-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 rounded-xl text-xs font-black text-white bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Save Admin Modifications
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
