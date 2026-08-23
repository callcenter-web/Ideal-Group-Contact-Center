import { createClient, SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";
import { 
  Complaint, 
  UserProfile, 
  WorkstationCalendarDate, 
  CallCenterOfficer, 
  StationProfile, 
  SystemicEmailLog 
} from "../types";
import { 
  sanitizeComplaintForSupabase, 
  normalizeComplaintFromSupabase, 
  performResilientSupabaseUpsert,
  mergeComplaintObjects
} from "./supabaseSanitizer";

export const SUPABASE_URL = "https://qsistbvaukxuwebqupiy.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_Npa3x5SHHp65jinonZFnKA_56lBMOQb";

// Create shared client-side Supabase client instance (Anon key only)
export const centralSupabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

/**
 * Deterministic UUID generator for stable user_profiles primary keys.
 * Generates a stable UUID based on a string (e.g. user_id or officer ID or email).
 */
export function stringToStableUuid(str: string): string {
  const clean = (str || "admin-master").trim().toLowerCase();
  let hash1 = 0x811c9dc5;
  let hash2 = 0x41c64e6d;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean.charCodeAt(i);
    hash1 = (hash1 ^ ch) * 0x01000193;
    hash2 = (hash2 ^ (ch << 1)) * 0x5bd1e995;
  }
  const hex1 = (hash1 >>> 0).toString(16).padStart(8, "0");
  const hex2 = (hash2 >>> 0).toString(16).padStart(8, "0");
  const hexCombined = (hex1 + hex2 + hex1 + hex2).substring(0, 32);

  return [
    hexCombined.substring(0, 8),
    hexCombined.substring(8, 12),
    "4" + hexCombined.substring(13, 16),
    ((parseInt(hexCombined.substring(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, "0") + hexCombined.substring(18, 20),
    hexCombined.substring(20, 32),
  ].join("-");
}

export interface SyncResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

// -------------------------------------------------------------
// COMPLAINTS CENTRAL DATABASE OPERATIONS
// -------------------------------------------------------------

export async function fetchComplaintsCentral(): Promise<SyncResponse<Complaint[]>> {
  try {
    const { data, error } = await centralSupabase
      .from("complaints")
      .select("*")
      .order("date", { ascending: false });

    if (error) {
      console.error("[Central DB] Fetch complaints error:", error);
      return { success: false, error: error.message, code: error.code };
    }

    const normalized = (data || []).map((row: any) => normalizeComplaintFromSupabase(row) as Complaint);
    return { success: true, data: normalized };
  } catch (err: any) {
    console.error("[Central DB] Fetch complaints exception:", err);
    return { success: false, error: err.message || "Network error fetching complaints" };
  }
}

export async function saveComplaintsCentral(complaints: Complaint[]): Promise<SyncResponse<Complaint[]>> {
  try {
    if (!complaints || complaints.length === 0) {
      return { success: true, data: [] };
    }

    const { error, strippedColumns } = await performResilientSupabaseUpsert(centralSupabase, complaints);

    if (error) {
      console.error("[Central DB] Save complaints error:", error);
      return { success: false, error: error.message, code: error.code };
    }

    return { success: true, data: complaints };
  } catch (err: any) {
    console.error("[Central DB] Save complaints exception:", err);
    return { success: false, error: err.message || "Network error saving complaints" };
  }
}

export async function deleteComplaintCentral(id: string, woNo?: string): Promise<SyncResponse> {
  try {
    const conditions: string[] = [];
    if (id) {
      conditions.push(`id.eq.${id}`);
      conditions.push(`woNo.eq.${id}`);
      conditions.push(`wo_no.eq.${id}`);
    }
    if (woNo) {
      conditions.push(`id.eq.${woNo}`);
      conditions.push(`woNo.eq.${woNo}`);
      conditions.push(`wo_no.eq.${woNo}`);
      conditions.push(`id.eq.COMP-${woNo}`);
    }

    if (conditions.length === 0) {
      return { success: false, error: "No ID or WO number specified for deletion" };
    }

    const { error } = await centralSupabase
      .from("complaints")
      .delete()
      .or(conditions.join(","));

    if (error) {
      console.error("[Central DB] Delete complaint error:", error);
      return { success: false, error: error.message, code: error.code };
    }

    return { success: true };
  } catch (err: any) {
    console.error("[Central DB] Delete complaint exception:", err);
    return { success: false, error: err.message || "Failed to delete complaint from database" };
  }
}

export async function clearAllComplaintsCentral(): Promise<SyncResponse> {
  try {
    const { error } = await centralSupabase
      .from("complaints")
      .delete()
      .neq("id", "FORCE_NONE_MATCHING_ID");

    if (error) {
      console.error("[Central DB] Clear all complaints error:", error);
      return { success: false, error: error.message, code: error.code };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to clear complaints" };
  }
}

// -------------------------------------------------------------
// WORKSTATION CALENDAR CENTRAL DATABASE OPERATIONS
// -------------------------------------------------------------

export async function fetchCalendarCentral(): Promise<SyncResponse<WorkstationCalendarDate[]>> {
  try {
    const { data, error } = await centralSupabase
      .from("workstation_calendar")
      .select("*")
      .order("date", { ascending: true });

    if (error) {
      console.error("[Central DB] Fetch calendar error:", error);
      return { success: false, error: error.message, code: error.code };
    }

    const formatted: WorkstationCalendarDate[] = (data || []).map((row: any) => ({
      id: row.id,
      station: row.station || "All",
      date: row.date,
      type: row.type || "off_day",
      reason: row.reason || "",
      createdAt: row.createdAt || row.created_at || new Date().toISOString(),
      createdBy: row.createdBy || row.created_by || "System Admin",
    }));

    return { success: true, data: formatted };
  } catch (err: any) {
    console.error("[Central DB] Fetch calendar exception:", err);
    return { success: false, error: err.message || "Network error fetching calendar" };
  }
}

export async function saveCalendarDateCentral(entry: WorkstationCalendarDate): Promise<SyncResponse<WorkstationCalendarDate>> {
  try {
    const stationSlug = (entry.station || "All").trim().toLowerCase().replace(/[^a-z0-9]/g, "-");
    const stableId = entry.id || `cal-${stationSlug}-${entry.date}`;

    const row = {
      id: stableId,
      station: entry.station || "All",
      date: entry.date,
      type: entry.type,
      reason: entry.reason || "",
      createdAt: entry.createdAt || new Date().toISOString(),
      createdBy: entry.createdBy || "System Admin",
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await centralSupabase
      .from("workstation_calendar")
      .upsert([row], { onConflict: "id" })
      .select();

    if (error) {
      console.error("[Central DB] Save calendar date error:", error);
      return { success: false, error: error.message, code: error.code };
    }

    return { success: true, data: entry };
  } catch (err: any) {
    console.error("[Central DB] Save calendar date exception:", err);
    return { success: false, error: err.message || "Failed to save calendar date" };
  }
}

export async function deleteCalendarDateCentral(id: string): Promise<SyncResponse> {
  try {
    const { error } = await centralSupabase
      .from("workstation_calendar")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[Central DB] Delete calendar date error:", error);
      return { success: false, error: error.message, code: error.code };
    }

    return { success: true };
  } catch (err: any) {
    console.error("[Central DB] Delete calendar date exception:", err);
    return { success: false, error: err.message || "Failed to delete calendar date" };
  }
}

// -------------------------------------------------------------
// USER PROFILES CENTRAL DATABASE OPERATIONS
// -------------------------------------------------------------

/**
 * Normalizes a database row from public.user_profiles into a frontend UserProfile
 */
export function normalizeUserProfileFromSupabase(row: any): UserProfile {
  if (!row || typeof row !== "object") return null as any;

  const prefs = (row.communication_preferences && typeof row.communication_preferences === "object")
    ? row.communication_preferences
    : { email: true, sms: true };

  const perms = (row.working_permissions && typeof row.working_permissions === "object")
    ? row.working_permissions
    : {};

  const role = (row.role === "admin" || row.role === "agent" || row.role === "callcenter")
    ? row.role
    : "callcenter";

  const defaultTitle = role === "admin" 
    ? "National CX Director" 
    : role === "callcenter" 
    ? "Call Center CX Specialist" 
    : "Service Station Representative";

  return {
    id: row.id,
    auth_user_id: row.auth_user_id || null,
    user_id: row.user_id || "",
    role,
    name: row.display_name || "",
    title: perms.title || defaultTitle,
    email: row.email || "",
    phone: row.phone || "",
    station: row.station || undefined,
    officerId: (role === "callcenter" ? row.user_id : undefined) || perms.officerId || undefined,
    avatar: row.avatar || "",
    department: row.department || (role === "callcenter" ? "Ideal Central Call Center" : role === "admin" ? "National CX Command Center" : "Service Station HQ"),
    communication_preferences: prefs,
    working_permissions: perms,
    emergency_hotline: row.emergency_hotline || null,
    backup_contact_name: row.backup_contact_name || null,
    backup_contact_phone: row.backup_contact_phone || null,
    active: row.active ?? true,
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_updated_by: row.last_updated_by || null,
  };
}

/**
 * Converts a UserProfile into a database row for public.user_profiles
 */
export function userProfileToSupabaseRow(profile: UserProfile, authUserId?: string | null): Record<string, any> {
  const userIdKey = profile.user_id || profile.officerId || (
    profile.role === "admin" ? "admin-master" : profile.station ? `station-${profile.station}` : "user-default"
  );
  const stableUuid = profile.id || stringToStableUuid(userIdKey);

  const perms = {
    ...(profile.working_permissions || {}),
    title: profile.title || "",
    officerId: profile.officerId || "",
  };

  const prefs = profile.communication_preferences || { email: true, sms: true };

  return {
    id: stableUuid,
    auth_user_id: authUserId || profile.auth_user_id || null,
    user_id: userIdKey,
    display_name: profile.name || "",
    email: profile.email || "",
    phone: profile.phone || "",
    role: profile.role || "callcenter",
    station: profile.station || null,
    department: profile.department || "",
    communication_preferences: prefs,
    working_permissions: perms,
    emergency_hotline: profile.emergency_hotline || null,
    backup_contact_name: profile.backup_contact_name || null,
    backup_contact_phone: profile.backup_contact_phone || null,
    avatar: profile.avatar || "",
    active: profile.active ?? true,
    updated_at: new Date().toISOString(),
    last_updated_by: profile.name || "User",
  };
}

export async function fetchUserProfilesCentral(): Promise<SyncResponse<UserProfile[]>> {
  try {
    const { data, error } = await centralSupabase
      .from("user_profiles")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[Central DB] Fetch user profiles error:", error);
      return { success: false, error: error.message, code: error.code };
    }

    const normalized = (data || []).map((row: any) => normalizeUserProfileFromSupabase(row));
    return { success: true, data: normalized };
  } catch (err: any) {
    console.error("[Central DB] Fetch user profiles exception:", err);
    return { success: false, error: err.message || "Failed to fetch user profiles" };
  }
}

/**
 * Loads a single authoritative user profile from public.user_profiles in Supabase.
 * Checks authenticated user first via auth.getUser(), then queries by auth_user_id, id, user_id, or role.
 */
export async function fetchUserProfileCentral(criteria?: {
  id?: string;
  authUserId?: string | null;
  userId?: string;
  role?: string;
  station?: string;
  officerId?: string;
}): Promise<SyncResponse<UserProfile>> {
  try {
    // 1. Try authenticated Supabase user first
    try {
      const { data: authData } = await centralSupabase.auth.getUser();
      if (authData?.user?.id) {
        const { data: authProfile, error: authProfileErr } = await centralSupabase
          .from("user_profiles")
          .select("*")
          .eq("auth_user_id", authData.user.id)
          .maybeSingle();

        if (!authProfileErr && authProfile) {
          return { success: true, data: normalizeUserProfileFromSupabase(authProfile) };
        }
      }
    } catch (authErr) {
      // Non-blocking if auth is not active
    }

    // 2. Query by specific criteria
    if (criteria?.id) {
      const { data, error } = await centralSupabase
        .from("user_profiles")
        .select("*")
        .eq("id", criteria.id)
        .maybeSingle();

      if (!error && data) {
        return { success: true, data: normalizeUserProfileFromSupabase(data) };
      }
    }

    if (criteria?.authUserId) {
      const { data, error } = await centralSupabase
        .from("user_profiles")
        .select("*")
        .eq("auth_user_id", criteria.authUserId)
        .maybeSingle();

      if (!error && data) {
        return { success: true, data: normalizeUserProfileFromSupabase(data) };
      }
    }

    const targetUserIdKey = criteria?.userId || criteria?.officerId || (
      criteria?.role === "admin" ? "admin-master" : criteria?.station ? `station-${criteria.station}` : undefined
    );

    if (targetUserIdKey) {
      const { data, error } = await centralSupabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", targetUserIdKey)
        .maybeSingle();

      if (!error && data) {
        return { success: true, data: normalizeUserProfileFromSupabase(data) };
      }
    }

    if (criteria?.role === "admin") {
      const { data, error } = await centralSupabase
        .from("user_profiles")
        .select("*")
        .eq("role", "admin")
        .maybeSingle();

      if (!error && data) {
        return { success: true, data: normalizeUserProfileFromSupabase(data) };
      }
    }

    if (criteria?.role === "agent" && criteria?.station) {
      const { data, error } = await centralSupabase
        .from("user_profiles")
        .select("*")
        .eq("station", criteria.station)
        .maybeSingle();

      if (!error && data) {
        return { success: true, data: normalizeUserProfileFromSupabase(data) };
      }
    }

    return { success: false, error: "Profile not found in central database" };
  } catch (err: any) {
    console.error("[Central DB] Fetch user profile exception:", err);
    return { success: false, error: err.message || "Failed to fetch user profile" };
  }
}

/**
 * Saves a user profile to public.user_profiles in Supabase.
 * Returns the exact database record confirmed by Supabase.
 */
export async function saveUserProfileCentral(profile: UserProfile): Promise<SyncResponse<UserProfile>> {
  try {
    let authUserId: string | null = profile.auth_user_id || null;
    try {
      const { data: authData } = await centralSupabase.auth.getUser();
      if (authData?.user?.id) {
        authUserId = authData.user.id;
      }
    } catch {
      // ignore
    }

    const row = userProfileToSupabaseRow(profile, authUserId);

    const { data, error } = await centralSupabase
      .from("user_profiles")
      .upsert([row], { onConflict: "id" })
      .select()
      .single();

    if (error) {
      console.error("[Central DB] Save user profile error:", error);
      return { success: false, error: error.message, code: error.code };
    }

    const savedProfile = normalizeUserProfileFromSupabase(data);
    console.log("✅ [Central DB] Profile successfully saved to public.user_profiles in Supabase:", savedProfile);
    return { success: true, data: savedProfile };
  } catch (err: any) {
    console.error("[Central DB] Save user profile exception:", err);
    return { success: false, error: err.message || "Failed to save user profile" };
  }
}

// -------------------------------------------------------------
// STATIONS & OFFICERS CENTRAL DATABASE OPERATIONS
// -------------------------------------------------------------

export async function fetchStationsCentral(): Promise<SyncResponse<StationProfile[]>> {
  try {
    const { data, error } = await centralSupabase
      .from("stations")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.error("[Central DB] Fetch stations error:", error);
      return { success: false, error: error.message, code: error.code };
    }

    const stations: StationProfile[] = (data || []).map((row: any) => ({
      code: row.code,
      name: row.name,
      passwordHash: row.password_hash || row.passwordHash || "ideal123",
      managerName: row.manager_name || row.managerName || "",
      email: row.email || "",
      phone: row.phone || "",
      address: row.address || "",
    }));

    return { success: true, data: stations };
  } catch (err: any) {
    console.error("[Central DB] Fetch stations exception:", err);
    return { success: false, error: err.message || "Failed to fetch stations" };
  }
}

export async function saveStationsCentral(stations: StationProfile[]): Promise<SyncResponse<StationProfile[]>> {
  try {
    const rows = stations.map((s) => ({
      code: s.code,
      name: s.name,
      manager_name: s.managerName || null,
      email: s.email || null,
      phone: s.phone || null,
      active: true,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await centralSupabase
      .from("stations")
      .upsert(rows, { onConflict: "code" });

    if (error) {
      console.error("[Central DB] Save stations error:", error);
      return { success: false, error: error.message, code: error.code };
    }

    return { success: true, data: stations };
  } catch (err: any) {
    console.error("[Central DB] Save stations exception:", err);
    return { success: false, error: err.message || "Failed to save stations" };
  }
}

export async function fetchOfficersCentral(): Promise<SyncResponse<CallCenterOfficer[]>> {
  try {
    const { data, error } = await centralSupabase
      .from("call_center_officers")
      .select("*")
      .order("id", { ascending: true });

    if (error) {
      console.error("[Central DB] Fetch officers error:", error);
      return { success: false, error: error.message, code: error.code };
    }

    const officers: CallCenterOfficer[] = (data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      title: row.title || "Call Center Executive",
      email: row.email || "",
      phone: row.phone || "",
      avatar: row.avatar || "",
      department: row.department || "Ideal Motors Central CX Call Center",
      passwordHash: row.password_hash || row.passwordHash || "callcenter123",
    }));

    return { success: true, data: officers };
  } catch (err: any) {
    console.error("[Central DB] Fetch officers exception:", err);
    return { success: false, error: err.message || "Failed to fetch officers" };
  }
}

export async function saveOfficersCentral(officers: CallCenterOfficer[]): Promise<SyncResponse<CallCenterOfficer[]>> {
  try {
    const rows = officers.map((o) => ({
      id: o.id,
      name: o.name,
      title: o.title,
      email: o.email,
      phone: o.phone,
      avatar: o.avatar || null,
      department: o.department,
      role: "Call Center Executive",
      active: true,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await centralSupabase
      .from("call_center_officers")
      .upsert(rows, { onConflict: "id" });

    if (error) {
      console.error("[Central DB] Save officers error:", error);
      return { success: false, error: error.message, code: error.code };
    }

    return { success: true, data: officers };
  } catch (err: any) {
    console.error("[Central DB] Save officers exception:", err);
    return { success: false, error: err.message || "Failed to save officers" };
  }
}

// -------------------------------------------------------------
// SYSTEMIC EMAIL LOGS CENTRAL DATABASE OPERATIONS
// -------------------------------------------------------------

export async function fetchEmailLogsCentral(): Promise<SyncResponse<SystemicEmailLog[]>> {
  try {
    const { data, error } = await centralSupabase
      .from("systemic_email_logs")
      .select("*")
      .order("sentAt", { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function saveEmailLogsCentral(logs: SystemicEmailLog[]): Promise<SyncResponse> {
  try {
    if (!logs || logs.length === 0) return { success: true };

    const rows = logs.map((l) => ({
      id: l.id,
      sentAt: l.sentAt,
      recipients: l.recipients,
      subject: l.subject,
      complaintIds: l.complaintIds,
      status: l.status || "Delivered",
      created_at: new Date().toISOString(),
    }));

    const { error } = await centralSupabase
      .from("systemic_email_logs")
      .upsert(rows, { onConflict: "id" });

    if (error) {
      console.warn("[Central DB] Save email logs warning:", error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// -------------------------------------------------------------
// COMPLAINT WORKFLOW HISTORY CENTRAL OPERATIONS
// -------------------------------------------------------------

export async function recordWorkflowHistoryCentral(entry: {
  complaint_id: string;
  previous_status?: string;
  new_status?: string;
  action_type: string;
  action_reason?: string;
  remarks?: string;
  performed_by: string;
}): Promise<SyncResponse> {
  try {
    const row = {
      id: `WF-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      complaint_id: entry.complaint_id,
      previous_status: entry.previous_status || null,
      new_status: entry.new_status || null,
      action_type: entry.action_type,
      action_reason: entry.action_reason || null,
      remarks: entry.remarks || null,
      performed_by: entry.performed_by,
      created_at: new Date().toISOString(),
    };

    const { error } = await centralSupabase
      .from("complaint_workflow_history")
      .upsert([row], { onConflict: "id" });

    if (error) {
      console.warn("[Central DB] Record workflow history error:", error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// -------------------------------------------------------------
// CENTRAL REALTIME SUBSCRIPTION MULTI-TABLE HANDLER
// -------------------------------------------------------------

export interface RealtimeHandlers {
  onComplaintsChange?: (payload: { eventType: "INSERT" | "UPDATE" | "DELETE"; new: any; old: any }) => void;
  onCalendarChange?: (payload: { eventType: "INSERT" | "UPDATE" | "DELETE"; new: any; old: any }) => void;
  onUserProfilesChange?: (payload: { eventType: "INSERT" | "UPDATE" | "DELETE"; new: any; old: any }) => void;
  onStationsChange?: (payload: { eventType: "INSERT" | "UPDATE" | "DELETE"; new: any; old: any }) => void;
  onOfficersChange?: (payload: { eventType: "INSERT" | "UPDATE" | "DELETE"; new: any; old: any }) => void;
  onEmailLogsChange?: (payload: { eventType: "INSERT" | "UPDATE" | "DELETE"; new: any; old: any }) => void;
}

export function subscribeToCentralRealtime(handlers: RealtimeHandlers): RealtimeChannel {
  const channelName = `central-sync-room-${Date.now()}`;
  const channel = centralSupabase.channel(channelName);

  // 1. Complaints table
  if (handlers.onComplaintsChange) {
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "complaints" },
      (payload) => {
        handlers.onComplaintsChange?.({
          eventType: payload.eventType as any,
          new: payload.new,
          old: payload.old,
        });
      }
    );
  }

  // 2. Workstation Calendar table
  if (handlers.onCalendarChange) {
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "workstation_calendar" },
      (payload) => {
        handlers.onCalendarChange?.({
          eventType: payload.eventType as any,
          new: payload.new,
          old: payload.old,
        });
      }
    );
  }

  // 3. User Profiles table
  if (handlers.onUserProfilesChange) {
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "user_profiles" },
      (payload) => {
        handlers.onUserProfilesChange?.({
          eventType: payload.eventType as any,
          new: payload.new,
          old: payload.old,
        });
      }
    );
  }

  // 4. Stations table
  if (handlers.onStationsChange) {
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "stations" },
      (payload) => {
        handlers.onStationsChange?.({
          eventType: payload.eventType as any,
          new: payload.new,
          old: payload.old,
        });
      }
    );
  }

  // 5. Call Center Officers table
  if (handlers.onOfficersChange) {
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "call_center_officers" },
      (payload) => {
        handlers.onOfficersChange?.({
          eventType: payload.eventType as any,
          new: payload.new,
          old: payload.old,
        });
      }
    );
  }

  // 6. Systemic Email Logs table
  if (handlers.onEmailLogsChange) {
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "systemic_email_logs" },
      (payload) => {
        handlers.onEmailLogsChange?.({
          eventType: payload.eventType as any,
          new: payload.new,
          old: payload.old,
        });
      }
    );
  }

  channel.subscribe((status) => {
    console.log(`[Central DB Realtime] Subscription status for ${channelName}:`, status);
  });

  return channel;
}
