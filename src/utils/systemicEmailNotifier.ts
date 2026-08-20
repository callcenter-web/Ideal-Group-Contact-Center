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
  const subject = `[Ideal Aftermarket] Complaint Summary Notice - ${count} Assigned Case(s) for ${station.name}`;

  // Calculate aggregated counts
  const pendingActionCount = assignedComplaints.filter(
    (c) => c.status === "Pending" || !c.status || c.stationResponseStatus === "Pending" || !c.stationContactedDate
  ).length;

  const inProgressCount = assignedComplaints.filter(
    (c) => c.status === "In Progress" || c.status === "Contacted" || (c.stationContactedDate && c.status !== "Resolved")
  ).length;

  const resolvedCount = assignedComplaints.filter((c) => c.status === "Resolved").length;

  const rejectedCount = assignedComplaints.filter(
    (c) =>
      c.stationResponseStatus === "Rejected" ||
      c.stationResponseStatus === "Rejected by Call Center" ||
      c.stationResponseStatus === "Returned to Service Station" ||
      c.feedbackStatus === "Rejected Again to Service Station" ||
      c.feedbackStatus === "Returned to Service Station" ||
      c.finalStatus?.includes("Rejected") ||
      c.finalStatus?.includes("Returned")
  ).length;

  const getAgingDays = (c: Complaint) => {
    if (!c.date) return 0;
    const t = new Date(c.date).getTime();
    if (isNaN(t)) return 0;
    return Math.max(0, Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24)));
  };

  const highPriorityCount = assignedComplaints.filter(
    (c) =>
      c.initialSatisfaction === "Very Dissatisfied" ||
      getAgingDays(c) > 5 ||
      c.feedbackStatus === "Still Dissatisfied"
  ).length;

  // Category counts
  const categoryMap: Record<string, number> = {};
  assignedComplaints.forEach((c) => {
    const cat = c.category || c.mchCodeDescription || "General Service";
    categoryMap[cat] = (categoryMap[cat] || 0) + 1;
  });

  const categoryRowsHtml = Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([cat, catCount], idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 0 ? "background-color: #f8fafc;" : ""}">
        <td style="padding: 9px 12px; font-weight: bold; color: #1e293b; font-size: 12px;">${cat}</td>
        <td style="padding: 9px 12px; text-align: center; font-weight: 800; color: #0369a1; font-size: 13px;">${catCount}</td>
        <td style="padding: 9px 12px; text-align: right; color: #64748b; font-size: 11px;">${count > 0 ? Math.round((catCount / count) * 100) : 0}%</td>
      </tr>
    `
    )
    .join("");

  // Aging distribution counts
  const aging03 = assignedComplaints.filter((c) => getAgingDays(c) <= 3).length;
  const aging35 = assignedComplaints.filter((c) => getAgingDays(c) > 3 && getAgingDays(c) <= 5).length;
  const aging610 = assignedComplaints.filter((c) => getAgingDays(c) > 5 && getAgingDays(c) <= 10).length;
  const agingOver10 = assignedComplaints.filter((c) => getAgingDays(c) > 10).length;

  const officersListHtml = station.officers
    ? station.officers
        .map((o) => `<li><strong>${o.name}</strong> (${o.role}) &bull; Email: ${o.email} &bull; Tel: ${o.phone}</li>`)
        .join("")
    : `<li>Email: ${station.email} &bull; Tel: ${station.phone}</li>`;

  const bodyHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; padding: 24px; color: #1e293b;">
      <div style="max-width: 680px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #cbd5e1; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
        
        <!-- Header -->
        <div style="background-color: #0f172a; padding: 22px 24px; color: #ffffff; text-align: left;">
          <div style="font-size: 11px; font-weight: 800; letter-spacing: 2px; color: #38bdf8; text-transform: uppercase;">Ideal Group Aftermarket Operations</div>
          <h2 style="margin: 6px 0 0 0; font-size: 20px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px;">Workstation Complaint Summary Notice</h2>
          <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">Sent by: <strong style="color: #e2e8f0;">callcenter@idealgroup.lk</strong> &bull; ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</div>
        </div>

        <!-- Body Content -->
        <div style="padding: 24px; text-align: left;">
          
          <!-- Station Profile Info Box -->
          <div style="background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 14px; margin-bottom: 20px;">
            <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 800; color: #0369a1;">📍 Assigned Workstation: ${station.name}</p>
            <p style="margin: 0; font-size: 12px; color: #334155;"><strong>Address:</strong> ${station.address || "Ideal Motors Station"}</p>
            <p style="margin: 6px 0 2px 0; font-size: 12px; color: #334155;"><strong>Assigned Station Personnel:</strong></p>
            <ul style="margin: 2px 0 0 0; padding-left: 18px; font-size: 12px; color: #475569; line-height: 1.5;">
              ${officersListHtml}
            </ul>
          </div>

          <p style="font-size: 13px; line-height: 1.6; color: #334155; margin-bottom: 16px;">
            Dear Station Management Team,<br/>
            Please find the consolidated complaint assignment counts for <strong>${station.name}</strong>. Central Call Center has logged a total of <strong>${count} assigned case(s)</strong> requiring inspection, customer contact, and resolution update in the portal.
          </p>

          <!-- 4 Executive KPI Metric Count Cards -->
          <table style="width: 100%; border-collapse: separate; border-spacing: 8px; margin-bottom: 20px;">
            <tr>
              <td style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; text-align: center; width: 25%;">
                <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">Total Assigned</div>
                <div style="font-size: 22px; font-weight: 900; color: #0f172a; margin-top: 2px;">${count}</div>
                <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">Total Cases</div>
              </td>
              <td style="background-color: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; text-align: center; width: 25%;">
                <div style="font-size: 10px; font-weight: 800; color: #92400e; text-transform: uppercase;">To Contact</div>
                <div style="font-size: 22px; font-weight: 900; color: #b45309; margin-top: 2px;">${pendingActionCount}</div>
                <div style="font-size: 10px; color: #b45309; margin-top: 2px;">Pending Station</div>
              </td>
              <td style="background-color: #fee2e2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; text-align: center; width: 25%;">
                <div style="font-size: 10px; font-weight: 800; color: #991b1b; text-transform: uppercase;">High / Urgent</div>
                <div style="font-size: 22px; font-weight: 900; color: #dc2626; margin-top: 2px;">${highPriorityCount}</div>
                <div style="font-size: 10px; color: #dc2626; margin-top: 2px;">Critical Priority</div>
              </td>
              <td style="background-color: #ffedd5; border: 1px solid #fed7aa; border-radius: 8px; padding: 12px; text-align: center; width: 25%;">
                <div style="font-size: 10px; font-weight: 800; color: #9a3412; text-transform: uppercase;">Rejected / Re-action</div>
                <div style="font-size: 22px; font-weight: 900; color: #ea580c; margin-top: 2px;">${rejectedCount}</div>
                <div style="font-size: 10px; color: #ea580c; margin-top: 2px;">Returned to Station</div>
              </td>
            </tr>
          </table>

          <!-- 2 Column Breakdown Tables (Category Counts + Aging Counts) -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
              <!-- Category Count Table -->
              <td style="width: 50%; vertical-align: top; padding-right: 8px;">
                <h4 style="margin: 0 0 8px 0; font-size: 12px; font-weight: 800; text-transform: uppercase; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px;">
                  Category Summary Counts
                </h4>
                <table style="width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
                  <thead>
                    <tr style="background-color: #e2e8f0; color: #1e293b; font-weight: 800; font-size: 10px; text-transform: uppercase;">
                      <th style="padding: 6px 10px; text-align: left;">Category</th>
                      <th style="padding: 6px 10px; text-align: center;">Count</th>
                      <th style="padding: 6px 10px; text-align: right;">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${categoryRowsHtml || '<tr><td colspan="3" style="padding: 12px; text-align: center; color: #94a3b8;">No complaints logged</td></tr>'}
                  </tbody>
                </table>
              </td>

              <!-- Aging SLA Count Table -->
              <td style="width: 50%; vertical-align: top; padding-left: 8px;">
                <h4 style="margin: 0 0 8px 0; font-size: 12px; font-weight: 800; text-transform: uppercase; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px;">
                  SLA Aging Breakdown Counts
                </h4>
                <table style="width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
                  <thead>
                    <tr style="background-color: #e2e8f0; color: #1e293b; font-weight: 800; font-size: 10px; text-transform: uppercase;">
                      <th style="padding: 6px 10px; text-align: left;">Aging Range</th>
                      <th style="padding: 6px 10px; text-align: center;">Count</th>
                      <th style="padding: 6px 10px; text-align: right;">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style="border-bottom: 1px solid #e2e8f0; background-color: #f0fdf4;">
                      <td style="padding: 8px 10px; font-weight: bold; color: #166534; font-size: 11px;">0 - 3 Days</td>
                      <td style="padding: 8px 10px; text-align: center; font-weight: 900; color: #166534; font-size: 12px;">${aging03}</td>
                      <td style="padding: 8px 10px; text-align: right; font-size: 10px; color: #16a34a; font-weight: bold;">Normal</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0; background-color: #fffbeb;">
                      <td style="padding: 8px 10px; font-weight: bold; color: #92400e; font-size: 11px;">3 - 5 Days</td>
                      <td style="padding: 8px 10px; text-align: center; font-weight: 900; color: #92400e; font-size: 12px;">${aging35}</td>
                      <td style="padding: 8px 10px; text-align: right; font-size: 10px; color: #d97706; font-weight: bold;">Pending</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0; background-color: #fff7ed;">
                      <td style="padding: 8px 10px; font-weight: bold; color: #9a3412; font-size: 11px;">6 - 10 Days</td>
                      <td style="padding: 8px 10px; text-align: center; font-weight: 900; color: #9a3412; font-size: 12px;">${aging610}</td>
                      <td style="padding: 8px 10px; text-align: right; font-size: 10px; color: #ea580c; font-weight: bold;">Escalated</td>
                    </tr>
                    <tr style="background-color: #fef2f2;">
                      <td style="padding: 8px 10px; font-weight: bold; color: #991b1b; font-size: 11px;">&gt; 10 Days</td>
                      <td style="padding: 8px 10px; text-align: center; font-weight: 900; color: #991b1b; font-size: 12px;">${agingOver10}</td>
                      <td style="padding: 8px 10px; text-align: right; font-size: 10px; color: #dc2626; font-weight: bold;">Critical</td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </table>

          <!-- Mandatory Action Notice -->
          <div style="padding: 14px 16px; background-color: #f8fafc; border: 1px solid #cbd5e1; border-left: 4px solid #0284c7; border-radius: 6px; font-size: 12px; color: #334155; margin-bottom: 20px;">
            <p style="margin: 0 0 4px 0; font-weight: 800; color: #0369a1; font-size: 13px;">📋 Portal Action Required</p>
            <p style="margin: 0; line-height: 1.5;">
              To protect customer data privacy and streamline operations, full vehicle and customer records are securely hosted on the <strong>Ideal Group Complaint System Portal</strong>. Please log into your station dashboard to access customer phone numbers, conduct contact, and record the <strong>Date Contacted</strong> & <strong>Solution Provided</strong>.
            </p>
          </div>

          <!-- Central Support Contact -->
          <div style="font-size: 12px; color: #64748b; line-height: 1.5;">
            For urgent re-assignments or inquiries, contact the central CX team at <a href="mailto:callcenter@idealgroup.lk" style="color: #0284c7; font-weight: bold; text-decoration: none;">callcenter@idealgroup.lk</a>.
          </div>

        </div>

        <!-- Footer -->
        <div style="background-color: #0f172a; padding: 14px 24px; color: #94a3b8; font-size: 11px; text-align: center;">
          Sent by <strong>Ideal Group Central CX Call Center</strong> (<a href="mailto:callcenter@idealgroup.lk" style="color: #38bdf8; text-decoration: none;">callcenter@idealgroup.lk</a>). Generated automatically for workstation performance compliance.
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
