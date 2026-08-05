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
  AlertCircle,
  User,
  Phone,
  Mail,
  Calendar,
  FileSpreadsheet,
  Settings,
  HelpCircle,
  X,
  Trash2,
  Sun,
  Moon,
  RefreshCw,
  ListFilter
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { Complaint, SatisfactionLevel, FollowUpStatus, AIAnalysis, UserProfile, CallCenterOfficer, StationProfile, WorkstationCalendarDate } from "./types";
import { DEMO_COMPLAINTS, STATIONS, CALL_CENTER_OFFICERS } from "./demoData";
import { sanitizeComplaintForSupabase, deduplicateAndSanitizeComplaints } from "./utils/supabaseSanitizer";
import { matchesStationCodeOrName } from "./utils/stationUtils";
import LoginScreen from "./components/LoginScreen";
import UploadZone from "./components/UploadZone";
import StationOverview from "./components/StationOverview";
import MetricCard from "./components/MetricCard";
import ReportsPanel from "./components/ReportsPanel";
import IdealMotorsLogo from "./components/IdealMotorsLogo";
import UserProfileModal from "./components/UserProfileModal";
import AllComplaintsList from "./components/AllComplaintsList";
import { getComplaintAgeInfo, getAgeFormulaBreakdown } from "./utils/agingUtils";
import { getStoredCalendarDates, saveCalendarDates } from "./utils/workstationCalendar";
import { WorkstationCalendarManager } from "./components/WorkstationCalendarManager";
import { StationDirectoryAndEmailModal } from "./components/StationDirectoryAndEmailModal";
import { CallCenterNotificationToast, CallCenterNotification } from "./components/CallCenterNotificationToast";
import { SystemicEmailLog } from "./types";
import { 
  getStoredSystemicEmailLogs, 
  saveSystemicEmailLogs, 
  dispatchSystemicEmailsForComplaints, 
  playCallCenterNotificationSound 
} from "./utils/systemicEmailNotifier";


// Initialize client-side Supabase client with safe publishable credentials
const SUPABASE_URL = "https://qsistbvaukxuwebqupiy.supabase.co";
const SUPABASE_KEY = "sb_publishable_Npa3x5SHHp65jinonZFnKA_56lBMOQb";
export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

export default function App() {
  // State
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("ideal_theme");
    return (saved as "light" | "dark") || "light";
  });

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("ideal_theme", nextTheme);
  };

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
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

  const [officersList, setOfficersList] = useState<CallCenterOfficer[]>(() => {
    const saved = localStorage.getItem("ideal_group_callcenter_officers");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // fallback
      }
    }
    return CALL_CENTER_OFFICERS;
  });

  const [stationsList, setStationsList] = useState<StationProfile[]>(() => {
    const saved = localStorage.getItem("ideal_group_stations");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // fallback
      }
    }
    return STATIONS;
  });

  const handleUpdateOfficersList = (newList: CallCenterOfficer[]) => {
    setOfficersList(newList);
    localStorage.setItem("ideal_group_callcenter_officers", JSON.stringify(newList));

    // Sync to backend API & Supabase
    fetch("/api/officers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ officers: newList }),
    }).catch((err) => console.error("Error saving officers to Supabase API:", err));
  };

  const handleUpdateStationsList = (newList: StationProfile[]) => {
    setStationsList(newList);
    localStorage.setItem("ideal_group_stations", JSON.stringify(newList));

    // Sync to backend API & Supabase
    fetch("/api/stations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stations: newList }),
    }).catch((err) => console.error("Error saving stations to Supabase API:", err));
  };

  // Fetch officers & stations on initial load from Supabase backend API
  useEffect(() => {
    fetch("/api/officers")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.officers && data.officers.length > 0) {
          setOfficersList(data.officers);
          localStorage.setItem("ideal_group_callcenter_officers", JSON.stringify(data.officers));
        }
      })
      .catch(() => console.log("Officers sync using local storage / fallback"));

    fetch("/api/stations")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.stations && data.stations.length > 0) {
          setStationsList(data.stations);
          localStorage.setItem("ideal_group_stations", JSON.stringify(data.stations));
        }
      })
      .catch(() => console.log("Stations sync using local storage / fallback"));

    fetch("/api/calendar")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.dates && data.dates.length > 0) {
          setCalendarDates(data.dates);
          saveCalendarDates(data.dates);
        }
      })
      .catch(() => console.log("Calendar sync using local storage / fallback"));

    fetch("/api/email-logs")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.logs && Array.isArray(data.logs) && data.logs.length > 0) {
          setEmailLogs(data.logs);
          saveSystemicEmailLogs(data.logs);
        } else {
          setEmailLogs(getStoredSystemicEmailLogs());
        }
      })
      .catch(() => setEmailLogs(getStoredSystemicEmailLogs()));
  }, []);

  // Periodic background sync across all devices / IPs every 4 seconds
  useEffect(() => {
    const syncBackendData = async () => {
      try {
        const [resC, resO, resS, resCal, resEml] = await Promise.allSettled([
          fetch("/api/complaints"),
          fetch("/api/officers"),
          fetch("/api/stations"),
          fetch("/api/calendar"),
          fetch("/api/email-logs")
        ]);

        if (resC.status === "fulfilled" && resC.value.ok) {
          const text = await resC.value.text();
          if (!text.trim().startsWith("<!DOCTYPE")) {
            const data = JSON.parse(text);
            if (data && data.complaints && Array.isArray(data.complaints)) {
              setComplaints(data.complaints);
              localStorage.setItem("ideal_group_complaints", JSON.stringify(data.complaints));
            }
          }
        }

        if (resO.status === "fulfilled" && resO.value.ok) {
          const dataO = await resO.value.json();
          if (dataO && dataO.officers && Array.isArray(dataO.officers) && dataO.officers.length > 0) {
            setOfficersList(dataO.officers);
            localStorage.setItem("ideal_group_callcenter_officers", JSON.stringify(dataO.officers));
          }
        }

        if (resS.status === "fulfilled" && resS.value.ok) {
          const dataS = await resS.value.json();
          if (dataS && dataS.stations && Array.isArray(dataS.stations) && dataS.stations.length > 0) {
            setStationsList(dataS.stations);
            localStorage.setItem("ideal_group_stations", JSON.stringify(dataS.stations));
          }
        }

        if (resCal.status === "fulfilled" && resCal.value.ok) {
          const dataCal = await resCal.value.json();
          if (dataCal && dataCal.dates && Array.isArray(dataCal.dates)) {
            setCalendarDates(dataCal.dates);
            saveCalendarDates(dataCal.dates);
          }
        }

        if (resEml.status === "fulfilled" && resEml.value.ok) {
          const dataEml = await resEml.value.json();
          if (dataEml && dataEml.logs && Array.isArray(dataEml.logs)) {
            saveSystemicEmailLogs(dataEml.logs);
          }
        }
      } catch (e) {
        // Silent catch for background sync
      }
    };

    const interval = setInterval(syncBackendData, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateCurrentUser = (updated: UserProfile) => {
    setCurrentUser(updated);
    localStorage.setItem("ideal_group_current_user", JSON.stringify(updated));
  };

  const [calendarDates, setCalendarDates] = useState<WorkstationCalendarDate[]>(() => getStoredCalendarDates());
  const [showCalendarModal, setShowCalendarModal] = useState<boolean>(false);
  const [calendarStationTarget, setCalendarStationTarget] = useState<string>("All");

  // Systemic Email Logs & Call Center Notification Sound States
  const [showStationDirectoryModal, setShowStationDirectoryModal] = useState<boolean>(false);
  const [emailLogs, setEmailLogs] = useState<SystemicEmailLog[]>(() => getStoredSystemicEmailLogs());
  const [callCenterNotifications, setCallCenterNotifications] = useState<CallCenterNotification[]>([]);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  const handleAddCalendarDate = (newDateData: Omit<WorkstationCalendarDate, "id" | "createdAt" | "createdBy">) => {
    const newEntry: WorkstationCalendarDate = {
      ...newDateData,
      id: "cal-" + Date.now(),
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.name || (currentUser?.role === "admin" ? "System Admin" : "Call Center Admin"),
    };
    const updated = [newEntry, ...calendarDates];
    setCalendarDates(updated);
    saveCalendarDates(updated);
    fetch("/api/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dates: updated }),
    }).catch((err) => console.error("Error saving calendar date:", err));
  };

  const handleRemoveCalendarDate = (id: string) => {
    const updated = calendarDates.filter((item) => item.id !== id);
    setCalendarDates(updated);
    saveCalendarDates(updated);
    fetch(`/api/calendar/${id}`, { method: "DELETE" }).catch((err) =>
      console.error("Error deleting calendar date from Supabase:", err)
    );
    fetch("/api/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dates: updated }),
    }).catch((err) => console.error("Error updating calendar dates:", err));
  };

  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState<"analytics" | "list" | "stations" | "upload" | "reports">("analytics");

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

  // Call Center specific follow-up & attempt tracking fields
  const [formCallCenterContactedDate, setFormCallCenterContactedDate] = useState("");
  const [formCallCenterFinalRemarks, setFormCallCenterFinalRemarks] = useState("");
  const [formCallCenterFinalSatisfaction, setFormCallCenterFinalSatisfaction] = useState<SatisfactionLevel>("Satisfied");
  const [formAttemptStage, setFormAttemptStage] = useState<"1st Attempt" | "2nd Attempt">("1st Attempt");
  const [formFirstAttemptCallStatus, setFormFirstAttemptCallStatus] = useState<string>("Connected");
  const [formSecondAttemptFeedbackStatus, setFormSecondAttemptFeedbackStatus] = useState<string>("Follow Up Required");
  
  // Parallel track status fields
  const [formFeedbackStatus, setFormFeedbackStatus] = useState("Follow-up Required");
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

  // Live ticker clock updating every second for real-time elapsed counter (days, hours, mins, secs)
  const [tickerDate, setTickerDate] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setTickerDate(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // State-based delete confirmation state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Supabase Database Connection State
  const [supabaseActive, setSupabaseActive] = useState<boolean | null>(null);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);
  const [isTestingSupabase, setIsTestingSupabase] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Unreachable and Connection alert states
  const [autoLoggedUnreachable, setAutoLoggedUnreachable] = useState(false);
  const [showConnectedAlert, setShowConnectedAlert] = useState(false);
  const [connectedCustomerName, setConnectedCustomerName] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);

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
        return false;
      }

      if (data) {
        setComplaints(data);
        localStorage.setItem("ideal_group_complaints", JSON.stringify(data));
      }
      setSupabaseActive(true);
      setSupabaseError(null);
      return true;
    } catch (err: any) {
      console.error("Direct Supabase connection exception:", err);
      setSupabaseActive(false);
      setSupabaseError(originalErrorMsg || err.message);
      return false;
    }
  };

  const fetchComplaints = async () => {
    try {
      const res = await fetch("/api/complaints");
      const text = await res.text();
      
      if (text.trim().startsWith("<!DOCTYPE")) {
        console.warn("Backend API not found (HTML response). Falling back to client-side direct Supabase connection...");
        return await fetchComplaintsDirectly();
      }

      const data = JSON.parse(text);
      if (data.complaints) {
        setComplaints(data.complaints);
        localStorage.setItem("ideal_group_complaints", JSON.stringify(data.complaints));
      }
      setSupabaseActive(data.isSupabaseActive);
      if (!data.isSupabaseActive && data.error) {
        setSupabaseError(data.error);
        return false;
      } else {
        setSupabaseError(null);
        return true;
      }
    } catch (e: any) {
      console.warn("Backend API call failed, falling back to client-side direct Supabase connection:", e);
      return await fetchComplaintsDirectly(e.message);
    }
  };

  // Load complaints on mount
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

    fetchComplaints();
  }, []);

  // Periodic auto-retry if Supabase connection is currently marked offline/error
  useEffect(() => {
    if (supabaseActive === false) {
      const interval = setInterval(() => {
        console.log("Auto-retrying Supabase connection check...");
        fetchComplaints();
      }, 15000);
      return () => clearInterval(interval);
    }
  }, [supabaseActive]);

  const saveComplaintsDirectly = async (updatedList: Complaint[]) => {
    try {
      console.log("Upserting directly to Supabase client-side...");
      const cleanList = deduplicateAndSanitizeComplaints(updatedList);
      let { error } = await supabaseClient
        .from("complaints")
        .upsert(cleanList, { onConflict: "id" });

      if (error && error.message && error.message.includes("column")) {
        console.warn("Direct Supabase upsert column mismatch retry:", error.message);
        let retryPayload = cleanList;
        if (error.message.includes("'woNo'")) {
          retryPayload = cleanList.map(({ woNo, ...rest }) => rest);
        } else if (error.message.includes("'wo_no'")) {
          retryPayload = cleanList.map(({ wo_no, ...rest }) => rest);
        }
        const retryRes = await supabaseClient
          .from("complaints")
          .upsert(retryPayload, { onConflict: "id" });
        error = retryRes.error;
      }

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
  const handleLoginSuccess = (
    role: "admin" | "agent" | "callcenter", 
    stationCode?: string,
    officerDetails?: CallCenterOfficer
  ) => {
    const userObj: UserProfile = { 
      role, 
      station: stationCode,
      name: officerDetails?.name,
      officerId: officerDetails?.id,
      title: officerDetails?.title,
      email: officerDetails?.email,
      phone: officerDetails?.phone,
      avatar: officerDetails?.avatar,
      department: officerDetails?.department
    };
    setCurrentUser(userObj);
    localStorage.setItem("ideal_group_current_user", JSON.stringify(userObj));
    // If agent, default station filter to their station
    if (role === "agent" && stationCode) {
      setStationFilter(stationCode);
    } else {
      setStationFilter("All");
    }
    // Default call center view to "Awaiting" and switch tab to Recovery Workspace
    if (role === "callcenter") {
      setCallCenterQuickFilter("awaiting");
      setCurrentTab("analytics");
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
      // Upsert by WO Number / ID (if duplicate WO exists, update it, otherwise prepend)
      const existingMap = new Map(complaints.map(c => [c.id, c]));
      newComplaints.forEach(nc => {
        existingMap.set(nc.id, nc);
      });
      updatedList = Array.from(existingMap.values());
    }
    saveComplaints(updatedList);

    // Auto dispatch systemic emails to workshop personnel for newly added complaints
    const dispatched = dispatchSystemicEmailsForComplaints(newComplaints);
    if (dispatched.length > 0) {
      setEmailLogs(prev => [...dispatched, ...prev]);
    }
  };

  // Single Complaint Delete from Whole Database
  const handleDeleteSingleComplaint = async (complaintId: string) => {
    const targetComp = complaints.find(
      (c) => c.id === complaintId || c.woNo === complaintId || `COMP-${c.woNo}` === complaintId
    );

    const targetId = targetComp ? targetComp.id : complaintId;
    const targetWoNo = targetComp ? targetComp.woNo : complaintId;

    const updatedList = complaints.filter((c) => {
      const cId = (c.id || "").trim().toUpperCase();
      const cWo = (c.woNo || "").trim().toUpperCase();
      const tId = (targetId || "").trim().toUpperCase();
      const tWo = (targetWoNo || "").trim().toUpperCase();

      if (tId && (cId === tId || cWo === tId)) return false;
      if (tWo && (cId === tWo || cWo === tWo)) return false;
      if (tWo && cId === `COMP-${tWo}`) return false;
      return true;
    });

    setComplaints(updatedList);
    localStorage.setItem("ideal_group_complaints", JSON.stringify(updatedList));

    if (selectedComplaintId === complaintId || selectedComplaintId === targetId) {
      setSelectedComplaintId(null);
    }
    setDeletingId(null);

    // Direct Supabase delete
    try {
      const conditions: string[] = [];
      if (targetId) {
        conditions.push(`id.eq.${targetId}`);
        conditions.push(`woNo.eq.${targetId}`);
        conditions.push(`wo_no.eq.${targetId}`);
      }
      if (targetWoNo) {
        conditions.push(`id.eq.${targetWoNo}`);
        conditions.push(`woNo.eq.${targetWoNo}`);
        conditions.push(`wo_no.eq.${targetWoNo}`);
        conditions.push(`id.eq.COMP-${targetWoNo}`);
      }
      await supabaseClient
        .from("complaints")
        .delete()
        .or(conditions.join(","));
    } catch (err) {
      console.warn("Direct Supabase delete failed:", err);
    }

    // Server API delete call
    try {
      await fetch("/api/complaints/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: targetId, woNo: targetWoNo }),
      });
    } catch (err) {
      console.warn("Backend API delete failed:", err);
    }
  };

  // Clear All Complaints from Whole Database
  const handleDeleteAllComplaints = async () => {
    setComplaints([]);
    localStorage.setItem("ideal_group_complaints", JSON.stringify([]));
    setSelectedComplaintId(null);
    setDeletingId(null);
    setShowDeleteAllConfirm(false);

    try {
      await supabaseClient
        .from("complaints")
        .delete()
        .neq("id", "FORCE_NONE_MATCHING_ID");
    } catch (err) {
      console.warn("Direct Supabase clear all failed:", err);
    }

    try {
      await fetch("/api/complaints/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
    } catch (err) {
      console.warn("Backend API clear failed:", err);
    }
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

    // Auto dispatch systemic email notice for manual complaint
    const dispatched = dispatchSystemicEmailsForComplaints([newComplaint]);
    if (dispatched.length > 0) {
      setEmailLogs(prev => [...dispatched, ...prev]);
    }

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

  // Handle manual removal of a complaint
  const handleDeleteComplaint = (complaintId: string) => {
    handleDeleteSingleComplaint(complaintId);
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

  const resetComplaintsDirectly = async () => {
    try {
      console.log("Resetting complaints directly from Supabase client-side...");
      // First clear all
      await supabaseClient
        .from("complaints")
        .delete()
        .neq("id", "FORCE_NONE_MATCHING_ID");

      // Then insert default ones
      const cleanDemo = deduplicateAndSanitizeComplaints(DEMO_COMPLAINTS);
      let { error } = await supabaseClient
        .from("complaints")
        .insert(cleanDemo);

      if (error && error.message && error.message.includes("column")) {
        console.warn("Direct Supabase reset insert column mismatch retry:", error.message);
        let retryPayload = cleanDemo;
        if (error.message.includes("'woNo'")) {
          retryPayload = cleanDemo.map(({ woNo, ...rest }) => rest);
        } else if (error.message.includes("'wo_no'")) {
          retryPayload = cleanDemo.map(({ wo_no, ...rest }) => rest);
        }
        const retryRes = await supabaseClient.from("complaints").insert(retryPayload);
        error = retryRes.error;
      }

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

  // Handle follow-up submission (triggers confirm popup)
  const handleUpdateFollowUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaintId) return;
    setShowConfirmModal(true);
  };

  // Actual follow-up submission after user confirms
  const executeUpdateFollowUp = () => {
    if (!selectedComplaintId) return;
    setShowConfirmModal(false);

    let wasUnreachableBefore = false;
    let isConnectedNow = false;

    const updated = complaints.map((c) => {
      if (c.id === selectedComplaintId) {
        // Check if previously marked as Customer Unreachable or Unreachable or Pending
        wasUnreachableBefore = 
          c.feedbackStatus === "Customer Unreachable" || 
          c.finalStatus === "Unreachable" || 
          c.status === "Pending";

        if (currentUser?.role === "admin") {
          isConnectedNow = 
            formStatus !== "Pending" && 
            formFeedbackStatus !== "Customer Unreachable" && 
            formFinalStatus !== "Unreachable";

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
          isConnectedNow = 
            formFeedbackStatus !== "Customer Unreachable" && 
            formFinalStatus !== "Unreachable";

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
          const submitDate = formCallCenterContactedDate || new Date().toISOString().split("T")[0];
          const is1stAttempt = formAttemptStage === "1st Attempt";

          let calcStatus: FollowUpStatus = "Pending";
          let calcSatisfaction: SatisfactionLevel = formCallCenterFinalSatisfaction;
          let calcFeedbackStatus = formFeedbackStatus;
          let calcFinalStatus = "Open";

          if (is1stAttempt) {
            calcFeedbackStatus = formFirstAttemptCallStatus;
            
            if (["Customer Busy", "Customer Unreachable", "No Answer"].includes(formFirstAttemptCallStatus)) {
              // 1st attempt uncontactable -> stay in recovery list, pass for 2nd attempt
              calcStatus = "Pending";
              calcSatisfaction = "Dissatisfied";
              calcFinalStatus = "Pending (2nd Attempt Required)";
              isConnectedNow = false;
            } else if (formFirstAttemptCallStatus === "Connected") {
              isConnectedNow = true;
              calcFeedbackStatus = formSecondAttemptFeedbackStatus || "Follow Up Required";
              if (formSecondAttemptFeedbackStatus === "Satisfied") {
                calcStatus = "Resolved";
                calcSatisfaction = "Satisfied";
                calcFinalStatus = "Closed";
              } else {
                calcStatus = "Pending";
                calcSatisfaction = "Dissatisfied";
                calcFinalStatus = "In Progress";
              }
            } else if (["Invalid Details", "Invalid Number"].includes(formFirstAttemptCallStatus)) {
              calcStatus = "Pending";
              calcSatisfaction = "Dissatisfied";
              calcFinalStatus = "Unreachable (Invalid Number/Details)";
              isConnectedNow = false;
            }
          } else {
            // 2nd Attempt
            calcFeedbackStatus = formSecondAttemptFeedbackStatus;

            if (formSecondAttemptFeedbackStatus === "Satisfied") {
              // ONLY if selected satisfied -> pass to complete (Resolved)
              calcStatus = "Resolved";
              calcSatisfaction = "Satisfied";
              calcFinalStatus = "Closed";
              isConnectedNow = true;
            } else if (formSecondAttemptFeedbackStatus === "Customer Unreachable") {
              // After 2nd attempt customer is unreachable -> classify as NOT SATISFIED customer base
              calcStatus = "Pending";
              calcSatisfaction = "Dissatisfied"; // Classify under Not Satisfied Customer Base
              calcFinalStatus = "Unreachable (Not Satisfied Base)";
              isConnectedNow = false;
            } else if (["Not Satisfied", "No solution Received"].includes(formSecondAttemptFeedbackStatus)) {
              calcStatus = "Pending";
              calcSatisfaction = "Dissatisfied";
              calcFinalStatus = "Not Satisfied (Pending Station Action)";
              isConnectedNow = true;
            } else if (formSecondAttemptFeedbackStatus === "Escalated") {
              calcStatus = "Pending";
              calcSatisfaction = "Dissatisfied";
              calcFinalStatus = "Escalated to Management";
              isConnectedNow = true;
            } else {
              calcStatus = "Pending";
              calcSatisfaction = formCallCenterFinalSatisfaction;
              calcFinalStatus = "In Progress";
              isConnectedNow = true;
            }
          }

          return {
            ...c,
            callCenterContactedDate: submitDate,
            callCenterFinalRemarks: formCallCenterFinalRemarks,
            callCenterFinalSatisfaction: calcSatisfaction,
            currentSatisfaction: calcSatisfaction, // promote to main satisfaction
            status: calcStatus,
            feedbackStatus: calcFeedbackStatus,
            finalStatus: calcFinalStatus,
            attemptCount: is1stAttempt ? 1 : 2,
            firstAttemptCallStatus: is1stAttempt ? formFirstAttemptCallStatus : (c.firstAttemptCallStatus || formFirstAttemptCallStatus),
            firstAttemptDate: is1stAttempt ? submitDate : (c.firstAttemptDate || submitDate),
            firstAttemptNotes: is1stAttempt ? formCallCenterFinalRemarks : c.firstAttemptNotes,
            secondAttemptFeedbackStatus: !is1stAttempt ? formSecondAttemptFeedbackStatus : c.secondAttemptFeedbackStatus,
            secondAttemptDate: !is1stAttempt ? submitDate : c.secondAttemptDate,
            secondAttemptNotes: !is1stAttempt ? formCallCenterFinalRemarks : c.secondAttemptNotes,
            solutionProvidedByAftermarket: formSolutionProvided,
            solutionDate: formSolutionDate,
            followUpDate: formFollowUpDate || submitDate,
            updatedAt: submitDate
          };
        }
      }
      return c;
    });

    saveComplaints(updated);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);

    // Real-Time Sound and Pop-up Notification trigger for Call Center & Admin
    if (currentUser?.role === "agent" || currentUser?.role === "admin") {
      if (soundEnabled) {
        playCallCenterNotificationSound();
      }
      const targetC = complaints.find((item) => item.id === selectedComplaintId);
      const actionText = currentUser?.role === "agent"
        ? (formStationResolutionNotes || `Feedback status: ${formFeedbackStatus}`)
        : (formNotes || `Follow-up status: ${formStatus}`);

      setCallCenterNotifications((prev) => [
        {
          id: "NOTIF-" + Date.now(),
          timestamp: new Date().toISOString(),
          stationName: currentUser.station || formAssignedStation || "Service Station",
          complaintId: selectedComplaintId,
          customerName: targetC?.customerName || "Customer",
          actionSummary: actionText,
          updatedBy: formAgentName || currentUser.name || `${currentUser.station || "Service"} Adviser`,
        },
        ...prev,
      ]);
    }

    if (wasUnreachableBefore && isConnectedNow) {
      setConnectedCustomerName(selectedComplaint?.customerName || "Customer");
      setShowConnectedAlert(true);
    }
  };

  // Quick Action to auto-log customer unreachable and add to pending list
  const handleMarkUnreachable = async () => {
    if (!selectedComplaintId || !currentUser) return;
    
    const now = new Date();
    const timestamp = `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
    const autoRemark = `[Auto-Logged Contact Issue: Customer was unreachable at ${timestamp}]`;

    const updated = complaints.map((c) => {
      if (c.id === selectedComplaintId) {
        let updatedNotes = c.notes || "";
        let updatedStationNotes = c.stationResolutionNotes || "";
        let updatedCallCenterRemarks = c.callCenterFinalRemarks || "";

        if (currentUser.role === "agent") {
          updatedStationNotes = updatedStationNotes 
            ? `${updatedStationNotes}\n${autoRemark}` 
            : autoRemark;
        } else if (currentUser.role === "callcenter") {
          updatedCallCenterRemarks = updatedCallCenterRemarks 
            ? `${updatedCallCenterRemarks}\n${autoRemark}` 
            : autoRemark;
        } else {
          updatedNotes = updatedNotes 
            ? `${updatedNotes}\n${autoRemark}` 
            : autoRemark;
        }

        return {
          ...c,
          status: "Pending" as FollowUpStatus, // Add back to pending list!
          feedbackStatus: "Customer Unreachable",
          finalStatus: "Unreachable",
          notes: updatedNotes,
          stationResolutionNotes: updatedStationNotes,
          callCenterFinalRemarks: updatedCallCenterRemarks,
          updatedAt: now.toISOString().split("T")[0]
        };
      }
      return c;
    });

    await saveComplaints(updated);
    
    // Instantly sync local form state fields so the active view matches the new values
    setFormFeedbackStatus("Customer Unreachable");
    setFormFinalStatus("Unreachable");
    setFormStatus("Pending");
    if (currentUser.role === "agent") {
      setFormStationResolutionNotes((prev) => prev ? `${prev}\n${autoRemark}` : autoRemark);
    } else if (currentUser.role === "callcenter") {
      setFormCallCenterFinalRemarks((prev) => prev ? `${prev}\n${autoRemark}` : autoRemark);
    } else {
      setFormNotes((prev) => prev ? `${prev}\n${autoRemark}` : autoRemark);
    }

    setAutoLoggedUnreachable(true);
    setTimeout(() => setAutoLoggedUnreachable(false), 4000);
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
      setFormCallCenterContactedDate(new Date().toISOString().split("T")[0]);
      setFormCallCenterFinalRemarks(selectedComplaint.callCenterFinalRemarks || "");
      setFormCallCenterFinalSatisfaction(selectedComplaint.callCenterFinalSatisfaction || "Neutral");
      setFormAssignedStation(selectedComplaint.station || "");

      // Pre-fill multi-attempt fields
      const firstStatus = selectedComplaint.firstAttemptCallStatus || "Connected";
      const secondStatus = selectedComplaint.secondAttemptFeedbackStatus || "Follow Up Required";
      setFormFirstAttemptCallStatus(firstStatus);
      setFormSecondAttemptFeedbackStatus(secondStatus);

      // Auto-determine active attempt stage
      if (
        selectedComplaint.attemptCount === 2 ||
        selectedComplaint.secondAttemptFeedbackStatus ||
        ["Customer Busy", "Customer Unreachable", "No Answer"].includes(firstStatus)
      ) {
        setFormAttemptStage("2nd Attempt");
      } else {
        setFormAttemptStage("1st Attempt");
      }

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
    return <LoginScreen onLoginSuccess={handleLoginSuccess} theme={theme} toggleTheme={toggleTheme} />;
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
    const matchesStation = matchesStationCodeOrName(c.station, activeStation);

    // Status filter
    let matchesStatus = true;
    if (statusFilter === "Station Contacted (Pending/In-Progress)") {
      matchesStatus = !!(c.stationContactedDate || c.stationResolutionNotes || c.notes || c.status === "Contacted") && c.status !== "Resolved";
    } else {
      matchesStatus = statusFilter === "All" || c.status === statusFilter;
    }

    // Category filter
    const matchesCategory = categoryFilter === "All" || c.category === categoryFilter;

    // Call Center Quick Filter
    let matchesCallCenterQuick = true;
    if (currentUser.role === "callcenter") {
      if (callCenterQuickFilter === "awaiting") {
        // Awaiting Call Center follow-up: Station responded/contacted customer, Call Center remarks pending, not resolved
        matchesCallCenterQuick = !!(c.stationContactedDate || c.stationResolutionNotes || c.notes || c.status === "Contacted") && !c.callCenterFinalRemarks && c.status !== "Resolved";
      } else if (callCenterQuickFilter === "completed") {
        matchesCallCenterQuick = !!c.callCenterFinalRemarks || c.status === "Resolved";
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
        return <span className="bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">Very Dissatisfied</span>;
      case "Dissatisfied":
        return <span className="bg-orange-50 text-orange-700 border border-orange-200 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">Dissatisfied</span>;
      case "Neutral":
        return <span className="bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">Neutral</span>;
      case "Satisfied":
        return <span className="bg-green-50 text-green-700 border border-green-200 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">Satisfied</span>;
      case "Very Satisfied":
        return <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">Very Satisfied</span>;
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
    const val = status || "Follow-up Required";
    let colorClass = "bg-blue-50 text-blue-700 border-blue-200";
    if (val === "Satisfied After Resolution" || val === "Satisfied") colorClass = "bg-green-50 text-green-700 border-green-200";
    else if (val === "Still Dissatisfied" || val === "Not Satisfied") colorClass = "bg-red-50 text-red-700 border-red-200";
    else if (val === "No Solution Received" || val === "No solution Received") colorClass = "bg-amber-50 text-amber-700 border-amber-200";
    else if (val === "Customer Unreachable") colorClass = "bg-purple-50 text-purple-700 border-purple-200";
    else if (val === "Follow-up Required" || val === "Follow Up Required") colorClass = "bg-blue-50 text-blue-700 border-blue-200";
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

  const isDark = theme === "dark";
  const cardBg = isDark ? "bg-slate-900/80 backdrop-blur-md border-slate-800 text-slate-100 shadow-md" : "bg-white border-slate-200 text-slate-900 shadow-sm";
  const textTitle = isDark ? "text-slate-100" : "text-slate-800";
  const textSub = isDark ? "text-slate-400" : "text-slate-500";
  const bgSub = isDark ? "bg-slate-950" : "bg-slate-50";
  const borderColor = isDark ? "border-slate-800" : "border-slate-200";

  if (!currentUser) {
    return (
      <LoginScreen
        onLoginSuccess={handleLoginSuccess}
        theme={theme}
        toggleTheme={toggleTheme}
        officersList={officersList}
        availableStations={stationsList}
      />
    );
  }

  return (
    <div id="app-root" className={`min-h-screen flex flex-col font-sans animate-fade-in-scale transition-colors duration-500 ${
      isDark ? "bg-luxury-grid text-slate-100" : "bg-luxury-light-grid text-slate-900"
    }`}>
      
      {/* Top Corporate Nav */}
      <header id="app-header" className={`shrink-0 sticky top-0 z-30 transition-all duration-500 border-b ${
        isDark ? "bg-slate-900/90 backdrop-blur-md border-slate-800" : "bg-white border-slate-200"
      }`}>
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-slate-950 hover:bg-black px-3 py-1.5 rounded-lg border border-slate-800 flex items-center justify-center transition-all shadow-xs">
              <IdealMotorsLogo className="h-7 w-auto" />
            </div>
            <div className={`border-l pl-3 ${isDark ? "border-slate-800" : "border-slate-200"}`}>
              <h1 id="header-title" className={`text-xs font-black tracking-wider uppercase font-sans ${textTitle}`}>
                CX Recovery Terminal
              </h1>
              <p className={`text-[9px] font-extrabold ${textSub}`}>
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
                    ? isDark 
                      ? "bg-emerald-950/30 border-emerald-900/40 text-emerald-300" 
                      : "bg-emerald-50 border-emerald-200 text-emerald-700" 
                    : isDark 
                      ? "bg-amber-950/30 border-amber-900/40 text-amber-300" 
                      : "bg-amber-50 border-amber-200 text-amber-700"
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${supabaseActive ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                <span>{supabaseActive ? "Supabase Active" : "Supabase: Offline Fallback"}</span>
              </div>
            )}

            {/* Workstation Calendar Button */}
            <button
              id="btn-open-workstation-calendar"
              type="button"
              onClick={() => {
                if (currentUser.role === "agent" && currentUser.station) {
                  setCalendarStationTarget(currentUser.station);
                } else {
                  setCalendarStationTarget("All");
                }
                setShowCalendarModal(true);
              }}
              className={`flex items-center gap-1.5 py-1 px-2.5 rounded-md border text-[11px] font-bold transition-all cursor-pointer shadow-xs ${
                isDark
                  ? "bg-blue-950/40 border-blue-800 text-blue-300 hover:bg-blue-900/50"
                  : "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
              }`}
              title="Add or cancel working dates for service workstations"
            >
              <Calendar className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span>{currentUser.role === "admin" || currentUser.role === "callcenter" ? "Workstation Calendar" : "Station Dates"}</span>
              {calendarDates.length > 0 && (
                <span className="ml-1 bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">
                  {calendarDates.length}
                </span>
              )}
            </button>

            {/* Station Directory & Systemic Email Matrix Button */}
            {currentUser.role === "admin" && (
              <button
                id="btn-open-station-directory"
                type="button"
                onClick={() => setShowStationDirectoryModal(true)}
                className={`flex items-center gap-1.5 py-1 px-2.5 rounded-md border text-[11px] font-bold transition-all cursor-pointer shadow-xs ${
                  isDark
                    ? "bg-amber-950/40 border-amber-800 text-amber-300 hover:bg-amber-900/50"
                    : "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100"
                }`}
                title="View Workstation Personnel Contacts & Systemic Dispatch Logs"
              >
                <Mail className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                <span>Station Contacts & Emails</span>
                {emailLogs.length > 0 && (
                  <span className="ml-1 bg-amber-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">
                    {emailLogs.length}
                  </span>
                )}
              </button>
            )}


            <button
              id="btn-user-profile"
              type="button"
              onClick={() => setShowProfileModal(true)}
              className={`hidden sm:flex items-center gap-2 py-1 px-2.5 rounded-md border transition-all cursor-pointer ${
                isDark 
                  ? "bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-300 hover:border-slate-700" 
                  : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 hover:border-slate-300"
              }`}
              title="Click to view full user profile details"
            >
              <div className="h-5 w-5 rounded-full bg-red-600 text-white font-black text-[9px] flex items-center justify-center">
                {currentUser.avatar || (currentUser.name ? currentUser.name.substring(0, 2).toUpperCase() : (currentUser.role === "admin" ? "NM" : currentUser.role === "callcenter" ? "CC" : "SA"))}
              </div>
              <div className="text-left">
                <span className="text-[11px] font-bold block leading-none">
                  {currentUser.name || (currentUser.role === "admin" 
                    ? "National Manager" 
                    : currentUser.role === "callcenter" 
                      ? "Call Center Agent" 
                      : `${currentUser.station} Service Adviser`)}
                </span>
                <span className="text-[8px] font-extrabold text-red-600 dark:text-red-400 uppercase tracking-wider block">
                  My Profile
                </span>
              </div>
            </button>
            
            <button
              id="btn-logout"
              type="button"
              onClick={handleLogout}
              className={`flex items-center gap-1.5 font-bold text-[11px] py-1.5 px-3 rounded-md border transition-all cursor-pointer ${
                isDark
                  ? "text-slate-300 hover:text-red-400 bg-slate-950 hover:bg-red-950/20 border-slate-800 hover:border-red-900/55"
                  : "text-slate-600 hover:text-red-700 bg-white hover:bg-red-50 border-slate-200 hover:border-red-200"
              }`}
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
        {supabaseActive === false && !bannerDismissed && (
          <div 
            id="supabase-warning-banner"
            className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all shadow-xs"
          >
            <div className="space-y-1 flex-1">
              <h4 className="text-xs font-black text-amber-800 uppercase tracking-tight flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                Supabase Setup or RLS Policies Required
              </h4>
              <p className="text-[11px] text-amber-700 font-medium leading-relaxed">
                A secure backend connection has been established to your Supabase project (<code className="font-mono bg-amber-100 px-1 py-0.2 rounded font-bold text-amber-900">qsistbvaukxuwebqupiy</code>), but there is a table or policy configuration issue. If you have already updated your SQL Editor or want to verify connection, click <strong className="font-bold text-amber-900">"Test & Reconnect Now"</strong> below!
              </p>
              {supabaseError && (
                <div className="mt-2 text-[10px] bg-red-50 border border-red-100 text-red-700 font-mono p-1.5 rounded font-bold">
                  Connection Diagnostic: {supabaseError}
                </div>
              )}
            </div>
            
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                id="btn-reconnect-supabase"
                type="button"
                disabled={isTestingSupabase}
                onClick={async () => {
                  setIsTestingSupabase(true);
                  const success = await fetchComplaints();
                  setIsTestingSupabase(false);
                  if (success) {
                    alert("✅ Successfully connected to Supabase database!");
                  }
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] py-1.5 px-3 rounded shadow-xs transition-all cursor-pointer uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${isTestingSupabase ? "animate-spin" : ""}`} />
                {isTestingSupabase ? "Testing..." : "Test & Reconnect Now"}
              </button>

              <button
                id="btn-copy-supabase-sql"
                type="button"
                onClick={() => {
                  const sqlText = `-- IDEAL MOTORS CX RECOVERY DATABASE SCHEMA
DROP TABLE IF EXISTS call_center_logs CASCADE;
DROP TABLE IF EXISTS systemic_email_logs CASCADE;
DROP TABLE IF EXISTS workstation_calendar CASCADE;
DROP TABLE IF EXISTS complaints CASCADE;
DROP TABLE IF EXISTS call_center_officers CASCADE;
DROP TABLE IF EXISTS stations CASCADE;

CREATE TABLE stations (
  code text PRIMARY KEY,
  name text NOT NULL,
  manager_name text,
  email text,
  phone text
);

CREATE TABLE call_center_officers (
  id text PRIMARY KEY,
  name text NOT NULL,
  title text NOT NULL,
  email text UNIQUE NOT NULL,
  phone text,
  avatar text,
  department text DEFAULT 'Ideal Motors Central CX Call Center'
);

CREATE TABLE workstation_calendar (
  id text PRIMARY KEY,
  station text DEFAULT 'All',
  date text NOT NULL,
  type text NOT NULL DEFAULT 'off_day',
  reason text,
  "createdAt" timestamptz DEFAULT now(),
  "createdBy" text DEFAULT 'System Admin'
);

CREATE TABLE systemic_email_logs (
  id text PRIMARY KEY,
  "sentAt" timestamptz DEFAULT now(),
  sender text DEFAULT 'callcenter@idealgroup.lk',
  recipients jsonb NOT NULL,
  subject text NOT NULL,
  "complaintIds" jsonb,
  "stationTarget" text,
  "htmlBody" text,
  "triggerEvent" text
);

CREATE TABLE complaints (
  id text PRIMARY KEY,
  "woNo" text,
  wo_no text,
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
  status text DEFAULT 'Pending',
  notes text,
  "agentName" text,
  assigned_officer_id text REFERENCES call_center_officers(id) ON DELETE SET NULL,
  "aiAnalysis" jsonb,
  "updatedAt" timestamptz DEFAULT now(),
  month text,
  company text,
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
  "npsScore" integer DEFAULT 0,
  "stationContactedDate" text,
  "stationResolutionNotes" text,
  "callCenterContactedDate" text,
  "callCenterFinalRemarks" text,
  "callCenterFinalSatisfaction" text,
  "feedbackStatus" text,
  "finalStatus" text,
  "solutionProvidedByAftermarket" text,
  "solutionDate" text,
  "followUpDate" text,
  "firstAttemptCallStatus" text,
  "firstAttemptDate" text,
  "firstAttemptNotes" text,
  "secondAttemptFeedbackStatus" text,
  "secondAttemptDate" text,
  "secondAttemptNotes" text,
  "attemptCount" integer DEFAULT 0
);

CREATE OR REPLACE VIEW service_stations AS SELECT * FROM stations;

CREATE TABLE call_center_logs (
  id bigserial PRIMARY KEY,
  complaint_id text NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  officer_id text REFERENCES call_center_officers(id) ON DELETE SET NULL,
  officer_name text,
  call_date timestamptz DEFAULT now(),
  remarks text,
  satisfaction_score integer
);

ALTER TABLE stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_center_officers ENABLE ROW LEVEL SECURITY;
ALTER TABLE workstation_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE systemic_email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_center_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read stations" ON stations FOR SELECT USING (true);
CREATE POLICY "Allow public insert stations" ON stations FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update stations" ON stations FOR UPDATE USING (true);

CREATE POLICY "Allow public read officers" ON call_center_officers FOR SELECT USING (true);
CREATE POLICY "Allow public insert officers" ON call_center_officers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update officers" ON call_center_officers FOR UPDATE USING (true);

CREATE POLICY "Allow public read calendar" ON workstation_calendar FOR SELECT USING (true);
CREATE POLICY "Allow public insert calendar" ON workstation_calendar FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update calendar" ON workstation_calendar FOR UPDATE USING (true);
CREATE POLICY "Allow public delete calendar" ON workstation_calendar FOR DELETE USING (true);

CREATE POLICY "Allow public read systemic_email_logs" ON systemic_email_logs FOR SELECT USING (true);
CREATE POLICY "Allow public insert systemic_email_logs" ON systemic_email_logs FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read complaints" ON complaints FOR SELECT USING (true);
CREATE POLICY "Allow public insert complaints" ON complaints FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update complaints" ON complaints FOR UPDATE USING (true);
CREATE POLICY "Allow public delete complaints" ON complaints FOR DELETE USING (true);

CREATE POLICY "Allow public read logs" ON call_center_logs FOR SELECT USING (true);
CREATE POLICY "Allow public insert logs" ON call_center_logs FOR INSERT WITH CHECK (true);
`;
                  navigator.clipboard.writeText(sqlText);
                  alert("Relational SQL Setup Script copied to clipboard! Paste it in your Supabase SQL Editor, run it, then click 'Test & Reconnect Now'.");
                }}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] py-1.5 px-3 rounded shadow-xs transition-all cursor-pointer uppercase tracking-wider"
              >
                Copy Connected SQL Script
              </button>

              <button
                type="button"
                onClick={() => setBannerDismissed(true)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[10px] py-1.5 px-2.5 rounded shadow-xs transition-all cursor-pointer uppercase tracking-wider"
                title="Dismiss Banner"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        
        {/* National Manager & Call Center Tabs navigation */}
        {(currentUser.role === "admin" || currentUser.role === "callcenter") && (
          <div className="flex border-b border-slate-200 gap-1 shrink-0 overflow-x-auto">
            <button
              id="tab-analytics-btn"
              type="button"
              onClick={() => setCurrentTab("analytics")}
              className={`py-1.5 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                currentTab === "analytics"
                  ? "border-blue-600 text-blue-600 bg-blue-50/20 font-black"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Users className="h-3.5 w-3.5 inline mr-1.5" />
              Recovery Workspace
            </button>
            <button
              id="tab-all-list-btn"
              type="button"
              onClick={() => setCurrentTab("list")}
              className={`py-1.5 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                currentTab === "list"
                  ? "border-blue-600 text-blue-600 bg-blue-50/20 font-black"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <ListFilter className="h-3.5 w-3.5 inline mr-1.5" />
              All Complaints List
            </button>
            <button
              id="tab-stations-btn"
              type="button"
              onClick={() => setCurrentTab("stations")}
              className={`py-1.5 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
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
              className={`py-1.5 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
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
                className={`py-1.5 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
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

        {/* MASTER ALL COMPLAINTS LIST TAB (ADMIN VIEW) */}
        {(currentUser.role === "admin" || currentUser.role === "callcenter") && currentTab === "list" && (
          <AllComplaintsList
            complaints={complaints}
            theme={theme}
            onSelectComplaintInWorkspace={(complaintId) => {
              setSelectedComplaintId(complaintId);
              setCurrentTab("analytics");
            }}
            onDeleteComplaint={handleDeleteSingleComplaint}
            onDeleteAllComplaints={handleDeleteAllComplaints}
            calendarDates={calendarDates}
          />
        )}

        {/* STATION PERFORMANCE TAB */}
        {(currentUser.role === "admin" || currentUser.role === "callcenter") && currentTab === "stations" && (
          <StationOverview 
            complaints={complaints} 
            theme={theme}
            calendarDates={calendarDates}
            onOpenCalendarModal={(stationName) => {
              setCalendarStationTarget(stationName);
              setShowCalendarModal(true);
            }}
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
            existingComplaints={complaints}
          />
        )}

        {/* REPORTS & AGING TAB */}
        {(currentUser.role === "admin" || currentUser.role === "callcenter") && currentTab === "reports" && (
          <ReportsPanel complaints={complaints} theme={theme} />
        )}

        {/* CORE ANALYTICS BOARD / WORKSPACE VIEW */}
        {currentTab === "analytics" && (
          <div className="space-y-4">
            
            {/* KPI Metrics Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <MetricCard
                theme={theme}
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
                theme={theme}
                title="Pending Recovery"
                value={pendingCount}
                subtitle="Immediate action required"
                icon={<Clock className="h-4.5 w-4.5 text-red-500" />}
                colorClass="bg-red-50 border-red-200 text-red-700 shadow-sm"
              />
              <MetricCard
                theme={theme}
                title="In Progress"
                value={progressCount}
                subtitle="Currently being investigated"
                icon={<Settings className="h-4.5 w-4.5 text-orange-500" />}
                colorClass="bg-orange-50 border-orange-200 text-orange-700 shadow-sm"
              />
              <MetricCard
                theme={theme}
                title="Successfully Resolved"
                value={resolvedCount}
                subtitle="Satisfaction restored"
                icon={<CheckCircle className="h-4.5 w-4.5 text-green-500" />}
                colorClass="bg-green-50 border-green-200 text-green-700 shadow-sm"
              />
              <MetricCard
                theme={theme}
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
                          Awaiting Call Center Follow-up ({complaints.filter(c => !!(c.stationContactedDate || c.stationResolutionNotes || c.notes || c.status === "Contacted") && !c.callCenterFinalRemarks && c.status !== "Resolved").length})
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
                          Completed ({complaints.filter(c => !!c.callCenterFinalRemarks || c.status === "Resolved").length})
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
                          <option value="Station Contacted (Pending/In-Progress)">⚡ Station Contacted (Pending & In Progress Only)</option>
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
                            <Trash2 className="h-3 w-3" />
                            Delete All
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
                      const itemAge = getComplaintAgeInfo(item, tickerDate, calendarDates);

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

                          {/* Station Tag, Category Tag & Time Passing Badge */}
                          <div className="flex flex-wrap gap-1.5 mt-2.5">
                            <span className="inline-flex items-center text-[10px] bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-slate-600 font-bold">
                              <MapPin className="h-3 w-3 text-blue-600 mr-1" />
                              {item.station}
                            </span>
                            <span className="inline-flex items-center text-[10px] bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-slate-600 font-bold">
                              {item.category}
                            </span>
                            <span className={`inline-flex items-center text-[9px] font-black border px-2 py-0.5 rounded-full ${itemAge.badgeColorClass}`}>
                              <Clock className="h-2.5 w-2.5 mr-1" />
                              {itemAge.category}
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
                {selectedComplaint ? (() => {
                  const selectedAge = getComplaintAgeInfo(selectedComplaint, tickerDate, calendarDates);

                  return (
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

                          {(currentUser.role === "admin" || currentUser.role === "callcenter") && (
                            <div className="mt-2 text-right">
                              {deletingId !== selectedComplaint.id ? (
                                <button
                                  type="button"
                                  onClick={() => setDeletingId(selectedComplaint.id)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50 border border-slate-200 hover:border-red-200 text-[10px] font-bold px-2 py-1 rounded transition-all cursor-pointer flex items-center gap-1 shrink-0"
                                  title="Delete this complaint permanently from database"
                                >
                                  <Trash2 className="h-3 w-3 text-red-600" /> Delete Complaint
                                </button>
                              ) : (
                                <div className="bg-red-50 p-1.5 rounded border border-red-200 flex flex-col gap-1 items-end">
                                  <span className="text-[9px] font-bold text-red-700">Delete permanently from database?</span>
                                  <div className="flex gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteSingleComplaint(selectedComplaint.id)}
                                      className="bg-red-600 hover:bg-red-700 text-white text-[9px] font-black px-2 py-0.5 rounded cursor-pointer transition-colors"
                                    >
                                      Yes, Delete
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDeletingId(null)}
                                      className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-[9px] font-black px-2 py-0.5 rounded cursor-pointer transition-colors"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Time Passing & Deadline Tracker Box */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                      {/* Live Ticking Time Counter Header */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-blue-600 text-white rounded-lg shrink-0 shadow-2xs">
                            <Clock className="h-4 w-4 animate-spin-slow" />
                          </div>
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                              Complaint Time Elapsed (Live Tracker)
                            </span>
                            <span className="text-xs font-black text-blue-900 font-mono tracking-tight flex items-center gap-1">
                              <span>{selectedAge.days}d</span>
                              <span className="text-slate-400">:</span>
                              <span>{String(selectedAge.hours).padStart(2, "0")}h</span>
                              <span className="text-slate-400">:</span>
                              <span>{String(selectedAge.minutes).padStart(2, "0")}m</span>
                              <span className="text-slate-400">:</span>
                              <span className="text-blue-600 animate-pulse">{String(selectedAge.seconds).padStart(2, "0")}s</span>
                            </span>
                          </div>
                        </div>
                        <span className={`inline-flex items-center text-[10px] font-black px-2.5 py-1 rounded-full border shadow-2xs ${selectedAge.badgeColorClass}`}>
                          {selectedAge.category}
                        </span>
                      </div>

                      {/* Deadline SLA Milestone Countdown Alert */}
                      <div className={`p-2.5 rounded-lg border text-left space-y-1 ${
                        selectedAge.category === ">10 Days (Critical)"
                          ? "bg-rose-50/80 border-rose-200 text-rose-900"
                          : selectedAge.category === "6-10 Days (Escalated)"
                            ? "bg-orange-50/80 border-orange-200 text-orange-900"
                            : selectedAge.category === "3-5 Days (Pending)"
                              ? "bg-amber-50/80 border-amber-200 text-amber-900"
                              : "bg-emerald-50/80 border-emerald-200 text-emerald-900"
                      }`}>
                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                          <span className="flex items-center gap-1">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            {selectedAge.deadlineStatus}
                          </span>
                        </div>
                        <p className="text-[11px] font-bold font-mono leading-tight">
                          {selectedAge.nextMilestoneText}
                        </p>
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

                    {/* Quick Unreachable Action Component */}
                    <div className="flex flex-col gap-1.5 bg-red-50/40 border border-red-100 p-2.5 rounded-lg text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-red-800 text-[10px] uppercase tracking-wider">Contact Attempt Issue?</span>
                        <span className="text-[9px] font-bold text-slate-400">Did not connect?</span>
                      </div>
                      <button
                        id="btn-mark-unreachable"
                        type="button"
                        onClick={handleMarkUnreachable}
                        className="bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-xs py-1.5 px-3 rounded-md transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer w-full"
                        title="Auto-log Customer Unreachable and keep/add to pending list without manually clicking save"
                      >
                        <Phone className="h-3.5 w-3.5 animate-pulse" />
                        Mark Unreachable (Auto-Save)
                      </button>
                      
                      {autoLoggedUnreachable && (
                        <div className="text-red-700 text-[10px] font-black bg-red-50 p-1.5 rounded border border-red-200 text-center animate-pulse uppercase tracking-wider flex items-center justify-center gap-1">
                          <CheckCircle className="h-3 w-3 text-red-600 shrink-0" />
                          Unreachable remark logged & kept on pending list
                        </div>
                      )}
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
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Customer Complaint Description (Excel):
                        </span>
                        <span className="text-[9px] font-black text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 flex items-center gap-1 shrink-0">
                          <FileSpreadsheet className="h-3 w-3 text-blue-600" />
                          Column: "Tell us more about the reason for this rating ."
                        </span>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs text-slate-700 leading-relaxed font-semibold shadow-2xs">
                        {selectedComplaint.description && selectedComplaint.description !== "No feedback details provided." ? (
                          selectedComplaint.description
                        ) : (
                          <span className="italic text-slate-400 font-medium">
                            No detailed comment recorded under "Tell us more about the reason for this rating ." column.
                          </span>
                        )}
                      </div>
                    </div>

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

                            {/* Attempt history summary if logged */}
                            {(selectedComplaint.firstAttemptCallStatus || selectedComplaint.secondAttemptFeedbackStatus) && (
                              <div className="border-t border-blue-100 pt-1.5 mt-1.5 grid grid-cols-2 gap-2 text-[10px]">
                                {selectedComplaint.firstAttemptCallStatus && (
                                  <div className="bg-white/80 p-1.5 rounded border border-blue-200">
                                    <span className="text-[9px] font-bold text-slate-400 block uppercase">1st Call Attempt</span>
                                    <span className="font-bold text-slate-800">{selectedComplaint.firstAttemptCallStatus}</span>
                                    {selectedComplaint.firstAttemptDate && <span className="text-[8px] text-slate-400 block">{selectedComplaint.firstAttemptDate}</span>}
                                  </div>
                                )}
                                {selectedComplaint.secondAttemptFeedbackStatus && (
                                  <div className="bg-white/80 p-1.5 rounded border border-blue-200">
                                    <span className="text-[9px] font-bold text-slate-400 block uppercase">2nd Call Attempt</span>
                                    <span className="font-bold text-slate-800">{selectedComplaint.secondAttemptFeedbackStatus}</span>
                                    {selectedComplaint.secondAttemptDate && <span className="text-[8px] text-slate-400 block">{selectedComplaint.secondAttemptDate}</span>}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <h4 className="text-xs font-black text-green-700 uppercase tracking-wider flex items-center gap-1.5 bg-green-50 px-2 py-1.5 rounded border border-green-100">
                            <Sparkles className="h-4 w-4" />
                            Call Center Follow-Up & Verification Workflow
                          </h4>

                          {/* Attempt Stage Toggle Selector */}
                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase">
                              Follow-Up Call Attempt Stage
                            </label>
                            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                              <button
                                type="button"
                                onClick={() => setFormAttemptStage("1st Attempt")}
                                className={`flex-1 py-1.5 px-3 rounded-md text-xs font-bold transition-all cursor-pointer ${
                                  formAttemptStage === "1st Attempt"
                                    ? "bg-white text-blue-700 shadow-xs border border-slate-200"
                                    : "text-slate-600 hover:text-slate-900"
                                }`}
                              >
                                1st Call Attempt
                              </button>
                              <button
                                type="button"
                                onClick={() => setFormAttemptStage("2nd Attempt")}
                                className={`flex-1 py-1.5 px-3 rounded-md text-xs font-bold transition-all cursor-pointer ${
                                  formAttemptStage === "2nd Attempt"
                                    ? "bg-white text-blue-700 shadow-xs border border-slate-200"
                                    : "text-slate-600 hover:text-slate-900"
                                }`}
                              >
                                2nd Call Attempt
                              </button>
                            </div>
                          </div>

                          {/* 1st Attempt Section */}
                          {formAttemptStage === "1st Attempt" && (
                            <div className="bg-amber-50/60 p-3 rounded-lg border border-amber-200 space-y-2">
                              <label className="block text-[10px] font-bold text-amber-900 uppercase tracking-wider">
                                1st Attempt Call Status *
                              </label>
                              <select
                                value={formFirstAttemptCallStatus}
                                onChange={(e) => setFormFirstAttemptCallStatus(e.target.value)}
                                className="w-full bg-white border border-amber-300 rounded-md py-1.5 px-2.5 text-xs text-slate-800 cursor-pointer focus:outline-none focus:border-blue-500 font-bold shadow-2xs"
                              >
                                <option value="Connected">Connected</option>
                                <option value="Customer Busy">Customer Busy</option>
                                <option value="Customer Unreachable">Customer Unreachable</option>
                                <option value="Invalid Details">Invalid Details</option>
                                <option value="Invalid Number">Invalid Number</option>
                                <option value="No Answer">No Answer</option>
                              </select>

                              {["Customer Busy", "Customer Unreachable", "No Answer"].includes(formFirstAttemptCallStatus) && (
                                <div className="text-[11px] text-amber-800 bg-amber-100/80 p-2 rounded border border-amber-300/80 font-medium flex items-start gap-1.5">
                                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                                  <span>
                                    <strong>Pass to 2nd Attempt:</strong> Customer was uncontactable on 1st attempt. Record will stay in recovery list and move to 2nd attempt queue.
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* 2nd Attempt or Connected Section */}
                          {(formAttemptStage === "2nd Attempt" || formFirstAttemptCallStatus === "Connected") && (
                            <div className="bg-blue-50/60 p-3 rounded-lg border border-blue-200 space-y-2">
                              <label className="block text-[10px] font-bold text-blue-900 uppercase tracking-wider">
                                {formAttemptStage === "2nd Attempt" ? "2nd Attempt Feedback Status / Remarks *" : "Call Feedback Status / Remarks *"}
                              </label>
                              <select
                                value={formSecondAttemptFeedbackStatus}
                                onChange={(e) => {
                                  setFormSecondAttemptFeedbackStatus(e.target.value);
                                  setFormFeedbackStatus(e.target.value);
                                }}
                                className="w-full bg-white border border-blue-300 rounded-md py-1.5 px-2.5 text-xs text-slate-800 cursor-pointer focus:outline-none focus:border-blue-500 font-bold shadow-2xs"
                              >
                                <option value="Satisfied">Satisfied (Pass to Complete)</option>
                                <option value="Not Satisfied">Not Satisfied</option>
                                <option value="No solution Received">No solution Received</option>
                                <option value="Customer Unreachable">Customer Unreachable</option>
                                <option value="Follow Up Required">Follow Up Required</option>
                                <option value="Escalated">Escalated</option>
                              </select>

                              {formSecondAttemptFeedbackStatus === "Satisfied" && (
                                <div className="text-[11px] text-green-800 bg-green-100/80 p-2 rounded border border-green-300/80 font-medium flex items-center gap-1.5">
                                  <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                                  <span>
                                    <strong>Complete Recovery:</strong> 'Satisfied' converts the customer and marks complaint as Completed & Resolved.
                                  </span>
                                </div>
                              )}

                              {formSecondAttemptFeedbackStatus === "Customer Unreachable" && formAttemptStage === "2nd Attempt" && (
                                <div className="text-[11px] text-rose-800 bg-rose-100/80 p-2 rounded border border-rose-300/80 font-medium flex items-start gap-1.5">
                                  <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                                  <span>
                                    <strong>Not Satisfied Base:</strong> Unreachable after 2nd attempt. Automatically classified as Not Satisfied customer base.
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

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
                                <option value="Very Dissatisfied">Very Dissatisfied</option>
                                <option value="Dissatisfied">Dissatisfied</option>
                                <option value="Neutral">Neutral</option>
                                <option value="Satisfied">Satisfied</option>
                                <option value="Very Satisfied">Very Satisfied</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              Customer's Final Remark *
                            </label>
                            <textarea
                              id="callcenter-final-remarks-textarea"
                              rows={3}
                              required
                              placeholder="Enter the customer's remarks and feedback details during call center follow up..."
                              value={formCallCenterFinalRemarks}
                              onChange={(e) => setFormCallCenterFinalRemarks(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-md py-2 px-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 leading-relaxed resize-none font-medium"
                            />
                          </div>

                          {saveSuccess && (
                            <div className="text-green-700 text-xs font-semibold bg-green-50 p-2 rounded border border-green-200 text-center">
                              {formAttemptStage === "2nd Attempt" && formSecondAttemptFeedbackStatus === "Satisfied"
                                ? "Call center feedback saved & marked as Completed/Resolved!"
                                : "Call center feedback logged & saved successfully!"}
                            </div>
                          )}

                          <button
                            type="submit"
                            className={`w-full text-white font-bold text-xs py-2.5 px-4 rounded-md transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5 ${
                              formAttemptStage === "2nd Attempt" && formSecondAttemptFeedbackStatus === "Satisfied"
                                ? "bg-green-600 hover:bg-green-700"
                                : formAttemptStage === "1st Attempt" && ["Customer Busy", "Customer Unreachable", "No Answer"].includes(formFirstAttemptCallStatus)
                                ? "bg-amber-600 hover:bg-amber-700"
                                : formAttemptStage === "2nd Attempt" && formSecondAttemptFeedbackStatus === "Customer Unreachable"
                                ? "bg-rose-600 hover:bg-rose-700"
                                : "bg-blue-600 hover:bg-blue-700"
                            }`}
                          >
                            {formAttemptStage === "2nd Attempt" && formSecondAttemptFeedbackStatus === "Satisfied"
                              ? "Save & Mark as Completed (Resolved)"
                              : formAttemptStage === "1st Attempt" && ["Customer Busy", "Customer Unreachable", "No Answer"].includes(formFirstAttemptCallStatus)
                              ? "Save 1st Attempt & Pass to 2nd Attempt Queue"
                              : formAttemptStage === "2nd Attempt" && formSecondAttemptFeedbackStatus === "Customer Unreachable"
                              ? "Save 2nd Attempt & Mark as Not Satisfied Base"
                              : "Save Call Center Log & Update Status"}
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
                                <option value="Very Dissatisfied">Very Dissatisfied</option>
                                <option value="Dissatisfied">Dissatisfied</option>
                                <option value="Neutral">Neutral</option>
                                <option value="Satisfied">Satisfied</option>
                                <option value="Very Satisfied">Very Satisfied</option>
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
                                <option value="Satisfied After Resolution">Satisfied After Resolution</option>
                                <option value="Still Dissatisfied">Still Dissatisfied</option>
                                <option value="No Solution Received">No Solution Received</option>
                                <option value="Customer Unreachable">Customer Unreachable</option>
                                <option value="Follow-up Required">Follow-up Required</option>
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
                  );
                })() : (
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

      {/* Universal Footer */}
      <footer className={`w-full max-w-7xl mx-auto px-4 py-4 mt-auto border-t flex flex-col sm:flex-row items-center justify-between gap-3 text-center transition-all duration-500 ${
        isDark ? "border-slate-800 text-slate-400" : "border-slate-200 text-slate-500"
      }`}>
        <p className="text-[10px] font-mono uppercase tracking-widest">
          Solution by Yash (All Rights Reserved) • Passwords Protected
        </p>
        <div className="flex items-center gap-3">
          <span className="text-[9px] uppercase tracking-wider font-bold">Theme Mode:</span>
          <button
            type="button"
            onClick={toggleTheme}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all duration-300 shadow-xs cursor-pointer ${
              isDark 
                ? "bg-slate-900 border-slate-800 text-amber-400 hover:text-amber-300 hover:bg-slate-800" 
                : "bg-white border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            {isDark ? (
              <>
                <Sun className="h-3.5 w-3.5" />
                <span>Light Mode</span>
              </>
            ) : (
              <>
                <Moon className="h-3.5 w-3.5" />
                <span>Dark Mode</span>
              </>
            )}
          </button>
        </div>
      </footer>

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

      {/* Nice Connected Alert Custom Modal */}
      {showConnectedAlert && (
        <div id="connected-alert-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 text-center space-y-4 animate-scale-in">
            <div className="w-16 h-16 bg-green-50 border border-green-100 rounded-full flex items-center justify-center mx-auto text-green-600 animate-bounce">
              <CheckCircle className="h-10 w-10" />
            </div>
            
            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-800 uppercase tracking-wider">
                Customer Connected
              </h3>
              <p className="text-xs text-slate-500 font-semibold">
                Successfully re-established communication with customer:
              </p>
              <p className="text-sm font-extrabold text-blue-600 font-sans mt-1 bg-blue-50 py-1.5 px-3 rounded-md border border-blue-100 inline-block">
                {connectedCustomerName}
              </p>
            </div>
            
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              The customer was previously flagged as unreachable. The updated follow-up details and recovery status have been logged and synced successfully. Great job restoring the customer relationship!
            </p>
            
            <button
              type="button"
              onClick={() => {
                setShowConnectedAlert(false);
                setConnectedCustomerName("");
              }}
              className="w-full bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-extrabold text-xs py-2 px-4 rounded-lg transition-all shadow-md cursor-pointer"
            >
              Wonderful, Continue!
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Update Follow Up Actions */}
      {showConfirmModal && (
        <div id="confirm-action-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-scale-in">
            {/* Header */}
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-amber-400 animate-pulse" />
                <h3 className="text-sm font-black uppercase tracking-wider">Confirm Action Update</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer p-1"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div className="flex gap-4 items-start">
                <div className="bg-amber-50 p-2.5 rounded-full border border-amber-100 text-amber-600 shrink-0">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Are you sure you want to save?</h4>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">
                    You are updating the recovery status and logging adviser notes for complaint <strong className="text-slate-800">{selectedComplaintId}</strong> ({selectedComplaint?.customerName}). This action will immediately sync with the main database.
                  </p>
                </div>
              </div>

              {/* Summary details review box */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-2">
                <p className="font-bold text-slate-500 uppercase text-[9px] tracking-wider border-b border-slate-200 pb-1.5">Action Preview Summary</p>
                {currentUser?.role === "agent" && (
                  <div className="space-y-1">
                    <p className="text-slate-600"><strong>Adviser Name:</strong> {formAgentName || "Not set"}</p>
                    <p className="text-slate-600 truncate"><strong>Resolution Notes:</strong> {formStationResolutionNotes || "Not set"}</p>
                    <p className="text-slate-600"><strong>Feedback Status:</strong> {formFeedbackStatus}</p>
                    <p className="text-slate-600"><strong>Final Status:</strong> {formFinalStatus}</p>
                  </div>
                )}
                {currentUser?.role === "callcenter" && (
                  <div className="space-y-1">
                    <p className="text-slate-600"><strong>Contact Date:</strong> {formCallCenterContactedDate || "Not set"}</p>
                    <p className="text-slate-600"><strong>Verified Satisfaction:</strong> {formCallCenterFinalSatisfaction}</p>
                    <p className="text-slate-600 truncate"><strong>Final Remarks:</strong> {formCallCenterFinalRemarks || "Not set"}</p>
                    <p className="text-slate-600"><strong>Feedback Status:</strong> {formFeedbackStatus}</p>
                    <p className="text-slate-600"><strong>Final Status:</strong> {formFinalStatus}</p>
                  </div>
                )}
                {currentUser?.role === "admin" && (
                  <div className="space-y-1">
                    <p className="text-slate-600"><strong>Status:</strong> {formStatus}</p>
                    <p className="text-slate-600"><strong>Satisfaction:</strong> {formSatisfaction}</p>
                    <p className="text-slate-600"><strong>Feedback Status:</strong> {formFeedbackStatus}</p>
                    <p className="text-slate-600"><strong>Final Status:</strong> {formFinalStatus}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-extrabold text-xs py-2 px-4 rounded-lg transition-all shadow-xs cursor-pointer"
              >
                No, Cancel & Close
              </button>
              <button
                type="button"
                onClick={executeUpdateFollowUp}
                className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs py-2 px-4 rounded-lg transition-all shadow-md cursor-pointer flex items-center gap-1.5"
              >
                Yes, Save & Sync
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Profile Modal */}
      {showProfileModal && currentUser && (
        <UserProfileModal
          user={currentUser}
          complaints={complaints}
          onClose={() => setShowProfileModal(false)}
          isDark={isDark}
          onUpdateCurrentUser={handleUpdateCurrentUser}
          officersList={officersList}
          onUpdateOfficersList={handleUpdateOfficersList}
          stationsList={stationsList}
          onUpdateStationsList={handleUpdateStationsList}
        />
      )}

      {/* Workstation Calendar Manager Modal */}
      {showCalendarModal && currentUser && (
        <WorkstationCalendarManager
          currentUser={currentUser}
          calendarDates={calendarDates}
          onAddCalendarDate={handleAddCalendarDate}
          onRemoveCalendarDate={handleRemoveCalendarDate}
          isOpen={showCalendarModal}
          onClose={() => setShowCalendarModal(false)}
          selectedStationFilter={calendarStationTarget}
        />
      )}

      {/* Real-Time Call Center Sound & Pop-Up Notification Toast */}
      <CallCenterNotificationToast
        notifications={callCenterNotifications}
        onDismiss={(id) => setCallCenterNotifications((prev) => prev.filter((n) => n.id !== id))}
        onClearAll={() => setCallCenterNotifications([])}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled((prev) => !prev)}
        onOpenEmailModal={() => setShowStationDirectoryModal(true)}
      />

      {/* Station Directory & Systemic Email Matrix Modal */}
      {showStationDirectoryModal && currentUser && (
        <StationDirectoryAndEmailModal
          isOpen={showStationDirectoryModal}
          onClose={() => setShowStationDirectoryModal(false)}
          currentUser={currentUser}
          complaints={complaints}
          emailLogs={emailLogs}
          onRefreshEmailLogs={() => {
            fetch("/api/email-logs")
              .then((res) => res.json())
              .then((d) => d.logs && setEmailLogs(d.logs))
              .catch(() => setEmailLogs(getStoredSystemicEmailLogs()));
          }}
        />
      )}


      {/* Unified Footer: Signature & Theme Switcher */}
      <footer className="shrink-0 mt-8 mb-6 flex flex-col items-center gap-3 text-center border-t pt-6 border-slate-200/30 dark:border-slate-800/30">
        <p className={`text-[10px] font-mono uppercase tracking-widest ${isDark ? "text-slate-500" : "text-slate-400"}`}>
          Solution by Yash (All Rights Reserved) • Passwords Protected
        </p>
        <button
          type="button"
          onClick={toggleTheme}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all duration-300 shadow-xs cursor-pointer ${
            isDark 
              ? "bg-slate-900 border-slate-800 text-amber-400 hover:text-amber-300 hover:bg-slate-800" 
              : "bg-white border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          {isDark ? (
            <>
              <Sun className="h-3.5 w-3.5" />
              <span>Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="h-3.5 w-3.5" />
              <span>Dark Mode</span>
            </>
          )}
        </button>
      </footer>

    </div>
  );
}
