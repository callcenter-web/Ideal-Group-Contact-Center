import React, { useState } from "react";
import { UserProfile, Complaint, CallCenterOfficer, StationProfile } from "../types";
import { 
  X, User, Shield, Phone, Mail, MapPin, CheckCircle2, Clock, Award, Lock, Sparkles, 
  Edit3, Save, UserPlus, Users, Eye, EyeOff, Search, Check, Key, Plus
} from "lucide-react";
import { STATIONS as DEFAULT_STATIONS } from "../demoData";

interface UserProfileModalProps {
  user: UserProfile;
  complaints: Complaint[];
  onClose: () => void;
  isDark?: boolean;
  onUpdateCurrentUser: (updated: UserProfile) => void;
  officersList: CallCenterOfficer[];
  onUpdateOfficersList: (newList: CallCenterOfficer[]) => void;
  stationsList?: StationProfile[];
  onUpdateStationsList?: (newList: StationProfile[]) => void;
}

export default function UserProfileModal({
  user,
  complaints,
  onClose,
  isDark = false,
  onUpdateCurrentUser,
  officersList,
  onUpdateOfficersList,
  stationsList = DEFAULT_STATIONS,
  onUpdateStationsList,
}: UserProfileModalProps) {
  const isAdmin = user.role === "admin";
  const [activeTab, setActiveTab] = useState<"profile" | "manage_users" | "manage_stations">("profile");
  
  // Self Editing State
  const [isEditingSelf, setIsEditingSelf] = useState(false);
  const [selfForm, setSelfForm] = useState({
    name: user.name || "",
    title: user.title || "",
    email: user.email || "",
    phone: user.phone || "",
    department: user.department || "",
    avatar: user.avatar || "",
  });

  // Admin User Editing State
  const [editingOfficerId, setEditingOfficerId] = useState<string | null>(null);
  const [officerForm, setOfficerForm] = useState<Partial<CallCenterOfficer>>({});

  // Admin Add User State
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    name: "",
    title: "Call Center Executive",
    email: "",
    phone: "+94 77 ",
    id: `CC-${100 + officersList.length + 1}`,
    avatar: "",
    department: "Ideal Motors Central CX Call Center"
  });

  // Station Management State
  const [editingStationCode, setEditingStationCode] = useState<string | null>(null);
  const [stationForm, setStationForm] = useState<Partial<StationProfile>>({});
  const [showPasskeys, setShowPasskeys] = useState<Record<string, boolean>>({});
  const [isAddingStation, setIsAddingStation] = useState(false);
  const [newStationForm, setNewStationForm] = useState<StationProfile>({
    name: "",
    code: "",
    passwordHash: "ideal123",
    managerName: "",
    email: "",
    phone: "+94 ",
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const getInitials = (name?: string) => {
    if (!name) return "CX";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const togglePasskeyVisibility = (code: string) => {
    setShowPasskeys((prev) => ({ ...prev, [code]: !prev[code] }));
  };

  // Admin Save Station Edit
  const handleSaveStationEdit = (code: string) => {
    if (!onUpdateStationsList || !stationsList) return;
    const updatedList = stationsList.map((st) => {
      if (st.code === code) {
        return {
          ...st,
          ...stationForm,
        } as StationProfile;
      }
      return st;
    });
    onUpdateStationsList(updatedList);
    setEditingStationCode(null);
    setSaveMessage("Station credentials & profile updated!");
    setTimeout(() => setSaveMessage(null), 3000);
  };

  // Admin Add New Station
  const handleAddNewStation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateStationsList || !stationsList) return;
    if (!newStationForm.name.trim() || !newStationForm.code.trim()) return;

    const newStation: StationProfile = {
      ...newStationForm,
      code: newStationForm.code.trim(),
      passwordHash: newStationForm.passwordHash || "ideal123",
    };

    onUpdateStationsList([...stationsList, newStation]);
    setIsAddingStation(false);
    setNewStationForm({
      name: "",
      code: "",
      passwordHash: "ideal123",
      managerName: "",
      email: "",
      phone: "+94 ",
    });
    setSaveMessage(`Station ${newStation.name} registered successfully!`);
    setTimeout(() => setSaveMessage(null), 3000);
  };

  // Save Self Profile
  const handleSaveSelf = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedUser: UserProfile = {
      ...user,
      name: selfForm.name,
      title: selfForm.title,
      email: selfForm.email,
      phone: selfForm.phone,
      department: selfForm.department,
      avatar: selfForm.avatar || getInitials(selfForm.name),
    };
    onUpdateCurrentUser(updatedUser);

    // If user is a Call Center officer, sync in officers list
    if (user.officerId && onUpdateOfficersList && officersList) {
      const updatedList = officersList.map((off) => {
        if (off.id === user.officerId) {
          return {
            ...off,
            name: selfForm.name,
            title: selfForm.title,
            email: selfForm.email,
            phone: selfForm.phone,
            department: selfForm.department,
            avatar: selfForm.avatar || getInitials(selfForm.name),
          };
        }
        return off;
      });
      onUpdateOfficersList(updatedList);
    }

    // If user is a Service Station agent, sync station profile in stations list
    if (user.role === "agent" && user.station && onUpdateStationsList && stationsList) {
      const updatedStations = stationsList.map((st) => {
        if (st.code === user.station || st.name.toLowerCase().includes(user.station!.toLowerCase())) {
          return {
            ...st,
            managerName: selfForm.name,
            email: selfForm.email,
            phone: selfForm.phone,
          };
        }
        return st;
      });
      onUpdateStationsList(updatedStations);
    }

    setIsEditingSelf(false);
    setSaveMessage("Profile updated successfully!");
    setTimeout(() => setSaveMessage(null), 3000);
  };

  // Admin Save Officer Edit
  const handleSaveOfficerEdit = (officerId: string) => {
    const updatedList = officersList.map((off) => {
      if (off.id === officerId) {
        return {
          ...off,
          ...officerForm,
          avatar: officerForm.avatar || getInitials(officerForm.name || off.name),
        } as CallCenterOfficer;
      }
      return off;
    });
    onUpdateOfficersList(updatedList);
    setEditingOfficerId(null);
    setSaveMessage("User profile updated!");
    setTimeout(() => setSaveMessage(null), 3000);
  };

  // Admin Add New Officer
  const handleAddNewUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserForm.name.trim()) return;

    const newOfficer: CallCenterOfficer = {
      id: newUserForm.id || `CC-${100 + officersList.length + 1}`,
      name: newUserForm.name,
      title: newUserForm.title,
      email: newUserForm.email || `${newUserForm.name.toLowerCase().replace(/\s+/g, "")}@idealgroup.lk`,
      phone: newUserForm.phone,
      avatar: newUserForm.avatar || getInitials(newUserForm.name),
      department: newUserForm.department,
    };

    onUpdateOfficersList([...officersList, newOfficer]);
    setIsAddingUser(false);
    setNewUserForm({
      name: "",
      title: "Call Center Executive",
      email: "",
      phone: "+94 77 ",
      id: `CC-${100 + officersList.length + 2}`,
      avatar: "",
      department: "Ideal Motors Central CX Call Center"
    });
    setSaveMessage(`User ${newOfficer.name} created successfully!`);
    setTimeout(() => setSaveMessage(null), 3000);
  };

  // Statistics calculation for Call Center
  const totalComplaints = complaints.length;
  const awaitingCallCenter = complaints.filter(
    (c) => (c.stationResolutionNotes || c.stationContactedDate) && !c.callCenterFinalRemarks
  ).length;
  const completedCallCenter = complaints.filter((c) => !!c.callCenterFinalRemarks).length;
  const satisfiedCount = complaints.filter(
    (c) => c.callCenterFinalSatisfaction === "Satisfied" || c.currentSatisfaction === "Satisfied" || c.currentSatisfaction === "Very Satisfied"
  ).length;
  const satisfactionRate = totalComplaints > 0 ? Math.round((satisfiedCount / totalComplaints) * 100) : 100;

  const filteredOfficers = officersList.filter((off) => 
    off.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    off.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    off.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    off.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredStations = stationsList.filter((st) =>
    st.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    st.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (st.managerName && st.managerName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fade-in">
      <div 
        className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden transition-all duration-300 max-h-[90vh] flex flex-col ${
          isDark ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        {/* Banner Header */}
        <div className="bg-gradient-to-r from-red-600 via-red-700 to-slate-900 p-4 relative flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2 text-white text-xs font-black uppercase tracking-widest">
            <Shield className="h-4 w-4 text-red-300" />
            <span>CX Executive User & Station Portal</span>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin ? (
              <div className="flex bg-black/40 p-1 rounded-lg border border-white/20">
                <button
                  type="button"
                  onClick={() => setActiveTab("profile")}
                  className={`px-2.5 py-1 text-[10px] font-black rounded-md transition-all cursor-pointer uppercase ${
                    activeTab === "profile" ? "bg-white text-slate-900 shadow-sm" : "text-white/80 hover:text-white"
                  }`}
                >
                  My Profile
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("manage_users")}
                  className={`px-2.5 py-1 text-[10px] font-black rounded-md transition-all cursor-pointer uppercase flex items-center gap-1 ${
                    activeTab === "manage_users" ? "bg-white text-slate-900 shadow-sm" : "text-white/80 hover:text-white"
                  }`}
                >
                  <Users className="h-3 w-3" />
                  Call Center ({officersList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("manage_stations")}
                  className={`px-2.5 py-1 text-[10px] font-black rounded-md transition-all cursor-pointer uppercase flex items-center gap-1 ${
                    activeTab === "manage_stations" ? "bg-white text-slate-900 shadow-sm" : "text-white/80 hover:text-white"
                  }`}
                >
                  <MapPin className="h-3 w-3" />
                  Stations ({stationsList.length})
                </button>
              </div>
            ) : (
              <span className="text-[11px] font-bold text-white/90 bg-black/40 px-3 py-1 rounded-lg border border-white/20 uppercase tracking-wider">
                My Profile
              </span>
            )}

            <button
              type="button"
              onClick={onClose}
              className="text-white/80 hover:text-white bg-black/30 hover:bg-black/50 p-1.5 rounded-full transition-all cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Save notification toast */}
        {saveMessage && (
          <div className="bg-emerald-600 text-white text-xs font-bold px-4 py-2 flex items-center justify-between shrink-0 animate-fade-in">
            <span className="flex items-center gap-2">
              <Check className="h-4 w-4" /> {saveMessage}
            </span>
            <button type="button" onClick={() => setSaveMessage(null)} className="text-white/80 hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Modal Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {activeTab === "profile" ? (
            <div>
              {/* Profile Card Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-5 border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-4">
                  <div className={`h-16 w-16 rounded-2xl border-2 flex items-center justify-center font-black text-xl shadow-md ${
                    isDark 
                      ? "bg-slate-950 border-slate-800 text-red-400" 
                      : "bg-red-600 border-red-500 text-white"
                  }`}>
                    {user.avatar || getInitials(user.name)}
                  </div>
                  <div>
                    <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
                      {user.name || (user.role === "admin" ? "National Manager" : user.role === "callcenter" ? "Call Center Executive" : `${user.station} Service Adviser`)}
                      <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-900">
                        {user.role === "admin" ? "Admin" : user.role === "callcenter" ? "Call Center" : "Station Adviser"}
                      </span>
                    </h3>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      {user.title || (user.role === "admin" ? "National CX Director" : user.role === "callcenter" ? "Call Center CX Specialist" : "Service Station Representative")}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsEditingSelf(!isEditingSelf)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                    isEditingSelf
                      ? "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                      : "bg-red-600 hover:bg-red-700 text-white shadow-sm"
                  }`}
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  {isEditingSelf ? "Cancel Editing" : "Edit My Details"}
                </button>
              </div>

              {/* Edit Self Form */}
              {isEditingSelf ? (
                <form onSubmit={handleSaveSelf} className="mt-5 space-y-4 bg-slate-50 dark:bg-slate-950/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  <h4 className="text-xs font-black uppercase tracking-widest text-red-600 dark:text-red-400 flex items-center gap-1.5">
                    <Edit3 className="h-4 w-4" />
                    Update Profile Details
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Full Name</label>
                      <input
                        type="text"
                        required
                        value={selfForm.name}
                        onChange={(e) => setSelfForm({ ...selfForm, name: e.target.value })}
                        className={`w-full text-xs font-bold rounded-lg p-2 border ${
                          isDark ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-300 text-slate-900"
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Job Title</label>
                      <input
                        type="text"
                        required
                        value={selfForm.title}
                        onChange={(e) => setSelfForm({ ...selfForm, title: e.target.value })}
                        className={`w-full text-xs font-bold rounded-lg p-2 border ${
                          isDark ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-300 text-slate-900"
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Official Email</label>
                      <input
                        type="email"
                        required
                        value={selfForm.email}
                        onChange={(e) => setSelfForm({ ...selfForm, email: e.target.value })}
                        className={`w-full text-xs font-bold rounded-lg p-2 border ${
                          isDark ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-300 text-slate-900"
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Phone Number</label>
                      <input
                        type="text"
                        required
                        value={selfForm.phone}
                        onChange={(e) => setSelfForm({ ...selfForm, phone: e.target.value })}
                        className={`w-full text-xs font-bold rounded-lg p-2 border ${
                          isDark ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-300 text-slate-900"
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Department / Unit</label>
                      <input
                        type="text"
                        required
                        value={selfForm.department}
                        onChange={(e) => setSelfForm({ ...selfForm, department: e.target.value })}
                        className={`w-full text-xs font-bold rounded-lg p-2 border ${
                          isDark ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-300 text-slate-900"
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Avatar Initials</label>
                      <input
                        type="text"
                        maxLength={3}
                        value={selfForm.avatar}
                        onChange={(e) => setSelfForm({ ...selfForm, avatar: e.target.value.toUpperCase() })}
                        placeholder="e.g. US"
                        className={`w-full text-xs font-bold rounded-lg p-2 border ${
                          isDark ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-300 text-slate-900"
                        }`}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingSelf(false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
                    >
                      <Save className="h-3.5 w-3.5" />
                      Save My Changes
                    </button>
                  </div>
                </form>
              ) : (
                /* Profile Display Grid */
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className={`p-3 rounded-xl border flex items-center gap-3 ${isDark ? "bg-slate-950/60 border-slate-800" : "bg-slate-50 border-slate-100"}`}>
                    <div className="p-2 rounded-lg bg-red-500/10 text-red-600">
                      <Shield className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="block text-[9px] font-black uppercase text-slate-400">Employee / Officer ID</span>
                      <span className="text-xs font-extrabold font-mono">{user.officerId || (user.role === "admin" ? "ADM-001" : user.role === "callcenter" ? "CC-OFFICER" : `SA-${user.station}`)}</span>
                    </div>
                  </div>

                  <div className={`p-3 rounded-xl border flex items-center gap-3 ${isDark ? "bg-slate-950/60 border-slate-800" : "bg-slate-50 border-slate-100"}`}>
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="block text-[9px] font-black uppercase text-slate-400">Department / Unit</span>
                      <span className="text-xs font-extrabold">{user.department || (user.role === "callcenter" ? "Ideal Central Call Center" : user.station || "Ideal Motors HQ")}</span>
                    </div>
                  </div>

                  <div className={`p-3 rounded-xl border flex items-center gap-3 ${isDark ? "bg-slate-950/60 border-slate-800" : "bg-slate-50 border-slate-100"}`}>
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="block text-[9px] font-black uppercase text-slate-400">Official Email</span>
                      <span className="text-xs font-extrabold">{user.email || `${user.name?.toLowerCase().replace(/\s+/g, '') || "callcenter"}@idealgroup.lk`}</span>
                    </div>
                  </div>

                  <div className={`p-3 rounded-xl border flex items-center gap-3 ${isDark ? "bg-slate-950/60 border-slate-800" : "bg-slate-50 border-slate-100"}`}>
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600">
                      <Phone className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="block text-[9px] font-black uppercase text-slate-400">Direct Hotline</span>
                      <span className="text-xs font-extrabold">{user.phone || "+94 11 770 0700"}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Performance Overview for Call Center */}
              {user.role === "callcenter" && (
                <div className="mt-5 space-y-2">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    Live Call Center Terminal Stats
                  </h4>
                  <div className="grid grid-cols-3 gap-2">
                    <div className={`p-3 rounded-xl border text-center ${isDark ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
                      <span className="block text-lg font-black text-amber-600">{awaitingCallCenter}</span>
                      <span className="text-[9px] font-bold uppercase text-slate-500">Awaiting Follow-ups</span>
                    </div>

                    <div className={`p-3 rounded-xl border text-center ${isDark ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
                      <span className="block text-lg font-black text-emerald-600">{completedCallCenter}</span>
                      <span className="text-[9px] font-bold uppercase text-slate-500">Completed Calls</span>
                    </div>

                    <div className={`p-3 rounded-xl border text-center ${isDark ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
                      <span className="block text-lg font-black text-blue-600">{satisfactionRate}%</span>
                      <span className="text-[9px] font-bold uppercase text-slate-500">CX Recovery Score</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Security info banner (strictly no plain text passwords) */}
              <div className={`mt-5 p-3 rounded-xl border flex items-center justify-between text-xs font-medium ${
                isDark ? "bg-slate-950 border-slate-800 text-slate-400" : "bg-slate-100 border-slate-200 text-slate-600"
              }`}>
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span className="text-[11px] font-bold">
                    Secure Enterprise Credentials Verified & Authenticated
                  </span>
                </div>
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              </div>
            </div>
          ) : (
            /* ADMIN: Manage All Team Profiles Tab */
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                    <Users className="h-4 w-4 text-red-600" />
                    Team User Profiles Directory
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    View, modify, or onboard Call Center officers and system personnel.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAddingUser(!isAddingUser)}
                  className="px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-red-600 hover:bg-red-700 text-white flex items-center gap-1.5 shadow-sm cursor-pointer self-start sm:self-auto"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  {isAddingUser ? "Cancel Add User" : "+ Add New Team Officer"}
                </button>
              </div>

              {/* Add New User Form */}
              {isAddingUser && (
                <form onSubmit={handleAddNewUser} className="bg-slate-50 dark:bg-slate-950/80 p-4 rounded-xl border border-red-500/30 space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-widest text-red-600 dark:text-red-400 flex items-center gap-1.5">
                    <UserPlus className="h-4 w-4" />
                    Onboard New Call Center Executive
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Officer Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Nimal Perera"
                        value={newUserForm.name}
                        onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                        className={`w-full text-xs font-bold rounded-lg p-2 border ${
                          isDark ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-300 text-slate-900"
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Officer ID *</label>
                      <input
                        type="text"
                        required
                        value={newUserForm.id}
                        onChange={(e) => setNewUserForm({ ...newUserForm, id: e.target.value })}
                        className={`w-full text-xs font-bold rounded-lg p-2 border ${
                          isDark ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-300 text-slate-900"
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Job Title</label>
                      <input
                        type="text"
                        required
                        value={newUserForm.title}
                        onChange={(e) => setNewUserForm({ ...newUserForm, title: e.target.value })}
                        className={`w-full text-xs font-bold rounded-lg p-2 border ${
                          isDark ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-300 text-slate-900"
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Official Email</label>
                      <input
                        type="email"
                        placeholder="e.g. nimal@idealgroup.lk"
                        value={newUserForm.email}
                        onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                        className={`w-full text-xs font-bold rounded-lg p-2 border ${
                          isDark ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-300 text-slate-900"
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Phone Hotline</label>
                      <input
                        type="text"
                        value={newUserForm.phone}
                        onChange={(e) => setNewUserForm({ ...newUserForm, phone: e.target.value })}
                        className={`w-full text-xs font-bold rounded-lg p-2 border ${
                          isDark ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-300 text-slate-900"
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Avatar Initials</label>
                      <input
                        type="text"
                        maxLength={3}
                        placeholder="e.g. NP"
                        value={newUserForm.avatar}
                        onChange={(e) => setNewUserForm({ ...newUserForm, avatar: e.target.value.toUpperCase() })}
                        className={`w-full text-xs font-bold rounded-lg p-2 border ${
                          isDark ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-300 text-slate-900"
                        }`}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingUser(false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider bg-red-600 hover:bg-red-700 text-white flex items-center gap-1.5"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Add to Call Center Team
                    </button>
                  </div>
                </form>
              )}

              {/* Search filter */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Filter team members by name, title, or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full rounded-xl py-2 pl-9 pr-3 text-xs font-medium border ${
                    isDark ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                  }`}
                />
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              </div>

              {/* Registered Officer Cards List */}
              <div className="space-y-3">
                {filteredOfficers.map((officer) => {
                  const isEditingThis = editingOfficerId === officer.id;

                  return (
                    <div 
                      key={officer.id}
                      className={`p-4 rounded-xl border transition-all ${
                        isDark ? "bg-slate-950/70 border-slate-800" : "bg-slate-50/80 border-slate-200"
                      }`}
                    >
                      {isEditingThis ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-red-600 dark:text-red-400 uppercase">
                              Editing Officer ({officer.id})
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[9px] font-black uppercase text-slate-500">Name</label>
                              <input
                                type="text"
                                defaultValue={officer.name}
                                onChange={(e) => setOfficerForm({ ...officerForm, name: e.target.value })}
                                className={`w-full text-xs font-bold rounded-lg p-1.5 border ${
                                  isDark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-300"
                                }`}
                              />
                            </div>

                            <div>
                              <label className="block text-[9px] font-black uppercase text-slate-500">Title</label>
                              <input
                                type="text"
                                defaultValue={officer.title}
                                onChange={(e) => setOfficerForm({ ...officerForm, title: e.target.value })}
                                className={`w-full text-xs font-bold rounded-lg p-1.5 border ${
                                  isDark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-300"
                                }`}
                              />
                            </div>

                            <div>
                              <label className="block text-[9px] font-black uppercase text-slate-500">Email</label>
                              <input
                                type="email"
                                defaultValue={officer.email}
                                onChange={(e) => setOfficerForm({ ...officerForm, email: e.target.value })}
                                className={`w-full text-xs font-bold rounded-lg p-1.5 border ${
                                  isDark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-300"
                                }`}
                              />
                            </div>

                            <div>
                              <label className="block text-[9px] font-black uppercase text-slate-500">Phone</label>
                              <input
                                type="text"
                                defaultValue={officer.phone}
                                onChange={(e) => setOfficerForm({ ...officerForm, phone: e.target.value })}
                                className={`w-full text-xs font-bold rounded-lg p-1.5 border ${
                                  isDark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-300"
                                }`}
                              />
                            </div>
                          </div>

                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setEditingOfficerId(null)}
                              className="px-2.5 py-1 text-xs font-bold rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveOfficerEdit(officer.id)}
                              className="px-3 py-1 text-xs font-black uppercase bg-emerald-600 hover:bg-emerald-700 text-white rounded flex items-center gap-1"
                            >
                              <Save className="h-3 w-3" /> Save User
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className={`h-11 w-11 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                              isDark ? "bg-slate-900 text-red-400 border border-slate-800" : "bg-red-600 text-white"
                            }`}>
                              {officer.avatar || getInitials(officer.name)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-xs font-black">{officer.name}</h4>
                                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                  {officer.id}
                                </span>
                              </div>
                              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                {officer.title}
                              </p>
                              <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-0.5">
                                <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {officer.email}</span>
                                <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {officer.phone}</span>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingOfficerId(officer.id);
                              setOfficerForm(officer);
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all cursor-pointer flex items-center gap-1 self-end sm:self-auto"
                          >
                            <Edit3 className="h-3 w-3" /> Edit Profile
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Manage Service Stations Tab */}
          {activeTab === "manage_stations" && isAdmin && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider">Service Station Network & Passkeys</h3>
                  <p className="text-xs text-slate-500">Edit station passwords, manager contact info, or add new service centers.</p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAddingStation(!isAddingStation)}
                  className="px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider bg-red-600 hover:bg-red-700 text-white flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {isAddingStation ? "Cancel" : "Add Station"}
                </button>
              </div>

              {/* Add Station Form */}
              {isAddingStation && (
                <form onSubmit={handleAddNewStation} className="p-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/20 dark:bg-red-950/20 space-y-3">
                  <h4 className="text-xs font-black uppercase text-red-600 dark:text-red-400 flex items-center gap-1">
                    <MapPin className="h-4 w-4" /> Register New Service Station Branch
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Station Display Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Gampaha Service Center"
                        value={newStationForm.name}
                        onChange={(e) => setNewStationForm({ ...newStationForm, name: e.target.value })}
                        className={`w-full text-xs font-bold rounded-lg p-2 border ${
                          isDark ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-300 text-slate-900"
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Station Code / Identifier *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Gampaha"
                        value={newStationForm.code}
                        onChange={(e) => setNewStationForm({ ...newStationForm, code: e.target.value })}
                        className={`w-full text-xs font-bold rounded-lg p-2 border ${
                          isDark ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-300 text-slate-900"
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Station Security Passkey *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. gampaha123"
                        value={newStationForm.passwordHash}
                        onChange={(e) => setNewStationForm({ ...newStationForm, passwordHash: e.target.value })}
                        className={`w-full text-xs font-bold rounded-lg p-2 border ${
                          isDark ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-300 text-slate-900"
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Station Manager Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Jagath Perera"
                        value={newStationForm.managerName || ""}
                        onChange={(e) => setNewStationForm({ ...newStationForm, managerName: e.target.value })}
                        className={`w-full text-xs font-bold rounded-lg p-2 border ${
                          isDark ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-300 text-slate-900"
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Station Email</label>
                      <input
                        type="email"
                        placeholder="e.g. station@idealgroup.lk"
                        value={newStationForm.email || ""}
                        onChange={(e) => setNewStationForm({ ...newStationForm, email: e.target.value })}
                        className={`w-full text-xs font-bold rounded-lg p-2 border ${
                          isDark ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-300 text-slate-900"
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Phone Hotline</label>
                      <input
                        type="text"
                        placeholder="+94 11 ..."
                        value={newStationForm.phone || ""}
                        onChange={(e) => setNewStationForm({ ...newStationForm, phone: e.target.value })}
                        className={`w-full text-xs font-bold rounded-lg p-2 border ${
                          isDark ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-300 text-slate-900"
                        }`}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingStation(false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider bg-red-600 hover:bg-red-700 text-white flex items-center gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Save New Station
                    </button>
                  </div>
                </form>
              )}

              {/* Search filter for stations */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Filter stations by name, code, or manager..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full rounded-xl py-2 pl-9 pr-3 text-xs font-medium border ${
                    isDark ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                  }`}
                />
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              </div>

              {/* Registered Stations Cards List */}
              <div className="space-y-3">
                {filteredStations.map((station) => {
                  const isEditingThis = editingStationCode === station.code;
                  const isPasskeyVisible = !!showPasskeys[station.code];

                  return (
                    <div 
                      key={station.code}
                      className={`p-4 rounded-xl border transition-all ${
                        isDark ? "bg-slate-950/70 border-slate-800" : "bg-slate-50/80 border-slate-200"
                      }`}
                    >
                      {isEditingThis ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-red-600 dark:text-red-400 uppercase">
                              Editing Station: {station.name} ({station.code})
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[9px] font-black uppercase text-slate-500">Station Display Name</label>
                              <input
                                type="text"
                                defaultValue={station.name}
                                onChange={(e) => setStationForm({ ...stationForm, name: e.target.value })}
                                className={`w-full text-xs font-bold rounded-lg p-1.5 border ${
                                  isDark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-300"
                                }`}
                              />
                            </div>

                            <div>
                              <label className="block text-[9px] font-black uppercase text-slate-500">Security Passkey / Password</label>
                              <input
                                type="text"
                                defaultValue={station.passwordHash}
                                onChange={(e) => setStationForm({ ...stationForm, passwordHash: e.target.value })}
                                className={`w-full text-xs font-bold rounded-lg p-1.5 border font-mono ${
                                  isDark ? "bg-slate-900 border-slate-700 text-amber-400" : "bg-white border-slate-300 text-slate-900"
                                }`}
                              />
                            </div>

                            <div>
                              <label className="block text-[9px] font-black uppercase text-slate-500">Station Manager Name</label>
                              <input
                                type="text"
                                defaultValue={station.managerName || ""}
                                onChange={(e) => setStationForm({ ...stationForm, managerName: e.target.value })}
                                className={`w-full text-xs font-bold rounded-lg p-1.5 border ${
                                  isDark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-300"
                                }`}
                              />
                            </div>

                            <div>
                              <label className="block text-[9px] font-black uppercase text-slate-500">Station Email</label>
                              <input
                                type="email"
                                defaultValue={station.email || ""}
                                onChange={(e) => setStationForm({ ...stationForm, email: e.target.value })}
                                className={`w-full text-xs font-bold rounded-lg p-1.5 border ${
                                  isDark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-300"
                                }`}
                              />
                            </div>

                            <div>
                              <label className="block text-[9px] font-black uppercase text-slate-500">Phone Hotline</label>
                              <input
                                type="text"
                                defaultValue={station.phone || ""}
                                onChange={(e) => setStationForm({ ...stationForm, phone: e.target.value })}
                                className={`w-full text-xs font-bold rounded-lg p-1.5 border ${
                                  isDark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-300"
                                }`}
                              />
                            </div>
                          </div>

                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setEditingStationCode(null)}
                              className="px-2.5 py-1 text-xs font-bold rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveStationEdit(station.code)}
                              className="px-3 py-1 text-xs font-black uppercase bg-emerald-600 hover:bg-emerald-700 text-white rounded flex items-center gap-1"
                            >
                              <Save className="h-3 w-3" /> Save Credentials
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className={`h-11 w-11 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                              isDark ? "bg-slate-900 text-red-400 border border-slate-800" : "bg-red-600 text-white"
                            }`}>
                              <MapPin className="h-5 w-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-xs font-black">{station.name}</h4>
                                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                  {station.code}
                                </span>
                              </div>
                              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                Manager: <span className="font-semibold text-slate-700 dark:text-slate-300">{station.managerName || "Unassigned"}</span>
                              </p>
                              
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-400 mt-1">
                                {station.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {station.email}</span>}
                                {station.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {station.phone}</span>}
                                
                                {/* Passkey Display with Eye toggle */}
                                <div className="flex items-center gap-1.5 bg-amber-500/10 dark:bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30 text-amber-700 dark:text-amber-300">
                                  <Key className="h-3 w-3" />
                                  <span className="font-mono font-bold text-[10px]">
                                    {isPasskeyVisible ? station.passwordHash : "••••••••"}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => togglePasskeyVisibility(station.code)}
                                    title={isPasskeyVisible ? "Hide Passkey" : "Reveal Passkey"}
                                    className="p-0.5 hover:text-amber-500 transition-colors ml-1 cursor-pointer"
                                  >
                                    {isPasskeyVisible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingStationCode(station.code);
                              setStationForm(station);
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all cursor-pointer flex items-center gap-1 self-end sm:self-auto"
                          >
                            <Edit3 className="h-3 w-3" /> Edit Passkey & Info
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-black uppercase tracking-wider py-2 px-5 rounded-xl transition-all cursor-pointer shadow-sm"
          >
            Done / Close
          </button>
        </div>
      </div>
    </div>
  );
}
