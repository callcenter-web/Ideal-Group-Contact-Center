import React, { useState } from "react";
import { Shield, Key, Car, MapPin, CheckCircle2, Phone } from "lucide-react";
import { STATIONS } from "../demoData";

interface LoginProps {
  onLoginSuccess: (role: "admin" | "agent" | "callcenter", stationCode?: string) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginProps) {
  const [activeTab, setActiveTab] = useState<"admin" | "agent" | "callcenter">("admin");
  const [selectedStation, setSelectedStation] = useState<string>("Rathmalana");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string>("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (activeTab === "admin") {
      if (password === "admin123") {
        onLoginSuccess("admin");
      } else {
        setError("Invalid National Manager security code.");
      }
    } else if (activeTab === "callcenter") {
      if (password === "callcenter123") {
        onLoginSuccess("callcenter");
      } else {
        setError("Invalid Call Center security code.");
      }
    } else {
      const station = STATIONS.find((s) => s.code === selectedStation);
      if (station && password === station.passwordHash) {
        onLoginSuccess("agent", selectedStation);
      } else {
        setError(`Incorrect password for ${selectedStation} station.`);
      }
    }
  };

  const handleQuickLogin = (role: "admin" | "agent" | "callcenter", stationCode?: string) => {
    if (role === "admin") {
      setPassword("admin123");
    } else if (role === "callcenter") {
      setPassword("callcenter123");
    } else {
      setPassword("rathmalana123");
    }
    
    if (stationCode) {
      setSelectedStation(stationCode);
    }
    setActiveTab(role);
  };

  return (
    <div id="login-container" className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden relative">
        
        {/* Header decoration */}
        <div className="bg-blue-600 h-1.5 w-full" />
        
        <div className="p-6">
          <div className="flex justify-center mb-4">
            <div className="bg-slate-100 p-3 rounded-full border border-slate-200">
              <Car id="app-logo-icon" className="h-6 w-6 text-blue-600" />
            </div>
          </div>

          <h2 id="login-title" className="text-xl font-black text-center text-slate-800 font-sans tracking-tight">
            Ideal Group Recovery
          </h2>
          <p className="text-center text-slate-500 text-xs mt-0.5 mb-6 font-medium">
            Service Station Satisfaction Recovery System
          </p>

          {/* Tab selectors */}
          <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-md mb-5 border border-slate-200/50">
            <button
              id="tab-admin"
              type="button"
              onClick={() => {
                setActiveTab("admin");
                setPassword("");
                setError("");
              }}
              className={`py-1.5 px-1 text-[10px] sm:text-xs font-bold rounded transition-all flex items-center justify-center gap-1 ${
                activeTab === "admin"
                  ? "bg-white text-slate-800 shadow-sm border border-slate-200/20"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Shield className="h-3 w-3" />
              Admin
            </button>
            <button
              id="tab-agent"
              type="button"
              onClick={() => {
                setActiveTab("agent");
                setPassword("");
                setError("");
              }}
              className={`py-1.5 px-1 text-[10px] sm:text-xs font-bold rounded transition-all flex items-center justify-center gap-1 ${
                activeTab === "agent"
                  ? "bg-white text-slate-800 shadow-sm border border-slate-200/20"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <MapPin className="h-3 w-3" />
              Station
            </button>
            <button
              id="tab-callcenter"
              type="button"
              onClick={() => {
                setActiveTab("callcenter");
                setPassword("");
                setError("");
              }}
              className={`py-1.5 px-1 text-[10px] sm:text-xs font-bold rounded transition-all flex items-center justify-center gap-1 ${
                activeTab === "callcenter"
                  ? "bg-white text-slate-800 shadow-sm border border-slate-200/20"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Phone className="h-3 w-3" />
              Call Center
            </button>
          </div>

          <form id="login-form" onSubmit={handleLogin} className="space-y-4">
            {activeTab === "agent" && (
              <div>
                <label id="station-select-label" className="block text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1.5">
                  Service Station
                </label>
                <select
                  id="station-select"
                  value={selectedStation}
                  onChange={(e) => setSelectedStation(e.target.value)}
                  className="w-full bg-white text-slate-800 border border-slate-200 rounded-md py-1.5 px-2.5 text-xs font-medium focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors cursor-pointer"
                >
                  {STATIONS.map((station) => (
                    <option key={station.code} value={station.code}>
                      {station.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label id="password-label" className="block text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1.5">
                {activeTab === "admin" ? "National Security Code" : activeTab === "callcenter" ? "Call Center Passkey" : "Station Passkey"}
              </label>
              <div className="relative">
                <input
                  id="password-input"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white text-slate-800 border border-slate-200 rounded-md py-1.5 pl-8 pr-2.5 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                />
                <Key className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              </div>
            </div>

            {error && (
              <p id="login-error-msg" className="text-red-700 text-[11px] text-center font-semibold bg-red-50 p-2 rounded border border-red-200">
                {error}
              </p>
            )}

            <button
              id="login-submit-btn"
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs py-2 px-4 rounded-md transition-all shadow-sm cursor-pointer"
            >
              Sign In to Dashboard
            </button>
          </form>
        </div>
      </div>
      <p className="text-[10px] text-slate-400 mt-5 font-sans font-medium">
        Powered by Google Gemini AI & Ideal Group CX Recovery Service.
      </p>
    </div>
  );
}
