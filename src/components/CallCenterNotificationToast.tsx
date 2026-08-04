import React from "react";
import { 
  Bell, 
  Volume2, 
  VolumeX, 
  X, 
  CheckCircle2, 
  Building2, 
  Mail, 
  PhoneCall, 
  Clock,
  UserCheck
} from "lucide-react";

export interface CallCenterNotification {
  id: string;
  timestamp: string;
  stationName: string;
  complaintId: string;
  customerName: string;
  actionSummary: string;
  updatedBy: string;
}

interface CallCenterNotificationToastProps {
  notifications: CallCenterNotification[];
  onDismiss: (id: string) => void;
  onClearAll: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenEmailModal: () => void;
}

export const CallCenterNotificationToast: React.FC<CallCenterNotificationToastProps> = ({
  notifications,
  onDismiss,
  onClearAll,
  soundEnabled,
  onToggleSound,
  onOpenEmailModal,
}) => {
  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-16 right-4 z-50 max-w-sm w-full space-y-2 pointer-events-auto">
      {/* Top Controls Header */}
      <div className="bg-slate-900/90 text-white backdrop-blur-md px-3 py-2 rounded-xl border border-slate-700 shadow-xl flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 font-bold">
          <Bell className="h-4 w-4 text-amber-400 animate-bounce" />
          <span>Call Center Real-Time Alerts ({notifications.length})</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Sound Toggle */}
          <button
            type="button"
            onClick={onToggleSound}
            title={soundEnabled ? "Audio alert sound enabled" : "Audio sound muted"}
            className={`p-1 rounded-lg transition-colors cursor-pointer ${
              soundEnabled ? "bg-emerald-500/30 text-emerald-300 border border-emerald-400/40" : "bg-slate-800 text-slate-400"
            }`}
          >
            {soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          </button>

          <button
            type="button"
            onClick={onClearAll}
            className="text-[10px] font-bold text-slate-300 hover:text-white underline cursor-pointer"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Stacked Notifications */}
      <div className="space-y-2 max-h-[80vh] overflow-y-auto pr-1">
        {notifications.map((item) => (
          <div
            key={item.id}
            className="bg-white dark:bg-slate-900 border-2 border-emerald-500/80 rounded-xl p-3.5 shadow-2xl space-y-2 text-left animate-slide-in relative group"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-lg border border-emerald-300/60">
                  <UserCheck className="h-4 w-4" />
                </span>
                <div>
                  <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <span>Service Station Contacted Customer</span>
                  </h4>
                  <p className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                    📍 {item.stationName}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onDismiss(item.id)}
                className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-200/80 dark:border-slate-700/80 space-y-1 text-xs">
              <div className="flex items-center justify-between font-extrabold text-slate-800 dark:text-slate-200">
                <span className="font-mono text-blue-600 dark:text-blue-400">{item.complaintId}</span>
                <span className="text-slate-900 dark:text-slate-100">{item.customerName}</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug font-medium">
                {item.actionSummary}
              </p>
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
              <span className="flex items-center gap-1 font-mono">
                <Clock className="h-3 w-3" /> {new Date(item.timestamp).toLocaleTimeString()}
              </span>
              <span>Logged by: <strong>{item.updatedBy}</strong></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
