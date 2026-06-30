import React from "react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  colorClass?: string;
  onClick?: () => void;
}

export default function MetricCard({ title, value, subtitle, icon, colorClass = "bg-white border-slate-200 text-slate-900 shadow-sm", onClick }: MetricCardProps) {
  return (
    <div 
      onClick={onClick}
      className={`p-4 rounded-lg border flex items-center justify-between transition-all hover:scale-[1.01] ${onClick ? "cursor-pointer hover:shadow-md hover:border-slate-300" : ""} ${colorClass}`}
    >
      <div className="space-y-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-sans">
          {title}
        </span>
        <span className="text-2xl font-black tracking-tight block">
          {value}
        </span>
        {subtitle && (
          <span className="text-[10px] text-slate-500 block">
            {subtitle}
          </span>
        )}
      </div>
      <div className="p-2.5 bg-slate-100/50 rounded-lg text-slate-500">
        {icon}
      </div>
    </div>
  );
}

