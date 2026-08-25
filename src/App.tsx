import React, { useState, useEffect, useRef } from "react";
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
  ListFilter,
  XCircle,
  Send,
  ShieldAlert,
  BarChart2,
  Edit3,
  CornerDownLeft
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { Complaint, SatisfactionLevel, FollowUpStatus, AIAnalysis, UserProfile, CallCenterOfficer, StationProfile, WorkstationCalendarDate, CaseHistoryEntry, ContactAttemptEvent } from "./types";
import { DEMO_COMPLAINTS, STATIONS, CALL_CENTER_OFFICERS } from "./demoData";
import { sanitizeComplaintForSupabase, normalizeComplaintFromSupabase, deduplicateAndSanitizeComplaints, performResilientSupabaseUpsert, mergeComplaintObjects } from "./utils/supabaseSanitizer";
import { matchesStationCodeOrName, isComplaintRejected, isStationContacted } from "./utils/stationUtils";
import { sanitizeComplaintDates, parseComplaintDate } from "./utils/agingUtils";
import LoginScreen from "./components/LoginScreen";
import UploadZone from "./components/UploadZone";
import StationOverview from "./components/StationOverview";
import MetricCard from "./components/MetricCard";
import ReportsPanel from "./components/ReportsPanel";
import IdealMotorsLogo from "./components/IdealMotorsLogo";
import UserProfileModal from "./components/UserProfileModal";
import AllComplaintsList from "./components/AllComplaintsList";
import CallCenterSLAReportModal from "./components/CallCenterSLAReportModal";
import AdminEditComplaintModal from "./components/AdminEditComplaintModal";
import CaseHistoryTimeline from "./components/CaseHistoryTimeline";
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
import {
  fetchComplaintsCentral,
  saveComplaintsCentral,
  deleteComplaintCentral,
  clearAllComplaintsCentral,
  fetchCalendarCentral,
  saveCalendarDateCentral,
  deleteCalendarDateCentral,
  fetchOfficersCentral,
  saveOfficersCentral,
  fetchStationsCentral,
  saveStationsCentral,
  fetchEmailLogsCentral,
  saveEmailLogsCentral,
  fetchUserProfileCentral,
  saveUserProfileCentral,
  normalizeUserProfileFromSupabase,
  subscribeToCentralRealtime,
  centralSupabase
} from "./utils/centralDbSync";


// Initialize client-side Supabase client with safe publishable credentials
const SUPABASE_URL = "https://qsistbvaukxuwebqupiy.supabase.co";
const SUPABASE_KEY = "sb_publishable_Npa3x5SHHp65jinonZFnKA_56lBMOQb";
export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

const getFormattedDateTime = (d: Date = new Date()): string => {
  const dateStr = d.toISOString().split("T")[0];
  const timeStr = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  return `${dateStr} ${timeStr}`;
};

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
    try {
      const saved = localStorage.getItem("ideal_group_session_identity") || localStorage.getItem("ideal_group_current_user");
      if (saved) return JSON.parse(saved);
    } catch {
      return null;
    }
    return null;
  });

  const [officersList, setOfficersList] = useState<CallCenterOfficer[]>(CALL_CENTER_OFFICERS);
  const [stationsList, setStationsList] = useState<StationProfile[]>(STATIONS);
  const [calendarDates, setCalendarDates] = useState<WorkstationCalendarDate[]>(() => getStoredCalendarDates());
  const [emailLogs, setEmailLogs] = useState<SystemicEmailLog[]>(() => getStoredSystemicEmailLogs());
  const [complaints, setComplaints] = useState<Complaint[]>([]);

  // Central Database Sync & Feedback States
  const [dbSaveState, setDbSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [dbSaveErrorMsg, setDbSaveErrorMsg] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string>(new Date().toLocaleTimeString());

  // Authoritative user profile loader from public.user_profiles in Supabase
  const loadActiveUserProfileFromDb = async () => {
    try {
      // 1. Check Supabase Auth
      try {
        const { data: authData } = await centralSupabase.auth.getUser();
        if (authData?.user?.id) {
          const authRes = await fetchUserProfileCentral({ authUserId: authData.user.id });
          if (authRes.success && authRes.data) {
            setCurrentUser(authRes.data);
            return;
          }
        }
      } catch {
        // ignore
      }

      // 2. Check saved session identity
      const saved = localStorage.getItem("ideal_group_session_identity") || localStorage.getItem("ideal_group_current_user");
      if (saved) {
        const parsed = JSON.parse(saved);
        const criteria = {
          id: parsed.id,
          authUserId: parsed.auth_user_id,
          userId: parsed.user_id || parsed.officerId,
          role: parsed.role,
          station: parsed.station,
          officerId: parsed.officerId,
        };
        const res = await fetchUserProfileCentral(criteria);
        if (res.success && res.data) {
          setCurrentUser(res.data);
        } else if (parsed.role) {
          // Seed profile to database if not yet present
          const seedRes = await saveUserProfileCentral(parsed);
          if (seedRes.success && seedRes.data) {
            setCurrentUser(seedRes.data);
          }
        }
      }
    } catch (err) {
      console.error("[Central DB] Error loading user profile:", err);
    }
  };

  // Master load from Supabase Single Source of Truth
  const refreshAllFromCentralDb = async () => {
    try {
      const [resC, resO, resS, resCal, resEml] = await Promise.all([
        fetchComplaintsCentral(),
        fetchOfficersCentral(),
        fetchStationsCentral(),
        fetchCalendarCentral(),
        fetchEmailLogsCentral(),
      ]);

      if (resC.success && resC.data) {
        setComplaints(resC.data);
        setSupabaseActive(true);
        setSupabaseError(null);
      } else if (!resC.success) {
        setSupabaseActive(false);
        setSupabaseError(resC.error || "Failed to load complaints from central database");
      }

      if (resO.success && resO.data && resO.data.length > 0) {
        setOfficersList(resO.data);
      }
      if (resS.success && resS.data && resS.data.length > 0) {
        setStationsList(resS.data);
      }
      if (resCal.success && resCal.data && resCal.data.length > 0) {
        setCalendarDates(resCal.data);
      }
      if (resEml.success && resEml.data) {
        setEmailLogs(resEml.data);
      }
      
      // Also refresh active profile from database
      await loadActiveUserProfileFromDb();

      setLastSyncTime(new Date().toLocaleTimeString());
    } catch (err: any) {
      console.error("Central database fetch error:", err);
    }
  };

  // Initial load on mount
  useEffect(() => {
    refreshAllFromCentralDb();
  }, []);

  // Multi-table Supabase Realtime synchronization across all operational tables
  useEffect(() => {
    const channel = subscribeToCentralRealtime({
      onComplaintsChange: (payload) => {
        console.log("⚡ [Realtime Complaints Event]:", payload.eventType);
        if (payload.eventType === "DELETE" && payload.old?.id) {
          setComplaints((prev) => prev.filter((c) => c.id !== payload.old.id && c.woNo !== payload.old.id));
        } else if (payload.new) {
          const normalized = normalizeComplaintFromSupabase(payload.new);
          setComplaints((prev) => {
            const exists = prev.some((c) => c.id === normalized.id || (normalized.woNo && c.woNo === normalized.woNo));
            if (exists) {
              return prev.map((c) => (c.id === normalized.id || (normalized.woNo && c.woNo === normalized.woNo) ? normalized : c));
            } else {
              return [normalized, ...prev];
            }
          });
        }
        setLastSyncTime(new Date().toLocaleTimeString());
      },
      onCalendarChange: (payload) => {
        console.log("⚡ [Realtime Calendar Event]:", payload.eventType);
        if (payload.eventType === "DELETE" && payload.old?.id) {
          setCalendarDates((prev) => prev.filter((item) => item.id !== payload.old.id));
        } else if (payload.new) {
          const newDate: WorkstationCalendarDate = {
            id: payload.new.id,
            station: payload.new.station || "All",
            date: payload.new.date,
            type: payload.new.type || "off_day",
            reason: payload.new.reason || "",
            createdAt: payload.new.createdAt || payload.new.created_at || new Date().toISOString(),
            createdBy: payload.new.createdBy || payload.new.created_by || "System Admin",
          };
          setCalendarDates((prev) => {
            const exists = prev.some((item) => item.id === newDate.id);
            if (exists) {
              return prev.map((item) => (item.id === newDate.id ? newDate : item));
            } else {
              return [newDate, ...prev];
            }
          });
        }
        setLastSyncTime(new Date().toLocaleTimeString());
      },
      onUserProfilesChange: (payload) => {
        console.log("⚡ [Realtime User Profiles Event]:", payload.eventType);
        if (payload.new) {
          const updatedProfile = normalizeUserProfileFromSupabase(payload.new);
          setCurrentUser((prev) => {
            if (!prev) return prev;
            const isMatch = (prev.id && prev.id === updatedProfile.id) ||
                            (prev.auth_user_id && prev.auth_user_id === updatedProfile.auth_user_id) ||
                            (prev.user_id && prev.user_id === updatedProfile.user_id) ||
                            (prev.role === "admin" && updatedProfile.role === "admin") ||
                            (prev.role === "callcenter" && prev.officerId && (prev.officerId === updatedProfile.user_id || prev.officerId === updatedProfile.officerId)) ||
                            (prev.role === "agent" && prev.station && prev.station === updatedProfile.station);
            if (isMatch) {
              console.log("🔄 [Realtime] Authoritative profile update applied from central Supabase:", updatedProfile.name);
              return { ...prev, ...updatedProfile };
            }
            return prev;
          });
        }
      },
      onOfficersChange: (payload) => {
        console.log("⚡ [Realtime Officers Event]:", payload.eventType);
        fetchOfficersCentral().then((res) => {
          if (res.success && res.data) setOfficersList(res.data);
        });
      },
      onStationsChange: (payload) => {
        console.log("⚡ [Realtime Stations Event]:", payload.eventType);
        fetchStationsCentral().then((res) => {
          if (res.success && res.data) setStationsList(res.data);
        });
      },
      onEmailLogsChange: (payload) => {
        console.log("⚡ [Realtime Email Logs Event]:", payload.eventType);
        fetchEmailLogsCentral().then((res) => {
          if (res.success && res.data) setEmailLogs(res.data);
        });
      },
    });

    // Periodic poll every 5s for cross-workstation fallback sync
    const syncInterval = setInterval(() => {
      refreshAllFromCentralDb();
    }, 5000);

    return () => {
      channel.unsubscribe();
      clearInterval(syncInterval);
    };
  }, []);

  const handleUpdateOfficersList = async (newList: CallCenterOfficer[]) => {
    setOfficersList(newList);
    setDbSaveState("saving");
    setDbSaveErrorMsg(null);
    const res = await saveOfficersCentral(newList);
    if (res.success) {
      setDbSaveState("saved");
      setLastSyncTime(new Date().toLocaleTimeString());
      setTimeout(() => setDbSaveState("idle"), 3000);
    } else {
      setDbSaveState("error");
      setDbSaveErrorMsg(res.error || "Failed to save officers to central database");
    }
  };

  const handleUpdateStationsList = async (newList: StationProfile[]) => {
    setStationsList(newList);
    setDbSaveState("saving");
    setDbSaveErrorMsg(null);
    const res = await saveStationsCentral(newList);
    if (res.success) {
      setDbSaveState("saved");
      setLastSyncTime(new Date().toLocaleTimeString());
      setTimeout(() => setDbSaveState("idle"), 3000);
    } else {
      setDbSaveState("error");
      setDbSaveErrorMsg(res.error || "Failed to save stations to central database");
    }
  };

  const handleUpdateCurrentUser = (updated: UserProfile) => {
    setCurrentUser(updated);
    localStorage.setItem("ideal_group_session_identity", JSON.stringify({
      id: updated.id,
      auth_user_id: updated.auth_user_id,
      user_id: updated.user_id || updated.officerId,
      role: updated.role,
      station: updated.station,
      officerId: updated.officerId,
    }));
  };

  const [showCalendarModal, setShowCalendarModal] = useState<boolean>(false);
  const [calendarStationTarget, setCalendarStationTarget] = useState<string>("All");

  // Systemic Email Logs & Call Center Notification Sound States
  const [showStationDirectoryModal, setShowStationDirectoryModal] = useState<boolean>(false);
  const [callCenterNotifications, setCallCenterNotifications] = useState<CallCenterNotification[]>([]);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Admin Master Complaint Edit Modal State
  const [adminEditingComplaint, setAdminEditingComplaint] = useState<Complaint | null>(null);
  const [showAdminEditModal, setShowAdminEditModal] = useState<boolean>(false);

  const handleAdminSaveComplaint = (updated: Complaint) => {
    const original = complaints.find((c) => c.id === updated.id);
    const isStationChanged = original && original.station !== updated.station;

    const updatedList = complaints.map((c) => (c.id === updated.id ? updated : c));
    saveComplaints(updatedList);
    setAdminEditingComplaint(updated);

    // If service station changed, dispatch automated email notification to the new station
    if (isStationChanged) {
      dispatchSystemicEmailsForComplaints([updated]);
    }
  };

  const handleAddCalendarDate = async (newDateData: Omit<WorkstationCalendarDate, "id" | "createdAt" | "createdBy">) => {
    const stationSlug = (newDateData.station || "All").trim().toLowerCase().replace(/[^a-z0-9]/g, "-");
    const stableId = `cal-${stationSlug}-${newDateData.date}`;

    const newEntry: WorkstationCalendarDate = {
      ...newDateData,
      id: stableId,
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.name || (currentUser?.role === "admin" ? "System Admin" : "Call Center Admin"),
    };
    
    setCalendarDates(prev => {
      const filtered = prev.filter(item => item.id !== stableId);
      return [newEntry, ...filtered];
    });

    setDbSaveState("saving");
    setDbSaveErrorMsg(null);
    const res = await saveCalendarDateCentral(newEntry);
    if (res.success) {
      setDbSaveState("saved");
      setLastSyncTime(new Date().toLocaleTimeString());
      setTimeout(() => setDbSaveState("idle"), 3000);
    } else {
      setDbSaveState("error");
      setDbSaveErrorMsg(res.error || "Failed to save calendar date to central database");
    }
  };

  const handleRemoveCalendarDate = async (id: string) => {
    setCalendarDates(prev => prev.filter(item => item.id !== id));
    setDbSaveState("saving");
    setDbSaveErrorMsg(null);
    const res = await deleteCalendarDateCentral(id);
    if (res.success) {
      setDbSaveState("saved");
      setLastSyncTime(new Date().toLocaleTimeString());
      setTimeout(() => setDbSaveState("idle"), 3000);
    } else {
      setDbSaveState("error");
      setDbSaveErrorMsg(res.error || "Failed to delete calendar date from central database");
    }
  };

  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState<"analytics" | "list" | "stations" | "upload" | "reports">("analytics");

  // Track complaints updated during background sync for subtle highlight/pulse animation
  const [recentlyUpdatedStatusIds, setRecentlyUpdatedStatusIds] = useState<Set<string>>(new Set());
  const prevComplaintStatusesRef = useRef<Map<string, { status: string; stationResponseStatus?: string }>>(new Map());

  useEffect(() => {
    if (!complaints || complaints.length === 0) return;

    const prevMap = prevComplaintStatusesRef.current;
    const changedIds: string[] = [];

    if (prevMap.size === 0) {
      // First load: store initial status values without animation
      complaints.forEach((c) => {
        prevMap.set(c.id, {
          status: c.status,
          stationResponseStatus: c.stationResponseStatus,
        });
      });
      return;
    }

    complaints.forEach((c) => {
      const prev = prevMap.get(c.id);
      if (prev) {
        if (prev.status !== c.status || prev.stationResponseStatus !== c.stationResponseStatus) {
          changedIds.push(c.id);
        }
      }
      prevMap.set(c.id, {
        status: c.status,
        stationResponseStatus: c.stationResponseStatus,
      });
    });

    if (changedIds.length > 0) {
      setRecentlyUpdatedStatusIds((prev) => {
        const next = new Set(prev);
        changedIds.forEach((id) => next.add(id));
        return next;
      });

      const timer = setTimeout(() => {
        setRecentlyUpdatedStatusIds((prev) => {
          const next = new Set(prev);
          changedIds.forEach((id) => next.delete(id));
          return next;
        });
      }, 4000);

      return () => clearTimeout(timer);
    }
  }, [complaints]);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [stationFilter, setStationFilter] = useState<string>("All");
  const [dateFilter, setDateFilter] = useState<string>("All");
  const [startDateFilter, setStartDateFilter] = useState<string>("");
  const [endDateFilter, setEndDateFilter] = useState<string>("");

  // Call Center Quick Filter: 1st Attempt, 2nd Attempt, Rejected List, Completed, All Station Contacted
  const [callCenterQuickFilter, setCallCenterQuickFilter] = useState<"1st_attempt" | "2nd_attempt" | "rejected" | "completed" | "all">("1st_attempt");

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
  const [formSecondAttemptCallStatus, setFormSecondAttemptCallStatus] = useState<string>("Connected");
  const [formSecondAttemptFeedbackStatus, setFormSecondAttemptFeedbackStatus] = useState<string>("Follow Up Required");
  
  // Track loaded complaint to prevent form resets on state re-renders / dropdown interactions
  const prevSelectedComplaintIdRef = useRef<string | null>(null);
  
  // Parallel track status fields
  const [formFeedbackStatus, setFormFeedbackStatus] = useState("Follow-up Required");
  const [formFinalStatus, setFormFinalStatus] = useState("Open");
  const [formSolutionProvided, setFormSolutionProvided] = useState("");
  const [formSolutionDate, setFormSolutionDate] = useState("");
  const [formFollowUpDate, setFormFollowUpDate] = useState("");
  
  // National Admin station assignment field
  const [formAssignedStation, setFormAssignedStation] = useState("");

  // Rejection Workflow states
  const [rejectionReasonInput, setRejectionReasonInput] = useState("");
  const [showRejectionForm, setShowRejectionForm] = useState(false);

  // Service Station Return / Reject states
  const [stationReturnReasonInput, setStationReturnReasonInput] = useState("");
  const [showStationReturnForm, setShowStationReturnForm] = useState(false);

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
  const [showSLAReportModal, setShowSLAReportModal] = useState(false);

  // Diagnostics logging for CX Recovery DB & Query Verification (Requirement #12)
  useEffect(() => {
    const tissaRecords = complaints.filter(
      (c) => matchesStationCodeOrName(c.station, "Tissamaharama") || matchesStationCodeOrName(c.station, "TISSA")
    );
    const rejectedRecords = complaints.filter(
      (c) =>
        c.stationResponseStatus === "Rejected" ||
        c.stationResponseStatus === "Returned to Service Station" ||
        c.stationResponseStatus === "Rejected by Call Center" ||
        c.feedbackStatus === "Returned to Service Station"
    );

    console.log("====================================");
    console.log("🔍 [CX RECOVERY DB & SYNC DIAGNOSTICS]");
    console.log("👤 Current User:", currentUser?.name || currentUser?.role || "Not Logged In");
    console.log("🆔 Officer ID / Email:", currentUser?.officerId || currentUser?.email || "N/A");
    console.log("🏢 Assigned Station:", currentUser?.station || "N/A (All / Call Center / Admin)");
    console.log("🌐 Supabase Active:", supabaseActive, supabaseError ? `Error: ${supabaseError}` : "Connected (OK)");
    console.log("📊 Total Records from Supabase:", complaints.length);
    console.log("📍 Total Tissamaharama Records:", tissaRecords.length, tissaRecords.map((c) => ({ id: c.id, customer: c.customerName, status: c.status, stationResponseStatus: c.stationResponseStatus })));
    console.log("❌ Total Rejected Records:", rejectedRecords.length, rejectedRecords.map((c) => ({ id: c.id, customer: c.customerName, reason: c.stationResponseRejectionReason })));
    console.log("====================================");
  }, [complaints, currentUser, supabaseActive, supabaseError]);

  const saveComplaints = async (updatedList: Complaint[]) => {
    setComplaints(updatedList);
    setDbSaveState("saving");
    setDbSaveErrorMsg(null);

    const res = await saveComplaintsCentral(updatedList);
    if (res.success) {
      setDbSaveState("saved");
      setSupabaseActive(true);
      setSupabaseError(null);
      setLastSyncTime(new Date().toLocaleTimeString());
      setTimeout(() => setDbSaveState("idle"), 3000);
    } else {
      setDbSaveState("error");
      setDbSaveErrorMsg(res.error || "Failed to save complaints to central database");
      setSupabaseActive(false);
      setSupabaseError(res.error || "Failed to sync");
    }
  };

  // Login handler
  const handleLoginSuccess = async (
    role: "admin" | "agent" | "callcenter", 
    stationCode?: string,
    officerDetails?: CallCenterOfficer
  ) => {
    const baseUserObj: UserProfile = { 
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

    let profileToUse = baseUserObj;
    try {
      const criteria = {
        role,
        station: stationCode,
        officerId: officerDetails?.id,
        userId: officerDetails?.id || (role === "admin" ? "admin-master" : stationCode ? `station-${stationCode}` : undefined),
      };
      const res = await fetchUserProfileCentral(criteria);
      if (res.success && res.data) {
        profileToUse = res.data;
      } else {
        const seedRes = await saveUserProfileCentral(baseUserObj);
        if (seedRes.success && seedRes.data) {
          profileToUse = seedRes.data;
        }
      }
    } catch (err) {
      console.error("[Login Profile Sync Error]:", err);
    }

    setCurrentUser(profileToUse);
    localStorage.setItem("ideal_group_session_identity", JSON.stringify({
      id: profileToUse.id,
      auth_user_id: profileToUse.auth_user_id,
      user_id: profileToUse.user_id || profileToUse.officerId,
      role: profileToUse.role,
      station: profileToUse.station,
      officerId: profileToUse.officerId,
    }));

    // If agent, default station filter to their station and status filter to Pending Action ("To Contact")
    if (role === "agent") {
      if (stationCode) setStationFilter(stationCode);
      setStatusFilter("To Contact");
      setCurrentTab("analytics");
    } else {
      setStationFilter("All");
      setStatusFilter("All");
    }
    // Default call center view to "1st_attempt" and switch tab to Recovery Workspace
    if (role === "callcenter") {
      setCallCenterQuickFilter("1st_attempt");
      setCurrentTab("analytics");
    }
    setSelectedComplaintId(null);
  };

  // Logout handler
  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("ideal_group_session_identity");
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

    if (selectedComplaintId === complaintId || selectedComplaintId === targetId) {
      setSelectedComplaintId(null);
    }
    setDeletingId(null);

    setDbSaveState("saving");
    setDbSaveErrorMsg(null);
    const res = await deleteComplaintCentral(targetId, targetWoNo);
    if (res.success) {
      setDbSaveState("saved");
      setLastSyncTime(new Date().toLocaleTimeString());
      setTimeout(() => setDbSaveState("idle"), 3000);
    } else {
      setDbSaveState("error");
      setDbSaveErrorMsg(res.error || "Failed to delete complaint from central database");
    }
  };

  // Clear All Complaints from Whole Database
  const handleDeleteAllComplaints = async () => {
    setComplaints([]);
    setSelectedComplaintId(null);
    setDeletingId(null);
    setShowDeleteAllConfirm(false);

    setDbSaveState("saving");
    setDbSaveErrorMsg(null);
    const res = await clearAllComplaintsCentral();
    if (res.success) {
      setDbSaveState("saved");
      setLastSyncTime(new Date().toLocaleTimeString());
      setTimeout(() => setDbSaveState("idle"), 3000);
    } else {
      setDbSaveState("error");
      setDbSaveErrorMsg(res.error || "Failed to clear complaints from central database");
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

  // Reset demo complaints data
  const handleResetDemo = async () => {
    setComplaints(DEMO_COMPLAINTS);
    setSelectedComplaintId(null);
    setShowResetConfirm(false);
    setDbSaveState("saving");
    setDbSaveErrorMsg(null);

    // Clear all then reseed
    await clearAllComplaintsCentral();
    const res = await saveComplaintsCentral(DEMO_COMPLAINTS);
    if (res.success) {
      setDbSaveState("saved");
      setSupabaseActive(true);
      setSupabaseError(null);
      setLastSyncTime(new Date().toLocaleTimeString());
      setTimeout(() => setDbSaveState("idle"), 3000);
    } else {
      setDbSaveState("error");
      setDbSaveErrorMsg(res.error || "Failed to reset demo data in central database");
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
          const isStationChanged = formAssignedStation && formAssignedStation !== c.station;
          isConnectedNow = 
            formStatus !== "Pending" && 
            formFeedbackStatus !== "Customer Unreachable" && 
            formFinalStatus !== "Unreachable";

          return {
            ...c,
            station: formAssignedStation,
            status: isStationChanged ? "Pending" as FollowUpStatus : formStatus,
            currentSatisfaction: formSatisfaction,
            notes: formNotes,
            agentName: formAgentName,
            feedbackStatus: isStationChanged ? "Pending" : formFeedbackStatus,
            finalStatus: isStationChanged ? "Open" : formFinalStatus,
            stationContactedDate: isStationChanged ? "" : (c.stationContactedDate || ""),
            stationResponseStatus: isStationChanged ? "Submitted to Call Center" : c.stationResponseStatus,
            solutionProvidedByAftermarket: formSolutionProvided,
            solutionDate: formSolutionDate,
            followUpDate: formFollowUpDate,
            updatedAt: new Date().toISOString().split("T")[0]
          };
        }
        
        if (currentUser?.role === "agent") {
          const submitDateTime = getFormattedDateTime();
          isConnectedNow = 
            formFeedbackStatus !== "Customer Unreachable" && 
            formFinalStatus !== "Unreachable";

          const isSatisfiedAgent = 
            formFeedbackStatus === "Satisfied" ||
            ["Satisfied", "Very Satisfied"].includes(formSatisfaction) ||
            ["Closed", "Completed", "Resolved"].includes(formFinalStatus) ||
            formStatus === "Resolved";

          const statHistoryEntry: CaseHistoryEntry = {
            id: "HIST-STAT-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
            timestamp: submitDateTime,
            actorName: formAgentName || `${currentUser.station} Adviser`,
            actorRole: "agent",
            action: "Station Action Logged & Submitted to Call Center",
            notes: formStationResolutionNotes,
            stationName: currentUser.station,
            newStatus: "Submitted to Call Center"
          };

          return {
            ...c,
            stationContactedDate: submitDateTime,
            stationResolutionNotes: formStationResolutionNotes,
            agentName: formAgentName || `${currentUser.station} Adviser`,
            status: isSatisfiedAgent ? ("Resolved" as FollowUpStatus) : ("Contacted" as FollowUpStatus),
            currentSatisfaction: isSatisfiedAgent ? ("Satisfied" as SatisfactionLevel) : (formSatisfaction || c.currentSatisfaction),
            callCenterFinalSatisfaction: isSatisfiedAgent ? ("Satisfied" as SatisfactionLevel) : c.callCenterFinalSatisfaction,
            stationResponseStatus: "Submitted to Call Center",
            feedbackStatus: isSatisfiedAgent ? "Satisfied" : formFeedbackStatus,
            finalStatus: isSatisfiedAgent ? "Closed" : formFinalStatus,
            solutionProvidedByAftermarket: formStationResolutionNotes, // Sync with action taken
            solutionDate: submitDateTime, // Sync with contacted date and time
            followUpDate: formFollowUpDate,
            updatedAt: new Date().toISOString(),
            caseHistory: [...(c.caseHistory || []), statHistoryEntry]
          };
        }

        if (currentUser?.role === "callcenter") {
          const submitDate = formCallCenterContactedDate ? (
            formCallCenterContactedDate.includes(" ") 
              ? formCallCenterContactedDate 
              : `${formCallCenterContactedDate} ${new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}`
          ) : getFormattedDateTime();
          const is1stAttempt = formAttemptStage === "1st Attempt";

          let calcStatus: FollowUpStatus = "Pending";
          let calcSatisfaction: SatisfactionLevel = formCallCenterFinalSatisfaction;
          let calcFeedbackStatus = formFeedbackStatus;
          let calcFinalStatus = "Open";

          // Detect if customer was satisfied during verification (1st attempt or 2nd attempt Connected/Satisfied)
          const isSatisfiedSelected = 
            ["Satisfied", "Very Satisfied"].includes(formCallCenterFinalSatisfaction) ||
            formSecondAttemptFeedbackStatus === "Satisfied" ||
            formFeedbackStatus === "Satisfied" ||
            (is1stAttempt && (formFirstAttemptCallStatus === "Satisfied" || formFirstAttemptCallStatus === "Completed")) ||
            (!is1stAttempt && (formSecondAttemptCallStatus === "Satisfied" || formSecondAttemptCallStatus === "Completed")) ||
            (!is1stAttempt && formSecondAttemptCallStatus === "Connected" && formSecondAttemptFeedbackStatus === "Satisfied") ||
            (is1stAttempt && formFirstAttemptCallStatus === "Connected" && (formFeedbackStatus === "Satisfied" || formSecondAttemptFeedbackStatus === "Satisfied"));

          if (isSatisfiedSelected) {
            calcStatus = "Resolved";
            calcSatisfaction = ["Very Satisfied", "Satisfied"].includes(formCallCenterFinalSatisfaction) ? formCallCenterFinalSatisfaction : "Satisfied";
            calcFeedbackStatus = "Satisfied";
            calcFinalStatus = "Closed";
            isConnectedNow = true;
          } else if (is1stAttempt) {
            calcFeedbackStatus = formFirstAttemptCallStatus;
            
            if (["Customer Busy", "Customer Unreachable", "No Answer"].includes(formFirstAttemptCallStatus)) {
              // 1st attempt uncontactable -> stay in recovery list, pass for 2nd attempt
              calcStatus = "Pending";
              calcSatisfaction = "Dissatisfied";
              calcFinalStatus = "Pending (2nd Attempt Required)";
              isConnectedNow = false;
            } else if (["Invalid Details", "Invalid Number"].includes(formFirstAttemptCallStatus)) {
              calcStatus = "Pending";
              calcSatisfaction = "Dissatisfied";
              calcFinalStatus = "Unreachable (Invalid Number/Details)";
              isConnectedNow = false;
            } else if (formFirstAttemptCallStatus === "Customer Not Interested" || formSecondAttemptFeedbackStatus === "Customer Not Interested") {
              calcStatus = "Pending";
              calcSatisfaction = "Dissatisfied";
              calcFeedbackStatus = "Customer Not Interested";
              calcFinalStatus = "Customer Not Interested";
              isConnectedNow = true;
            } else {
              // Connected, Follow Up Required, etc.
              isConnectedNow = true;
              calcFeedbackStatus = formSecondAttemptFeedbackStatus || formFeedbackStatus || "Follow Up Required";
              calcStatus = "Pending";
              calcSatisfaction = formCallCenterFinalSatisfaction || "Neutral";
              calcFinalStatus = "In Progress";
            }
          } else {
            // 2nd Attempt - structured process
            if (["Customer Busy", "Customer Unreachable", "No Answer", "Invalid Details", "Invalid Number"].includes(formSecondAttemptCallStatus)) {
              // After 2nd attempt customer is uncontactable -> classify as NOT SATISFIED customer base
              calcFeedbackStatus = formSecondAttemptCallStatus;
              calcStatus = "Pending";
              calcSatisfaction = "Dissatisfied"; // Classify under Not Satisfied Customer Base
              calcFinalStatus = "Unreachable (Not Satisfied Base)";
              isConnectedNow = false;
            } else if (formSecondAttemptFeedbackStatus === "Customer Unreachable") {
              calcStatus = "Pending";
              calcSatisfaction = "Dissatisfied";
              calcFinalStatus = "Unreachable (Not Satisfied Base)";
              isConnectedNow = false;
            } else if (["Not Satisfied", "No solution Received", "No Solution Received"].includes(formSecondAttemptFeedbackStatus) || ["No solution Received", "No Solution Received"].includes(formFeedbackStatus)) {
              calcStatus = "Pending";
              calcSatisfaction = "Dissatisfied";
              calcFeedbackStatus = formSecondAttemptFeedbackStatus;
              calcFinalStatus = "Re-assigned to Station (No Solution Received)";
              isConnectedNow = true;
            } else if (formSecondAttemptFeedbackStatus === "Escalated") {
              calcStatus = "Pending";
              calcSatisfaction = "Dissatisfied";
              calcFeedbackStatus = "Escalated";
              calcFinalStatus = "Escalated to Management";
              isConnectedNow = true;
            } else if (formSecondAttemptFeedbackStatus === "Customer Not Interested" || formSecondAttemptCallStatus === "Customer Not Interested") {
              calcStatus = "Pending";
              calcSatisfaction = "Dissatisfied";
              calcFeedbackStatus = "Customer Not Interested";
              calcFinalStatus = "Customer Not Interested";
              isConnectedNow = true;
            } else {
              calcFeedbackStatus = formSecondAttemptFeedbackStatus || formFeedbackStatus || "Follow Up Required";
              calcStatus = "Pending";
              calcSatisfaction = formCallCenterFinalSatisfaction || "Neutral";
              calcFinalStatus = "In Progress";
              isConnectedNow = true;
            }
          }

          const isNoSol = calcFinalStatus.includes("Re-assigned to Station");
          const defaultSatisfiedRemark = is1stAttempt 
            ? "Customer confirmed satisfied during call center 1st attempt verification"
            : "Customer confirmed satisfied during call center 2nd attempt verification";
          const finalRemarks = formCallCenterFinalRemarks.trim() || (isSatisfiedSelected ? defaultSatisfiedRemark : "");

          const ccHistoryEntry: CaseHistoryEntry = {
            id: "HIST-CC-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
            timestamp: submitDate,
            actorName: currentUser?.name || "Call Center Officer",
            actorRole: "callcenter",
            action: isSatisfiedSelected
              ? "Verified & Case Closed by Call Center"
              : `Call Center Follow-up (${formAttemptStage}): ${calcFeedbackStatus}`,
            notes: finalRemarks,
            newStatus: calcFinalStatus
          };

          const ccContactAttempt: ContactAttemptEvent = {
            id: "ATTEMPT-CC-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
            timestamp: submitDate,
            actorName: currentUser?.name || "Call Center Officer",
            actorRole: "callcenter",
            contactMethod: "Phone Call",
            outcome: is1stAttempt ? formFirstAttemptCallStatus : formSecondAttemptCallStatus,
            customerResponse: is1stAttempt 
              ? (["Connected", "Satisfied", "Follow Up Required", "Completed"].includes(formFirstAttemptCallStatus) ? formSecondAttemptFeedbackStatus : formFirstAttemptCallStatus)
              : formSecondAttemptFeedbackStatus,
            remarks: finalRemarks,
            nextFollowUpDate: formFollowUpDate
          };

          return {
            ...c,
            callCenterContactedDate: submitDate,
            callCenterFinalRemarks: finalRemarks,
            callCenterFinalSatisfaction: calcSatisfaction,
            currentSatisfaction: calcSatisfaction, // promote to main satisfaction
            status: calcStatus,
            feedbackStatus: calcFeedbackStatus,
            finalStatus: calcFinalStatus,
            stationResponseStatus: isNoSol ? "Rejected" : (c.stationResponseStatus || "Submitted to Call Center"),
            stationResponseRejectionReason: isNoSol ? `Call Center Verification: Customer reported 'No solution received'. Re-assigned to Service Station for mandatory followup. Remarks: "${finalRemarks || "No solution received"}"` : c.stationResponseRejectionReason,
            stationResponseRejectedDate: isNoSol ? submitDate : c.stationResponseRejectedDate,
            stationResponseRejectedBy: isNoSol ? (currentUser?.name || "Call Center Officer") : c.stationResponseRejectedBy,
            stationContactedDate: isNoSol ? "" : (c.stationContactedDate || ""), // clear if re-assigned so it moves back into Service Station pending queue
            attemptCount: is1stAttempt ? (c.attemptCount && c.attemptCount > 1 ? c.attemptCount : 1) : 2,
            firstAttemptCallStatus: is1stAttempt ? (isSatisfiedSelected ? (formFirstAttemptCallStatus === "Connected" ? "Connected" : "Satisfied") : formFirstAttemptCallStatus) : (c.firstAttemptCallStatus || formFirstAttemptCallStatus),
            firstAttemptDate: is1stAttempt ? submitDate : (c.firstAttemptDate || submitDate),
            firstAttemptNotes: is1stAttempt ? finalRemarks : c.firstAttemptNotes,
            secondAttemptCallStatus: !is1stAttempt ? (isSatisfiedSelected ? (formSecondAttemptCallStatus === "Connected" ? "Connected" : "Satisfied") : formSecondAttemptCallStatus) : c.secondAttemptCallStatus,
            secondAttemptFeedbackStatus: !is1stAttempt ? (isSatisfiedSelected ? "Satisfied" : (formSecondAttemptCallStatus === "Connected" ? formSecondAttemptFeedbackStatus : formSecondAttemptCallStatus)) : c.secondAttemptFeedbackStatus,
            secondAttemptDate: !is1stAttempt ? submitDate : c.secondAttemptDate,
            secondAttemptNotes: !is1stAttempt ? finalRemarks : c.secondAttemptNotes,
            solutionProvidedByAftermarket: formSolutionProvided,
            solutionDate: formSolutionDate,
            followUpDate: formFollowUpDate || submitDate,
            updatedAt: submitDate,
            caseHistory: [...(c.caseHistory || []), ccHistoryEntry],
            contactAttempts: [...(c.contactAttempts || []), ccContactAttempt]
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

  // Service Station Rejects / Returns Complaint to Call Center
  const handleStationRejectAndReturn = () => {
    if (!selectedComplaintId || !stationReturnReasonInput.trim()) return;
    const nowStr = getFormattedDateTime();
    const today = new Date().toISOString().split("T")[0];
    const targetC = complaints.find((c) => c.id === selectedComplaintId);
    if (!targetC) return;

    const historyEntry: CaseHistoryEntry = {
      id: "HIST-STAT-REJ-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      timestamp: nowStr,
      actorName: formAgentName || `${currentUser?.station || "Service Station"} Adviser`,
      actorRole: "agent",
      action: "Returned to Call Center by Service Station",
      rejectionReason: stationReturnReasonInput.trim(),
      stationName: currentUser?.station || targetC.station,
      previousStatus: targetC.status,
      newStatus: "Returned to Call Center"
    };

    const updated = complaints.map((c) => {
      if (c.id === selectedComplaintId) {
        return {
          ...c,
          stationResponseStatus: "Returned to Call Center",
          stationResponseRejectionReason: stationReturnReasonInput.trim(),
          stationResponseRejectedDate: nowStr,
          stationResponseRejectedBy: formAgentName || `${currentUser?.station || "Service Station"} Adviser`,
          status: "Pending" as FollowUpStatus,
          finalStatus: "Returned to Call Center",
          feedbackStatus: "Returned to Call Center",
          stationContactedDate: "", // clear so station queue knows it's returned
          updatedAt: today,
          caseHistory: [...(c.caseHistory || []), historyEntry]
        };
      }
      return c;
    });

    saveComplaints(updated);
    setSaveSuccess(true);
    setShowStationReturnForm(false);
    setStationReturnReasonInput("");
    setTimeout(() => setSaveSuccess(false), 3000);

    // Notify Call Center
    if (soundEnabled) {
      playCallCenterNotificationSound();
    }
    setCallCenterNotifications((prev) => [
      {
        id: "NOTIF-STAT-REJ-" + Date.now(),
        timestamp: new Date().toISOString(),
        stationName: currentUser?.station || targetC.station || "Service Station",
        complaintId: selectedComplaintId,
        customerName: targetC.customerName || "Customer",
        actionSummary: `↩️ Case Returned to Call Center by Station: "${stationReturnReasonInput.trim()}"`,
        updatedBy: formAgentName || `${currentUser?.station || "Service Station"} Adviser`,
      },
      ...prev,
    ]);
  };

  // Reject Station Response Action Handler (Call Center / Admin)
  const handleRejectStationResponse = async () => {
    if (!selectedComplaintId || !rejectionReasonInput.trim()) return;
    const nowStr = getFormattedDateTime();
    const today = new Date().toISOString().split("T")[0];
    const targetC = complaints.find((c) => c.id === selectedComplaintId);
    if (!targetC) return;

    const officerName = currentUser?.name || currentUser?.title || "Call Center Officer";
    const rejectionReason = rejectionReasonInput.trim();

    const historyEntry: CaseHistoryEntry = {
      id: "HIST-CC-REJ-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      timestamp: nowStr,
      actorName: officerName,
      actorRole: "callcenter",
      action: "Station Response Rejected by Call Center & Returned to Service Station",
      rejectionReason: rejectionReason,
      stationName: targetC?.station,
      previousStatus: targetC?.status,
      newStatus: "Returned to Service Station"
    };

    const updated = complaints.map((c) => {
      if (c.id === selectedComplaintId) {
        return {
          ...c,
          stationResponseStatus: "Returned to Service Station",
          stationResponseRejectionReason: rejectionReason,
          stationResponseRejectedDate: nowStr,
          stationResponseRejectedBy: officerName,
          status: "Pending" as FollowUpStatus,
          serviceStationContactStatus: "NOT_CONTACTED",
          feedbackStatus: "Returned to Service Station",
          finalStatus: "Pending with Aftermarket (Re-contact Required)",
          stationContactedDate: "", // Cleared so it returns to Service Station pending action queue
          callCenterContactedDate: nowStr,
          callCenterFinalRemarks: `Rejected by Call Center: ${rejectionReason}`,
          callCenterFinalSatisfaction: "" as SatisfactionLevel,
          firstAttemptCallStatus: "",
          firstAttemptDate: "",
          firstAttemptNotes: "",
          secondAttemptFeedbackStatus: "",
          secondAttemptDate: "",
          secondAttemptNotes: "",
          attemptCount: 0,
          updatedAt: new Date().toISOString(),
          caseHistory: [...(c.caseHistory || []), historyEntry]
        };
      }
      return c;
    });

    await saveComplaints(updated);

    const workflowPayload = {
      id: `WF-CC-REJ-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      complaint_id: targetC.id,
      customer_id: targetC.customerNo || null,
      customer_name: targetC.customerName,
      customer_phone: targetC.customerPhone,
      previous_status: targetC.status,
      new_status: "Returned to Service Station",
      previous_assigned_to: officerName,
      new_assigned_to: targetC.station,
      assigned_service_station: targetC.station,
      action_type: "REJECTED_BY_CALL_CENTER",
      action_reason: rejectionReason,
      remarks: rejectionReason,
      performed_by: officerName,
      performed_by_role: "callcenter",
      created_at: new Date().toISOString()
    };

    // Save workflow audit event directly to Supabase and via API
    try {
      await supabaseClient.from("complaint_workflow_history").upsert([workflowPayload]);
    } catch (err) {
      console.warn("Direct Supabase workflow insert warning:", err);
    }

    try {
      await fetch("/api/workflow-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: workflowPayload })
      });
    } catch (e) {
      console.warn("Could not save workflow history event:", e);
    }

    setSaveSuccess(true);
    setShowRejectionForm(false);
    setRejectionReasonInput("");
    setTimeout(() => setSaveSuccess(false), 3000);

    // Notify Station
    if (soundEnabled) {
      playCallCenterNotificationSound();
    }
    setCallCenterNotifications((prev) => [
      {
        id: "NOTIF-REJ-" + Date.now(),
        timestamp: new Date().toISOString(),
        stationName: targetC?.station || "Service Station",
        complaintId: selectedComplaintId,
        customerName: targetC?.customerName || "Customer",
        actionSummary: `❌ Response Rejected & Returned to Station: "${rejectionReason}"`,
        updatedBy: officerName,
      },
      ...prev,
    ]);
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

  // Pre-fill form when selected complaint changes (strictly when selecting a different complaint ID)
  const selectedComplaint = complaints.find((c) => c.id === selectedComplaintId);
  useEffect(() => {
    if (!selectedComplaintId) {
      prevSelectedComplaintIdRef.current = null;
      return;
    }

    if (selectedComplaintId !== prevSelectedComplaintIdRef.current) {
      prevSelectedComplaintIdRef.current = selectedComplaintId;
      const comp = complaints.find((c) => c.id === selectedComplaintId);
      if (comp) {
        setFormStatus(comp.status);
        setFormSatisfaction(comp.currentSatisfaction);
        setFormNotes(comp.notes || "");
        setFormAgentName(comp.agentName || (currentUser?.role === "agent" ? currentUser.station + " Agent" : ""));
        
        // Load custom fields
        setFormStationContactedDate(comp.stationContactedDate || getFormattedDateTime());
        setFormStationResolutionNotes(comp.stationResolutionNotes || "");
        setFormCallCenterContactedDate(
          comp.callCenterContactedDate 
            ? (comp.callCenterContactedDate.includes("T") ? comp.callCenterContactedDate.split("T")[0] : comp.callCenterContactedDate.split(" ")[0])
            : new Date().toISOString().split("T")[0]
        );
        setFormCallCenterFinalRemarks(comp.callCenterFinalRemarks || "");
        setFormCallCenterFinalSatisfaction(comp.callCenterFinalSatisfaction || comp.currentSatisfaction || "Neutral");
        setFormAssignedStation(comp.station || "");

        // Pre-fill multi-attempt fields
        const firstStatus = comp.firstAttemptCallStatus || "Connected";
        const secondCallStatus = comp.secondAttemptCallStatus || (comp.secondAttemptFeedbackStatus ? (["Satisfied", "Not Satisfied", "No solution Received", "Follow Up Required", "Escalated", "Customer Not Interested"].includes(comp.secondAttemptFeedbackStatus) ? "Connected" : comp.secondAttemptFeedbackStatus) : "Connected");
        const secondFeedback = comp.secondAttemptFeedbackStatus || comp.feedbackStatus || "Follow Up Required";
        setFormFirstAttemptCallStatus(firstStatus);
        setFormSecondAttemptCallStatus(secondCallStatus);
        setFormSecondAttemptFeedbackStatus(secondFeedback);

        // Auto-determine active attempt stage ONLY on initial complaint open
        if (
          comp.attemptCount === 2 ||
          comp.secondAttemptDate ||
          (comp.firstAttemptCallStatus && comp.firstAttemptCallStatus !== "" && !isComplaintCompleted(comp) && comp.status !== "Resolved")
        ) {
          setFormAttemptStage("2nd Attempt");
        } else {
          setFormAttemptStage("1st Attempt");
        }

        // Intelligent fallbacks for custom parallel status fields
        const initialFeedbackStatus = comp.feedbackStatus || (
          comp.status === "Resolved" ? "Satisfied" : "Follow Up Required"
        );
        const initialFinalStatus = comp.finalStatus || (
          comp.status === "Resolved" ? "Closed" :
          comp.status === "Contacted" ? "Solution Received" :
          comp.status === "In Progress" ? "Pending with Aftermarket" : "Open"
        );
        
        setFormFeedbackStatus(initialFeedbackStatus);
        setFormFinalStatus(initialFinalStatus);
        setFormSolutionProvided(comp.solutionProvidedByAftermarket || comp.stationResolutionNotes || "");
        setFormSolutionDate(comp.solutionDate || comp.stationContactedDate || "");
        setFormFollowUpDate(comp.followUpDate || comp.callCenterContactedDate || new Date().toISOString().split("T")[0]);
      }
    }
  }, [selectedComplaintId, complaints, currentUser]);

  if (!currentUser) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} theme={theme} toggleTheme={toggleTheme} />;
  }

  // Helper to determine if service station has contacted/actioned the customer
  const isStationContacted = (c: Complaint) => {
    if (
      c.stationResponseStatus === "Rejected" ||
      c.stationResponseStatus === "Returned to Service Station" ||
      c.stationResponseStatus === "Rejected by Call Center" ||
      c.feedbackStatus === "Returned to Service Station" ||
      c.finalStatus === "Returned to Service Station"
    ) {
      return false;
    }
    return !!(
      (c.stationContactedDate && c.stationContactedDate.trim().length > 0) ||
      c.status === "Contacted" ||
      c.stationResponseStatus === "Submitted to Call Center"
    );
  };

  // Helper to determine if a complaint is completed/resolved
  const isComplaintCompleted = (c: Complaint) => {
    return (
      c.status === "Resolved" ||
      c.feedbackStatus === "Satisfied" ||
      c.feedbackStatus === "Satisfied After Resolution" ||
      c.callCenterFinalSatisfaction === "Satisfied" ||
      c.callCenterFinalSatisfaction === "Very Satisfied" ||
      c.currentSatisfaction === "Satisfied" ||
      c.currentSatisfaction === "Very Satisfied" ||
      c.firstAttemptCallStatus === "Satisfied" ||
      c.secondAttemptCallStatus === "Satisfied" ||
      c.secondAttemptFeedbackStatus === "Satisfied" ||
      (c.secondAttemptCallStatus === "Connected" && c.secondAttemptFeedbackStatus === "Satisfied") ||
      (c.firstAttemptCallStatus === "Connected" && c.feedbackStatus === "Satisfied") ||
      c.finalStatus === "Closed" ||
      c.finalStatus === "Completed" ||
      c.finalStatus === "Resolved"
    );
  };

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
    if (currentUser.role === "agent") {
      if (statusFilter === "Rejected") {
        matchesStatus = isComplaintRejected(c);
      } else {
        matchesStatus = !isStationContacted(c);
      }
    } else if (statusFilter === "1st Attempt Required") {
      matchesStatus = isStationContacted(c) && !isComplaintRejected(c) && !isComplaintCompleted(c) && !c.callCenterFinalRemarks && (!c.firstAttemptCallStatus || c.attemptCount === 0);
    } else if (statusFilter === "2nd Attempt Required") {
      matchesStatus = isStationContacted(c) && !isComplaintRejected(c) && !isComplaintCompleted(c) && !c.callCenterFinalRemarks && (!!c.firstAttemptCallStatus || (c.attemptCount && c.attemptCount >= 1));
    } else if (statusFilter === "Rejected") {
      matchesStatus = isComplaintRejected(c);
    } else if (statusFilter === "Station Contacted (Pending/In-Progress)") {
      matchesStatus = isStationContacted(c) && !isComplaintCompleted(c);
    } else if (statusFilter === "Pending" || statusFilter === "To Contact") {
      matchesStatus = !isStationContacted(c);
    } else {
      matchesStatus = statusFilter === "All" || c.status === statusFilter;
    }

    // Category filter
    const matchesCategory = categoryFilter === "All" || c.category === categoryFilter;

    // Call Center Quick Filter (Excludes uncontacted customers by service station)
    let matchesCallCenterQuick = true;
    if (currentUser.role === "callcenter") {
      if (callCenterQuickFilter === "1st_attempt") {
        // 1st Attempt: Service station HAS contacted, Call Center 1st attempt pending, not rejected, not completed
        matchesCallCenterQuick = isStationContacted(c) && !isComplaintRejected(c) && !isComplaintCompleted(c) && !c.callCenterFinalRemarks && (!c.firstAttemptCallStatus || c.attemptCount === 0);
      } else if (callCenterQuickFilter === "2nd_attempt") {
        // 2nd Attempt: Service station HAS contacted, 1st attempt logged, needs 2nd attempt, not rejected, not completed
        matchesCallCenterQuick = isStationContacted(c) && !isComplaintRejected(c) && !isComplaintCompleted(c) && !c.callCenterFinalRemarks && (!!c.firstAttemptCallStatus || (c.attemptCount && c.attemptCount >= 1));
      } else if (callCenterQuickFilter === "rejected") {
        // Rejected List: Station response rejected by Call Center or returned
        matchesCallCenterQuick = isComplaintRejected(c);
      } else if (callCenterQuickFilter === "completed") {
        // Completed: Call Center final remarks logged or Resolved or Satisfied
        matchesCallCenterQuick = isComplaintCompleted(c) || !!c.callCenterFinalRemarks;
      } else if (callCenterQuickFilter === "all") {
        // All Station Contacted: ONLY complaints contacted by service station or rejected or completed by Call Center
        matchesCallCenterQuick = isStationContacted(c) || isComplaintRejected(c) || !!c.callCenterFinalRemarks || isComplaintCompleted(c);
      }
    }

    // Added Date Filter
    let matchesAddedDate = true;
    if (dateFilter !== "All") {
      const complaintDate = parseComplaintDate(c.date, c.createdAt);
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      if (dateFilter === "Today") {
        matchesAddedDate = complaintDate >= todayStart;
      } else if (dateFilter === "Yesterday") {
        const yesterdayStart = new Date(todayStart);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);
        const yesterdayEnd = new Date(todayStart);
        matchesAddedDate = complaintDate >= yesterdayStart && complaintDate < yesterdayEnd;
      } else if (dateFilter === "This Week") {
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        matchesAddedDate = complaintDate >= weekStart;
      } else if (dateFilter === "This Month") {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        matchesAddedDate = complaintDate >= monthStart;
      } else if (dateFilter === "Last 30 Days") {
        const thirtyDaysAgo = new Date(todayStart);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        matchesAddedDate = complaintDate >= thirtyDaysAgo;
      } else if (dateFilter === "Custom") {
        if (startDateFilter) {
          const start = new Date(startDateFilter);
          start.setHours(0, 0, 0, 0);
          if (complaintDate < start) matchesAddedDate = false;
        }
        if (endDateFilter) {
          const end = new Date(endDateFilter);
          end.setHours(23, 59, 59, 999);
          if (complaintDate > end) matchesAddedDate = false;
        }
      }
    }

    return matchesSearch && matchesStation && matchesStatus && matchesCategory && matchesCallCenterQuick && matchesAddedDate;
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
            {/* Supabase Central Sync Status Indicator */}
            <div 
              id="supabase-status-badge"
              className={`flex items-center gap-2 py-1 px-2.5 rounded-md border text-[11px] font-bold ${
                dbSaveState === "error" || supabaseActive === false
                  ? isDark
                    ? "bg-red-950/30 border-red-900/50 text-red-300"
                    : "bg-red-50 border-red-200 text-red-700"
                  : dbSaveState === "saving"
                  ? isDark
                    ? "bg-amber-950/30 border-amber-900/50 text-amber-300"
                    : "bg-amber-50 border-amber-200 text-amber-700"
                  : isDark 
                    ? "bg-emerald-950/30 border-emerald-900/40 text-emerald-300" 
                    : "bg-emerald-50 border-emerald-200 text-emerald-700"
              }`}
              title={dbSaveErrorMsg ? `Sync Issue: ${dbSaveErrorMsg}` : `Supabase Central Database: Synced at ${lastSyncTime}`}
            >
              <span className={`h-2 w-2 rounded-full ${
                dbSaveState === "error" || supabaseActive === false
                  ? "bg-red-500"
                  : dbSaveState === "saving"
                  ? "bg-amber-500 animate-ping"
                  : "bg-emerald-500 animate-pulse"
              }`} />
              <span>
                {dbSaveState === "saving"
                  ? "Saving to Supabase..."
                  : dbSaveState === "saved"
                  ? "Changes Saved to Central DB"
                  : dbSaveState === "error" || supabaseActive === false
                  ? "Supabase Error / Reconnecting..."
                  : "Supabase Central SSOT (Live)"}
              </span>
              <button
                type="button"
                onClick={refreshAllFromCentralDb}
                className="opacity-70 hover:opacity-100 transition-opacity ml-1 cursor-pointer"
                title="Force refresh all workstations from central Supabase"
              >
                <RefreshCw className="h-3 w-3" />
              </button>
            </div>

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
            {(currentUser.role === "admin" || currentUser.role === "callcenter") && (
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
                  await refreshAllFromCentralDb();
                  setIsTestingSupabase(false);
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

-- MIGRATION SCRIPT FOR EXISTING TABLES (SAFE - PRESERVES DATA)
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS "firstAttemptCallStatus" text;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS "firstAttemptDate" text;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS "firstAttemptNotes" text;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS "secondAttemptFeedbackStatus" text;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS "secondAttemptDate" text;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS "secondAttemptNotes" text;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS "attemptCount" integer DEFAULT 0;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS "stationContactedDate" text;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS "stationResolutionNotes" text;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS "callCenterContactedDate" text;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS "callCenterFinalRemarks" text;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS "callCenterFinalSatisfaction" text;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS "feedbackStatus" text;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS "finalStatus" text;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS "solutionProvidedByAftermarket" text;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS "solutionDate" text;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS "followUpDate" text;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS "woNo" text;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS "wo_no" text;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS "stationResponseStatus" text;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS "stationResponseRejectionReason" text;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS "stationResponseRejectedDate" text;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS "stationResponseRejectedBy" text;

-- REFRESH SUPABASE SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
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
          <div className="space-y-2 shrink-0">
            <div className="flex border-b border-slate-200 gap-1 overflow-x-auto items-center justify-between">
              <div className="flex gap-1 overflow-x-auto">
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

              {/* Admin & Call Center Button for SLA & Analytics Reports */}
              <button
                id="btn-call-center-sla-report"
                type="button"
                onClick={() => setShowSLAReportModal(true)}
                className="mb-1 py-1.5 px-3.5 bg-gradient-to-r from-blue-700 to-indigo-800 hover:from-blue-800 hover:to-indigo-900 text-white font-extrabold text-[11px] rounded-lg shadow-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap border border-blue-600/40"
                title="View Service Station & Call Center Analytics Reports"
              >
                <ShieldAlert className="h-3.5 w-3.5 text-amber-300" />
                <span>SLA & Analytics Reports</span>
              </button>
            </div>
          </div>
        )}

        {/* MASTER ALL COMPLAINTS LIST TAB (ADMIN VIEW) */}
        {(currentUser.role === "admin" || currentUser.role === "callcenter") && currentTab === "list" && (
          <AllComplaintsList
            complaints={complaints}
            theme={theme}
            recentlyUpdatedStatusIds={recentlyUpdatedStatusIds}
            onSelectComplaintInWorkspace={(complaintId) => {
              setSelectedComplaintId(complaintId);
              setCurrentTab("analytics");
            }}
            onEditComplaint={currentUser.role === "admin" ? (comp) => {
              setAdminEditingComplaint(comp);
              setShowAdminEditModal(true);
            } : undefined}
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
          <ReportsPanel 
            complaints={complaints} 
            theme={theme} 
            onOpenSLAReportModal={() => setShowSLAReportModal(true)} 
            onSelectComplaintInWorkspace={(complaintId) => {
              setSelectedComplaintId(complaintId);
              setCurrentTab("analytics");
            }}
            onEditComplaint={currentUser.role === "admin" ? (comp) => {
              setAdminEditingComplaint(comp);
              setShowAdminEditModal(true);
            } : undefined}
          />
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
                    
                    {/* Call Center Filter Tabs (Only showing customers contacted by Service Station) */}
                    {currentUser.role === "callcenter" && (
                      <div className="flex bg-slate-100 p-0.5 rounded-md gap-0.5 self-start w-full overflow-x-auto">
                        <button
                          type="button"
                          onClick={() => setCallCenterQuickFilter("1st_attempt")}
                          className={`flex-1 min-w-[100px] text-center py-1.5 px-2 text-[11px] font-bold rounded-md transition-all cursor-pointer whitespace-nowrap ${
                            callCenterQuickFilter === "1st_attempt"
                              ? "bg-white text-blue-700 shadow-xs border border-blue-200"
                              : "text-slate-600 hover:text-slate-800"
                          }`}
                        >
                          📞 1st Attempt ({complaints.filter(c => isStationContacted(c) && !isComplaintRejected(c) && !isComplaintCompleted(c) && !c.callCenterFinalRemarks && (!c.firstAttemptCallStatus || c.attemptCount === 0)).length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setCallCenterQuickFilter("2nd_attempt")}
                          className={`flex-1 min-w-[100px] text-center py-1.5 px-2 text-[11px] font-bold rounded-md transition-all cursor-pointer whitespace-nowrap ${
                            callCenterQuickFilter === "2nd_attempt"
                              ? "bg-white text-amber-700 shadow-xs border border-amber-200"
                              : "text-slate-600 hover:text-slate-800"
                          }`}
                        >
                          🔁 2nd Attempt ({complaints.filter(c => isStationContacted(c) && !isComplaintRejected(c) && !isComplaintCompleted(c) && !c.callCenterFinalRemarks && (!!c.firstAttemptCallStatus || (c.attemptCount && c.attemptCount >= 1))).length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setCallCenterQuickFilter("rejected")}
                          className={`flex-1 min-w-[110px] text-center py-1.5 px-2 text-[11px] font-bold rounded-md transition-all cursor-pointer whitespace-nowrap ${
                            callCenterQuickFilter === "rejected"
                              ? "bg-white text-rose-700 shadow-xs border border-rose-200 font-extrabold"
                              : "text-slate-600 hover:text-slate-800"
                          }`}
                        >
                          ↩️ Returned / Rejected ({complaints.filter(c => isComplaintRejected(c)).length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setCallCenterQuickFilter("completed")}
                          className={`flex-1 min-w-[90px] text-center py-1.5 px-2 text-[11px] font-bold rounded-md transition-all cursor-pointer whitespace-nowrap ${
                            callCenterQuickFilter === "completed"
                              ? "bg-white text-green-700 shadow-xs border border-green-200"
                              : "text-slate-600 hover:text-slate-800"
                          }`}
                        >
                          ✅ Completed ({complaints.filter(c => isComplaintCompleted(c) || !!c.callCenterFinalRemarks).length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setCallCenterQuickFilter("all")}
                          className={`flex-1 min-w-[120px] text-center py-1.5 px-2 text-[11px] font-bold rounded-md transition-all cursor-pointer whitespace-nowrap ${
                            callCenterQuickFilter === "all"
                              ? "bg-white text-slate-800 shadow-xs border border-slate-300"
                              : "text-slate-600 hover:text-slate-800"
                          }`}
                        >
                          All Station Contacted ({complaints.filter(c => isStationContacted(c) || isComplaintRejected(c) || !!c.callCenterFinalRemarks || isComplaintCompleted(c)).length})
                        </button>
                      </div>
                    )}

                    {/* Service Station Filter Tabs (Only showing pending / actionable customers for station) */}
                    {currentUser.role === "agent" && (
                      <div className="flex bg-slate-100 p-0.5 rounded-md gap-0.5 self-start w-full overflow-x-auto">
                        <button
                          type="button"
                          onClick={() => setStatusFilter("To Contact")}
                          className={`flex-1 min-w-[140px] text-center py-1.5 px-3 text-[11px] font-bold rounded-md transition-all cursor-pointer whitespace-nowrap ${
                            (statusFilter === "To Contact" || statusFilter === "Pending" || statusFilter !== "Rejected")
                              ? "bg-white text-blue-700 shadow-xs border border-blue-200 font-extrabold"
                              : "text-slate-600 hover:text-slate-800"
                          }`}
                        >
                          ⏳ Pending Station Contact ({complaints.filter(c => matchesStationCodeOrName(c.station, currentUser.station) && !isStationContacted(c)).length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setStatusFilter("Rejected")}
                          className={`flex-1 min-w-[130px] text-center py-1.5 px-3 text-[11px] font-bold rounded-md transition-all cursor-pointer whitespace-nowrap ${
                            statusFilter === "Rejected"
                              ? "bg-white text-rose-700 shadow-xs border border-rose-200 font-extrabold"
                              : "text-slate-600 hover:text-slate-800"
                          }`}
                        >
                          ❌ Rejected List ({complaints.filter(c => matchesStationCodeOrName(c.station, currentUser.station) && isComplaintRejected(c)).length})
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
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                        {(currentUser.role === "admin" || currentUser.role === "callcenter") ? (
                          <>
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

                            <div className="flex flex-col">
                              <label className="text-[10px] text-slate-500 font-bold uppercase mb-1">Follow-up Status</label>
                              <select
                                id="filter-status"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="bg-white border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-700 cursor-pointer focus:outline-none focus:border-blue-500 font-medium"
                              >
                                <option value="All">All Statuses</option>
                                <option value="To Contact">⚡ Who Has To Contact (Action Required)</option>
                                <option value="Rejected">❌ Response Rejected by Call Center</option>
                                <option value="Station Contacted (Pending/In-Progress)">⚡ Station Contacted (Pending & In Progress)</option>
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
                          </>
                        ) : (
                          <div className="sm:col-span-2 flex items-center justify-between text-xs text-slate-600 bg-blue-50/60 border border-blue-100 px-3 py-1.5 rounded-md font-medium">
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Lock Station: <strong className="text-blue-700">{currentUser.station} HQ</strong></span>
                            <span className="text-[11px] text-blue-700 font-semibold">Showing Pending Action Queue Only</span>
                          </div>
                        )}

                        {/* Added Date Filter */}
                        <div className="flex flex-col">
                          <label className="text-[10px] text-blue-600 font-bold uppercase mb-1 flex items-center justify-between">
                            <span>📅 Added Date</span>
                            {dateFilter !== "All" && (
                              <button
                                type="button"
                                onClick={() => {
                                  setDateFilter("All");
                                  setStartDateFilter("");
                                  setEndDateFilter("");
                                }}
                                className="text-[9px] text-rose-600 hover:underline cursor-pointer lowercase"
                              >
                                reset
                              </button>
                            )}
                          </label>
                          <select
                            id="filter-added-date"
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            className="bg-white border border-blue-200 rounded-md px-2 py-1 text-xs text-slate-800 font-semibold cursor-pointer focus:outline-none focus:border-blue-500"
                          >
                            <option value="All">All Dates</option>
                            <option value="Today">Today</option>
                            <option value="Yesterday">Yesterday</option>
                            <option value="This Week">This Week</option>
                            <option value="This Month">This Month</option>
                            <option value="Last 30 Days">Last 30 Days</option>
                            <option value="Custom">Custom Date Range...</option>
                          </select>
                        </div>
                      </div>

                      {/* Custom Date Range Picker */}
                      {dateFilter === "Custom" && (
                        <div className="flex items-center gap-2 bg-blue-50/70 border border-blue-200 p-2 rounded-md">
                          <div className="flex items-center gap-1.5 flex-1">
                            <label className="text-[10px] text-slate-600 font-bold whitespace-nowrap">From:</label>
                            <input
                              type="date"
                              value={startDateFilter}
                              onChange={(e) => setStartDateFilter(e.target.value)}
                              className="w-full bg-white border border-slate-300 rounded px-2 py-0.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                            />
                          </div>
                          <div className="flex items-center gap-1.5 flex-1">
                            <label className="text-[10px] text-slate-600 font-bold whitespace-nowrap">To:</label>
                            <input
                              type="date"
                              value={endDateFilter}
                              onChange={(e) => setEndDateFilter(e.target.value)}
                              className="w-full bg-white border border-slate-300 rounded px-2 py-0.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                            />
                          </div>
                        </div>
                      )}
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
                      const isUpdatedRecently = recentlyUpdatedStatusIds.has(item.id);

                      return (
                        <div
                          id={`complaint-card-${item.id}`}
                          key={item.id}
                          onClick={() => setSelectedComplaintId(item.id)}
                          className={`p-3.5 rounded-lg border transition-all duration-500 cursor-pointer select-none text-left relative overflow-hidden ${
                            isUpdatedRecently
                              ? "border-amber-400 bg-amber-50/90 dark:bg-amber-950/40 shadow-md ring-2 ring-amber-400/80 animate-pulse"
                              : isSelected 
                                ? "border-blue-500 bg-blue-50/25 shadow-sm ring-1 ring-blue-500/10" 
                                : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                          }`}
                        >
                          {isUpdatedRecently && (
                            <div className="absolute top-0 right-0 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-[9px] font-black px-2 py-0.5 rounded-bl shadow-xs flex items-center gap-1 uppercase tracking-wider animate-bounce z-10">
                              <Sparkles className="h-2.5 w-2.5" />
                              Status Updated
                            </div>
                          )}
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
                            {isStationContacted(item) && item.stationResponseStatus !== "Rejected" && !isComplaintCompleted(item) && !item.callCenterFinalRemarks && (
                              item.firstAttemptCallStatus ? (
                                <span className="inline-flex items-center text-[9px] bg-amber-100 border border-amber-300 px-2 py-0.5 rounded text-amber-800 font-extrabold uppercase">
                                  🔁 2nd Attempt Needed ({item.firstAttemptCallStatus})
                                </span>
                              ) : (
                                <span className="inline-flex items-center text-[9px] bg-blue-100 border border-blue-300 px-2 py-0.5 rounded text-blue-800 font-extrabold uppercase">
                                  📞 Call Center 1st Attempt
                                </span>
                              )
                            )}
                            {!isStationContacted(item) && (
                              <span className="inline-flex items-center text-[9px] bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-slate-500 font-bold uppercase">
                                ⏳ Station Contact Pending
                              </span>
                            )}
                            {item.stationResponseStatus === "Rejected" && (
                              <span className="inline-flex items-center text-[9px] bg-rose-100 border border-rose-300 px-2 py-0.5 rounded text-rose-800 font-black uppercase tracking-wider animate-pulse">
                                <AlertTriangle className="h-2.5 w-2.5 mr-1 text-rose-600" />
                                Response Rejected
                              </span>
                            )}
                            {item.aiAnalysis && (
                              <span className="inline-flex items-center text-[9px] bg-green-50 border border-green-200 px-2 py-0.5 rounded text-green-700 font-bold uppercase tracking-wider">
                                <Sparkles className="h-2.5 w-2.5 mr-1 text-green-600" />
                                AI Optimized
                              </span>
                            )}
                          </div>

                          {item.stationResponseStatus === "Rejected" && item.stationResponseRejectionReason && (
                            <div className="text-[11px] font-bold text-rose-800 bg-rose-50 p-2 rounded-md border border-rose-200 mt-2.5 space-y-0.5">
                              <span className="text-[9px] uppercase tracking-wider text-rose-600 font-black block">⚠️ Call Center Rejection Message:</span>
                              <p className="line-clamp-2 italic">"{item.stationResponseRejectionReason}"</p>
                            </div>
                          )}

                          <p className="text-slate-500 text-xs mt-2 text-ellipsis overflow-hidden line-clamp-2 leading-relaxed font-medium">
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
                            <div className="mt-2 flex items-center justify-end gap-1.5 flex-wrap">
                              {currentUser.role === "admin" && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAdminEditingComplaint(selectedComplaint);
                                    setShowAdminEditModal(true);
                                  }}
                                  className="text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-[10px] font-extrabold px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 shrink-0 shadow-2xs"
                                  title="Admin Master Edit all uploaded details (Name, Phone, Dates, WO No, Vehicle, Category, Notes, etc.)"
                                >
                                  <Edit3 className="h-3 w-3 text-indigo-600" />
                                  <span>Edit Details (Admin)</span>
                                </button>
                              )}

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
                          <div className={`p-1.5 text-white rounded-lg shrink-0 shadow-2xs ${
                            (selectedComplaint.status === "Resolved" || selectedComplaint.finalStatus === "Closed" || selectedComplaint.feedbackStatus === "Satisfied")
                              ? "bg-emerald-600"
                              : "bg-blue-600"
                          }`}>
                            <Clock className={`h-4 w-4 ${
                              (selectedComplaint.status === "Resolved" || selectedComplaint.finalStatus === "Closed" || selectedComplaint.feedbackStatus === "Satisfied")
                                ? ""
                                : "animate-spin-slow"
                            }`} />
                          </div>
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block flex items-center gap-1.5">
                              {(selectedComplaint.status === "Resolved" || selectedComplaint.finalStatus === "Closed" || selectedComplaint.feedbackStatus === "Satisfied") ? (
                                <>
                                  <span>Complaint Duration (Timer Frozen at Resolution)</span>
                                  <span className="text-[8px] bg-emerald-100 text-emerald-800 border border-emerald-300 font-black px-1.5 py-0.2 rounded uppercase">
                                    FROZEN
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span>Complaint Time Elapsed (Live Floating Tracker)</span>
                                  <span className="text-[8px] bg-blue-100 text-blue-800 border border-blue-300 font-bold px-1.5 py-0.2 rounded uppercase">
                                    LIVE FLOATING
                                  </span>
                                </>
                              )}
                            </span>
                            <span className="text-xs font-black text-blue-900 font-mono tracking-tight flex items-center gap-1">
                              <span>{selectedAge.days}d</span>
                              <span className="text-slate-400">:</span>
                              <span>{String(selectedAge.hours).padStart(2, "0")}h</span>
                              <span className="text-slate-400">:</span>
                              <span>{String(selectedAge.minutes).padStart(2, "0")}m</span>
                              <span className="text-slate-400">:</span>
                              <span className={(selectedComplaint.status === "Resolved" || selectedComplaint.finalStatus === "Closed" || selectedComplaint.feedbackStatus === "Satisfied") ? "text-emerald-700" : "text-blue-600 animate-pulse"}>
                                {String(selectedAge.seconds).padStart(2, "0")}s
                              </span>
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
                          {isComplaintRejected(selectedComplaint) && (
                            <div className="bg-gradient-to-r from-rose-50 via-rose-100/60 to-rose-50 border-2 border-rose-400 rounded-xl p-4 space-y-2.5 shadow-sm">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-rose-900 font-black text-xs uppercase tracking-wider">
                                  <AlertTriangle className="h-4.5 w-4.5 text-rose-600 shrink-0 animate-bounce" />
                                  <span>⚠️ Complaint Returned by Call Center to {selectedComplaint.station || "Service Station"}</span>
                                </div>
                                <span className="text-[10px] bg-rose-700 text-white font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider shadow-2xs">
                                  Re-Contact Required
                                </span>
                              </div>
                              <div className="bg-white p-3 rounded-lg border border-rose-300 shadow-2xs space-y-1.5">
                                <span className="text-[10px] font-black text-rose-800 uppercase tracking-wider block">
                                  Call Center Rejection Reason:
                                </span>
                                <p className="text-xs font-bold text-slate-800 leading-relaxed italic">
                                  "{selectedComplaint.stationResponseRejectionReason || "Response was rejected by Call Center. Please contact customer again and perform required service station follow-up."}"
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-rose-800 font-bold pt-0.5">
                                <span>📅 Rejected Date: {selectedComplaint.stationResponseRejectedDate || "Recently"}</span>
                                <span>👤 Officer: {selectedComplaint.stationResponseRejectedBy || "Call Center"}</span>
                                <span>🏢 Assigned Station: {selectedComplaint.station || currentUser.station}</span>
                              </div>
                              <div className="text-[11px] text-rose-950 font-bold bg-rose-200/80 p-2 rounded-lg text-center border border-rose-300">
                                👉 <span className="underline">Action Required</span>: Please re-contact the customer for {selectedComplaint.station || "this station"}, resolve their issue, and submit updated resolution notes below.
                              </div>
                            </div>
                          )}

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
                              placeholder="Detail how your station contacted and resolved this customer's complaint (e.g. called client again, replaced rattle bracket free-of-charge, client is happy to be verified by Call Center)..."
                              value={formStationResolutionNotes}
                              onChange={(e) => setFormStationResolutionNotes(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-md py-2 px-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 leading-relaxed resize-none font-medium"
                            />
                          </div>

                          {saveSuccess && (
                            <div className="text-green-700 text-xs font-semibold bg-green-50 p-2 rounded border border-green-200 text-center">
                              Station action logged and submitted to Call Center successfully!
                            </div>
                          )}

                          <button
                            type="submit"
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-4 rounded-md transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <Send className="h-3.5 w-3.5" />
                            <span>Save Station Action & Submit to Call Center</span>
                          </button>

                          {/* Reject / Return to Call Center Section for Service Station */}
                          <div className="mt-3 pt-3 border-t border-slate-200">
                            {!showStationReturnForm ? (
                              <button
                                type="button"
                                onClick={() => setShowStationReturnForm(true)}
                                className="text-xs font-bold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors w-full justify-center"
                              >
                                <CornerDownLeft className="h-4 w-4 text-rose-600" />
                                <span>Reject / Return Complaint to Call Center</span>
                              </button>
                            ) : (
                              <div className="bg-rose-50 border border-rose-300 p-3 rounded-lg space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-black text-rose-800 uppercase tracking-wider flex items-center gap-1">
                                    <CornerDownLeft className="h-3.5 w-3.5 text-rose-600" />
                                    Return Case to Call Center
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setShowStationReturnForm(false)}
                                    className="text-slate-500 hover:text-slate-700 text-xs font-bold cursor-pointer"
                                  >
                                    ✕ Cancel
                                  </button>
                                </div>
                                <p className="text-[11px] text-slate-600 font-medium">
                                  Enter reason why this complaint is being returned/rejected to the Call Center (e.g. wrong station assigned, customer refused station visit, out of scope).
                                </p>
                                <textarea
                                  rows={2}
                                  required
                                  value={stationReturnReasonInput}
                                  onChange={(e) => setStationReturnReasonInput(e.target.value)}
                                  placeholder="e.g. Customer brought vehicle to Rathmalana branch, not Tissamaharama. Return to Call Center for re-assignment."
                                  className="w-full bg-white border border-rose-300 rounded-md p-2 text-xs text-slate-800 focus:outline-none focus:border-rose-500 font-medium"
                                />
                                <button
                                  type="button"
                                  onClick={handleStationRejectAndReturn}
                                  disabled={!stationReturnReasonInput.trim()}
                                  className="w-full bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs py-1.5 px-3 rounded cursor-pointer transition-all shadow-xs flex items-center justify-center gap-1.5"
                                >
                                  <Send className="h-3.5 w-3.5" />
                                  Submit Rejection & Return Case to Call Center
                                </button>
                              </div>
                            )}
                          </div>
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
                              <span>Station Action Logged: <strong>{selectedComplaint.stationContactedDate || selectedComplaint.date || "N/A"}</strong></span>
                              <span>Adviser: <strong>{selectedComplaint.agentName || "Service Station Adviser"}</strong></span>
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
                            {/* Reject Station Response Section */}
                            <div className="mt-2.5 pt-2.5 border-t border-blue-200/60">
                              {(selectedComplaint.stationResponseStatus === "Rejected" || 
                                selectedComplaint.stationResponseStatus === "Returned to Service Station" || 
                                selectedComplaint.stationResponseStatus === "Rejected by Call Center") && !showRejectionForm && (
                                <div className="bg-rose-50 border border-rose-300 p-2.5 rounded-lg text-xs space-y-1.5 shadow-2xs">
                                  <div className="flex items-center justify-between">
                                    <span className="font-black text-rose-800 text-[10px] uppercase flex items-center gap-1">
                                      <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                                      Current Status: Response Rejected & Returned to Service Station
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRejectionReasonInput(selectedComplaint.stationResponseRejectionReason || "");
                                        setShowRejectionForm(true);
                                      }}
                                      className="text-[10px] font-bold text-rose-700 underline hover:text-rose-900 cursor-pointer"
                                    >
                                      Edit Rejection Note
                                    </button>
                                  </div>
                                  <p className="text-slate-800 text-[11px] font-semibold italic bg-white p-2 rounded border border-rose-200">
                                    "{selectedComplaint.stationResponseRejectionReason}"
                                  </p>
                                  <span className="text-[9px] text-slate-500 block font-bold">
                                    Rejected on {selectedComplaint.stationResponseRejectedDate} by {selectedComplaint.stationResponseRejectedBy || "Call Center"}
                                  </span>
                                </div>
                              )}

                              {selectedComplaint.stationResponseStatus === "Returned to Call Center" && !showRejectionForm && (
                                <div className="bg-amber-50 border border-amber-300 p-2.5 rounded-lg text-xs space-y-1.5 shadow-2xs">
                                  <div className="flex items-center justify-between">
                                    <span className="font-black text-amber-900 text-[10px] uppercase flex items-center gap-1">
                                      <CornerDownLeft className="h-3.5 w-3.5 text-amber-600" />
                                      Current Status: Returned to Call Center by Service Station
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRejectionReasonInput(selectedComplaint.stationResponseRejectionReason || "");
                                        setShowRejectionForm(true);
                                      }}
                                      className="text-[10px] font-bold text-amber-800 underline hover:text-amber-950 cursor-pointer"
                                    >
                                      Pass Back to Station
                                    </button>
                                  </div>
                                  <p className="text-slate-800 text-[11px] font-semibold italic bg-white p-2 rounded border border-amber-200">
                                    "{selectedComplaint.stationResponseRejectionReason}"
                                  </p>
                                  <span className="text-[9px] text-slate-500 block font-bold">
                                    Returned on {selectedComplaint.stationResponseRejectedDate} by {selectedComplaint.stationResponseRejectedBy || selectedComplaint.station}
                                  </span>
                                </div>
                              )}

                              {selectedComplaint.stationResponseStatus !== "Rejected" && 
                               selectedComplaint.stationResponseStatus !== "Returned to Service Station" && 
                               selectedComplaint.stationResponseStatus !== "Rejected by Call Center" && 
                               selectedComplaint.stationResponseStatus !== "Returned to Call Center" && 
                               !showRejectionForm && (
                                <button
                                  type="button"
                                  onClick={() => setShowRejectionForm(true)}
                                  className="text-xs font-bold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors w-full justify-center"
                                >
                                  <XCircle className="h-4 w-4 text-rose-600" />
                                  <span>Reject Station Response & Return Case to Service Station</span>
                                </button>
                              )}

                              {showRejectionForm && (
                                <div className="bg-rose-50 border border-rose-300 p-3 rounded-lg space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-black text-rose-800 uppercase tracking-wider flex items-center gap-1">
                                      <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                                      Reject Station Response / Return to Service Station
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setShowRejectionForm(false)}
                                      className="text-slate-500 hover:text-slate-700 text-xs font-bold cursor-pointer"
                                    >
                                      ✕ Cancel
                                    </button>
                                  </div>
                                  <p className="text-[11px] text-slate-600 font-medium">
                                    Enter reason why station response was rejected or what re-action is required. The service station will see this message and contact the customer again.
                                  </p>
                                  <textarea
                                    rows={2}
                                    value={rejectionReasonInput}
                                    onChange={(e) => setRejectionReasonInput(e.target.value)}
                                    placeholder="e.g. Customer stated noise persists during follow-up call. Station needs to inspect vehicle again..."
                                    className="w-full bg-white border border-rose-300 rounded-md p-2 text-xs text-slate-800 focus:outline-none focus:border-rose-500 font-medium"
                                  />
                                  <button
                                    type="button"
                                    onClick={handleRejectStationResponse}
                                    disabled={!rejectionReasonInput.trim()}
                                    className="w-full bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs py-1.5 px-3 rounded cursor-pointer transition-all shadow-xs flex items-center justify-center gap-1.5"
                                  >
                                    <Send className="h-3.5 w-3.5" />
                                    Submit Rejection & Return Case to Service Station
                                  </button>
                                </div>
                              )}
                            </div>
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
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setFormFirstAttemptCallStatus(val);
                                  if (val === "Satisfied" || val === "Completed") {
                                    setFormCallCenterFinalSatisfaction("Satisfied");
                                    setFormSecondAttemptFeedbackStatus("Satisfied");
                                    setFormFeedbackStatus("Satisfied");
                                  } else if (["Customer Busy", "Customer Unreachable", "No Answer", "Invalid Details", "Invalid Number", "Customer Not Interested"].includes(val)) {
                                    setFormSecondAttemptFeedbackStatus(val);
                                    setFormFeedbackStatus(val);
                                  }
                                }}
                                className="w-full bg-white border border-amber-300 rounded-md py-1.5 px-2.5 text-xs text-slate-800 cursor-pointer focus:outline-none focus:border-blue-500 font-bold shadow-2xs"
                              >
                                <option value="Connected">Connected</option>
                                <option value="Satisfied">Satisfied (Pass to Complete)</option>
                                <option value="Completed">Completed (Pass to Complete)</option>
                                <option value="Follow Up Required">Follow Up Required</option>
                                <option value="No Answer">No Answer</option>
                                <option value="Customer Busy">Customer Busy</option>
                                <option value="Customer Unreachable">Customer Unreachable</option>
                                <option value="Customer Not Interested">Customer Not Interested</option>
                                <option value="Invalid Details">Invalid Details</option>
                                <option value="Invalid Number">Invalid Number</option>
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

                          {/* 2nd Attempt Call Status Section */}
                          {formAttemptStage === "2nd Attempt" && (
                            <div className="bg-amber-50/60 p-3 rounded-lg border border-amber-200 space-y-2">
                              <label className="block text-[10px] font-bold text-amber-900 uppercase tracking-wider">
                                2nd Attempt Call Status *
                              </label>
                              <select
                                value={formSecondAttemptCallStatus}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setFormSecondAttemptCallStatus(val);
                                  if (val === "Satisfied" || val === "Completed") {
                                    setFormCallCenterFinalSatisfaction("Satisfied");
                                    setFormSecondAttemptFeedbackStatus("Satisfied");
                                    setFormFeedbackStatus("Satisfied");
                                  } else if (["Customer Busy", "Customer Unreachable", "No Answer", "Invalid Details", "Invalid Number", "Customer Not Interested"].includes(val)) {
                                    setFormSecondAttemptFeedbackStatus(val);
                                    setFormFeedbackStatus(val);
                                  }
                                }}
                                className="w-full bg-white border border-amber-300 rounded-md py-1.5 px-2.5 text-xs text-slate-800 cursor-pointer focus:outline-none focus:border-blue-500 font-bold shadow-2xs"
                              >
                                <option value="Connected">Connected</option>
                                <option value="Satisfied">Satisfied (Pass to Complete)</option>
                                <option value="Completed">Completed (Pass to Complete)</option>
                                <option value="Follow Up Required">Follow Up Required</option>
                                <option value="No Answer">No Answer</option>
                                <option value="Customer Busy">Customer Busy</option>
                                <option value="Customer Unreachable">Customer Unreachable</option>
                                <option value="Customer Not Interested">Customer Not Interested</option>
                                <option value="Invalid Details">Invalid Details</option>
                                <option value="Invalid Number">Invalid Number</option>
                              </select>

                              {["Customer Busy", "Customer Unreachable", "No Answer", "Invalid Details", "Invalid Number"].includes(formSecondAttemptCallStatus) && (
                                <div className="text-[11px] text-rose-800 bg-rose-100/80 p-2 rounded border border-rose-300/80 font-medium flex items-start gap-1.5">
                                  <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                                  <span>
                                    <strong>Not Satisfied Base:</strong> Customer was uncontactable after 2nd attempt. Automatically classified as Not Satisfied customer base.
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Connected Feedback Section (for 1st Attempt Connected/Follow Up or 2nd Attempt Connected/Follow Up) */}
                          {((formAttemptStage === "1st Attempt" && (["Connected", "Follow Up Required", "Satisfied", "Completed"].includes(formFirstAttemptCallStatus))) ||
                            (formAttemptStage === "2nd Attempt" && (["Connected", "Follow Up Required", "Satisfied", "Completed"].includes(formSecondAttemptCallStatus)))) && (
                            <div className="bg-blue-50/60 p-3 rounded-lg border border-blue-200 space-y-2">
                              <label className="block text-[10px] font-bold text-blue-900 uppercase tracking-wider">
                                {formAttemptStage === "2nd Attempt" ? "2nd Attempt Customer Feedback Status / Remarks *" : "1st Attempt Customer Feedback Status / Remarks *"}
                              </label>
                              <select
                                value={formSecondAttemptFeedbackStatus}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setFormSecondAttemptFeedbackStatus(val);
                                  setFormFeedbackStatus(val);
                                  if (val === "Satisfied" || val === "Completed") {
                                    setFormCallCenterFinalSatisfaction("Satisfied");
                                  } else if (["Not Satisfied", "No solution Received", "Customer Unreachable", "Escalated", "Customer Not Interested"].includes(val)) {
                                    if (formCallCenterFinalSatisfaction === "Satisfied" || formCallCenterFinalSatisfaction === "Very Satisfied") {
                                      setFormCallCenterFinalSatisfaction("Dissatisfied");
                                    }
                                  }
                                }}
                                className="w-full bg-white border border-blue-300 rounded-md py-1.5 px-2.5 text-xs text-slate-800 cursor-pointer focus:outline-none focus:border-blue-500 font-bold shadow-2xs"
                              >
                                <option value="Satisfied">Satisfied (Pass to Complete)</option>
                                <option value="Completed">Completed (Pass to Complete)</option>
                                <option value="Follow Up Required">Follow Up Required</option>
                                <option value="Not Satisfied">Not Satisfied</option>
                                <option value="No solution Received">No solution Received</option>
                                <option value="Customer Unreachable">Customer Unreachable</option>
                                <option value="Customer Not Interested">Customer Not Interested</option>
                                <option value="Escalated">Escalated</option>
                              </select>

                              {formSecondAttemptFeedbackStatus === "Customer Unreachable" && (
                                <div className="text-[11px] text-rose-800 bg-rose-100/80 p-2 rounded border border-rose-300/80 font-medium flex items-start gap-1.5">
                                  <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                                  <span>
                                    <strong>Unreachable:</strong> Customer unreachable during feedback follow-up call.
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
                                onChange={(e) => {
                                  const val = e.target.value as SatisfactionLevel;
                                  setFormCallCenterFinalSatisfaction(val);
                                  if (["Satisfied", "Very Satisfied"].includes(val)) {
                                    setFormSecondAttemptFeedbackStatus("Satisfied");
                                    setFormFeedbackStatus("Satisfied");
                                  }
                                }}
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

                          {(["Satisfied", "Very Satisfied"].includes(formCallCenterFinalSatisfaction) || formFeedbackStatus === "Satisfied" || formFirstAttemptCallStatus === "Satisfied" || formSecondAttemptCallStatus === "Satisfied" || formSecondAttemptFeedbackStatus === "Satisfied") && (
                            <div className="text-[11px] text-green-800 bg-green-100/80 p-2 rounded border border-green-300/80 font-medium flex items-center gap-1.5">
                              <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                              <span>
                                <strong>Complete Recovery:</strong> Customer confirmed satisfied. Saves and moves record directly to Completed & Resolved list (will not repeat in contact queues).
                              </span>
                            </div>
                          )}

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              Customer's Final Remark *
                            </label>
                            <textarea
                              id="callcenter-final-remarks-textarea"
                              rows={3}
                              required={!(["Satisfied", "Very Satisfied"].includes(formCallCenterFinalSatisfaction) || formSecondAttemptFeedbackStatus === "Satisfied" || formFirstAttemptCallStatus === "Satisfied" || formSecondAttemptCallStatus === "Satisfied" || formFeedbackStatus === "Satisfied")}
                              placeholder="Enter the customer's remarks and feedback details during call center follow up..."
                              value={formCallCenterFinalRemarks}
                              onChange={(e) => setFormCallCenterFinalRemarks(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-md py-2 px-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 leading-relaxed resize-none font-medium"
                            />
                          </div>

                          {saveSuccess && (
                            <div className="text-green-700 text-xs font-semibold bg-green-50 p-2 rounded border border-green-200 text-center">
                              {(["Satisfied", "Very Satisfied"].includes(formCallCenterFinalSatisfaction) || formSecondAttemptFeedbackStatus === "Satisfied")
                                ? "Call center feedback saved & marked as Completed/Resolved!"
                                : "Call center feedback logged & saved successfully!"}
                            </div>
                          )}

                          <button
                            type="submit"
                            className={`w-full text-white font-bold text-xs py-2.5 px-4 rounded-md transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5 ${
                              (["Satisfied", "Very Satisfied"].includes(formCallCenterFinalSatisfaction) || formSecondAttemptFeedbackStatus === "Satisfied" || formFirstAttemptCallStatus === "Satisfied" || formSecondAttemptCallStatus === "Satisfied" || formFeedbackStatus === "Satisfied")
                                ? "bg-green-600 hover:bg-green-700"
                                : formAttemptStage === "1st Attempt" && ["Customer Busy", "Customer Unreachable", "No Answer", "Invalid Details", "Invalid Number"].includes(formFirstAttemptCallStatus)
                                ? "bg-amber-600 hover:bg-amber-700"
                                : formAttemptStage === "2nd Attempt" && (["Customer Busy", "Customer Unreachable", "No Answer", "Invalid Details", "Invalid Number"].includes(formSecondAttemptCallStatus) || formSecondAttemptFeedbackStatus === "Customer Unreachable")
                                ? "bg-rose-600 hover:bg-rose-700"
                                : "bg-blue-600 hover:bg-blue-700"
                            }`}
                          >
                            {(["Satisfied", "Very Satisfied"].includes(formCallCenterFinalSatisfaction) || formSecondAttemptFeedbackStatus === "Satisfied" || formFirstAttemptCallStatus === "Satisfied" || formSecondAttemptCallStatus === "Satisfied" || formFeedbackStatus === "Satisfied")
                              ? "✅ Save & Pass to Complete (Resolved)"
                              : formAttemptStage === "1st Attempt" && ["Customer Busy", "Customer Unreachable", "No Answer", "Invalid Details", "Invalid Number"].includes(formFirstAttemptCallStatus)
                              ? "Save 1st Attempt & Pass to 2nd Attempt Queue"
                              : formAttemptStage === "2nd Attempt" && (["Customer Busy", "Customer Unreachable", "No Answer", "Invalid Details", "Invalid Number"].includes(formSecondAttemptCallStatus) || formSecondAttemptFeedbackStatus === "Customer Unreachable")
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

                      {/* Case History Lifecycle Timeline */}
                      <CaseHistoryTimeline complaint={selectedComplaint} />

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


      {/* Call Center SLA & Aging Report Modal */}
      {showSLAReportModal && (
        <CallCenterSLAReportModal
          isOpen={showSLAReportModal}
          onClose={() => setShowSLAReportModal(false)}
          complaints={complaints}
          theme={theme}
          onSelectComplaint={(id) => {
            setSelectedComplaintId(id);
            setCurrentTab("analytics");
          }}
        />
      )}

      {/* Admin Master Edit Complaint Modal */}
      {currentUser.role === "admin" && adminEditingComplaint && showAdminEditModal && (
        <AdminEditComplaintModal
          complaint={adminEditingComplaint}
          isOpen={showAdminEditModal}
          onClose={() => setShowAdminEditModal(false)}
          onSave={handleAdminSaveComplaint}
        />
      )}

      {/* Unified Footer: Signature & Theme Switcher */}
      <footer className="shrink-0 mt-8 mb-6 flex flex-col items-center gap-3 text-center border-t pt-6 border-slate-200/30 dark:border-slate-800/30">
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
