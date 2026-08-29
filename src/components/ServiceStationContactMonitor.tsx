import React, { useMemo } from "react";
import { 
  PhoneCall, 
  PhoneOff, 
  PhoneMissed, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  CalendarClock, 
  ShieldAlert, 
  Building2, 
  ArrowRight,
  Filter,
  Users
} from "lucide-react";
import { Complaint, ServiceStationContactStatus, WorkstationCalendarDate } from "../types";
import { STATIONS } from "../demoData";
import { 
  getComplaintCycleContactStatus, 
  isComplaintRejected, 
  isComplaintResolved,
  getActiveCycleAgeInfo,
  calculateStationMetrics,
  calculateNationalSummary
} from "../utils/workflowTallyUtils";
import { matchesStationCodeOrName } from "../utils/stationUtils";

interface ServiceStationContactMonitorProps {
  complaints: Complaint[];
  activeContactStatusFilter: string;
  onSelectContactStatusFilter: (status: string) => void;
  activeStationFilter: string;
  onSelectStationFilter: (station: string) => void;
  calendarDates?: WorkstationCalendarDate[];
  theme?: "light" | "dark";
  onQuickContact?: (complaint: Complaint) => void;
}

export default function ServiceStationContactMonitor({
  complaints,
  activeContactStatusFilter,
  onSelectContactStatusFilter,
  activeStationFilter,
  onSelectStationFilter,
  calendarDates = [],
  theme = "light",
  onQuickContact,
}: ServiceStationContactMonitorProps) {
  const isDark = theme === "dark";

  // Compute metrics across all complaints or filtered by station
  const metrics = useMemo(() => {
    const targetComplaints = activeStationFilter === "All" || activeStationFilter === "all"
      ? complaints
      : complaints.filter(c => matchesStationCodeOrName(c.station, activeStationFilter));

    let total = targetComplaints.length;
    let notContacted = 0;
    let contacted = 0;
    let contactAttempted = 0;
    let customerUnreachable = 0;
    let pendingContact = 0;
    let slaBreached = 0;
    let followUpDue = 0;
    let rejectedCount = 0;

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    const getContactCategory = (c: Complaint): "NOT_CONTACTED" | "CONTACTED" | "CONTACT_ATTEMPTED" | "CUSTOMER_UNREACHABLE" => {
      const isRes = isComplaintResolved(c);
      const isRej = isComplaintRejected(c);
      const hasContact = !!(c.stationContactedDate || c.serviceStationContactedAt);
      const isUnreachable = 
        c.feedbackStatus === "Customer Unreachable" || 
        c.finalStatus === "Unreachable" || 
        (typeof c.finalStatus === "string" && c.finalStatus.toLowerCase().includes("unreachable"));
      
      if (isUnreachable) return "CUSTOMER_UNREACHABLE";
      if (isRej) return "NOT_CONTACTED";
      if (hasContact || isRes) return "CONTACTED";
      if (Array.isArray(c.contactAttempts) && c.contactAttempts.length > 0) return "CONTACT_ATTEMPTED";
      return "NOT_CONTACTED";
    };

    targetComplaints.forEach((c) => {
      const statusCat = getContactCategory(c);
      const isRej = isComplaintRejected(c);
      const isRes = isComplaintResolved(c);

      if (isRej) {
        rejectedCount++;
      }

      if (statusCat === "NOT_CONTACTED") {
        notContacted++;
      } else if (statusCat === "CONTACTED") {
        contacted++;
      } else if (statusCat === "CONTACT_ATTEMPTED") {
        contactAttempted++;
      } else if (statusCat === "CUSTOMER_UNREACHABLE") {
        customerUnreachable++;
      }

      // SLA Breach check (> 24h / > 1 working day without contact in active cycle)
      const ageInfo = getActiveCycleAgeInfo(c, now, calendarDates);
      if (ageInfo.workingDays >= 1 && statusCat !== "CONTACTED" && !isRes) {
        slaBreached++;
      }

      // Follow up due check
      if (c.nextFollowUpDate && c.nextFollowUpDate <= todayStr && !isRes) {
        followUpDue++;
      } else if ((statusCat === "CONTACT_ATTEMPTED" || statusCat === "CUSTOMER_UNREACHABLE") && !isRes) {
        followUpDue++;
      }
    });

    return {
      total,
      notContacted,
      contacted,
      contactAttempted,
      customerUnreachable,
      pendingContact,
      slaBreached,
      followUpDue,
      rejectedCount
    };
  }, [complaints, activeStationFilter, calendarDates]);

  // Compute Station-Wise Summary Table
  const stationSummary = useMemo(() => {
    const getContactCategory = (c: Complaint): "NOT_CONTACTED" | "CONTACTED" | "CONTACT_ATTEMPTED" | "CUSTOMER_UNREACHABLE" => {
      const isRes = isComplaintResolved(c);
      const isRej = isComplaintRejected(c);
      const hasContact = !!(c.stationContactedDate || c.serviceStationContactedAt);
      const isUnreachable = 
        c.feedbackStatus === "Customer Unreachable" || 
        c.finalStatus === "Unreachable" || 
        (typeof c.finalStatus === "string" && c.finalStatus.toLowerCase().includes("unreachable"));
      
      if (isUnreachable) return "CUSTOMER_UNREACHABLE";
      if (isRej) return "NOT_CONTACTED";
      if (hasContact || isRes) return "CONTACTED";
      if (Array.isArray(c.contactAttempts) && c.contactAttempts.length > 0) return "CONTACT_ATTEMPTED";
      return "NOT_CONTACTED";
    };

    return STATIONS.map((station) => {
      const stationComplaints = complaints.filter((c) => matchesStationCodeOrName(c.station, station.code));
      const total = stationComplaints.length;
      let notContacted = 0;
      let contacted = 0;
      let attempted = 0;
      let unreachable = 0;
      let slaBreached = 0;
      let rejected = 0;

      const now = new Date();

      stationComplaints.forEach((c) => {
        const statusCat = getContactCategory(c);
        const isRej = isComplaintRejected(c);
        const isRes = isComplaintResolved(c);

        if (isRej) rejected++;

        if (statusCat === "NOT_CONTACTED") notContacted++;
        else if (statusCat === "CONTACTED") contacted++;
        else if (statusCat === "CONTACT_ATTEMPTED") attempted++;
        else if (statusCat === "CUSTOMER_UNREACHABLE") unreachable++;

        const ageInfo = getActiveCycleAgeInfo(c, now, calendarDates);
        if (ageInfo.workingDays >= 1 && statusCat !== "CONTACTED" && !isRes) {
          slaBreached++;
        }
      });

      const contactRate = total > 0 ? Math.round((contacted / total) * 100) : 0;

      return {
        ...station,
        total,
        notContacted,
        contacted,
        attempted,
        unreachable,
        slaBreached,
        rejected,
        contactRate
      };
    });
  }, [complaints, calendarDates]);

  const filterButtons = [
    {
      id: "ALL",
      label: "ALL CASES",
      count: metrics.total,
      color: "blue",
      icon: Users,
      desc: "All complaints across network"
    },
    {
      id: "NOT_CONTACTED",
      label: "NOT CONTACTED",
      count: metrics.notContacted,
      color: "rose",
      icon: PhoneOff,
      desc: "Immediate station action required",
      urgent: metrics.notContacted > 0
    },
    {
      id: "CONTACTED",
      label: "CONTACTED",
      count: metrics.contacted,
      color: "emerald",
      icon: CheckCircle2,
      desc: "Customer contacted by station"
    },
    {
      id: "CONTACT_ATTEMPTED",
      label: "CONTACT ATTEMPTED",
      count: metrics.contactAttempted,
      color: "amber",
      icon: PhoneCall,
      desc: "Call attempted / follow-up queued"
    },
    {
      id: "CUSTOMER_UNREACHABLE",
      label: "CUSTOMER UNREACHABLE",
      count: metrics.customerUnreachable,
      color: "orange",
      icon: PhoneMissed,
      desc: "Multiple failed attempts"
    },
    {
      id: "PENDING_CONTACT",
      label: "PENDING CONTACT",
      count: metrics.pendingContact,
      color: "slate",
      icon: Clock,
      desc: "Pending queue assignment"
    }
  ];

  return (
    <div id="service-station-contact-monitor" className="space-y-4">
      
      {/* Header Banner */}
      <div className={`p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xs transition-colors duration-300 ${
        isDark ? "bg-slate-900/90 border-slate-800/90 text-slate-100" : "bg-slate-50/80 border-slate-200 text-slate-800"
      }`}>
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-lg border ${
            isDark ? "bg-blue-950/40 border-blue-800/50 text-blue-400" : "bg-blue-100 border-blue-200 text-blue-700"
          }`}>
            <PhoneCall className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className={`text-base font-black uppercase tracking-wider ${isDark ? "text-white" : "text-slate-900"}`}>
                Service Station Customer Contact Monitor
              </h2>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
                Live Status
              </span>
            </div>
            <p className={`text-xs mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Real-time operational monitoring of customer contact actions, call attempts, unreachable logs, and SLA compliance.
            </p>
          </div>
        </div>

        {/* Station Filter Dropdown in Header */}
        <div className="flex items-center gap-2 self-stretch md:self-auto">
          <span className={`text-[11px] font-bold uppercase whitespace-nowrap ${isDark ? "text-slate-400" : "text-slate-600"}`}>Filter Station:</span>
          <select
            value={activeStationFilter}
            onChange={(e) => onSelectStationFilter(e.target.value)}
            className={`border rounded-lg px-3 py-1.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer transition-colors ${
              isDark 
                ? "bg-slate-950 text-slate-100 border-slate-800" 
                : "bg-white text-slate-800 border-slate-300 shadow-xs"
            }`}
          >
            <option value="All">All Service Stations ({complaints.length})</option>
            {STATIONS.map((st) => {
              const count = complaints.filter(c => matchesStationCodeOrName(c.station, st.code)).length;
              return (
                <option key={st.code} value={st.code}>
                  {st.name} ({count})
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Primary KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
        
        {/* TOTAL CASES */}
        <div 
          onClick={() => onSelectContactStatusFilter("ALL")}
          className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 hover:scale-[1.02] ${
            activeContactStatusFilter === "ALL" 
              ? "bg-blue-50 border-blue-400 ring-2 ring-blue-400/20 shadow-sm" 
              : isDark ? "bg-slate-900 border-slate-800 hover:border-slate-700" : "bg-white border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider">Total Cases</span>
            <Users className="h-3.5 w-3.5 text-blue-600" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-slate-100">{metrics.total}</div>
          <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">Active cases</span>
        </div>

        {/* NOT CONTACTED (CRITICAL) */}
        <div 
          onClick={() => onSelectContactStatusFilter("NOT_CONTACTED")}
          className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 hover:scale-[1.02] ${
            activeContactStatusFilter === "NOT_CONTACTED"
              ? "bg-rose-50 border-rose-500 ring-2 ring-rose-500/20 shadow-sm" 
              : metrics.notContacted > 0
                ? "bg-rose-50/50 border-rose-200 hover:border-rose-300"
                : isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between text-rose-600 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider">Not Contacted</span>
            <PhoneOff className="h-3.5 w-3.5 text-rose-600" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-xl font-black ${metrics.notContacted > 0 ? "text-rose-700 animate-pulse" : "text-slate-800 dark:text-slate-200"}`}>
              {metrics.notContacted}
            </span>
            {metrics.rejectedCount > 0 && (
              <span className="text-[9px] font-black text-rose-600 bg-rose-100 px-1 py-0.2 rounded" title="Includes rejected cases returned by Call Center">
                {metrics.rejectedCount} Rej
              </span>
            )}
          </div>
          <span className="text-[10px] text-rose-600 font-bold block mt-0.5">Action required</span>
        </div>

        {/* CONTACTED */}
        <div 
          onClick={() => onSelectContactStatusFilter("CONTACTED")}
          className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 hover:scale-[1.02] ${
            activeContactStatusFilter === "CONTACTED"
              ? "bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm" 
              : isDark ? "bg-slate-900 border-slate-800 hover:border-slate-700" : "bg-white border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between text-emerald-600 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider">Contacted</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <div className="text-xl font-black text-emerald-700 dark:text-emerald-400">{metrics.contacted}</div>
          <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">Station actioned</span>
        </div>

        {/* CONTACT ATTEMPTED */}
        <div 
          onClick={() => onSelectContactStatusFilter("CONTACT_ATTEMPTED")}
          className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 hover:scale-[1.02] ${
            activeContactStatusFilter === "CONTACT_ATTEMPTED"
              ? "bg-amber-50 border-amber-500 ring-2 ring-amber-500/20 shadow-sm" 
              : isDark ? "bg-slate-900 border-slate-800 hover:border-slate-700" : "bg-white border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between text-amber-600 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider">Attempted</span>
            <PhoneCall className="h-3.5 w-3.5 text-amber-600" />
          </div>
          <div className="text-xl font-black text-amber-700 dark:text-amber-400">{metrics.contactAttempted}</div>
          <span className="text-[10px] text-amber-600 font-semibold block mt-0.5">Queued / Busy</span>
        </div>

        {/* CUSTOMER UNREACHABLE */}
        <div 
          onClick={() => onSelectContactStatusFilter("CUSTOMER_UNREACHABLE")}
          className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 hover:scale-[1.02] ${
            activeContactStatusFilter === "CUSTOMER_UNREACHABLE"
              ? "bg-orange-50 border-orange-500 ring-2 ring-orange-500/20 shadow-sm" 
              : isDark ? "bg-slate-900 border-slate-800 hover:border-slate-700" : "bg-white border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between text-orange-600 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider">Unreachable</span>
            <PhoneMissed className="h-3.5 w-3.5 text-orange-600" />
          </div>
          <div className="text-xl font-black text-orange-700 dark:text-orange-400">{metrics.customerUnreachable}</div>
          <span className="text-[10px] text-orange-600 font-semibold block mt-0.5">No response</span>
        </div>

        {/* SLA BREACHED */}
        <div 
          onClick={() => onSelectContactStatusFilter("SLA_BREACHED")}
          className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 hover:scale-[1.02] ${
            activeContactStatusFilter === "SLA_BREACHED"
              ? "bg-red-50 border-red-600 ring-2 ring-red-600/20 shadow-sm" 
              : metrics.slaBreached > 0
                ? "bg-red-50/40 border-red-200 hover:border-red-300"
                : isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between text-red-600 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider">SLA Breached</span>
            <ShieldAlert className="h-3.5 w-3.5 text-red-600" />
          </div>
          <div className="text-xl font-black text-red-700 dark:text-red-400">{metrics.slaBreached}</div>
          <span className="text-[10px] text-red-600 font-semibold block mt-0.5">&gt; 24 hrs pending</span>
        </div>

        {/* FOLLOW-UP DUE */}
        <div 
          onClick={() => onSelectContactStatusFilter("FOLLOW_UP_DUE")}
          className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 hover:scale-[1.02] ${
            activeContactStatusFilter === "FOLLOW_UP_DUE"
              ? "bg-purple-50 border-purple-500 ring-2 ring-purple-500/20 shadow-sm" 
              : isDark ? "bg-slate-900 border-slate-800 hover:border-slate-700" : "bg-white border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between text-purple-600 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider">Follow-up Due</span>
            <CalendarClock className="h-3.5 w-3.5 text-purple-600" />
          </div>
          <div className="text-xl font-black text-purple-700 dark:text-purple-400">{metrics.followUpDue}</div>
          <span className="text-[10px] text-purple-600 font-semibold block mt-0.5">Today / overdue</span>
        </div>

      </div>

      {/* Primary Clickable Contact Status Filter Bar */}
      <div className={`p-2 rounded-xl border ${isDark ? "bg-slate-900/60 border-slate-800" : "bg-slate-100 border-slate-200"}`}>
        <div className="flex items-center justify-between px-2 py-1 mb-1.5">
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
              SERVICE STATION CONTACT STATUS (PRIMARY FILTER)
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-semibold">
            Showing: <strong className="text-blue-600">{activeContactStatusFilter}</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5">
          {filterButtons.map((btn) => {
            const isSelected = activeContactStatusFilter === btn.id;
            const Icon = btn.icon;

            return (
              <button
                key={btn.id}
                type="button"
                onClick={() => onSelectContactStatusFilter(btn.id)}
                className={`py-2 px-2.5 rounded-lg border text-left transition-all duration-150 cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? btn.id === "NOT_CONTACTED"
                      ? "bg-rose-600 border-rose-700 text-white shadow-sm font-black"
                      : btn.id === "CONTACTED"
                        ? "bg-emerald-600 border-emerald-700 text-white shadow-sm font-black"
                        : btn.id === "CONTACT_ATTEMPTED"
                          ? "bg-amber-600 border-amber-700 text-white shadow-sm font-black"
                          : btn.id === "CUSTOMER_UNREACHABLE"
                            ? "bg-orange-600 border-orange-700 text-white shadow-sm font-black"
                            : "bg-blue-700 border-blue-800 text-white shadow-sm font-black"
                    : isDark
                      ? "bg-slate-950/70 border-slate-800 text-slate-300 hover:bg-slate-800"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[10px] font-black uppercase tracking-wider truncate">
                    {btn.label}
                  </span>
                  <Icon className={`h-3 w-3 ${isSelected ? "text-white" : "text-slate-400"}`} />
                </div>
                <div className="flex items-baseline justify-between mt-1 w-full">
                  <span className={`text-base font-black ${isSelected ? "text-white" : "text-slate-900 dark:text-slate-100"}`}>
                    {btn.count}
                  </span>
                  {btn.urgent && !isSelected && (
                    <span className="text-[9px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1 py-0.2 rounded">
                      Urgent
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Service Station Performance Summary Table */}
      <div className={`rounded-xl border overflow-hidden shadow-xs ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}`}>
        <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/70 dark:bg-slate-950/40">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-600" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
              Service Station Contact Performance Summary
            </h3>
          </div>
          <span className="text-[10px] text-slate-500 font-semibold">
            Click any cell to immediately filter cases by Station & Contact Status
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                <th className="py-2.5 px-3">Service Station</th>
                <th className="py-2.5 px-2 text-center">Total Cases</th>
                <th className="py-2.5 px-2 text-center text-rose-600 bg-rose-50/50 dark:bg-rose-950/20">Not Contacted</th>
                <th className="py-2.5 px-2 text-center text-emerald-600">Contacted</th>
                <th className="py-2.5 px-2 text-center text-amber-600">Attempted</th>
                <th className="py-2.5 px-2 text-center text-orange-600">Unreachable</th>
                <th className="py-2.5 px-2 text-center text-red-600">SLA Breached</th>
                <th className="py-2.5 px-3 text-right">Contact Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {stationSummary.map((st) => {
                const isStationSelected = activeStationFilter === st.code;

                return (
                  <tr 
                    key={st.code}
                    className={`transition-colors ${
                      isStationSelected 
                        ? "bg-blue-50/60 dark:bg-blue-950/30 font-bold" 
                        : "hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <td className="py-2 px-3">
                      <button
                        type="button"
                        onClick={() => onSelectStationFilter(st.code)}
                        className="text-left font-bold text-slate-900 dark:text-slate-100 hover:text-blue-600 cursor-pointer flex items-center gap-1.5"
                      >
                        <span>{st.name}</span>
                        {st.rejected > 0 && (
                          <span className="text-[9px] font-black text-rose-700 bg-rose-100 px-1 py-0.2 rounded" title={`${st.rejected} rejected cases`}>
                            {st.rejected} rej
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="py-2 px-2 text-center font-bold text-slate-800 dark:text-slate-200">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectStationFilter(st.code);
                          onSelectContactStatusFilter("ALL");
                        }}
                        className="hover:underline cursor-pointer"
                      >
                        {st.total}
                      </button>
                    </td>
                    <td className="py-2 px-2 text-center bg-rose-50/40 dark:bg-rose-950/10">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectStationFilter(st.code);
                          onSelectContactStatusFilter("NOT_CONTACTED");
                        }}
                        className={`font-black px-2 py-0.5 rounded cursor-pointer transition-colors ${
                          st.notContacted > 0 
                            ? "bg-rose-100 text-rose-800 hover:bg-rose-200" 
                            : "text-slate-400"
                        }`}
                      >
                        {st.notContacted}
                      </button>
                    </td>
                    <td className="py-2 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectStationFilter(st.code);
                          onSelectContactStatusFilter("CONTACTED");
                        }}
                        className={`font-bold px-2 py-0.5 rounded cursor-pointer ${
                          st.contacted > 0 
                            ? "text-emerald-700 dark:text-emerald-400 hover:underline" 
                            : "text-slate-400"
                        }`}
                      >
                        {st.contacted}
                      </button>
                    </td>
                    <td className="py-2 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectStationFilter(st.code);
                          onSelectContactStatusFilter("CONTACT_ATTEMPTED");
                        }}
                        className={`font-bold px-2 py-0.5 rounded cursor-pointer ${
                          st.attempted > 0 
                            ? "text-amber-700 dark:text-amber-400 hover:underline" 
                            : "text-slate-400"
                        }`}
                      >
                        {st.attempted}
                      </button>
                    </td>
                    <td className="py-2 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectStationFilter(st.code);
                          onSelectContactStatusFilter("CUSTOMER_UNREACHABLE");
                        }}
                        className={`font-bold px-2 py-0.5 rounded cursor-pointer ${
                          st.unreachable > 0 
                            ? "text-orange-700 dark:text-orange-400 hover:underline" 
                            : "text-slate-400"
                        }`}
                      >
                        {st.unreachable}
                      </button>
                    </td>
                    <td className="py-2 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectStationFilter(st.code);
                          onSelectContactStatusFilter("SLA_BREACHED");
                        }}
                        className={`font-black px-2 py-0.5 rounded cursor-pointer ${
                          st.slaBreached > 0 
                            ? "bg-red-100 text-red-800 hover:bg-red-200" 
                            : "text-slate-400"
                        }`}
                      >
                        {st.slaBreached}
                      </button>
                    </td>
                    <td className="py-2 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className={`h-full ${st.contactRate >= 70 ? "bg-emerald-500" : st.contactRate >= 40 ? "bg-amber-500" : "bg-rose-500"}`}
                            style={{ width: `${st.contactRate}%` }}
                          />
                        </div>
                        <span className="font-mono font-bold text-[11px]">{st.contactRate}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
