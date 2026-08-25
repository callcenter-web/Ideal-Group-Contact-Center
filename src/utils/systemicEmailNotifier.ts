import { Complaint, StationProfile, SystemicEmailLog } from "../types";
import { STATIONS } from "../demoData";
import { saveEmailLogsCentral } from "./centralDbSync";
import { isStationContacted, isComplaintRejected } from "./stationUtils";
import { isComplaintPending, isComplaintResolved, isActiveCCRejectionRequired } from "./workflowTallyUtils";

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

// Helper to filter strictly the pending cases that a service station has to contact
export function getPendingCasesToContact(assignedComplaints: Complaint[]): Complaint[] {
  return assignedComplaints.filter((c) => isComplaintPending(c));
}

// Generate structured systemic email from callcenter@idealgroup.lk to workstation personnel
// Strictly contains summary counts, newly appointed times and counts for each, and pending to contact counts without individual case details
export function generateSystemicEmailContent(
  station: StationProfile,
  assignedComplaints: Complaint[]
): { recipients: string[]; subject: string; bodyHtml: string } {
  const recipients = station.officers
    ? station.officers.map((o) => o.email)
    : station.email
    ? station.email.split(",").map((e) => e.trim())
    : ["callcenter@idealgroup.lk"];

  // Filter strictly to cases that the Service Station has to contact
  const pendingCasesToContact = getPendingCasesToContact(assignedComplaints);
  const pendingCount = pendingCasesToContact.length;

  const now = new Date();
  const dispatchTimeString = now.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }) + " " + now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const subject = pendingCount > 0
    ? `[Ideal Group Call Center] Action Required: ${pendingCount} Pending Case(s) to Contact - ${station.name}`
    : `[Ideal Group Call Center] Status Notice: 0 Pending Cases to Contact - ${station.name}`;

  const getAgingDays = (c: Complaint) => {
    if (!c.date) return 0;
    const t = new Date(c.date).getTime();
    if (isNaN(t)) return 0;
    return Math.max(0, Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24)));
  };

  // Newly appointed cases (today or <= 1 day)
  const newlyAppointedCases = pendingCasesToContact.filter((c) => getAgingDays(c) <= 1);
  const newlyAppointedCount = newlyAppointedCases.length;

  const highPriorityCount = pendingCasesToContact.filter(
    (c) =>
      c.initialSatisfaction === "Very Dissatisfied" ||
      getAgingDays(c) > 3 ||
      c.feedbackStatus === "Still Dissatisfied"
  ).length;

  const rejectedCount = pendingCasesToContact.filter((c) => isComplaintRejected(c)).length;
  const overdueCount = pendingCasesToContact.filter((c) => getAgingDays(c) > 3).length;

  // 1. Group pending cases by Appointed Date / Time with count for each
  const appointedTimesMap: Record<string, { count: number; sampleDate: string; isRecent: boolean }> = {};
  pendingCasesToContact.forEach((c) => {
    const rawDate = c.date || "Recent";
    let formattedDate = rawDate;
    try {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        formattedDate = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
      }
    } catch {
      // keep rawDate
    }
    const aging = getAgingDays(c);
    if (!appointedTimesMap[formattedDate]) {
      appointedTimesMap[formattedDate] = { count: 0, sampleDate: rawDate, isRecent: aging <= 1 };
    }
    appointedTimesMap[formattedDate].count += 1;
  });

  const appointedTimesRowsHtml = Object.entries(appointedTimesMap)
    .sort((a, b) => new Date(b[1].sampleDate).getTime() - new Date(a[1].sampleDate).getTime())
    .map(([dateLabel, info], idx) => {
      const isToday = info.isRecent;
      return `
      <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 0 ? "background-color: #ffffff;" : "background-color: #f8fafc;"}">
        <td style="padding: 8px 12px; font-weight: 700; color: #1e293b; font-size: 12px;">
          📅 ${dateLabel}
          ${isToday ? '<span style="margin-left: 6px; padding: 2px 6px; background-color: #dbeafe; color: #1e40af; border-radius: 4px; font-size: 10px; font-weight: 800;">Newly Appointed</span>' : ""}
        </td>
        <td style="padding: 8px 12px; text-align: center; font-weight: 800; color: #0284c7; font-size: 13px;">
          ${info.count}
        </td>
        <td style="padding: 8px 12px; text-align: right; color: #64748b; font-size: 11px; font-weight: 600;">
          ${isToday ? "Immediate Contact Required" : "Follow-up Contact Required"}
        </td>
      </tr>
    `;
    })
    .join("");

  // 2. Category counts for pending cases ("Count for Each Category")
  const categoryMap: Record<string, number> = {};
  pendingCasesToContact.forEach((c) => {
    const cat = c.category || c.mchCodeDescription || "General Service";
    categoryMap[cat] = (categoryMap[cat] || 0) + 1;
  });

  const categoryRowsHtml = Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([cat, catCount], idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 0 ? "background-color: #ffffff;" : "background-color: #f8fafc;"}">
        <td style="padding: 8px 12px; font-weight: 600; color: #1e293b; font-size: 12px;">${cat}</td>
        <td style="padding: 8px 12px; text-align: center; font-weight: 800; color: #0f172a; font-size: 13px;">${catCount}</td>
        <td style="padding: 8px 12px; text-align: right; color: #64748b; font-size: 11px; font-weight: 600;">
          ${pendingCount > 0 ? Math.round((catCount / pendingCount) * 100) : 0}%
        </td>
      </tr>
    `
    )
    .join("");

  // 3. Aging distribution counts for pending cases
  const aging01 = pendingCasesToContact.filter((c) => getAgingDays(c) <= 1).length;
  const aging23 = pendingCasesToContact.filter((c) => getAgingDays(c) >= 2 && getAgingDays(c) <= 3).length;
  const aging45 = pendingCasesToContact.filter((c) => getAgingDays(c) >= 4 && getAgingDays(c) <= 5).length;
  const agingOver5 = pendingCasesToContact.filter((c) => getAgingDays(c) > 5).length;

  const officersListHtml = station.officers
    ? station.officers
        .map((o) => `<li><strong>${o.name}</strong> (${o.role}) &bull; Email: <a href="mailto:${o.email}" style="color: #0284c7; text-decoration: none;">${o.email}</a> &bull; Tel: <strong>${o.phone}</strong></li>`)
        .join("")
    : `<li>Email: ${station.email} &bull; Tel: ${station.phone}</li>`;

  // Crisp, clean Light Mode Email Template
  const bodyHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 24px; color: #1e293b;">
      <div style="max-width: 680px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        
        <!-- Clean Light Header -->
        <div style="background-color: #ffffff; border-bottom: 3px solid #0284c7; padding: 20px 24px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="vertical-align: middle;">
                <div style="font-size: 11px; font-weight: 800; letter-spacing: 1.5px; color: #0284c7; text-transform: uppercase;">Ideal Group Customer Experience</div>
                <h1 style="margin: 4px 0 0 0; font-size: 19px; font-weight: 900; color: #0f172a; letter-spacing: -0.3px;">
                  ${pendingCount > 0 ? `Action Notice: ${pendingCount} Pending Case(s) to Contact` : `Status Update: 0 Pending Cases`}
                </h1>
              </td>
              <td style="text-align: right; vertical-align: middle;">
                <div style="display: inline-block; background-color: #f0f9ff; border: 1px solid #bae6fd; padding: 6px 12px; border-radius: 8px;">
                  <span style="font-size: 10px; font-weight: 800; color: #0369a1; text-transform: uppercase; display: block;">Station Code</span>
                  <span style="font-size: 14px; font-weight: 900; color: #0284c7;">${station.code || station.name}</span>
                </div>
              </td>
            </tr>
          </table>
          <div style="margin-top: 10px; font-size: 11px; color: #64748b; border-top: 1px solid #f1f5f9; pt: 8px; padding-top: 8px;">
            <strong>Sender:</strong> callcenter@idealgroup.lk &bull; <strong>Dispatch Time:</strong> ${dispatchTimeString}
          </div>
        </div>

        <!-- Body Content -->
        <div style="padding: 24px; text-align: left;">
          
          <!-- Station Assignment Info -->
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 20px;">
            <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">
              📍 Workstation: <span style="color: #0284c7;">${station.name}</span>
            </div>
            <div style="font-size: 12px; color: #475569; margin-bottom: 8px;">
              <strong>Location:</strong> ${station.address || "Ideal Motors Station"}
            </div>
            <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">
              Assigned Workshop Personnel:
            </div>
            <ul style="margin: 0; padding-left: 18px; font-size: 11px; color: #334155; line-height: 1.6;">
              ${officersListHtml}
            </ul>
          </div>

          <!-- Summary Intro -->
          <p style="font-size: 13px; line-height: 1.5; color: #334155; margin-bottom: 20px;">
            Dear Service Advisors & Workshop Management Team,<br/>
            ${
              pendingCount > 0
                ? `Central Call Center has recorded <strong>${pendingCount} pending customer complaint case(s)</strong> assigned to <strong>${station.name}</strong> that require your immediate customer phone contact, inspection, and status update in the portal.`
                : `There are currently <strong>0 pending complaints</strong> requiring customer contact for <strong>${station.name}</strong>. All assigned cases are up to date.`
            }
          </p>

          <!-- 4 Executive Count Metric Cards -->
          <div style="margin-bottom: 24px;">
            <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #475569; letter-spacing: 0.5px; margin-bottom: 8px;">
              📊 Pending Contact & Appointment Count Summary
            </div>
            <table style="width: 100%; border-collapse: separate; border-spacing: 8px; margin-left: -8px; margin-right: -8px;">
              <tr>
                <td style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px; text-align: center; width: 25%;">
                  <div style="font-size: 10px; font-weight: 800; color: #166534; text-transform: uppercase;">To Contact</div>
                  <div style="font-size: 26px; font-weight: 900; color: #15803d; margin-top: 2px;">${pendingCount}</div>
                  <div style="font-size: 10px; color: #166534; font-weight: 600; margin-top: 2px;">Pending Action</div>
                </td>
                <td style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px; text-align: center; width: 25%;">
                  <div style="font-size: 10px; font-weight: 800; color: #1e40af; text-transform: uppercase;">Newly Appointed</div>
                  <div style="font-size: 26px; font-weight: 900; color: #2563eb; margin-top: 2px;">${newlyAppointedCount}</div>
                  <div style="font-size: 10px; color: #1e40af; font-weight: 600; margin-top: 2px;">Last 24 Hours</div>
                </td>
                <td style="background-color: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 12px; text-align: center; width: 25%;">
                  <div style="font-size: 10px; font-weight: 800; color: #9a3412; text-transform: uppercase;">Returned / Re-action</div>
                  <div style="font-size: 26px; font-weight: 900; color: #ea580c; margin-top: 2px;">${rejectedCount}</div>
                  <div style="font-size: 10px; color: #9a3412; font-weight: 600; margin-top: 2px;">Re-action Required</div>
                </td>
                <td style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; text-align: center; width: 25%;">
                  <div style="font-size: 10px; font-weight: 800; color: #991b1b; text-transform: uppercase;">High Priority / SLA</div>
                  <div style="font-size: 26px; font-weight: 900; color: #dc2626; margin-top: 2px;">${highPriorityCount}</div>
                  <div style="font-size: 10px; color: #991b1b; font-weight: 600; margin-top: 2px;">Immediate Attention</div>
                </td>
              </tr>
            </table>
          </div>

          <!-- TABLE 1: NEWLY APPOINTED TIMES & CASE COUNTS -->
          <div style="margin-bottom: 22px;">
            <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; color: #0f172a; margin-bottom: 6px; border-bottom: 2px solid #0284c7; padding-bottom: 4px;">
              ⏱️ Appointed Times & Daily Intake Count
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
              <thead>
                <tr style="background-color: #f1f5f9; color: #334155; font-weight: 800; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">
                  <th style="padding: 8px 12px; text-align: left;">Appointment Date / Intake Time</th>
                  <th style="padding: 8px 12px; text-align: center;">Case Count</th>
                  <th style="padding: 8px 12px; text-align: right;">Action Requirement</th>
                </tr>
              </thead>
              <tbody>
                ${appointedTimesRowsHtml || '<tr><td colspan="3" style="padding: 12px; text-align: center; color: #16a34a; font-weight: bold; background-color: #f0fdf4;">✅ No pending cases recorded.</td></tr>'}
              </tbody>
            </table>
          </div>

          <!-- TABLE 2: BREAKDOWN COUNT FOR EACH CATEGORY & AGING DISTRIBUTION -->
          <div style="margin-bottom: 22px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <!-- Category Counts -->
                <td style="width: 50%; vertical-align: top; padding-right: 6px;">
                  <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; color: #0f172a; margin-bottom: 6px; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px;">
                    📂 Count by Complaint Category
                  </div>
                  <table style="width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
                    <thead>
                      <tr style="background-color: #f1f5f9; color: #334155; font-weight: 800; font-size: 10px; text-transform: uppercase;">
                        <th style="padding: 6px 10px; text-align: left;">Category</th>
                        <th style="padding: 6px 10px; text-align: center;">Count</th>
                        <th style="padding: 6px 10px; text-align: right;">Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${categoryRowsHtml || '<tr><td colspan="3" style="padding: 10px; text-align: center; color: #94a3b8;">No pending complaints</td></tr>'}
                    </tbody>
                  </table>
                </td>

                <!-- Aging Distribution Counts -->
                <td style="width: 50%; vertical-align: top; padding-left: 6px;">
                  <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; color: #0f172a; margin-bottom: 6px; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px;">
                    ⏳ Count by SLA Aging Range
                  </div>
                  <table style="width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
                    <thead>
                      <tr style="background-color: #f1f5f9; color: #334155; font-weight: 800; font-size: 10px; text-transform: uppercase;">
                        <th style="padding: 6px 10px; text-align: left;">Aging Range</th>
                        <th style="padding: 6px 10px; text-align: center;">Count</th>
                        <th style="padding: 6px 10px; text-align: right;">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style="border-bottom: 1px solid #e2e8f0; background-color: #f0fdf4;">
                        <td style="padding: 6px 10px; font-weight: bold; color: #166534;">0 - 1 Day (New)</td>
                        <td style="padding: 6px 10px; text-align: center; font-weight: 800; color: #166534;">${aging01}</td>
                        <td style="padding: 6px 10px; text-align: right; font-size: 10px; color: #16a34a; font-weight: bold;">New Intake</td>
                      </tr>
                      <tr style="border-bottom: 1px solid #e2e8f0; background-color: #ffffff;">
                        <td style="padding: 6px 10px; font-weight: 600; color: #1e293b;">2 - 3 Days</td>
                        <td style="padding: 6px 10px; text-align: center; font-weight: 800; color: #0f172a;">${aging23}</td>
                        <td style="padding: 6px 10px; text-align: right; font-size: 10px; color: #0284c7; font-weight: bold;">In SLA</td>
                      </tr>
                      <tr style="border-bottom: 1px solid #e2e8f0; background-color: #fffbeb;">
                        <td style="padding: 6px 10px; font-weight: bold; color: #92400e;">4 - 5 Days</td>
                        <td style="padding: 6px 10px; text-align: center; font-weight: 800; color: #92400e;">${aging45}</td>
                        <td style="padding: 6px 10px; text-align: right; font-size: 10px; color: #d97706; font-weight: bold;">Pending SLA</td>
                      </tr>
                      <tr style="background-color: #fef2f2;">
                        <td style="padding: 6px 10px; font-weight: bold; color: #991b1b;">&gt; 5 Days</td>
                        <td style="padding: 6px 10px; text-align: center; font-weight: 800; color: #991b1b;">${agingOver5}</td>
                        <td style="padding: 6px 10px; text-align: right; font-size: 10px; color: #dc2626; font-weight: bold;">Escalated</td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </table>
          </div>

          <!-- Action Notice: Log into Portal -->
          <div style="padding: 14px 16px; background-color: #f0f9ff; border: 1px solid #bae6fd; border-left: 4px solid #0284c7; border-radius: 6px; font-size: 12px; color: #0369a1; margin-bottom: 20px;">
            <p style="margin: 0 0 4px 0; font-weight: 800; color: #0369a1; font-size: 13px;">💻 How to Take Action</p>
            <p style="margin: 0; line-height: 1.5; color: #334155;">
              To view full customer contact records, vehicle numbers, and complaint descriptions, please log into the <strong>Ideal Group Complaint System Portal</strong>. After contacting the customer and providing a solution, record the <strong>Date Contacted</strong> and <strong>Solution Provided</strong> to complete the SLA cycle.
            </p>
          </div>

          <!-- Central Support Contact -->
          <div style="font-size: 11px; color: #64748b; line-height: 1.5; border-top: 1px solid #e2e8f0; padding-top: 12px;">
            For urgent re-assignments or inquiries, contact the central CX team at <a href="mailto:callcenter@idealgroup.lk" style="color: #0284c7; font-weight: bold; text-decoration: none;">callcenter@idealgroup.lk</a>.
          </div>

        </div>

        <!-- Clean Light Footer -->
        <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 12px 24px; color: #64748b; font-size: 11px; text-align: center;">
          Ideal Group Central CX Call Center (<a href="mailto:callcenter@idealgroup.lk" style="color: #0284c7; text-decoration: none;">callcenter@idealgroup.lk</a>) &bull; Workstation Performance & SLA Management
        </div>

      </div>
    </div>
  `;

  return { recipients, subject, bodyHtml };
}

// In-memory cache for systemic email logs across sessions
let inMemoryEmailLogs: SystemicEmailLog[] = [];

export function getStoredSystemicEmailLogs(): SystemicEmailLog[] {
  return inMemoryEmailLogs;
}

export function saveSystemicEmailLogs(logs: SystemicEmailLog[]) {
  inMemoryEmailLogs = logs;
  saveEmailLogsCentral(logs).catch((err) => {
    console.warn("Async central save for email logs:", err);
  });
}

// Trigger systemic email dispatch for a batch of complaints per station
export function dispatchSystemicEmailsForComplaints(
  complaints: Complaint[]
): SystemicEmailLog[] {
  const logs: SystemicEmailLog[] = [...inMemoryEmailLogs];
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
      // Filter strictly to the pending cases that the station has to contact
      const pendingCases = getPendingCasesToContact(group);
      
      // If there are pending cases, or if this is a direct dispatch
      const casesToInclude = pendingCases.length > 0 ? pendingCases : group;

      const emailContent = generateSystemicEmailContent(profile, casesToInclude);
      const emailLog: SystemicEmailLog = {
        id: "EML-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
        station: profile.name,
        sentAt: new Date().toISOString(),
        fromEmail: "callcenter@idealgroup.lk",
        recipients: emailContent.recipients,
        subject: emailContent.subject,
        complaintCount: casesToInclude.length,
        complaintIds: casesToInclude.map((item) => item.id),
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

