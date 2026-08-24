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

  const subject = pendingCount > 0
    ? `[Ideal Aftermarket] Action Required: ${pendingCount} Pending Case(s) for ${station.name} to Contact`
    : `[Ideal Aftermarket] Status Notice: No Pending Cases to Contact - ${station.name}`;

  const getAgingDays = (c: Complaint) => {
    if (!c.date) return 0;
    const t = new Date(c.date).getTime();
    if (isNaN(t)) return 0;
    return Math.max(0, Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24)));
  };

  const highPriorityCount = pendingCasesToContact.filter(
    (c) =>
      c.initialSatisfaction === "Very Dissatisfied" ||
      getAgingDays(c) > 3 ||
      c.feedbackStatus === "Still Dissatisfied"
  ).length;

  const rejectedCount = pendingCasesToContact.filter((c) => isComplaintRejected(c)).length;
  const overdueCount = pendingCasesToContact.filter((c) => getAgingDays(c) > 3).length;

  // Category counts for pending cases
  const categoryMap: Record<string, number> = {};
  pendingCasesToContact.forEach((c) => {
    const cat = c.category || c.mchCodeDescription || "General Service";
    categoryMap[cat] = (categoryMap[cat] || 0) + 1;
  });

  const categoryRowsHtml = Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([cat, catCount], idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 0 ? "background-color: #f8fafc;" : ""}">
        <td style="padding: 7px 10px; font-weight: bold; color: #1e293b; font-size: 11px;">${cat}</td>
        <td style="padding: 7px 10px; text-align: center; font-weight: 800; color: #0369a1; font-size: 12px;">${catCount}</td>
        <td style="padding: 7px 10px; text-align: right; color: #64748b; font-size: 11px;">${pendingCount > 0 ? Math.round((catCount / pendingCount) * 100) : 0}%</td>
      </tr>
    `
    )
    .join("");

  // Aging distribution counts for pending cases
  const aging03 = pendingCasesToContact.filter((c) => getAgingDays(c) <= 3).length;
  const aging35 = pendingCasesToContact.filter((c) => getAgingDays(c) > 3 && getAgingDays(c) <= 5).length;
  const aging610 = pendingCasesToContact.filter((c) => getAgingDays(c) > 5 && getAgingDays(c) <= 10).length;
  const agingOver10 = pendingCasesToContact.filter((c) => getAgingDays(c) > 10).length;

  const officersListHtml = station.officers
    ? station.officers
        .map((o) => `<li><strong>${o.name}</strong> (${o.role}) &bull; Email: ${o.email} &bull; Tel: ${o.phone}</li>`)
        .join("")
    : `<li>Email: ${station.email} &bull; Tel: ${station.phone}</li>`;

  // Build the detailed itemized table of pending cases to contact
  const pendingCasesTableRowsHtml = pendingCasesToContact.length > 0
    ? pendingCasesToContact
        .map((c, index) => {
          const aging = getAgingDays(c);
          const isRejected = isComplaintRejected(c);
          const agingBadgeColor =
            aging > 5 ? "#dc2626" : aging > 3 ? "#d97706" : "#16a34a";
          const statusBadgeBg = isRejected ? "#fee2e2" : "#fef3c7";
          const statusBadgeColor = isRejected ? "#991b1b" : "#92400e";
          const statusText = isRejected
            ? `⚠️ Returned to Station (Re-action Required)`
            : `⏳ Pending Station Contact & Inspection`;

          return `
          <tr style="border-bottom: 1px solid #cbd5e1; ${index % 2 === 0 ? "background-color: #ffffff;" : "background-color: #f8fafc;"}">
            <td style="padding: 10px 8px; vertical-align: top; font-family: monospace; font-size: 11px; font-weight: bold; color: #0f172a;">
              <div>${c.id}</div>
              ${c.woNo ? `<div style="color: #64748b; font-size: 10px; margin-top: 2px;">WO: ${c.woNo}</div>` : ""}
            </td>
            <td style="padding: 10px 8px; vertical-align: top; font-size: 12px; color: #1e293b;">
              <div style="font-weight: 800; color: #0284c7;">${c.vehicleRegNo || "N/A"}</div>
              <div style="font-size: 10px; color: #64748b;">${c.category || c.mchCodeDescription || "Standard"}</div>
              ${c.chassiNo ? `<div style="font-size: 9px; color: #94a3b8;">Chassis: ${c.chassiNo}</div>` : ""}
            </td>
            <td style="padding: 10px 8px; vertical-align: top; font-size: 12px; color: #1e293b;">
              <div style="font-weight: bold;">${c.customerName || "Customer"}</div>
              <div style="font-size: 11px; font-weight: 800; color: #166534; margin-top: 2px;">
                📞 <a href="tel:${c.customerPhone}" style="color: #166534; text-decoration: none; font-weight: bold;">${c.customerPhone || "N/A"}</a>
              </div>
              ${c.customerEmail ? `<div style="font-size: 10px; color: #64748b;">${c.customerEmail}</div>` : ""}
            </td>
            <td style="padding: 10px 8px; vertical-align: top; font-size: 11px; color: #334155; max-width: 200px;">
              <div style="font-weight: 600; color: #0f172a; margin-bottom: 2px;">${c.category || "Service Issue"}</div>
              <div style="line-height: 1.4; color: #475569; font-size: 11px;">
                ${c.description || c.notes || "No complaint details provided."}
              </div>
              ${c.stationResponseRejectionReason ? `<div style="margin-top: 4px; padding: 4px 6px; background-color: #fee2e2; border-left: 3px solid #dc2626; font-size: 10px; color: #991b1b;"><strong>Rejection Note:</strong> ${c.stationResponseRejectionReason}</div>` : ""}
            </td>
            <td style="padding: 10px 8px; vertical-align: top; font-size: 11px; color: #475569; text-align: center; white-space: nowrap;">
              <div>${c.date || "Recent"}</div>
              <span style="display: inline-block; margin-top: 3px; padding: 2px 6px; border-radius: 9999px; font-size: 10px; font-weight: 800; color: #ffffff; background-color: ${agingBadgeColor};">
                ${aging} Day${aging === 1 ? "" : "s"}
              </span>
            </td>
            <td style="padding: 10px 8px; vertical-align: top; font-size: 11px; text-align: left;">
              <div style="display: inline-block; padding: 3px 6px; border-radius: 4px; font-size: 10px; font-weight: 800; background-color: ${statusBadgeBg}; color: ${statusBadgeColor};">
                ${statusText}
              </div>
              ${c.advisorName ? `<div style="font-size: 9px; color: #64748b; margin-top: 3px;">Advisor: ${c.advisorName}</div>` : ""}
            </td>
          </tr>
        `;
        })
        .join("")
    : `
      <tr>
        <td colspan="6" style="padding: 24px; text-align: center; color: #16a34a; font-weight: bold; background-color: #f0fdf4;">
          ✅ No pending cases requiring service station contact at this time. All assigned complaints are contacted and resolved.
        </td>
      </tr>
    `;

  const bodyHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; padding: 20px; color: #1e293b;">
      <div style="max-width: 780px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #cbd5e1; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
        
        <!-- Header -->
        <div style="background-color: #0f172a; padding: 22px 24px; color: #ffffff; text-align: left;">
          <div style="font-size: 11px; font-weight: 800; letter-spacing: 2px; color: #38bdf8; text-transform: uppercase;">Ideal Group Aftermarket Operations</div>
          <h2 style="margin: 6px 0 0 0; font-size: 20px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px;">
            ${pendingCount > 0 ? `🚨 Action Required: ${pendingCount} Pending Case(s) to Contact` : `✅ Workstation Status Notice - No Pending Cases`}
          </h2>
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
            Dear Station Management & Service Advisors,<br/>
            ${
              pendingCount > 0
                ? `Central Call Center has recorded <strong>${pendingCount} pending customer complaint case(s)</strong> assigned to <strong>${station.name}</strong> that require your immediate customer contact, workshop inspection, and status update.`
                : `There are currently <strong>0 pending complaints</strong> requiring customer contact for <strong>${station.name}</strong>. All logged cases are currently up to date.`
            }
          </p>

          <!-- 4 Executive KPI Metric Count Cards for Pending Cases -->
          <table style="width: 100%; border-collapse: separate; border-spacing: 8px; margin-bottom: 20px;">
            <tr>
              <td style="background-color: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; text-align: center; width: 25%;">
                <div style="font-size: 10px; font-weight: 800; color: #92400e; text-transform: uppercase;">To Contact</div>
                <div style="font-size: 24px; font-weight: 900; color: #b45309; margin-top: 2px;">${pendingCount}</div>
                <div style="font-size: 10px; color: #b45309; margin-top: 2px;">Pending Action</div>
              </td>
              <td style="background-color: #fee2e2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; text-align: center; width: 25%;">
                <div style="font-size: 10px; font-weight: 800; color: #991b1b; text-transform: uppercase;">High Priority</div>
                <div style="font-size: 24px; font-weight: 900; color: #dc2626; margin-top: 2px;">${highPriorityCount}</div>
                <div style="font-size: 10px; color: #dc2626; margin-top: 2px;">Dissatisfied</div>
              </td>
              <td style="background-color: #ffedd5; border: 1px solid #fed7aa; border-radius: 8px; padding: 12px; text-align: center; width: 25%;">
                <div style="font-size: 10px; font-weight: 800; color: #9a3412; text-transform: uppercase;">Returned / Re-action</div>
                <div style="font-size: 24px; font-weight: 900; color: #ea580c; margin-top: 2px;">${rejectedCount}</div>
                <div style="font-size: 10px; color: #ea580c; margin-top: 2px;">Action Required</div>
              </td>
              <td style="background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; text-align: center; width: 25%;">
                <div style="font-size: 10px; font-weight: 800; color: #475569; text-transform: uppercase;">Overdue SLA (&gt;3d)</div>
                <div style="font-size: 24px; font-weight: 900; color: #0f172a; margin-top: 2px;">${overdueCount}</div>
                <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Needs Attention</div>
              </td>
            </tr>
          </table>

          <!-- MAIN TABLE: ITEMISED PENDING CASES THAT SERVICE STATION MUST CONTACT -->
          <div style="margin-bottom: 24px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; border-bottom: 2px solid #0284c7; padding-bottom: 4px;">
              <h3 style="margin: 0; font-size: 14px; font-weight: 900; text-transform: uppercase; color: #0f172a; letter-spacing: -0.2px;">
                📋 Pending Cases that Service Station Must Contact (${pendingCount})
              </h3>
              <span style="font-size: 11px; color: #64748b; font-weight: 600;">Direct customer call & investigation required</span>
            </div>

            <table style="width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden;">
              <thead>
                <tr style="background-color: #0f172a; color: #ffffff; font-weight: 800; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">
                  <th style="padding: 8px 8px; text-align: left;">Case ID</th>
                  <th style="padding: 8px 8px; text-align: left;">Vehicle No</th>
                  <th style="padding: 8px 8px; text-align: left;">Customer & Phone</th>
                  <th style="padding: 8px 8px; text-align: left;">Category & Complaint Note</th>
                  <th style="padding: 8px 8px; text-align: center;">Aging</th>
                  <th style="padding: 8px 8px; text-align: left;">Status / Action</th>
                </tr>
              </thead>
              <tbody>
                ${pendingCasesTableRowsHtml}
              </tbody>
            </table>
          </div>

          <!-- 2 Column Breakdown Tables (Category Counts + Aging Counts) -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
              <!-- Category Count Table -->
              <td style="width: 50%; vertical-align: top; padding-right: 8px;">
                <h4 style="margin: 0 0 8px 0; font-size: 12px; font-weight: 800; text-transform: uppercase; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px;">
                  Pending Cases by Category
                </h4>
                <table style="width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
                  <thead>
                    <tr style="background-color: #e2e8f0; color: #1e293b; font-weight: 800; font-size: 10px; text-transform: uppercase;">
                      <th style="padding: 6px 8px; text-align: left;">Category</th>
                      <th style="padding: 6px 8px; text-align: center;">Count</th>
                      <th style="padding: 6px 8px; text-align: right;">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${categoryRowsHtml || '<tr><td colspan="3" style="padding: 10px; text-align: center; color: #94a3b8;">No pending complaints</td></tr>'}
                  </tbody>
                </table>
              </td>

              <!-- Aging SLA Count Table -->
              <td style="width: 50%; vertical-align: top; padding-left: 8px;">
                <h4 style="margin: 0 0 8px 0; font-size: 12px; font-weight: 800; text-transform: uppercase; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px;">
                  Pending SLA Aging Distribution
                </h4>
                <table style="width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
                  <thead>
                    <tr style="background-color: #e2e8f0; color: #1e293b; font-weight: 800; font-size: 10px; text-transform: uppercase;">
                      <th style="padding: 6px 8px; text-align: left;">Aging Range</th>
                      <th style="padding: 6px 8px; text-align: center;">Count</th>
                      <th style="padding: 6px 8px; text-align: right;">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style="border-bottom: 1px solid #e2e8f0; background-color: #f0fdf4;">
                      <td style="padding: 6px 8px; font-weight: bold; color: #166534; font-size: 11px;">0 - 3 Days</td>
                      <td style="padding: 6px 8px; text-align: center; font-weight: 900; color: #166534; font-size: 11px;">${aging03}</td>
                      <td style="padding: 6px 8px; text-align: right; font-size: 10px; color: #16a34a; font-weight: bold;">Normal</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0; background-color: #fffbeb;">
                      <td style="padding: 6px 8px; font-weight: bold; color: #92400e; font-size: 11px;">3 - 5 Days</td>
                      <td style="padding: 6px 8px; text-align: center; font-weight: 900; color: #92400e; font-size: 11px;">${aging35}</td>
                      <td style="padding: 6px 8px; text-align: right; font-size: 10px; color: #d97706; font-weight: bold;">Pending SLA</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0; background-color: #fff7ed;">
                      <td style="padding: 6px 8px; font-weight: bold; color: #9a3412; font-size: 11px;">6 - 10 Days</td>
                      <td style="padding: 6px 8px; text-align: center; font-weight: 900; color: #9a3412; font-size: 11px;">${aging610}</td>
                      <td style="padding: 6px 8px; text-align: right; font-size: 10px; color: #ea580c; font-weight: bold;">Escalated</td>
                    </tr>
                    <tr style="background-color: #fef2f2;">
                      <td style="padding: 6px 8px; font-weight: bold; color: #991b1b; font-size: 11px;">&gt; 10 Days</td>
                      <td style="padding: 6px 8px; text-align: center; font-weight: 900; color: #991b1b; font-size: 11px;">${agingOver10}</td>
                      <td style="padding: 6px 8px; text-align: right; font-size: 10px; color: #dc2626; font-weight: bold;">Critical</td>
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
              Please contact the above customer(s) directly on their provided phone numbers. After conducting the call and inspection, log into the <strong>Ideal Group Complaint System Portal</strong> to record the <strong>Date Contacted</strong> and <strong>Solution Provided</strong> to complete the SLA loop.
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

