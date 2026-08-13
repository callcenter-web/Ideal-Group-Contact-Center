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
  "caseHistory"
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
    "advisorName"
  ];

  for (const key of keysToPreserveNonEmpty) {
    const valP = primary[key];
    const valF = fallback[key];
    const isPEmpty = valP === undefined || valP === null || valP === "";
    const isFPopulated = valF !== undefined && valF !== null && valF !== "";
    if (isPEmpty && isFPopulated) {
      result[key] = valF;
    }
  }

  // Combine caseHistory entries without duplicate history items
  const historyA = Array.isArray(a.caseHistory) ? a.caseHistory : [];
  const historyB = Array.isArray(b.caseHistory) ? b.caseHistory : [];
  if (historyA.length > 0 || historyB.length > 0) {
    const historyMap = new Map<string, any>();
    [...historyA, ...historyB].forEach((entry) => {
      if (entry && entry.id) {
        historyMap.set(entry.id, entry);
      }
    });
    result.caseHistory = Array.from(historyMap.values()).sort((x, y) => 
      new Date(x.timestamp || 0).getTime() - new Date(y.timestamp || 0).getTime()
    );
  }

  // CRITICAL: If either record was marked as Resolved / Satisfied / Closed / Completed,
  // do NOT revert back to Pending/Contacted unless explicitly changed to Rejected/Re-assigned
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

  if ((isASatisfied || isBSatisfied) && result.stationResponseStatus !== "Rejected" && !result.finalStatus?.includes("Re-assigned")) {
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

  return result;
}

/**
 * Normalizes complaint objects fetched from Supabase, ensuring woNo and assignedOfficerId are available.
 */
export function normalizeComplaintFromSupabase(item: any): Record<string, any> {
  if (!item || typeof item !== "object") return item;
  return {
    ...item,
    woNo: item.woNo || item.wo_no || "",
    assignedOfficerId: item.assignedOfficerId || item.assigned_officer_id || undefined,
    stationResponseStatus: item.stationResponseStatus || "",
    stationResponseRejectionReason: item.stationResponseRejectionReason || "",
    stationResponseRejectedDate: item.stationResponseRejectedDate || "",
    stationResponseRejectedBy: item.stationResponseRejectedBy || ""
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


