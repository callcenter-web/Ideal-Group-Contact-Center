import React from "react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  colorClass?: string;
  onClick?: () => void;
  theme?: "light" | "dark";
}

export default function MetricCard({ 
  title, 
  value, 
  subtitle, 
  icon, 
  colorClass = "bg-white border-slate-200 text-slate-900 shadow-sm", 
  onClick,
  theme = "light"
}: MetricCardProps) {
  const isDark = theme === "dark";
  let activeColorClass = colorClass;
  
  if (isDark) {
    if (colorClass.includes("bg-white")) {
      activeColorClass = "bg-slate-900/90 border-slate-800 text-slate-100 shadow-inner";
    } else if (colorClass.includes("bg-red-50")) {
      activeColorClass = "bg-red-950/30 border-red-900/40 text-red-300 shadow-inner shadow-red-950/25";
    } else if (colorClass.includes("bg-orange-50")) {
      activeColorClass = "bg-orange-950/30 border-orange-900/40 text-orange-300 shadow-inner shadow-orange-950/25";
    } else if (colorClass.includes("bg-green-50")) {
      activeColorClass = "bg-green-950/30 border-green-900/40 text-green-300 shadow-inner shadow-green-950/25";
    } else if (colorClass.includes("bg-blue-50")) {
      activeColorClass = "bg-blue-950/30 border-blue-900/40 text-blue-300 shadow-inner shadow-blue-950/25";
    }
  }

  return (
    <div 
      onClick={onClick}
      className={`p-4 rounded-xl border flex items-center justify-between transition-all duration-300 hover:scale-[1.01] ${
        onClick ? "cursor-pointer hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700" : ""
      } ${activeColorClass}`}
    >
      <div className="space-y-1">
        <span className={`text-[10px] font-black uppercase tracking-widest block font-sans ${
          isDark ? "text-slate-400" : "text-slate-500"
        }`}>
          {title}
        </span>
        <span className="text-2xl font-black tracking-tight block font-sans">
          {value}
        </span>
        {subtitle && (
          <span className={`text-[10px] block font-medium ${
            isDark ? "text-slate-500" : "text-slate-400"
          }`}>
            {subtitle}
          </span>
        )}
      </div>
      <div className={`p-2.5 rounded-lg transition-colors ${
        isDark ? "bg-slate-950/50 text-slate-400" : "bg-slate-100/60 text-slate-500"
      }`}>
        {icon}
      </div>
    </div>
  );
}
