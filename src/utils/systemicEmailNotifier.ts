import { Complaint, StationProfile, SystemicEmailLog } from "../types";
import { STATIONS } from "../demoData";

// Web Audio API synth chime for real-time Call Center audio alerts
export function playCallCenterNotificationSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const now = ctx.currentTime;

    // Chime Note 1 (E5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(659.25, now);
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15);

    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.4);

    // Chime Note 2 (A5 -> D6)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, now + 0.15);
    osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.35);

    gain2.gain.setValueAtTime(0.3, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.55);
  } catch (err) {
    console.error("Audio chime play error:", err);
  }
}

// Find matching station profile by code or name
export function findStationProfile(stationIdentifier: string): StationProfile | undefined {
  const normalized = stationIdentifier.trim().toLowerCase();
  return STATIONS.find(
    (s) =>
      s.name.toLowerCase() === normalized ||
      s.code.toLowerCase() === normalized ||
      s.name.toLowerCase().includes(normalized) ||
      normalized.includes(s.code.toLowerCase())
  );
}

// Generate structured systemic email from callcenter@idealgroup.lk to workstation personnel
export function generateSystemicEmailContent(
  station: StationProfile,
  assignedComplaints: Complaint[]
): { recipients: string[]; subject: string; bodyHtml: string } {
  const recipients = station.officers
    ? station.officers.map((o) => o.email)
    : station.email
    ? station.email.split(",").map((e) => e.trim())
    : ["callcenter@idealgroup.lk"];

  const count = assignedComplaints.length;
  const subject = `[Ideal Aftermarket] Systemic Dispatch Notice - ${count} Pending Complaint(s) Assigned to ${station.name}`;

  const rowsHtml = assignedComplaints
    .map(
      (c, idx) => `
    <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 0 ? "background-color: #f8fafc;" : ""}">
      <td style="padding: 10px; font-weight: bold; font-family: monospace; color: #1e293b;">${c.id}</td>
      <td style="padding: 10px; font-weight: bold; color: #0284c7;">${c.woNo || "N/A"} / ${c.vehicleRegNo || "N/A"}</td>
      <td style="padding: 10px; font-weight: bold; color: #0f172a;">${c.customerName}<br/><span style="font-size: 11px; color: #64748b;">${c.customerPhone}</span></td>
      <td style="padding: 10px; color: #334155; max-width: 250px;">${c.description}</td>
      <td style="padding: 10px; font-size: 11px; color: #64748b;">${c.date}</td>
      <td style="padding: 10px;">
        <span style="background-color: #ffe4e6; color: #9f1239; border: 1px solid #f43f5e; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: bold;">
          ${c.status || "Pending Action"}
        </span>
      </td>
    </tr>
  `
    )
    .join("");

  const officersListHtml = station.officers
    ? station.officers
        .map((o) => `<li><strong>${o.name}</strong> (${o.role}) &bull; Email: ${o.email} &bull; Tel: ${o.phone}</li>`)
        .join("")
    : `<li>Email: ${station.email} &bull; Tel: ${station.phone}</li>`;

  const bodyHtml = `
    <div style="font-family: Arial, sans-serif; background-color: #f1f5f9; padding: 24px; color: #1e293b;">
      <div style="max-width: 700px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #cbd5e1; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
        
        <!-- Header -->
        <div style="background-color: #0f172a; padding: 20px 24px; color: #ffffff; text-align: left;">
          <div style="font-size: 11px; font-weight: bold; letter-spacing: 2px; color: #38bdf8; text-transform: uppercase;">Ideal Group Aftermarket Operations</div>
          <h2 style="margin: 4px 0 0 0; font-size: 18px; font-weight: 800; color: #ffffff;">Systemic Complaint Dispatch Notification</h2>
          <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">From: <strong>callcenter@idealgroup.lk</strong></div>
        </div>

        <!-- Body Content -->
        <div style="padding: 24px; text-align: left;">
          <div style="background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 14px; margin-bottom: 20px;">
            <p style="margin: 0 0 6px 0; font-size: 14px; font-weight: bold; color: #0369a1;">📍 Destination Workstation: ${station.name}</p>
            <p style="margin: 0; font-size: 12px; color: #334155;"><strong>Address:</strong> ${station.address || "Ideal Motors Station"}</p>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #334155;"><strong>Assigned Station Personnel:</strong></p>
            <ul style="margin: 4px 0 0 0; padding-left: 20px; font-size: 12px; color: #475569;">
              ${officersListHtml}
            </ul>
          </div>

          <p style="font-size: 13px; line-height: 1.5; color: #334155;">
            Dear Station Team,
          </p>
          <p style="font-size: 13px; line-height: 1.5; color: #334155;">
            The Ideal Group Central Call Center has logged <strong>${count} customer complaint(s)</strong> requiring immediate aftermarket inspection, customer contact, and resolution action at your workstation.
          </p>

          <h3 style="font-size: 13px; font-weight: bold; text-transform: uppercase; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-top: 24px;">
            Assigned Complaint Details (${count})
          </h3>

          <div style="overflow-x: auto; margin-top: 12px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
              <thead>
                <tr style="background-color: #e2e8f0; color: #1e293b; font-weight: bold; font-size: 11px; text-transform: uppercase;">
                  <th style="padding: 8px;">Complaint No</th>
                  <th style="padding: 8px;">WO / Reg No</th>
                  <th style="padding: 8px;">Customer</th>
                  <th style="padding: 8px;">Issue Description</th>
                  <th style="padding: 8px;">Received</th>
                  <th style="padding: 8px;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>

          <div style="margin-top: 24px; padding: 14px; background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; font-size: 12px; color: #991b1b;">
            <p style="margin: 0; font-weight: bold;">⚠️ Mandatory Aftermarket Resolution Action Required</p>
            <p style="margin: 4px 0 0 0; line-height: 1.4;">
              Please contact the customer immediately and update the <strong>Date Contacted</strong> and <strong>Solution Provided</strong> on the Ideal Group Complaint System portal. For any corrections or schedule issues, contact <strong>callcenter@idealgroup.lk</strong>.
            </p>
          </div>
        </div>

        <!-- Footer -->
        <div style="background-color: #f8fafc; padding: 14px 24px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center;">
          This is an automated systemic notification sent by <strong>Ideal Group Central CX Call Center</strong> (callcenter@idealgroup.lk).
        </div>
      </div>
    </div>
  `;

  return { recipients, subject, bodyHtml };
}

// Local storage key for email log history
const EMAIL_LOG_STORAGE_KEY = "ideal_group_systemic_email_logs";

export function getStoredSystemicEmailLogs(): SystemicEmailLog[] {
  try {
    const raw = localStorage.getItem(EMAIL_LOG_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveSystemicEmailLogs(logs: SystemicEmailLog[]) {
  try {
    localStorage.setItem(EMAIL_LOG_STORAGE_KEY, JSON.stringify(logs));
  } catch (err) {
    console.error("Failed to save email logs:", err);
  }
}

// Trigger systemic email dispatch for a batch of complaints per station
export function dispatchSystemicEmailsForComplaints(
  complaints: Complaint[]
): SystemicEmailLog[] {
  const logs: SystemicEmailLog[] = getStoredSystemicEmailLogs();
  const newDispatchedLogs: SystemicEmailLog[] = [];

  // Group complaints by station
  const stationGroups: { [stationCode: string]: Complaint[] } = {};
  complaints.forEach((c) => {
    if (!c.station) return;
    const stName = c.station;
    if (!stationGroups[stName]) stationGroups[stName] = [];
    stationGroups[stName].push(c);
  });

  Object.keys(stationGroups).forEach((stKey) => {
    const group = stationGroups[stKey];
    const profile = findStationProfile(stKey);

    if (profile && group.length > 0) {
      const emailContent = generateSystemicEmailContent(profile, group);
      const emailLog: SystemicEmailLog = {
        id: "EML-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
        station: profile.name,
        sentAt: new Date().toISOString(),
        fromEmail: "callcenter@idealgroup.lk",
        recipients: emailContent.recipients,
        subject: emailContent.subject,
        complaintCount: group.length,
        complaintIds: group.map((item) => item.id),
        bodyHtml: emailContent.bodyHtml,
        status: "Delivered",
      };

      logs.unshift(emailLog);
      newDispatchedLogs.push(emailLog);
    }
  });

  saveSystemicEmailLogs(logs);

  // Send to backend API asynchronously for persistence
  if (newDispatchedLogs.length > 0) {
    fetch("/api/email-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logs: newDispatchedLogs }),
    }).catch((err) => console.log("Backend email-logs save fallback:", err));
  }

  return newDispatchedLogs;
}
