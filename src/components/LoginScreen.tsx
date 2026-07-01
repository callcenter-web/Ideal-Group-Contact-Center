import React, { useState } from "react";
import { Shield, Key, Car, MapPin, CheckCircle2, Phone, Sun, Moon } from "lucide-react";
import { STATIONS } from "../demoData";
import IdealMotorsLogo from "./IdealMotorsLogo";

interface LoginProps {
  onLoginSuccess: (role: "admin" | "agent" | "callcenter", stationCode?: string) => void;
  theme?: "light" | "dark";
  toggleTheme?: () => void;
}

export default function LoginScreen({ onLoginSuccess, theme = "light", toggleTheme }: LoginProps) {
  const [activeTab, setActiveTab] = useState<"admin" | "agent" | "callcenter">("admin");
  const [selectedStation, setSelectedStation] = useState<string>("Rathmalana");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string>("");

  const isDark = theme === "dark";

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
    <div 
      id="login-container" 
      className={`min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 select-none transition-colors duration-500 relative overflow-hidden ${
        isDark ? "bg-luxury-grid text-slate-100" : "bg-luxury-light-grid text-slate-900"
      }`}
    >
      {/* Main Container Card */}
      <div 
        className={`w-full max-w-md rounded-2xl border transition-all duration-500 overflow-hidden relative shadow-2xl ${
          isDark 
            ? "bg-slate-900/90 backdrop-blur-md border-slate-800 shadow-luxury-red" 
            : "bg-white/95 backdrop-blur-md border-slate-200/80 shadow-slate-300/40"
        }`}
      >
        {/* Sleek Red Indicator Bar */}
        <div className="bg-red-600 h-1 w-full" />
        
        <div className="p-8 space-y-6">
          {/* Logo container */}
          <div 
            className={`flex justify-center py-5 px-4 rounded-xl border shadow-inner transition-all duration-500 ${
              isDark ? "bg-black/50 border-slate-800/80" : "bg-slate-900 border-slate-950"
            }`}
          >
            <IdealMotorsLogo className="h-16 w-auto animate-pulse" />
          </div>

          <div className="text-center space-y-1">
            <h2 
              id="login-title" 
              className={`text-sm font-black font-display tracking-widest uppercase transition-colors duration-500 ${
                isDark ? "text-slate-100" : "text-slate-800"
              }`}
            >
              CX Recovery System
            </h2>
            <p 
              className={`text-[9px] uppercase font-black tracking-widest transition-colors duration-500 ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              Service Station Satisfaction Recovery & Alignment
            </p>
          </div>

          {/* Premium Tab selectors */}
          <div 
            className={`grid grid-cols-3 gap-1 p-1 rounded-lg border transition-colors duration-500 ${
              isDark ? "bg-black/40 border-slate-800/60" : "bg-slate-100 border-slate-200"
            }`}
          >
            <button
              id="tab-admin"
              type="button"
              onClick={() => {
                setActiveTab("admin");
                setPassword("");
                setError("");
              }}
              className={`py-2 px-1 text-[10px] sm:text-xs font-black rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider ${
                activeTab === "admin"
                  ? "bg-red-600 text-white shadow-md shadow-red-900/20"
                  : isDark
                    ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
              }`}
            >
              <Shield className="h-3.5 w-3.5" />
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
              className={`py-2 px-1 text-[10px] sm:text-xs font-black rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider ${
                activeTab === "agent"
                  ? "bg-red-600 text-white shadow-md shadow-red-900/20"
                  : isDark
                    ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
              }`}
            >
              <MapPin className="h-3.5 w-3.5" />
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
              className={`py-2 px-1 text-[10px] sm:text-xs font-black rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider ${
                activeTab === "callcenter"
                  ? "bg-red-600 text-white shadow-md shadow-red-900/20"
                  : isDark
                    ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
              }`}
            >
              <Phone className="h-3.5 w-3.5" />
              Center
            </button>
          </div>

          <form id="login-form" onSubmit={handleLogin} className="space-y-4 pt-1">
            {activeTab === "agent" && (
              <div className="space-y-1.5">
                <label 
                  id="station-select-label" 
                  className={`block text-[10px] font-black uppercase tracking-widest ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  Service Station
                </label>
                <select
                  id="station-select"
                  value={selectedStation}
                  onChange={(e) => setSelectedStation(e.target.value)}
                  className={`w-full rounded-lg py-2 px-3 text-xs font-bold focus:outline-none focus:ring-1 transition-all cursor-pointer ${
                    isDark 
                      ? "bg-slate-950 text-slate-100 border border-slate-800 focus:border-red-500 focus:ring-red-500" 
                      : "bg-slate-50 text-slate-800 border border-slate-200 focus:border-red-600 focus:ring-red-600"
                  }`}
                >
                  {STATIONS.map((station) => (
                    <option key={station.code} value={station.code} className={isDark ? "bg-slate-900 text-slate-100" : "bg-white text-slate-800"}>
                      {station.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <label 
                id="password-label" 
                className={`block text-[10px] font-black uppercase tracking-widest ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
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
                  className={`w-full rounded-lg py-2 pl-9 pr-3 text-xs focus:outline-none focus:ring-1 transition-all font-mono ${
                    isDark 
                      ? "bg-slate-950 text-slate-100 border border-slate-800 focus:border-red-500 focus:ring-red-500 placeholder-slate-700" 
                      : "bg-slate-50 text-slate-800 border border-slate-200 focus:border-red-600 focus:ring-red-600 placeholder-slate-400"
                  }`}
                />
                <Key className={`absolute left-3 top-2.5 h-4 w-4 ${isDark ? "text-slate-500" : "text-slate-400"}`} />
              </div>
            </div>

            {error && (
              <p 
                id="login-error-msg" 
                className={`text-xs text-center font-bold p-2.5 rounded-lg border ${
                  isDark 
                    ? "text-red-400 bg-red-950/30 border-red-900/50" 
                    : "text-red-700 bg-red-50 border-red-200"
                }`}
              >
                {error}
              </p>
            )}

            <button
              id="login-submit-btn"
              type="submit"
              className="w-full bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-black text-xs py-2.5 px-4 rounded-lg transition-all shadow-md hover:shadow-lg shadow-red-900/20 active:scale-98 cursor-pointer uppercase tracking-wider"
            >
              Access Secure Console
            </button>
          </form>

        </div>
      </div>
      
      <footer className="mt-8 flex flex-col items-center gap-3 text-center">
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
