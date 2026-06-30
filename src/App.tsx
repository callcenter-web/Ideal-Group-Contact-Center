import React, { useState, useEffect } from "react";
import { 
  Car, 
  Users, 
  MapPin, 
  Clock, 
  CheckCircle, 
  TrendingUp, 
  LogOut, 
  Search, 
  Filter, 
  Sparkles, 
  MessageSquare,
  AlertTriangle,
  User,
  Phone,
  Mail,
  Calendar,
  FileSpreadsheet,
  Settings,
  HelpCircle
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { Complaint, SatisfactionLevel, FollowUpStatus, AIAnalysis } from "./types";
import { DEMO_COMPLAINTS, STATIONS } from "./demoData";
import LoginScreen from "./components/LoginScreen";
import UploadZone from "./components/UploadZone";
import StationOverview from "./components/StationOverview";
import MetricCard from "./components/MetricCard";
import AIRecoveryAssistant from "./components/AIRecoveryAssistant";
import ReportsPanel from "./components/ReportsPanel";

// Initialize client-side Supabase client with safe publishable credentials
const SUPABASE_URL = "https://qsistbvaukxuwebqupiy.supabase.co";
const SUPABASE_KEY = "sb_publishable_Npa3x5SHHp65jinonZFnKA_56lBMOQb";
export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

export default function App() {
  // State
  const [currentUser, setCurrentUser] = useState<{ role: "admin" | "agent" | "callcenter"; station?: string } | null>(() => {
    const savedUser = localStorage.getItem("ideal_group_current_user");
    if (savedUser) {
      try {
        return JSON.parse(savedUser);
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState<"analytics" | "stations" | "upload" | "reports">("analytics");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [stationFilter, setStationFilter] = useState<string>("All");

  // Call Center Quick Filter
  const [callCenterQuickFilter, setCallCenterQuickFilter] = useState<"all" | "awaiting" | "completed">("awaiting");

  // Follow-up form fields
  const [formStatus, setFormStatus] = useState<FollowUpStatus>("Pending");
  const [formSatisfaction, setFormSatisfaction] = useState<SatisfactionLevel>("Dissatisfied");
  const [formNotes, setFormNotes] = useState("");
  const [formAgentName, setFormAgentName] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Station specific follow-up fields
  const [formStationContactedDate, setFormStationContactedDate] = useState("");
  const [formStationResolutionNotes, setFormStationResolutionNotes] = useState("");

  // Call Center specific follow-up fields
  const [formCallCenterContactedDate, setFormCallCenterContactedDate] = useState("");
  const [formCallCenterFinalRemarks, setFormCallCenterFinalRemarks] = useState("");
  const [formCallCenterFinalSatisfaction, setFormCallCenterFinalSatisfaction] = useState<SatisfactionLevel>("Satisfied");
  
  // Parallel track status fields
  const [formFeedbackStatus, setFormFeedbackStatus] = useState("Follow Up Required");
  const [formFinalStatus, setFormFinalStatus] = useState("Open");
  const [formSolutionProvided, setFormSolutionProvided] = useState("");
  const [formSolutionDate, setFormSolutionDate] = useState("");
  const [formFollowUpDate, setFormFollowUpDate] = useState("");
  
  // National Admin station assignment field
  const [formAssignedStation, setFormAssignedStation] = useState("");

  // Manual Complaint States
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newStation, setNewStation] = useState(STATIONS[0]?.code || "");
  const [newCategory, setNewCategory] = useState("Mechanical");
  const [newDescription, setNewDescription] = useState("");
  const [newWoNo, setNewWoNo] = useState("");
  const [newVehicleRegNo, setNewVehicleRegNo] = useState("");
  const [newMileage, setNewMileage] = useState("");
  const [newAdvisorName, setNewAdvisorName] = useState("");
  const [newChassiNo, setNewChassiNo] = useState("");
  const [newReceivedDate, setNewReceivedDate] = useState(() => {
    const now = new Date();
    return now.toISOString().split("T")[0];
  });
  const [newReceivedTime, setNewReceivedTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });

  // State-based delete confirmation state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Supabase Database Connection State
  const [supabaseActive, setSupabaseActive] = useState<boolean | null>(null);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);

  // Load complaints on mount with optimistic local fallback
  useEffect(() => {
    const saved = localStorage.getItem("ideal_group_complaints");
    if (saved) {
      try {
        setComplaints(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved complaints:", e);
        setComplaints(DEMO_COMPLAINTS);
      }
    } else {
      setComplaints(DEMO_COMPLAINTS);
    }

    const fetchComplaintsDirectly = async (originalErrorMsg?: string) => {
      try {
        console.log("Contacting Supabase directly from the browser...");
        const { data, error } = await supabaseClient
          .from("complaints")
          .select("*")
          .order("date", { ascending: false });

        if (error) {
          console.error("Direct Supabase select error:", error);
          setSupabaseActive(false);
          setSupabaseError(error.message);
          return;
        }

        if (data) {
          if (data.length === 0) {
            console.log("Direct Supabase: Database is empty. Seeding DEMO_COMPLAINTS...");
            const { error: seedError } = await supabaseClient
              .from("complaints")
              .insert(DEMO_COMPLAINTS);
            
            if (!seedError) {
              const { data: refreshed } = await supabaseClient
                .from("complaints")
                .select("*")
                .order("date", { ascending: false });
              if (refreshed) {
                setComplaints(refreshed);
                localStorage.setItem("ideal_group_complaints", JSON.stringify(refreshed));
              }
            } else {
              console.error("Direct Supabase seed error:", seedError);
              setComplaints(DEMO_COMPLAINTS);
              localStorage.setItem("ideal_group_complaints", JSON.stringify(DEMO_COMPLAINTS));
            }
          } else {
            setComplaints(data);
            localStorage.setItem("ideal_group_complaints", JSON.stringify(data));
          }
        }
        setSupabaseActive(true);
        setSupabaseError(null);
      } catch (err: any) {
        console.error("Direct Supabase connection exception:", err);
        setSupabaseActive(false);
        setSupabaseError(originalErrorMsg || err.message);
      }
    };

    const fetchComplaints = async () => {
      try {
        const res = await fetch("/api/complaints");
        const text = await res.text();
        
        if (text.trim().startsWith("<!DOCTYPE")) {
          console.warn("Backend API not found (HTML response). Falling back to client-side direct Supabase connection...");
          await fetchComplaintsDirectly();
          return;
        }

        const data = JSON.parse(text);
        if (data.complaints) {
          setComplaints(data.complaints);
          localStorage.setItem("ideal_group_complaints", JSON.stringify(data.complaints));
        }
        setSupabaseActive(data.isSupabaseActive);
        if (!data.isSupabaseActive && data.error) {
          setSupabaseError(data.error);
        } else {
          setSupabaseError(null);
        }
      } catch (e: any) {
        console.warn("Backend API call failed, falling back to client-side direct Supabase connection:", e);
        await fetchComplaintsDirectly(e.message);
      }
    };

    fetchComplaints();
  }, []);

  const saveComplaintsDirectly = async (updatedList: Complaint[]) => {
    try {
      console.log("Upserting directly to Supabase client-side...");
      const { error } = await supabaseClient
        .from("complaints")
        .upsert(updatedList, { onConflict: "id" });

      if (error) {
        console.error("Direct Supabase upsert error:", error);
        setSupabaseActive(false);
        setSupabaseError(error.message);
      } else {
        setSupabaseActive(true);
        setSupabaseError(null);
      }
    } catch (err: any) {
      console.error("Direct Supabase upsert failed:", err);
      setSupabaseActive(false);
      setSupabaseError(err.message);
    }
  };

  // Handle saving to localStorage and syncing with Supabase on complaints change
  const saveComplaints = async (updatedList: Complaint[]) => {
    setComplaints(updatedList);
    localStorage.setItem("ideal_group_complaints", JSON.stringify(updatedList));

    try {
      const res = await fetch("/api/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complaints: updatedList })
      });
      const text = await res.text();

      if (text.trim().startsWith("<!DOCTYPE")) {
        console.warn("Backend API not found (HTML response). Saving directly to Supabase client-side...");
        await saveComplaintsDirectly(updatedList);
        return;
      }

      const data = JSON.parse(text);
      setSupabaseActive(data.isSupabaseActive);
      if (!data.isSupabaseActive && data.error) {
        setSupabaseError(data.error);
      } else {
        setSupabaseError(null);
      }
      if (data.complaints) {
        setComplaints(data.complaints);
        localStorage.setItem("ideal_group_complaints", JSON.stringify(data.complaints));
      }
    } catch (e: any) {
      console.warn("Backend API save failed, saving directly to Supabase client-side:", e);
      await saveComplaintsDirectly(updatedList);
    }
  };

  // Login handler
  const handleLoginSuccess = (role: "admin" | "agent" | "callcenter", stationCode?: string) => {
    const userObj = { role, station: stationCode };
    setCurrentUser(userObj);
    localStorage.setItem("ideal_group_current_user", JSON.stringify(userObj));
    // If agent, default station filter to their station
    if (role === "agent" && stationCode) {
      setStationFilter(stationCode);
    } else {
      setStationFilter("All");
    }
    // Default call center view to "Awaiting"
    if (role === "callcenter") {
      setCallCenterQuickFilter("awaiting");
    }
    setSelectedComplaintId(null);
  };

  // Logout handler
  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("ideal_group_current_user");
    setSelectedComplaintId(null);
  };

  // Upload/spreadsheet handler
  const handleDataLoaded = (newComplaints: Complaint[], overwrite: boolean) => {
    let updatedList;
    if (overwrite) {
      updatedList = newComplaints;
    } else {
      // Avoid duplicate IDs by merging
      const existingIds = complaints.map((c) => c.id);
      const filteredNew = newComplaints.filter((c) => !existingIds.includes(c.id));
      updatedList = [...filteredNew, ...complaints];
    }
    saveComplaints(updatedList);
  };

  // Handle manually adding a complaint (Admin only)
  const handleAddManualComplaint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName || !newCustomerPhone || !newStation || !newDescription) {
      return;
    }

    const newId = `M-${Math.floor(100000 + Math.random() * 900000)}`;
    
    const dateToUse = newReceivedDate || new Date().toISOString().split("T")[0];
    const timeToUse = newReceivedTime || "08:00";
    
    const [year, month, day] = dateToUse.split("-");
    const [hoursStr, minutesStr] = timeToUse.split(":");
    let hours = parseInt(hoursStr, 10);
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    const receivedDateTimeStr = `${year}-${month}-${day} ${String(hours).padStart(2, '0')}:${minutesStr} ${ampm}`;

    const newComplaint: Complaint = {
      id: newId,
      customerName: newCustomerName,
      customerPhone: newCustomerPhone,
      customerEmail: newCustomerEmail || "",
      station: newStation,
      category: newCategory,
      description: newDescription,
      date: dateToUse,
      receivedDateTime: receivedDateTimeStr,
      initialSatisfaction: "Dissatisfied",
      currentSatisfaction: "Dissatisfied",
      status: "Pending",
      notes: "Manually registered by Admin",
      agentName: "",
      woNo: newWoNo || undefined,
      vehicleRegNo: newVehicleRegNo || undefined,
      mileage: newMileage || undefined,
      advisorName: newAdvisorName || undefined,
      chassiNo: newChassiNo || undefined,
    };

    const updated = [newComplaint, ...complaints];
    saveComplaints(updated);
    setSelectedComplaintId(newId);
    setShowAddModal(false);

    // Reset form fields
    setNewCustomerName("");
    setNewCustomerPhone("");
    setNewCustomerEmail("");
    setNewStation(STATIONS[0]?.code || "");
    setNewCategory("Mechanical");
    setNewDescription("");
    setNewWoNo("");
    setNewVehicleRegNo("");
    setNewMileage("");
    setNewAdvisorName("");
    setNewChassiNo("");
    const now = new Date();
    setNewReceivedDate(now.toISOString().split("T")[0]);
    setNewReceivedTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
  };

  // Handle manual removal of a complaint (Admin only)
  const handleDeleteComplaint = (complaintId: string) => {
    const updated = complaints.filter((c) => c.id !== complaintId);
    saveComplaints(updated);
    setSelectedComplaintId(null);
    setDeletingId(null);
  };

  const clearComplaintsDirectly = async () => {
    try {
      console.log("Clearing all complaints directly from Supabase client-side...");
      const { error } = await supabaseClient
        .from("complaints")
        .delete()
        .neq("id", "FORCE_NONE_MATCHING_ID");

      if (error) {
        console.error("Direct Supabase clear error:", error);
        setSupabaseActive(false);
        setSupabaseError(error.message);
      } else {
        setSupabaseActive(true);
        setSupabaseError(null);
      }
    } catch (err: any) {
      console.error("Direct Supabase clear exception:", err);
      setSupabaseActive(false);
      setSupabaseError(err.message);
    }
  };

  // Handle clearing all complaints
  const handleDeleteAllComplaints = async () => {
    setComplaints([]);
    localStorage.setItem("ideal_group_complaints", JSON.stringify([]));
    setSelectedComplaintId(null);
    setDeletingId(null);
    setShowDeleteAllConfirm(false);

    try {
      const res = await fetch("/api/complaints/clear", { method: "POST" });
      const text = await res.text();

      if (text.trim().startsWith("<!DOCTYPE")) {
        console.warn("Backend API clear not found (HTML response). Clearing directly from Supabase client-side...");
        await clearComplaintsDirectly();
        return;
      }

      const data = JSON.parse(text);
      setSupabaseActive(data.isSupabaseActive);
      if (data.complaints) {
        setComplaints(data.complaints);
        localStorage.setItem("ideal_group_complaints", JSON.stringify(data.complaints));
      }
    } catch (e: any) {
      console.warn("Backend clear failed, clearing directly from Supabase client-side:", e);
      await clearComplaintsDirectly();
    }
  };

  const resetComplaintsDirectly = async () => {
    try {
      console.log("Resetting complaints directly from Supabase client-side...");
      // First clear all
      await supabaseClient
        .from("complaints")
        .delete()
        .neq("id", "FORCE_NONE_MATCHING_ID");

      // Then insert default ones
      const { error } = await supabaseClient
        .from("complaints")
        .insert(DEMO_COMPLAINTS);

      if (error) {
        console.error("Direct Supabase insert during reset error:", error);
        setSupabaseActive(false);
        setSupabaseError(error.message);
      } else {
        setSupabaseActive(true);
        setSupabaseError(null);
      }
    } catch (err: any) {
      console.error("Direct Supabase reset exception:", err);
      setSupabaseActive(false);
      setSupabaseError(err.message);
    }
  };

  // Reset demo complaints data
  const handleResetDemo = async () => {
    setComplaints(DEMO_COMPLAINTS);
    localStorage.setItem("ideal_group_complaints", JSON.stringify(DEMO_COMPLAINTS));
    setSelectedComplaintId(null);
    setShowResetConfirm(false);

    try {
      const res = await fetch("/api/complaints/reset", { method: "POST" });
      const text = await res.text();

      if (text.trim().startsWith("<!DOCTYPE")) {
        console.warn("Backend API reset not found (HTML response). Resetting directly on Supabase client-side...");
        await resetComplaintsDirectly();
        return;
      }

      const data = JSON.parse(text);
      setSupabaseActive(data.isSupabaseActive);
      if (data.complaints) {
        setComplaints(data.complaints);
        localStorage.setItem("ideal_group_complaints", JSON.stringify(data.complaints));
      }
    } catch (e: any) {
      console.warn("Backend reset failed, resetting directly on Supabase client-side:", e);
      await resetComplaintsDirectly();
    }
  };

  // Handle AI analysis attachment
  const handleAIAnalysisSuccess = (analysis: AIAnalysis) => {
    if (!selectedComplaintId) return;
    const updated = complaints.map((c) => {
      if (c.id === selectedComplaintId) {
        return { ...c, aiAnalysis: analysis };
      }
      return c;
    });
    saveComplaints(updated);
  };

  // Handle follow-up submission
  const handleUpdateFollowUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaintId) return;

    const updated = complaints.map((c) => {
      if (c.id === selectedComplaintId) {
        if (currentUser?.role === "admin") {
          return {
            ...c,
            station: formAssignedStation,
            status: formStatus,
            currentSatisfaction: formSatisfaction,
            notes: formNotes,
            agentName: formAgentName,
            feedbackStatus: formFeedbackStatus,
            finalStatus: formFinalStatus,
            solutionProvidedByAftermarket: formSolutionProvided,
            solutionDate: formSolutionDate,
            followUpDate: formFollowUpDate,
            updatedAt: new Date().toISOString().split("T")[0]
          };
        }
        
        if (currentUser?.role === "agent") {
          const submitDate = new Date().toISOString().split("T")[0];
          return {
            ...c,
            stationContactedDate: submitDate,
            stationResolutionNotes: formStationResolutionNotes,
            agentName: formAgentName || `${currentUser.station} Adviser`,
            status: "Contacted" as FollowUpStatus, // Auto mark as Contacted
            feedbackStatus: formFeedbackStatus,
            finalStatus: formFinalStatus,
            solutionProvidedByAftermarket: formStationResolutionNotes, // Sync with action taken
            solutionDate: submitDate, // Sync with contacted date
            followUpDate: formFollowUpDate,
            updatedAt: submitDate
          };
        }

        if (currentUser?.role === "callcenter") {
          return {
            ...c,
            callCenterContactedDate: formCallCenterContactedDate || new Date().toISOString().split("T")[0],
            callCenterFinalRemarks: formCallCenterFinalRemarks,
            callCenterFinalSatisfaction: formCallCenterFinalSatisfaction,
            currentSatisfaction: formCallCenterFinalSatisfaction, // promote to main satisfaction
            status: (formFeedbackStatus === "Satisfied" ? "Resolved" : "Pending") as FollowUpStatus, // mark Resolved only on "Satisfied" feedback, otherwise keep as "Pending"
            feedbackStatus: formFeedbackStatus,
            finalStatus: formFinalStatus,
            solutionProvidedByAftermarket: formSolutionProvided,
            solutionDate: formSolutionDate,
            followUpDate: formFollowUpDate || formCallCenterContactedDate || new Date().toISOString().split("T")[0],
            updatedAt: new Date().toISOString().split("T")[0]
          };
        }
      }
      return c;
    });

    saveComplaints(updated);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Pre-fill form when selected complaint changes
  const selectedComplaint = complaints.find((c) => c.id === selectedComplaintId);
  useEffect(() => {
    if (selectedComplaint) {
      setFormStatus(selectedComplaint.status);
      setFormSatisfaction(selectedComplaint.currentSatisfaction);
      setFormNotes(selectedComplaint.notes || "");
      setFormAgentName(selectedComplaint.agentName || (currentUser?.role === "agent" ? currentUser.station + " Agent" : ""));
      
      // Load custom fields
      setFormStationContactedDate(selectedComplaint.stationContactedDate || new Date().toISOString().split("T")[0]);
      setFormStationResolutionNotes(selectedComplaint.stationResolutionNotes || "");
      setFormCallCenterContactedDate(selectedComplaint.callCenterContactedDate || new Date().toISOString().split("T")[0]);
      setFormCallCenterFinalRemarks(selectedComplaint.callCenterFinalRemarks || "");
      setFormCallCenterFinalSatisfaction(selectedComplaint.callCenterFinalSatisfaction || "Neutral");
      setFormAssignedStation(selectedComplaint.station || "");

      // Intelligent fallbacks for custom parallel status fields
      const initialFeedbackStatus = selectedComplaint.feedbackStatus || (
        selectedComplaint.status === "Resolved" ? "Satisfied" : "Follow Up Required"
      );
      const initialFinalStatus = selectedComplaint.finalStatus || (
        selectedComplaint.status === "Resolved" ? "Closed" :
        selectedComplaint.status === "Contacted" ? "Solution Received" :
        selectedComplaint.status === "In Progress" ? "Pending with Aftermarket" : "Open"
      );
      
      setFormFeedbackStatus(initialFeedbackStatus);
      setFormFinalStatus(initialFinalStatus);
      setFormSolutionProvided(selectedComplaint.solutionProvidedByAftermarket || selectedComplaint.stationResolutionNotes || "");
      setFormSolutionDate(selectedComplaint.solutionDate || selectedComplaint.stationContactedDate || "");
      setFormFollowUpDate(selectedComplaint.followUpDate || selectedComplaint.callCenterContactedDate || new Date().toISOString().split("T")[0]);
    }
  }, [selectedComplaintId, currentUser]);

  if (!currentUser) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  // Filter complaints based on search and selected filter values
  const filteredComplaints = complaints.filter((c) => {
    // Search filter (name, email, phone, or description)
    const matchesSearch = 
      c.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.customerPhone.includes(searchQuery) ||
      (c.customerEmail && c.customerEmail.toLowerCase().includes(searchQuery.toLowerCase())) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.vehicleRegNo && c.vehicleRegNo.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.woNo && c.woNo.toLowerCase().includes(searchQuery.toLowerCase()));

    // Station filter - locked to logged-in agent station
    const activeStation = currentUser.role === "agent" ? currentUser.station : stationFilter;
    const matchesStation = activeStation === "All" || c.station === activeStation;

    // Status filter
    const matchesStatus = statusFilter === "All" || c.status === statusFilter;

    // Category filter
    const matchesCategory = categoryFilter === "All" || c.category === categoryFilter;

    // Call Center Quick Filter
    let matchesCallCenterQuick = true;
    if (currentUser.role === "callcenter") {
      if (callCenterQuickFilter === "awaiting") {
        // Station must have contacted them (has stationResolutionNotes or stationContactedDate) 
        // AND call center hasn't logged final remarks yet
        matchesCallCenterQuick = !!(c.stationResolutionNotes || c.stationContactedDate) && !c.callCenterFinalRemarks;
      } else if (callCenterQuickFilter === "completed") {
        matchesCallCenterQuick = !!c.callCenterFinalRemarks;
      }
    }

    return matchesSearch && matchesStation && matchesStatus && matchesCategory && matchesCallCenterQuick;
  });

  // Calculate high-level KPIs for filtered view
  const totalCount = filteredComplaints.length;
  const pendingCount = filteredComplaints.filter((c) => c.status === "Pending").length;
  const progressCount = filteredComplaints.filter((c) => c.status === "In Progress").length;
  const resolvedCount = filteredComplaints.filter((c) => c.status === "Resolved").length;

  // CX Recovery Score: percentage converted to Neutral/Satisfied/Very Satisfied, or Resolved status
  const recoveredCount = filteredComplaints.filter(
    (c) => c.status === "Resolved" || c.currentSatisfaction === "Satisfied" || c.currentSatisfaction === "Very Satisfied"
  ).length;
  const recoveryRate = totalCount > 0 ? Math.round((recoveredCount / totalCount) * 100) : 0;

  // Unique lists for dropdowns
  const categories = Array.from(new Set(complaints.map((c) => c.category)));

  // Satisfaction mapping helper
  const getSatisfactionBadge = (level: SatisfactionLevel) => {
    switch (level) {
      case "Very Dissatisfied":
        return <span className="bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold px-1.5 py-0.5 rounded">😡 Very Dissatisfied</span>;
      case "Dissatisfied":
        return <span className="bg-orange-50 text-orange-700 border border-orange-200 text-[10px] font-bold px-1.5 py-0.5 rounded">🙁 Dissatisfied</span>;
      case "Neutral":
        return <span className="bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold px-1.5 py-0.5 rounded">😐 Neutral</span>;
      case "Satisfied":
        return <span className="bg-green-50 text-green-700 border border-green-200 text-[10px] font-bold px-1.5 py-0.5 rounded">🙂 Satisfied</span>;
      case "Very Satisfied":
        return <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-1.5 py-0.5 rounded">😄 Very Satisfied</span>;
    }
  };

  const getStatusBadge = (status: FollowUpStatus) => {
    switch (status) {
      case "Pending":
        return <span className="bg-red-50 text-red-700 border border-red-200 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded">Pending</span>;
      case "In Progress":
        return <span className="bg-orange-50 text-orange-700 border border-orange-200 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded">In Progress</span>;
      case "Contacted":
        return <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded">Contacted</span>;
      case "Resolved":
        return <span className="bg-green-50 text-green-700 border border-green-200 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded">Resolved</span>;
    }
  };

  const getFeedbackStatusBadge = (status?: string) => {
    const val = status || "Follow Up Required";
    let colorClass = "bg-blue-50 text-blue-700 border-blue-200";
    if (val === "Satisfied") colorClass = "bg-green-50 text-green-700 border-green-200";
    else if (val === "Not Satisfied") colorClass = "bg-red-50 text-red-700 border-red-200";
    else if (val === "No solution Received") colorClass = "bg-amber-50 text-amber-700 border-amber-200";
    else if (val === "Customer Unreachable") colorClass = "bg-purple-50 text-purple-700 border-purple-200";
    else if (val === "Not Interested to Talk") colorClass = "bg-slate-100 text-slate-700 border-slate-300";
    else if (val === "Escalated") colorClass = "bg-rose-50 text-rose-700 border-rose-200";
    
    return (
      <span className={`inline-flex items-center text-[10px] font-black border px-2 py-0.5 rounded-full ${colorClass}`}>
        {val}
      </span>
    );
  };

  const getFinalStatusBadge = (status?: string) => {
    const val = status || "Open";
    let colorClass = "bg-slate-50 text-slate-700 border-slate-200";
    if (val === "Closed") colorClass = "bg-green-50 text-green-700 border-green-200";
    else if (val === "Solution Received") colorClass = "bg-blue-50 text-blue-700 border-blue-200";
    else if (val === "Pending with Aftermarket") colorClass = "bg-amber-50 text-amber-700 border-amber-200";
    else if (val === "Pending Customer Verification") colorClass = "bg-yellow-50 text-yellow-700 border-yellow-200";
    else if (val === "Unreachable") colorClass = "bg-red-50 text-red-700 border-red-200";
    
    return (
      <span className={`inline-flex items-center text-[10px] font-black border px-2 py-0.5 rounded-full ${colorClass}`}>
        {val}
      </span>
    );
  };

  return (
    <div id="app-root" className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      
      {/* Top Corporate Nav */}
      <header id="app-header" className="bg-white border-b border-slate-200 shrink-0 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-slate-100 border border-slate-200 p-2 rounded-lg">
              <Car id="header-logo" className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h1 id="header-title" className="text-xs font-black tracking-tight text-slate-800 uppercase">
                Ideal Group CX Recovery
              </h1>
              <p className="text-[9px] text-slate-500 font-bold">
                {currentUser.role === "admin" 
                  ? "National Management Terminal" 
                  : currentUser.role === "callcenter" 
                    ? "Call Center Follow-Up Terminal" 
                    : `${currentUser.station} Station Terminal`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Supabase Status Indicator */}
            {supabaseActive !== null && (
              <div 
                id="supabase-status-badge"
                className={`flex items-center gap-1.5 py-1 px-2.5 rounded-md border text-[11px] font-bold ${
                  supabaseActive 
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700" 
                    : "bg-amber-50 border-amber-200 text-amber-700"
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${supabaseActive ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                <span>{supabaseActive ? "Supabase Active" : "Supabase: Offline Fallback"}</span>
              </div>
            )}

            <div className="hidden sm:flex items-center gap-2 bg-slate-50 py-1 px-2.5 rounded-md border border-slate-200">
              <User className="h-3.5 w-3.5 text-blue-600" />
              <span className="text-[11px] text-slate-700 font-bold">
                {currentUser.role === "admin" 
                  ? "National Manager" 
                  : currentUser.role === "callcenter" 
                    ? "Call Center Agent" 
                    : `${currentUser.station} Service Adviser`}
              </span>
            </div>
            
            <button
              id="btn-logout"
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-slate-600 hover:text-red-700 font-bold text-[11px] bg-white hover:bg-red-50 py-1.5 px-3 rounded-md border border-slate-200 hover:border-red-200 transition-all cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-4 flex flex-col gap-4 overflow-x-hidden">
        
        {/* Supabase Table Setup Warning Banner */}
        {supabaseActive === false && (
          <div 
            id="supabase-warning-banner"
            className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all"
          >
            <div className="space-y-1">
              <h4 className="text-xs font-black text-amber-800 uppercase tracking-tight flex items-center gap-2">
                ⚠️ Supabase Setup or RLS Policies Required
              </h4>
              <p className="text-[11px] text-amber-700 font-medium leading-relaxed">
                A secure backend connection has been established to your Supabase project (<code className="font-mono bg-amber-100 px-1 py-0.2 rounded font-bold text-amber-900">qsistbvaukxuwebqupiy</code>), but there is a table or policy configuration issue. Since your <code className="font-mono bg-amber-100 px-1 py-0.2 rounded font-bold text-amber-900">complaints</code> table already exists, copy our complete drop-and-recreate script below to safely re-create the table and configure all required public read/write permissions so that other PCs can sync instantly!
              </p>
              {supabaseError && (
                <div className="mt-2 text-[10px] bg-red-50 border border-red-100 text-red-700 font-mono p-1.5 rounded font-bold">
                  Connection Diagnostic: {supabaseError}
                </div>
              )}
            </div>
            <button
              id="btn-copy-supabase-sql"
              type="button"
              onClick={() => {
                const sqlText = `-- CLEAR AND RECREATE COMPLAINTS TABLE (Saves form feeding & tracking)
DROP TABLE IF EXISTS complaints CASCADE;

CREATE TABLE complaints (
  id text primary key,
  "customerName" text,
  "customerPhone" text,
  "customerEmail" text,
  station text,
  category text,
  description text,
  date text,
  "receivedDateTime" text,
  "initialSatisfaction" text,
  "currentSatisfaction" text,
  status text,
  notes text,
  "agentName" text,
  "aiAnalysis" jsonb,
  "updatedAt" text,
  month text,
  company text,
  "woNo" text,
  "woState" text,
  "vehicleRegNo" text,
  "mchCodeDescription" text,
  "workType" text,
  "customerNo" text,
  "earliestStartDate" text,
  "finishDate" text,
  tel2 text,
  mileage text,
  "advisorName" text,
  "chassiNo" text,
  "npsScore" integer,
  "stationContactedDate" text,
  "stationResolutionNotes" text,
  "callCenterContactedDate" text,
  "callCenterFinalRemarks" text,
  "callCenterFinalSatisfaction" text,
  "feedbackStatus" text,
  "finalStatus" text,
  "solutionProvidedByAftermarket" text,
  "solutionDate" text,
  "followUpDate" text
);

-- ENABLE ROW LEVEL SECURITY FOR MULTI-PC COLLABORATION
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;

-- REMOVE EXISTING POLICIES TO AVOID CONFLICTS
DROP POLICY IF EXISTS "Allow public read" ON complaints;
DROP POLICY IF EXISTS "Allow public insert" ON complaints;
DROP POLICY IF EXISTS "Allow public update" ON complaints;
DROP POLICY IF EXISTS "Allow public delete" ON complaints;

-- CREATE FRESH SECURE PERMISSIVE POLICIES
CREATE POLICY "Allow public read" ON complaints FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON complaints FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON complaints FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON complaints FOR DELETE USING (true);
`;
                navigator.clipboard.writeText(sqlText);
                alert("SQL Setup Script copied to clipboard! Paste it in your Supabase SQL Editor, run it, and refresh the browser.");
              }}
              className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] py-1.5 px-3 rounded shadow-sm transition-all cursor-pointer uppercase tracking-wider"
            >
              Copy SQL Script
            </button>
          </div>
        )}
        
        {/* National Manager & Call Center Tabs navigation */}
        {(currentUser.role === "admin" || currentUser.role === "callcenter") && (
          <div className="flex border-b border-slate-200 gap-1 shrink-0">
            <button
              id="tab-analytics-btn"
              type="button"
              onClick={() => setCurrentTab("analytics")}
              className={`py-1.5 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                currentTab === "analytics"
                  ? "border-blue-600 text-blue-600 bg-blue-50/20 font-black"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Users className="h-3.5 w-3.5 inline mr-1.5" />
              View All Complaints
            </button>
            <button
              id="tab-stations-btn"
              type="button"
              onClick={() => setCurrentTab("stations")}
              className={`py-1.5 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                currentTab === "stations"
                  ? "border-blue-600 text-blue-600 bg-blue-50/20 font-black"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <MapPin className="h-3.5 w-3.5 inline mr-1.5" />
              Complaints for Each Service Station
            </button>
            <button
              id="tab-reports-btn"
              type="button"
              onClick={() => setCurrentTab("reports")}
              className={`py-1.5 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                currentTab === "reports"
                  ? "border-blue-600 text-blue-600 bg-blue-50/20 font-black"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <FileSpreadsheet className="h-3.5 w-3.5 inline mr-1.5" />
              Reports & Downloads
            </button>
            {currentUser.role === "admin" && (
              <button
                id="tab-upload-btn"
                type="button"
                onClick={() => setCurrentTab("upload")}
                className={`py-1.5 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  currentTab === "upload"
                    ? "border-blue-600 text-blue-600 bg-blue-50/20 font-black"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <FileSpreadsheet className="h-3.5 w-3.5 inline mr-1.5" />
                Upload Data
              </button>
            )}
          </div>
        )}

        {/* STATION PERFORMANCE TAB */}
        {(currentUser.role === "admin" || currentUser.role === "callcenter") && currentTab === "stations" && (
          <StationOverview 
            complaints={complaints} 
            onSelectStation={(stationCode) => {
              setStationFilter(stationCode);
              setCurrentTab("analytics");
            }} 
          />
        )}

        {/* ADMIN TAB: UPLOAD ZONE */}
        {currentUser.role === "admin" && currentTab === "upload" && (
          <UploadZone 
            onDataLoaded={handleDataLoaded} 
            onResetDemo={handleResetDemo} 
          />
        )}

        {/* REPORTS & AGING TAB */}
        {(currentUser.role === "admin" || currentUser.role === "callcenter") && currentTab === "reports" && (
          <ReportsPanel complaints={complaints} />
        )}

        {/* CORE ANALYTICS BOARD / WORKSPACE VIEW */}
        {currentTab === "analytics" && (
          <div className="space-y-4">
            
            {/* KPI Metrics Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <MetricCard
                title="Total Dissatisfied"
                value={totalCount}
                subtitle="From current search scope"
                icon={<Users className="h-4.5 w-4.5 text-slate-400" />}
                colorClass="bg-white border-slate-200 text-slate-900 shadow-sm"
                onClick={() => {
                  if (currentUser.role === "admin" || currentUser.role === "callcenter") {
                    setCurrentTab("stations");
                  }
                }}
              />
              <MetricCard
                title="Pending Recovery"
                value={pendingCount}
                subtitle="Immediate action required"
                icon={<Clock className="h-4.5 w-4.5 text-red-500" />}
                colorClass="bg-red-50 border-red-200 text-red-700 shadow-sm"
              />
              <MetricCard
                title="In Progress"
                value={progressCount}
                subtitle="Currently being investigated"
                icon={<Settings className="h-4.5 w-4.5 text-orange-500" />}
                colorClass="bg-orange-50 border-orange-200 text-orange-700 shadow-sm"
              />
              <MetricCard
                title="Successfully Resolved"
                value={resolvedCount}
                subtitle="Satisfaction restored"
                icon={<CheckCircle className="h-4.5 w-4.5 text-green-500" />}
                colorClass="bg-green-50 border-green-200 text-green-700 shadow-sm"
              />
              <MetricCard
                title="CX Recovery Score"
                value={`${recoveryRate}%`}
                subtitle="Converted to Neutral/Satisfied"
                icon={<TrendingUp className="h-4.5 w-4.5 text-blue-600" />}
                colorClass="bg-blue-50 border-blue-200 text-blue-700 shadow-sm col-span-2 lg:col-span-1"
              />
            </div>

            {/* Split Screen Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              
              {/* Left Side: Complaints Explorer */}
              <div className="lg:col-span-7 space-y-3">
                
                {/* Search & Filter Controls Card */}
                <div id="controls-panel" className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm">
                  <div className="flex flex-col gap-2.5">
                    
                    {/* Call Center Filter Tabs */}
                    {currentUser.role === "callcenter" && (
                      <div className="flex bg-slate-100 p-0.5 rounded-md gap-0.5 self-start w-full">
                        <button
                          type="button"
                          onClick={() => setCallCenterQuickFilter("awaiting")}
                          className={`flex-1 text-center py-1.5 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                            callCenterQuickFilter === "awaiting"
                              ? "bg-white text-blue-600 shadow-xs"
                              : "text-slate-600 hover:text-slate-800"
                          }`}
                        >
                          Awaiting Call Center Follow-up ({complaints.filter(c => !!(c.stationResolutionNotes || c.stationContactedDate) && !c.callCenterFinalRemarks).length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setCallCenterQuickFilter("completed")}
                          className={`flex-1 text-center py-1.5 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                            callCenterQuickFilter === "completed"
                              ? "bg-white text-blue-600 shadow-xs"
                              : "text-slate-600 hover:text-slate-800"
                          }`}
                        >
                          Completed ({complaints.filter(c => !!c.callCenterFinalRemarks).length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setCallCenterQuickFilter("all")}
                          className={`flex-1 text-center py-1.5 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                            callCenterQuickFilter === "all"
                              ? "bg-white text-blue-600 shadow-xs"
                              : "text-slate-600 hover:text-slate-800"
                          }`}
                        >
                          All ({complaints.length})
                        </button>
                      </div>
                    )}

                    {/* Search row */}
                    <div className="relative">
                      <input
                        id="search-input"
                        type="text"
                        placeholder="Search by customer name, phone, email, or complaint text..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 rounded-md py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:border-blue-500 transition-colors"
                      />
                      <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                    </div>

                    {/* Filters Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      
                      {/* Station filter: hidden if logged-in agent */}
                      {currentUser.role === "admin" || currentUser.role === "callcenter" ? (
                        <div className="flex flex-col">
                          <label className="text-[10px] text-slate-500 font-bold uppercase mb-1">Service Station</label>
                          <select
                            id="filter-station"
                            value={stationFilter}
                            onChange={(e) => setStationFilter(e.target.value)}
                            className="bg-white border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-700 cursor-pointer focus:outline-none focus:border-blue-500"
                          >
                            <option value="All">All Stations</option>
                            {STATIONS.map((st) => (
                              <option key={st.code} value={st.code}>{st.name}</option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div className="flex flex-col justify-center bg-blue-50/50 border border-blue-100 px-2 py-1 rounded-md text-center">
                          <span className="text-[9px] text-slate-500 block uppercase tracking-wider font-bold">Lock station:</span>
                          <span className="text-xs text-blue-600 font-bold block">{currentUser.station} HQ</span>
                        </div>
                      )}

                      <div className="flex flex-col">
                        <label className="text-[10px] text-slate-500 font-bold uppercase mb-1">Follow-up Status</label>
                        <select
                          id="filter-status"
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value)}
                          className="bg-white border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-700 cursor-pointer focus:outline-none focus:border-blue-500"
                        >
                          <option value="All">All Statuses</option>
                          <option value="Pending">Pending</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Contacted">Contacted</option>
                          <option value="Resolved">Resolved</option>
                        </select>
                      </div>

                      <div className="flex flex-col">
                        <label className="text-[10px] text-slate-500 font-bold uppercase mb-1">Complaint Category</label>
                        <select
                          id="filter-category"
                          value={categoryFilter}
                          onChange={(e) => setCategoryFilter(e.target.value)}
                          className="bg-white border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-700 cursor-pointer focus:outline-none focus:border-blue-500"
                        >
                          <option value="All">All Categories</option>
                          {categories.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>

                    </div>
                  </div>
                </div>

                {/* Complaints List Header Bar */}
                <div className="flex items-center justify-between py-1 px-1.5 bg-slate-100 rounded-md border border-slate-200 mb-2">
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider pl-1">
                    Complaints Inventory ({filteredComplaints.length})
                  </span>
                  <div className="flex gap-1.5">
                    {(currentUser.role === "admin" || currentUser.role === "callcenter") && (
                      <div className="relative flex items-center">
                        {!showDeleteAllConfirm ? (
                          <button
                            type="button"
                            onClick={() => setShowDeleteAllConfirm(true)}
                            className="bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-[10px] py-1 px-2.5 rounded-md transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                            title="Delete all complaints from local storage"
                          >
                            🗑️ Delete All
                          </button>
                        ) : (
                          <div className="flex items-center gap-1 bg-red-50 border border-red-200 rounded-md p-0.5">
                            <span className="text-[9px] font-black text-red-700 px-1">Confirm delete ALL?</span>
                            <button
                              type="button"
                              onClick={handleDeleteAllComplaints}
                              className="bg-red-600 hover:bg-red-700 text-white text-[9px] font-black px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowDeleteAllConfirm(false)}
                              className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-[9px] font-black px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                            >
                              No
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    {currentUser.role === "admin" && (
                      <button
                        type="button"
                        onClick={() => setShowAddModal(true)}
                        className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-[10px] py-1 px-2.5 rounded-md transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                      >
                        <span className="font-extrabold text-xs leading-none">+</span> Add Complaint
                      </button>
                    )}
                  </div>
                </div>

                {/* Complaints List Container */}
                <div id="complaints-list-wrapper" className="space-y-1.5 max-h-[550px] overflow-y-auto pr-1">
                  {filteredComplaints.length === 0 ? (
                    <div className="bg-white rounded-lg border border-slate-200 p-10 text-center">
                      <AlertTriangle className="h-7 w-7 text-slate-400 mx-auto mb-2" />
                      <p className="text-slate-700 font-bold text-sm">No complaints match your filters.</p>
                      <p className="text-slate-400 text-xs mt-1">Try resetting search inputs or uploading a new spreadsheet.</p>
                    </div>
                  ) : (
                    filteredComplaints.map((item) => {
                      const isSelected = selectedComplaintId === item.id;
                      return (
                        <div
                          id={`complaint-card-${item.id}`}
                          key={item.id}
                          onClick={() => setSelectedComplaintId(item.id)}
                          className={`p-3.5 rounded-lg border transition-all cursor-pointer select-none text-left ${
                            isSelected 
                              ? "border-blue-500 bg-blue-50/25 shadow-sm ring-1 ring-blue-500/10" 
                              : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="text-[10px] font-mono font-bold text-slate-400 block flex flex-wrap items-center gap-1">
                                <span>{item.id}</span>
                                <span>•</span>
                                <span className="bg-blue-50 text-blue-700 px-1 py-0.5 rounded font-black text-[9px] uppercase tracking-wider">
                                  Received: {item.receivedDateTime || `${item.date} 08:00 AM`}
                                </span>
                              </span>
                              <h4 className="text-sm font-bold text-slate-800 font-sans mt-0.5">
                                {item.customerName}
                              </h4>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              {getStatusBadge(item.status)}
                              {getSatisfactionBadge(item.currentSatisfaction)}
                            </div>
                          </div>

                          {/* Station Tag & Category Tag */}
                          <div className="flex flex-wrap gap-1.5 mt-2.5">
                            <span className="inline-flex items-center text-[10px] bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-slate-600 font-bold">
                              <MapPin className="h-3 w-3 text-blue-600 mr-1" />
                              {item.station}
                            </span>
                            <span className="inline-flex items-center text-[10px] bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-slate-600 font-bold">
                              {item.category}
                            </span>
                            {item.aiAnalysis && (
                              <span className="inline-flex items-center text-[9px] bg-green-50 border border-green-200 px-2 py-0.5 rounded text-green-700 font-bold uppercase tracking-wider">
                                <Sparkles className="h-2.5 w-2.5 mr-1 text-green-600" />
                                AI Optimized
                              </span>
                            )}
                          </div>

                          <p className="text-slate-500 text-xs mt-2.5 line-clamp-2 leading-relaxed font-medium">
                            {item.description}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>

              </div>

              {/* Right Side: Active Recovery Workspace Panel */}
              <div className="lg:col-span-5">
                {selectedComplaint ? (
                  <div id="recovery-workspace-card" className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm sticky top-[68px] space-y-4 text-left">
                    
                    {/* Workspace Header */}
                    <div className="border-b border-slate-100 pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest block font-sans">
                            Active Recovery Workspace
                          </span>
                          <h3 className="text-lg font-black text-slate-800 mt-0.5">
                            {selectedComplaint.customerName}
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5 font-medium">
                            Assigned Station: <strong className="text-slate-700">{selectedComplaint.station} HQ</strong>
                          </p>
                          <div className="mt-1.5 flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-1 rounded text-[10px] text-slate-600 font-bold w-fit">
                            <Clock className="h-3 w-3 text-blue-600 shrink-0" />
                            <span>Received Date & Time: <span className="text-blue-700 font-black">{selectedComplaint.receivedDateTime || `${selectedComplaint.date} 08:00 AM`}</span></span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {getStatusBadge(selectedComplaint.status)}
                          {getSatisfactionBadge(selectedComplaint.currentSatisfaction)}

                          {currentUser.role === "admin" && (
                            <div className="mt-2 text-right">
                              {deletingId !== selectedComplaint.id ? (
                                <button
                                  type="button"
                                  onClick={() => setDeletingId(selectedComplaint.id)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50 border border-slate-200 hover:border-red-200 text-[10px] font-bold px-2 py-1 rounded transition-all cursor-pointer flex items-center gap-1 shrink-0"
                                  title="Delete this complaint"
                                >
                                  <span>🗑️</span> Remove
                                </button>
                              ) : (
                                <div className="bg-red-50 p-1.5 rounded border border-red-200 flex flex-col gap-1 items-end">
                                  <span className="text-[9px] font-bold text-red-700">Delete this complaint?</span>
                                  <div className="flex gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteComplaint(selectedComplaint.id)}
                                      className="bg-red-600 hover:bg-red-700 text-white text-[9px] font-black px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                                    >
                                      Yes
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDeletingId(null)}
                                      className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-[9px] font-black px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                                    >
                                      No
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Step Timeline Progress Tracker */}
                    <div className="grid grid-cols-3 gap-2 border-b border-slate-100 pb-4">
                      <div className={`text-center p-2 rounded-lg border ${
                        selectedComplaint.status === "Pending" 
                          ? "bg-red-50/50 border-red-200" 
                          : "bg-slate-50 border-slate-100"
                      }`}>
                        <span className="text-[9px] font-bold text-slate-400 block uppercase">Step 1</span>
                        <span className={`text-[10px] font-black ${
                          selectedComplaint.status === "Pending" ? "text-red-600" : "text-slate-600"
                        }`}>Uploaded</span>
                      </div>
                      
                      <div className={`text-center p-2 rounded-lg border ${
                        selectedComplaint.stationResolutionNotes || selectedComplaint.stationContactedDate
                          ? "bg-green-50 border-green-200"
                          : selectedComplaint.status === "In Progress" || selectedComplaint.status === "Contacted"
                            ? "bg-blue-50/50 border-blue-200 animate-pulse"
                            : "bg-slate-50/50 border-slate-100 text-slate-400"
                      }`}>
                        <span className="text-[9px] font-bold text-slate-400 block uppercase">Step 2</span>
                        <span className={`text-[10px] font-black ${
                          selectedComplaint.stationResolutionNotes || selectedComplaint.stationContactedDate
                            ? "text-green-700"
                            : selectedComplaint.status === "In Progress" || selectedComplaint.status === "Contacted"
                              ? "text-blue-600"
                              : "text-slate-400"
                        }`}>Station Solved</span>
                      </div>

                      <div className={`text-center p-2 rounded-lg border ${
                        selectedComplaint.callCenterFinalRemarks
                          ? "bg-green-50 border-green-200"
                          : "bg-slate-50/50 border-slate-100 text-slate-400"
                      }`}>
                        <span className="text-[9px] font-bold text-slate-400 block uppercase">Step 3</span>
                        <span className={`text-[10px] font-black ${
                          selectedComplaint.callCenterFinalRemarks ? "text-green-700" : "text-slate-400"
                        }`}>Verified</span>
                      </div>
                    </div>

                    {/* Parallel SLA & Operational Status Badges */}
                    <div className="grid grid-cols-2 gap-3 bg-blue-50/20 border border-slate-200 p-3 rounded-lg text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider mb-1">
                          SLA Feedback Status
                        </span>
                        {getFeedbackStatusBadge(selectedComplaint.feedbackStatus)}
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider mb-1">
                          Operational Life Cycle
                        </span>
                        {getFinalStatusBadge(selectedComplaint.finalStatus)}
                      </div>
                    </div>

                    {/* Customer Contact & Channel Metadata */}
                    <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs text-slate-600">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Phone:</span>
                        <a href={`tel:${selectedComplaint.customerPhone}`} className="flex items-center gap-1.5 hover:text-blue-600 transition-colors font-bold text-slate-700">
                          <Phone className="h-3 w-3 text-blue-600 animate-bounce" />
                          {selectedComplaint.customerPhone || "Not provided"}
                        </a>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Email:</span>
                        <a href={`mailto:${selectedComplaint.customerEmail}`} className="flex items-center gap-1.5 hover:text-blue-600 transition-colors font-bold text-slate-700">
                          <Mail className="h-3 w-3 text-blue-600" />
                          <span className="truncate max-w-[120px]" title={selectedComplaint.customerEmail}>{selectedComplaint.customerEmail || "Not provided"}</span>
                        </a>
                      </div>
                    </div>

                    {/* Full Comprehensive Excel Work Order details block */}
                    <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden text-xs">
                      <div className="bg-slate-100/80 px-3 py-2 border-b border-slate-200 flex justify-between items-center">
                        <span className="font-bold text-slate-700 uppercase tracking-wider text-[9px]">
                          Original Feedback & Vehicle Metadata
                        </span>
                        {selectedComplaint.npsScore !== undefined && (
                          <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-black text-[9px]">
                            Initial Rating: {selectedComplaint.npsScore}/10
                          </span>
                        )}
                      </div>
                      <div className="p-3 grid grid-cols-2 gap-x-4 gap-y-2 text-slate-600">
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 block uppercase">Inquiry Received At</span>
                          <span className="font-bold text-slate-800 text-[11px]">{selectedComplaint.receivedDateTime || `${selectedComplaint.date} 08:00 AM`}</span>
                        </div>
                        {selectedComplaint.month && (
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 block uppercase">Month</span>
                            <span className="font-semibold text-slate-800">{selectedComplaint.month}</span>
                          </div>
                        )}
                        {selectedComplaint.company && (
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 block uppercase">Company</span>
                            <span className="font-semibold text-slate-800">{selectedComplaint.company}</span>
                          </div>
                        )}
                        {selectedComplaint.woNo && (
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 block uppercase">Work Order</span>
                            <span className="font-bold text-blue-600">
                              #{selectedComplaint.woNo} <span className="text-[10px] text-slate-500 font-medium">({selectedComplaint.woState || "Completed"})</span>
                            </span>
                          </div>
                        )}
                        {selectedComplaint.vehicleRegNo && (
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 block uppercase">Vehicle Reg No</span>
                            <span className="font-bold text-slate-800 font-mono bg-white px-1 py-0.5 border border-slate-200 rounded">
                              {selectedComplaint.vehicleRegNo}
                            </span>
                          </div>
                        )}
                        {selectedComplaint.mchCodeDescription && (
                          <div className="col-span-2">
                            <span className="text-[9px] font-bold text-slate-400 block uppercase">Model description</span>
                            <span className="font-semibold text-slate-800">{selectedComplaint.mchCodeDescription}</span>
                          </div>
                        )}
                        {selectedComplaint.customerNo && (
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 block uppercase">Customer No</span>
                            <span className="font-mono text-slate-800">{selectedComplaint.customerNo}</span>
                          </div>
                        )}
                        {selectedComplaint.advisorName && (
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 block uppercase">Original Adviser</span>
                            <span className="font-semibold text-slate-800">{selectedComplaint.advisorName}</span>
                          </div>
                        )}
                        {selectedComplaint.mileage && (
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 block uppercase">Mileage</span>
                            <span className="font-semibold text-slate-800">{selectedComplaint.mileage} KM</span>
                          </div>
                        )}
                        {selectedComplaint.chassiNo && (
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 block uppercase">Chassis No</span>
                            <span className="font-mono text-slate-800 text-[10px]">{selectedComplaint.chassiNo}</span>
                          </div>
                        )}
                        {selectedComplaint.tel2 && (
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 block uppercase">Tel 2 (Alt)</span>
                            <span className="font-semibold text-slate-800">{selectedComplaint.tel2}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Complaint Reason details */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Customer Complaint Description (Excel):
                      </span>
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs text-slate-600 leading-relaxed font-semibold">
                        {selectedComplaint.description}
                      </div>
                    </div>

                    {/* Gemini AI Assistant Component */}
                    <AIRecoveryAssistant 
                      complaint={selectedComplaint} 
                      onAnalysisSuccess={handleAIAnalysisSuccess} 
                    />

                    {/* Role-Specific Action Forms */}
                    <div className="border-t border-slate-100 pt-4 space-y-4">
                      
                      {/* ROLE: STATION AGENT ACTION FORM */}
                      {currentUser.role === "agent" && (
                        <form id="agent-action-form" onSubmit={handleUpdateFollowUp} className="space-y-3">
                          <h4 className="text-xs font-black text-blue-700 uppercase tracking-wider flex items-center gap-1.5 bg-blue-50 px-2 py-1.5 rounded border border-blue-100">
                            <Settings className="h-4 w-4" />
                            Station Adviser Action Logs
                          </h4>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                Date Contacted Customer (Auto-Captured)
                              </label>
                              <div className="bg-slate-100 border border-slate-200 rounded-md py-1.5 px-2.5 text-xs text-slate-600 font-bold flex items-center justify-between">
                                <span>{formStationContactedDate || new Date().toISOString().split("T")[0]}</span>
                                <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider">
                                  Auto
                                </span>
                              </div>
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                Actioned Adviser Name *
                              </label>
                              <input
                                type="text"
                                required
                                placeholder="e.g. S. Priyantha"
                                value={formAgentName}
                                onChange={(e) => setFormAgentName(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-md py-1.5 px-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              Action Taken & Customer Resolution Notes *
                            </label>
                            <textarea
                              rows={3}
                              required
                              placeholder="Detail how your station contacted and resolved this customer's complaint (e.g. called client, replaced rattle bracket free-of-charge, client is happy to be verified by Call Center)..."
                              value={formStationResolutionNotes}
                              onChange={(e) => setFormStationResolutionNotes(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-md py-2 px-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 leading-relaxed resize-none font-medium"
                            />
                          </div>

                          {saveSuccess && (
                            <div className="text-green-700 text-xs font-semibold bg-green-50 p-2 rounded border border-green-200 text-center">
                              Station action logged and synced successfully!
                            </div>
                          )}

                          <button
                            type="submit"
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-4 rounded-md transition-all shadow-sm cursor-pointer"
                          >
                            Save Station Action & Sync
                          </button>
                        </form>
                      )}

                      {/* ROLE: CALL CENTER TEAM FORM */}
                      {currentUser.role === "callcenter" && (
                        <form id="callcenter-action-form" onSubmit={handleUpdateFollowUp} className="space-y-4">
                          
                          {/* Read-Only Service Station Action section */}
                          <div className="bg-blue-50/50 rounded-lg p-3 border border-blue-100 text-xs space-y-1.5">
                            <h5 className="font-bold text-blue-800 uppercase tracking-wider text-[9px]">
                              Logged Station Resolution (Read-Only Verification):
                            </h5>
                            <div className="text-slate-700 font-semibold">
                              {selectedComplaint.stationResolutionNotes ? (
                                <p className="italic">"{selectedComplaint.stationResolutionNotes}"</p>
                              ) : (
                                <span className="text-red-500">No corrective actions logged by the service station yet.</span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 font-medium">
                              <span>Station Contacted: <strong>{selectedComplaint.stationContactedDate || "N/A"}</strong></span>
                              <span>Adviser: <strong>{selectedComplaint.agentName || "N/A"}</strong></span>
                            </div>
                          </div>

                          <h4 className="text-xs font-black text-green-700 uppercase tracking-wider flex items-center gap-1.5 bg-green-50 px-2 py-1.5 rounded border border-green-100">
                            <Sparkles className="h-4 w-4" />
                            Call Center Final Verification
                          </h4>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                Date Contacted by Call Center *
                              </label>
                              <input
                                type="date"
                                required
                                value={formCallCenterContactedDate}
                                onChange={(e) => setFormCallCenterContactedDate(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-md py-1.5 px-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                Verified Final Satisfaction *
                              </label>
                              <select
                                value={formCallCenterFinalSatisfaction}
                                onChange={(e) => setFormCallCenterFinalSatisfaction(e.target.value as SatisfactionLevel)}
                                className="w-full bg-white border border-slate-200 rounded-md py-1.5 px-2.5 text-xs text-slate-800 cursor-pointer focus:outline-none focus:border-blue-500 font-semibold"
                              >
                                <option value="Very Dissatisfied">😡 Very Dissatisfied (No change)</option>
                                <option value="Dissatisfied">🙁 Dissatisfied (Still unhappy)</option>
                                <option value="Neutral">😐 Neutral (Acceptable outcome)</option>
                                <option value="Satisfied">🙂 Satisfied (Successfully converted)</option>
                                <option value="Very Satisfied">😄 Very Satisfied (Extremely happy)</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              Customer's Final Remark *
                            </label>
                            <textarea
                              rows={3}
                              required
                              placeholder="Enter the customer's final remarks and feedback during call center follow up..."
                              value={formCallCenterFinalRemarks}
                              onChange={(e) => setFormCallCenterFinalRemarks(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-md py-2 px-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 leading-relaxed resize-none font-medium"
                            />
                          </div>

                          <div className="bg-slate-50 p-3 rounded border border-slate-200">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              Feedback Status *
                            </label>
                            <select
                              value={formFeedbackStatus}
                              onChange={(e) => setFormFeedbackStatus(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-md py-1.5 px-2.5 text-xs text-slate-800 cursor-pointer focus:outline-none focus:border-blue-500 font-bold"
                            >
                              <option value="Satisfied">Satisfied</option>
                              <option value="Not Satisfied">Not Satisfied</option>
                              <option value="No solution Received">No solution Received</option>
                              <option value="Customer Unreachable">Customer Unreachable</option>
                              <option value="Not Interested to Talk">Not Interested to Talk</option>
                              <option value="Follow Up Required">Follow Up Required</option>
                              <option value="Escalated">Escalated</option>
                            </select>
                          </div>

                          {saveSuccess && (
                            <div className="text-green-700 text-xs font-semibold bg-green-50 p-2 rounded border border-green-200 text-center">
                              {formFeedbackStatus === "Satisfied"
                                ? "Call center feedback saved & marked as Resolved!"
                                : "Call center feedback saved & kept in Pending Recovery!"}
                            </div>
                          )}

                          <button
                            type="submit"
                            className={`w-full text-white font-bold text-xs py-2 px-4 rounded-md transition-all shadow-sm cursor-pointer ${
                              formFeedbackStatus === "Satisfied"
                                ? "bg-green-600 hover:bg-green-700"
                                : "bg-amber-600 hover:bg-amber-700"
                            }`}
                          >
                            {formFeedbackStatus === "Satisfied" ? "Save & Resolve" : "Save Final Remarks & Keep Pending"}
                          </button>
                        </form>
                      )}

                      {/* ROLE: NATIONAL ADMIN MASTER FORM */}
                      {currentUser.role === "admin" && (
                        <form id="admin-master-form" onSubmit={handleUpdateFollowUp} className="space-y-3.5">
                          
                          {/* Dynamic multi-stage logs preview if they exist */}
                          {(selectedComplaint.stationResolutionNotes || selectedComplaint.callCenterFinalRemarks) && (
                            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-xs space-y-2">
                              <span className="font-bold text-slate-700 uppercase tracking-wider text-[9px] block">
                                Multi-Stage Log History:
                              </span>
                              
                              {selectedComplaint.stationResolutionNotes && (
                                <div className="border-l-2 border-blue-500 pl-2">
                                  <span className="text-[9px] text-blue-700 font-bold block">Station Action Taken:</span>
                                  <p className="text-slate-600 font-medium">"{selectedComplaint.stationResolutionNotes}"</p>
                                  <span className="text-[8px] text-slate-400 font-medium">Contacted: {selectedComplaint.stationContactedDate} by {selectedComplaint.agentName}</span>
                                </div>
                              )}

                              {selectedComplaint.callCenterFinalRemarks && (
                                <div className="border-l-2 border-green-500 pl-2 pt-1">
                                  <span className="text-[9px] text-green-700 font-bold block">Call Center Remarks:</span>
                                  <p className="text-slate-600 font-medium">"{selectedComplaint.callCenterFinalRemarks}"</p>
                                  <span className="text-[8px] text-slate-400 font-medium">Verified on: {selectedComplaint.callCenterContactedDate} | Final Satisfaction: {selectedComplaint.callCenterFinalSatisfaction}</span>
                                </div>
                              )}
                            </div>
                          )}

                          <h4 className="text-xs font-black text-blue-800 uppercase tracking-wider flex items-center gap-1.5">
                            <Settings className="h-4 w-4 text-blue-600" />
                            Admin National Recovery & Dispatch Master
                          </h4>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                Dispatch to Service Station
                              </label>
                              <select
                                value={formAssignedStation}
                                onChange={(e) => setFormAssignedStation(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-md py-1.5 px-2.5 text-xs text-slate-800 cursor-pointer focus:outline-none focus:border-blue-500 font-semibold"
                              >
                                {STATIONS.map((st) => (
                                  <option key={st.code} value={st.code}>{st.name}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                Recovery Status
                              </label>
                              <select
                                value={formStatus}
                                onChange={(e) => setFormStatus(e.target.value as FollowUpStatus)}
                                className="w-full bg-white border border-slate-200 rounded-md py-1.5 px-2.5 text-xs text-slate-800 cursor-pointer focus:outline-none focus:border-blue-500 font-semibold"
                              >
                                <option value="Pending">Pending</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Contacted">Contacted</option>
                                <option value="Resolved">Resolved</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                Current Satisfaction Level
                              </label>
                              <select
                                value={formSatisfaction}
                                onChange={(e) => setFormSatisfaction(e.target.value as SatisfactionLevel)}
                                className="w-full bg-white border border-slate-200 rounded-md py-1.5 px-2.5 text-xs text-slate-800 cursor-pointer focus:outline-none focus:border-blue-500 font-semibold"
                              >
                                <option value="Very Dissatisfied">😡 Very Dissatisfied</option>
                                <option value="Dissatisfied">🙁 Dissatisfied</option>
                                <option value="Neutral">😐 Neutral</option>
                                <option value="Satisfied">🙂 Satisfied</option>
                                <option value="Very Satisfied">😄 Very Satisfied</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                Handling Adviser/Officer Name
                              </label>
                              <input
                                type="text"
                                required
                                value={formAgentName}
                                onChange={(e) => setFormAgentName(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-md py-1.5 px-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              General Management Action Log & Notes Override
                            </label>
                            <textarea
                              rows={3}
                              required
                              placeholder="Describe any central/national actions, customer call updates, or management interventions here..."
                              value={formNotes}
                              onChange={(e) => setFormNotes(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-md py-2 px-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 leading-relaxed resize-none font-medium"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3 bg-slate-50 p-2.5 rounded border border-slate-200">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                Feedback Status *
                              </label>
                              <select
                                value={formFeedbackStatus}
                                onChange={(e) => setFormFeedbackStatus(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-md py-1.5 px-2 text-xs text-slate-800 cursor-pointer focus:outline-none focus:border-blue-500 font-semibold"
                              >
                                <option value="Satisfied">Satisfied</option>
                                <option value="Not Satisfied">Not Satisfied</option>
                                <option value="No solution Received">No solution Received</option>
                                <option value="Customer Unreachable">Customer Unreachable</option>
                                <option value="Not Interested to Talk">Not Interested to Talk</option>
                                <option value="Follow Up Required">Follow Up Required</option>
                                <option value="Escalated">Escalated</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                Operational Status *
                              </label>
                              <select
                                value={formFinalStatus}
                                onChange={(e) => setFormFinalStatus(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-md py-1.5 px-2 text-xs text-slate-800 cursor-pointer focus:outline-none focus:border-blue-500 font-semibold"
                              >
                                <option value="Open">Open</option>
                                <option value="Pending with Aftermarket">Pending with Aftermarket</option>
                                <option value="Solution Received">Solution Received</option>
                                <option value="Pending Customer Verification">Pending Customer Verification</option>
                                <option value="Closed">Closed</option>
                                <option value="Unreachable">Unreachable</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 bg-slate-50 p-2.5 rounded border border-slate-200">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                Solution Provided by Aftermarket
                              </label>
                              <input
                                type="text"
                                placeholder="Solution Details"
                                value={formSolutionProvided}
                                onChange={(e) => setFormSolutionProvided(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-md py-1.5 px-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                Solution Date
                              </label>
                              <input
                                type="date"
                                value={formSolutionDate}
                                onChange={(e) => setFormSolutionDate(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-md py-1.5 px-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
                              />
                            </div>
                            <div className="col-span-2">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                Follow-up Date (Call Center Verification)
                              </label>
                              <input
                                type="date"
                                value={formFollowUpDate}
                                onChange={(e) => setFormFollowUpDate(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-md py-1.5 px-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
                              />
                            </div>
                          </div>

                          {saveSuccess && (
                            <div className="text-green-700 text-xs font-semibold bg-green-50 p-2 rounded border border-green-200 text-center">
                              National master logs saved and dispatched successfully!
                            </div>
                          )}

                          <button
                            type="submit"
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-4 rounded-md transition-all shadow-sm cursor-pointer"
                          >
                            Dispatch & Update Master Records
                          </button>
                        </form>
                      )}

                    </div>

                  </div>
                ) : (
                  <div className="bg-white rounded-lg border border-dashed border-slate-300 p-10 text-center text-slate-400 sticky top-[68px] shadow-sm">
                    <Clock className="h-7 w-7 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm font-bold text-slate-500">No Customer Selected</p>
                    <p className="text-xs mt-1 text-slate-400 font-medium">Select a customer complaint card from the left panel to open the recovery workspace and begin resolution.</p>
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

      </main>

      {/* Manual Add Complaint Modal Overlay */}
      {showAddModal && (
        <div id="add-complaint-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-xl flex flex-col max-h-[90vh] overflow-hidden text-left">
            
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                  Create Manual Customer Complaint
                </h3>
                <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                  Input new complaints directly into the CX Recovery pipeline.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAddManualComplaint} className="flex-1 overflow-y-auto p-5 space-y-4">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sahan Silva"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    className="w-full bg-slate-50 hover:bg-slate-50/50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-md py-1.5 px-3 text-xs text-slate-800 focus:outline-none transition-all font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                    Customer Phone *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. +94 77 111 2222"
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                    className="w-full bg-slate-50 hover:bg-slate-50/50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-md py-1.5 px-3 text-xs text-slate-800 focus:outline-none transition-all font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                    Customer Email
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. sahan@gmail.com"
                    value={newCustomerEmail}
                    onChange={(e) => setNewCustomerEmail(e.target.value)}
                    className="w-full bg-slate-50 hover:bg-slate-50/50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-md py-1.5 px-3 text-xs text-slate-800 focus:outline-none transition-all font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                    Assigned Service Station *
                  </label>
                  <select
                    required
                    value={newStation}
                    onChange={(e) => setNewStation(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-md py-1.5 px-3 text-xs text-slate-800 focus:outline-none cursor-pointer transition-all font-semibold"
                  >
                    {STATIONS.map((st) => (
                      <option key={st.code} value={st.code}>
                        {st.name} ({st.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                    Data Entry Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={newReceivedDate}
                    onChange={(e) => setNewReceivedDate(e.target.value)}
                    className="w-full bg-slate-50 hover:bg-slate-50/50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-md py-1.5 px-3 text-xs text-slate-800 focus:outline-none transition-all font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                    Data Entry Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={newReceivedTime}
                    onChange={(e) => setNewReceivedTime(e.target.value)}
                    className="w-full bg-slate-50 hover:bg-slate-50/50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-md py-1.5 px-3 text-xs text-slate-800 focus:outline-none transition-all font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                    Complaint Category *
                  </label>
                  <select
                    required
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-md py-1.5 px-3 text-xs text-slate-800 focus:outline-none cursor-pointer transition-all font-semibold"
                  >
                    <option value="Service Delay">Service Delay</option>
                    <option value="Quality of Work">Quality of Work</option>
                    <option value="Staff Behavior">Staff Behavior</option>
                    <option value="Overcharging">Overcharging</option>
                    <option value="Parts Unavailable">Parts Unavailable</option>
                    <option value="Damaged Vehicle">Damaged Vehicle</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                    Work Order (WO) Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. WO-54219"
                    value={newWoNo}
                    onChange={(e) => setNewWoNo(e.target.value)}
                    className="w-full bg-slate-50 hover:bg-slate-50/50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-md py-1.5 px-3 text-xs text-slate-800 focus:outline-none transition-all font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                    Vehicle Reg No
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. WP CAB-9988"
                    value={newVehicleRegNo}
                    onChange={(e) => setNewVehicleRegNo(e.target.value)}
                    className="w-full bg-slate-50 hover:bg-slate-50/50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-md py-1.5 px-3 text-xs text-slate-800 focus:outline-none transition-all font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                    Chassis Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. MC3H89..."
                    value={newChassiNo}
                    onChange={(e) => setNewChassiNo(e.target.value)}
                    className="w-full bg-slate-50 hover:bg-slate-50/50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-md py-1.5 px-3 text-xs text-slate-800 focus:outline-none transition-all font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                    Mileage (km)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 45200"
                    value={newMileage}
                    onChange={(e) => setNewMileage(e.target.value)}
                    className="w-full bg-slate-50 hover:bg-slate-50/50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-md py-1.5 px-3 text-xs text-slate-800 focus:outline-none transition-all font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                  Original Service Advisor Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. T. Alwis"
                  value={newAdvisorName}
                  onChange={(e) => setNewAdvisorName(e.target.value)}
                  className="w-full bg-slate-50 hover:bg-slate-50/50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-md py-1.5 px-3 text-xs text-slate-800 focus:outline-none transition-all font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                  Complaint Description *
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Provide precise details of the customer's complaint and the issue faced..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full bg-slate-50 hover:bg-slate-50/50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-md py-2 px-3 text-xs text-slate-800 focus:outline-none transition-all leading-relaxed resize-none font-medium"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 bg-white">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2 px-4 rounded-md transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-4 rounded-md shadow-xs transition-all cursor-pointer"
                >
                  Create Complaint
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
