export const VALID_COMPLAINT_COLUMNS = [
  "id",
  "customerName",
  "customerPhone",
  "customerEmail",
  "station",
  "category",
  "description",
  "date",
  "receivedDateTime",
  "initialSatisfaction",
  "currentSatisfaction",
  "status",
  "notes",
  "agentName",
  "assigned_officer_id",
  "assignedOfficerId",
  "aiAnalysis",
  "updatedAt",
  "month",
  "company",
  "woNo",
  "wo_no",
  "woState",
  "vehicleRegNo",
  "mchCodeDescription",
  "workType",
  "customerNo",
  "earliestStartDate",
  "finishDate",
  "tel2",
  "mileage",
  "advisorName",
  "chassiNo",
  "npsScore",
  "stationContactedDate",
  "stationResolutionNotes",
  "callCenterContactedDate",
  "callCenterFinalRemarks",
  "callCenterFinalSatisfaction",
  "feedbackStatus",
  "finalStatus",
  "solutionProvidedByAftermarket",
  "solutionDate",
  "followUpDate",
  "firstAttemptCallStatus",
  "firstAttemptDate",
  "firstAttemptNotes",
  "secondAttemptFeedbackStatus",
  "secondAttemptDate",
  "secondAttemptNotes",
  "attemptCount",
  "stationResponseStatus",
  "stationResponseRejectionReason",
  "stationResponseRejectedDate",
  "stationResponseRejectedBy",
  "caseHistory",
  // Primary Service Station Contact Tracking columns
  "serviceStationContactStatus",
  "service_station_contact_status",
  "serviceStationContactedAt",
  "service_station_contacted_at",
  "serviceStationContactedBy",
  "service_station_contacted_by",
  "serviceStationContactMethod",
  "service_station_contact_method",
  "serviceStationContactRemark",
  "service_station_contact_remark",
  "serviceStationCustomerResponse",
  "service_station_customer_response",
  "nextFollowUpDate",
  "next_follow_up_date",
  "lastContactAttemptAt",
  "last_contact_attempt_at",
  "contactAttemptCount",
  "contact_attempt_count",
  "contactAttempts",
  "contact_attempts"
];

/**
 * Sanitizes a complaint object before sending to Supabase.
 * Strips out any unrecognized properties (e.g. temporary UI flags, extra properties)
 * that would trigger PGRST204 column schema errors.
 */
export function sanitizeComplaintForSupabase(item: any): Record<string, any> {
  if (!item || typeof item !== "object") return {};
  const clean: Record<string, any> = {};
  for (const col of VALID_COMPLAINT_COLUMNS) {
    if (item[col] !== undefined) {
      if (col === "npsScore" || col === "attemptCount") {
        if (item[col] === null || item[col] === "" || item[col] === undefined) {
          clean[col] = null;
        } else {
          const val = Number(item[col]);
          clean[col] = isNaN(val) ? null : val;
        }
      } else {
        clean[col] = item[col];
      }
    }
  }

  // Ensure reset fields are explicitly passed as empty strings if undefined so Supabase clears them in DB
  const resettableFields = [
    "firstAttemptCallStatus", "firstAttemptDate", "firstAttemptNotes",
    "secondAttemptFeedbackStatus", "secondAttemptDate", "secondAttemptNotes",
    "callCenterContactedDate", "callCenterFinalRemarks", "callCenterFinalSatisfaction"
  ];
  for (const field of resettableFields) {
    if (clean[field] === undefined) {
      clean[field] = "";
    }
  }

  // Ensure both woNo and wo_no are populated if either exists
  const woVal = item.woNo !== undefined ? item.woNo : item.wo_no;
  if (woVal !== undefined) {
    clean.woNo = woVal;
    clean.wo_no = woVal;
  }

  // Ensure assigned_officer_id
  const officerVal = item.assigned_officer_id || item.assignedOfficerId;
  if (officerVal !== undefined) {
    clean.assigned_officer_id = officerVal;
  }

  return clean;
}

/**
 * Intelligently merges two complaint objects (a and b) for the same ID.
 * Respects updatedAt timestamps and prevents loss of populated values (e.g., stationContactedDate, Satisfied statuses).
 */
export function mergeComplaintObjects(a: any, b: any): any {
  if (!a) return b;
  if (!b) return a;

  const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
  const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;

  const primary = dateB >= dateA ? b : a;
  const fallback = dateB >= dateA ? a : b;

  const result: any = { ...fallback, ...primary };

  const isPrimaryRejected = 
    primary.stationResponseStatus === "Rejected" ||
    primary.stationResponseStatus === "Returned to Service Station" ||
    primary.stationResponseStatus === "Returned to Call Center" ||
    primary.feedbackStatus === "Returned to Service Station" ||
    primary.finalStatus === "Returned to Service Station" ||
    primary.finalStatus?.includes("Re-assigned to Station");

  const keysToPreserveNonEmpty = [
    "stationContactedDate",
    "stationResolutionNotes",
    "callCenterContactedDate",
    "callCenterFinalRemarks",
    "callCenterFinalSatisfaction",
    "currentSatisfaction",
    "feedbackStatus",
    "finalStatus",
    "status",
    "solutionProvidedByAftermarket",
    "solutionDate",
    "firstAttemptCallStatus",
    "firstAttemptDate",
    "firstAttemptNotes",
    "secondAttemptFeedbackStatus",
    "secondAttemptDate",
    "secondAttemptNotes",
    "stationResponseStatus",
    "stationResponseRejectionReason",
    "stationResponseRejectedDate",
    "stationResponseRejectedBy",
    "agentName",
    "advisorName",
    "serviceStationContactStatus",
    "service_station_contact_status",
    "serviceStationContactedAt",
    "service_station_contacted_at",
    "serviceStationContactedBy",
    "service_station_contacted_by",
    "serviceStationContactMethod",
    "service_station_contact_method",
    "serviceStationContactRemark",
    "service_station_contact_remark",
    "serviceStationCustomerResponse",
    "service_station_customer_response",
    "nextFollowUpDate",
    "next_follow_up_date",
    "lastContactAttemptAt",
    "last_contact_attempt_at",
    "contactAttemptCount",
    "contact_attempt_count"
  ];

  for (const key of keysToPreserveNonEmpty) {
    // If the primary state is an intentional rejection/return, do not resurrect cleared contact dates or call center remarks
    if (isPrimaryRejected && (key === "stationContactedDate" || key === "callCenterFinalRemarks" || key === "callCenterFinalSatisfaction" || key === "serviceStationContactedAt" || key === "service_station_contacted_at")) {
      result[key] = primary[key] !== undefined ? primary[key] : "";
      continue;
    }

    const valP = primary[key];
    const valF = fallback[key];
    const isPEmpty = valP === undefined || valP === null || valP === "";
    const isFPopulated = valF !== undefined && valF !== null && valF !== "";
    if (isPEmpty && isFPopulated) {
      result[key] = valF;
    }
  }

  // Combine contactAttempts entries without duplicates
  const attemptsA = Array.isArray(a.contactAttempts) ? a.contactAttempts : [];
  const attemptsB = Array.isArray(b.contactAttempts) ? b.contactAttempts : [];
  if (attemptsA.length > 0 || attemptsB.length > 0) {
    const attemptsMap = new Map<string, any>();
    [...attemptsA, ...attemptsB].forEach((att) => {
      if (att && (att.id || att.timestamp)) {
        const key = att.id || `${att.timestamp}-${att.actorName}`;
        attemptsMap.set(key, att);
      }
    });
    result.contactAttempts = Array.from(attemptsMap.values()).sort((x, y) => 
      new Date(x.timestamp || 0).getTime() - new Date(y.timestamp || 0).getTime()
    );
  }

  // Combine caseHistory entries without duplicate history items and sort chronologically
  const historyA = Array.isArray(a.caseHistory) ? a.caseHistory : [];
  const historyB = Array.isArray(b.caseHistory) ? b.caseHistory : [];
  if (historyA.length > 0 || historyB.length > 0) {
    const historyMap = new Map<string, any>();
    [...historyA, ...historyB].forEach((entry) => {
      if (entry && (entry.id || entry.action)) {
        const key = entry.id || `${entry.action}-${entry.timestamp}`;
        historyMap.set(key, entry);
      }
    });
    result.caseHistory = Array.from(historyMap.values()).sort((x, y) => 
      new Date(x.timestamp || 0).getTime() - new Date(y.timestamp || 0).getTime()
    );
  }

  // If the latest action is rejected or returned to station, respect Pending status
  if (isPrimaryRejected) {
    result.status = "Pending";
    result.stationResponseStatus = primary.stationResponseStatus || "Returned to Service Station";
    result.stationResponseRejectionReason = primary.stationResponseRejectionReason || fallback.stationResponseRejectionReason || "";
  } else {
    // CRITICAL: If either record was marked as Resolved / Satisfied / Closed / Completed,
    // and neither record is actively in a Rejected/Returned state, preserve satisfied status
    const isASatisfied = 
      a.status === "Resolved" || 
      a.feedbackStatus === "Satisfied" || 
      a.currentSatisfaction === "Satisfied" || 
      a.callCenterFinalSatisfaction === "Satisfied" ||
      a.finalStatus === "Closed" ||
      a.finalStatus === "Completed";

    const isBSatisfied = 
      b.status === "Resolved" || 
      b.feedbackStatus === "Satisfied" || 
      b.currentSatisfaction === "Satisfied" || 
      b.callCenterFinalSatisfaction === "Satisfied" ||
      b.finalStatus === "Closed" ||
      b.finalStatus === "Completed";

    if ((isASatisfied || isBSatisfied) && !result.stationResponseStatus?.includes("Reject") && !result.stationResponseStatus?.includes("Returned")) {
      result.status = "Resolved";
      result.feedbackStatus = "Satisfied";
      if (!result.currentSatisfaction || result.currentSatisfaction === "Dissatisfied" || result.currentSatisfaction === "Neutral") {
        result.currentSatisfaction = "Satisfied";
      }
      if (!result.callCenterFinalSatisfaction) {
        result.callCenterFinalSatisfaction = "Satisfied";
      }
      if (result.finalStatus === "Open" || result.finalStatus === "In Progress" || !result.finalStatus) {
        result.finalStatus = "Closed";
      }
    }
  }

  return result;
}

/**
 * Determines the true operational Service Station contact status.
 * Evaluates explicit database field `serviceStationContactStatus` / `service_station_contact_status`
 * and falls back cleanly for historical records without losing or misrepresenting data.
 */
export function getEffectiveStationContactStatus(item: any): "PENDING_CONTACT" | "CONTACT_ATTEMPTED" | "CONTACTED" | "CUSTOMER_UNREACHABLE" | "NOT_CONTACTED" {
  if (!item || typeof item !== "object") return "NOT_CONTACTED";

  // If rejected by call center or returned to service station, always requires fresh contact action
  const isRejectedOrReturned = 
    item.stationResponseStatus === "Rejected" ||
    item.stationResponseStatus === "Returned to Service Station" ||
    item.stationResponseStatus === "Rejected by Call Center" ||
    item.feedbackStatus === "Returned to Service Station" ||
    item.finalStatus === "Returned to Service Station" ||
    item.finalStatus === "Pending with Aftermarket (Re-contact Required)";

  if (isRejectedOrReturned) {
    // If a brand new contact was already performed after rejection
    const explicitStatus = item.serviceStationContactStatus || item.service_station_contact_status;
    if (explicitStatus === "CONTACTED" && item.serviceStationContactedAt && item.stationResponseRejectedDate && new Date(item.serviceStationContactedAt).getTime() > new Date(item.stationResponseRejectedDate).getTime()) {
      return "CONTACTED";
    }
    if (explicitStatus === "CONTACT_ATTEMPTED" || explicitStatus === "CUSTOMER_UNREACHABLE") {
      return explicitStatus;
    }
    return "NOT_CONTACTED";
  }

  // Explicit database field
  const explicit = item.serviceStationContactStatus || item.service_station_contact_status;
  if (explicit) {
    const norm = String(explicit).toUpperCase().trim();
    if (norm === "CONTACTED") return "CONTACTED";
    if (norm === "CONTACT_ATTEMPTED" || norm === "ATTEMPTED") return "CONTACT_ATTEMPTED";
    if (norm === "CUSTOMER_UNREACHABLE" || norm === "UNREACHABLE") return "CUSTOMER_UNREACHABLE";
    if (norm === "PENDING_CONTACT" || norm === "PENDING") return "PENDING_CONTACT";
    if (norm === "NOT_CONTACTED") return "NOT_CONTACTED";
  }

  // Backward-compatible fallback deduction for legacy records
  if (item.feedbackStatus === "Customer Unreachable" || item.firstAttemptCallStatus === "Customer Unreachable") {
    return "CUSTOMER_UNREACHABLE";
  }

  const hasStationContactRecorded = !!(
    (item.serviceStationContactedAt && String(item.serviceStationContactedAt).trim().length > 0) ||
    (item.stationContactedDate && String(item.stationContactedDate).trim().length > 0) ||
    (item.stationResolutionNotes && String(item.stationResolutionNotes).trim().length > 0) ||
    item.stationResponseStatus === "Submitted to Call Center"
  );

  if (hasStationContactRecorded) {
    return "CONTACTED";
  }

  if (item.contactAttemptCount && item.contactAttemptCount > 0) {
    return "CONTACT_ATTEMPTED";
  }

  return "NOT_CONTACTED";
}

/**
 * Normalizes complaint objects fetched from Supabase, ensuring woNo and assignedOfficerId are available.
 */
export function normalizeComplaintFromSupabase(item: any): Record<string, any> {
  if (!item || typeof item !== "object") return item;
  const effectiveContactStatus = getEffectiveStationContactStatus(item);
  return {
    ...item,
    woNo: item.woNo || item.wo_no || "",
    assignedOfficerId: item.assignedOfficerId || item.assigned_officer_id || undefined,
    stationResponseStatus: item.stationResponseStatus || "",
    stationResponseRejectionReason: item.stationResponseRejectionReason || "",
    stationResponseRejectedDate: item.stationResponseRejectedDate || "",
    stationResponseRejectedBy: item.stationResponseRejectedBy || "",
    serviceStationContactStatus: item.serviceStationContactStatus || item.service_station_contact_status || effectiveContactStatus,
    serviceStationContactedAt: item.serviceStationContactedAt || item.service_station_contacted_at || item.stationContactedDate || "",
    serviceStationContactedBy: item.serviceStationContactedBy || item.service_station_contacted_by || item.advisorName || "",
    serviceStationContactMethod: item.serviceStationContactMethod || item.service_station_contact_method || "Phone Call",
    serviceStationContactRemark: item.serviceStationContactRemark || item.service_station_contact_remark || item.stationResolutionNotes || "",
    serviceStationCustomerResponse: item.serviceStationCustomerResponse || item.service_station_customer_response || "",
    nextFollowUpDate: item.nextFollowUpDate || item.next_follow_up_date || item.followUpDate || "",
    lastContactAttemptAt: item.lastContactAttemptAt || item.last_contact_attempt_at || item.serviceStationContactedAt || "",
    contactAttemptCount: item.contactAttemptCount !== undefined ? item.contactAttemptCount : (item.contact_attempt_count !== undefined ? item.contact_attempt_count : (effectiveContactStatus === "CONTACTED" ? 1 : 0)),
    contactAttempts: Array.isArray(item.contactAttempts) ? item.contactAttempts : (Array.isArray(item.contact_attempts) ? item.contact_attempts : [])
  };
}

/**
 * Deduplicates complaints by ID (keeping the latest occurrence)
 * and sanitizes each complaint to ensure no unknown columns or duplicate IDs
 * are passed in a single batch to Supabase (preventing PostgreSQL error 21000:
 * 'ON CONFLICT DO UPDATE command cannot affect row a second time').
 */
export function deduplicateAndSanitizeComplaints(items: any[]): Record<string, any>[] {
  if (!Array.isArray(items)) return [];
  const map = new Map<string, Record<string, any>>();
  
  for (const item of items) {
    if (!item) continue;
    const clean = sanitizeComplaintForSupabase(item);
    if (!clean.id) {
      clean.id = `ID-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    }
    const idKey = String(clean.id).trim().toUpperCase();
    
    // Check if map already has this idKey or matching woNo/COMP- id
    let existingKey: string | undefined = undefined;
    if (map.has(idKey)) {
      existingKey = idKey;
    } else if (clean.woNo) {
      const woKey = String(clean.woNo).trim().toUpperCase();
      const compWoKey = `COMP-${woKey}`;
      if (map.has(compWoKey)) {
        existingKey = compWoKey;
      } else if (map.has(woKey)) {
        existingKey = woKey;
      }
    }

    if (existingKey) {
      const existing = map.get(existingKey)!;
      map.set(existingKey, mergeComplaintObjects(existing, clean));
    } else {
      map.set(idKey, clean);
    }
  }
  
  return Array.from(map.values());
}

/**
 * Performs a resilient Supabase upsert on complaints.
 * If Supabase throws a schema error like "Could not find the 'XYZ' column of 'complaints' in the schema cache",
 * this automatically strips the offending column from the payload and retries until successful.
 */
export async function performResilientSupabaseUpsert(
  supabase: any,
  rawComplaints: any[]
): Promise<{ data: any; error: any; strippedColumns: string[] }> {
  let payload = deduplicateAndSanitizeComplaints(rawComplaints);
  const strippedColumns: string[] = [];
  const maxAttempts = 15;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { data, error } = await supabase
      .from("complaints")
      .upsert(payload, { onConflict: "id" });

    if (!error) {
      if (strippedColumns.length > 0) {
        console.info(
          `Supabase upsert succeeded after gracefully stripping un-migrated columns: [${strippedColumns.join(", ")}]. Run the SQL migration to add these columns to Supabase.`
        );
      }
      return { data, error: null, strippedColumns };
    }

    const errMsg = error.message || "";
    // Detect column error
    const matchNotFound = errMsg.match(/Could not find the ['"]([^'"]+)['"] column/i);
    const matchColNotExist = errMsg.match(/column ['"]([^'"]+)['"] of relation/i);
    const matchColSingleQuote = errMsg.match(/column ['"]([^'"]+)['"]/i);

    const missingCol =
      (matchNotFound && matchNotFound[1]) ||
      (matchColNotExist && matchColNotExist[1]) ||
      (matchColSingleQuote && matchColSingleQuote[1]);

    if (missingCol && !strippedColumns.includes(missingCol)) {
      console.warn(`Supabase missing column detected ('${missingCol}'). Stripping column and retrying upsert...`);
      strippedColumns.push(missingCol);
      payload = payload.map((item) => {
        const copy = { ...item };
        delete copy[missingCol];
        return copy;
      });
      continue;
    }

    // Fallback check for common woNo / wo_no mismatches
    if (errMsg.includes("'woNo'") && !strippedColumns.includes("woNo")) {
      strippedColumns.push("woNo");
      payload = payload.map(({ woNo, ...rest }) => rest);
      continue;
    }
    if (errMsg.includes("'wo_no'") && !strippedColumns.includes("wo_no")) {
      strippedColumns.push("wo_no");
      payload = payload.map(({ wo_no, ...rest }) => rest);
      continue;
    }

    // If no specific column could be extracted or retry limit reached, break and return the error
    return { data, error, strippedColumns };
  }

  return { data: null, error: { message: "Exceeded max upsert retry attempts." }, strippedColumns };
}


