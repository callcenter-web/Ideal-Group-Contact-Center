import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { DEMO_COMPLAINTS, CALL_CENTER_OFFICERS, STATIONS } from "./src/demoData";
import { sanitizeComplaintForSupabase, normalizeComplaintFromSupabase, deduplicateAndSanitizeComplaints, performResilientSupabaseUpsert, mergeComplaintObjects } from "./src/utils/supabaseSanitizer";

dotenv.config();

// Configure Supabase details provided by user
let SUPABASE_URL = process.env.SUPABASE_URL || "https://qsistbvaukxuwebqupiy.supabase.co";
let SUPABASE_KEY = process.env.SUPABASE_KEY || "sb_publishable_Npa3x5SHHp65jinonZFnKA_56lBMOQb";

// Clean and normalize the Supabase URL (strip /rest/v1/ and trailing slashes to prevent SDK 404 errors)
if (SUPABASE_URL) {
  SUPABASE_URL = SUPABASE_URL.trim();
  if (SUPABASE_URL.endsWith("/rest/v1/")) {
    SUPABASE_URL = SUPABASE_URL.slice(0, -9);
  } else if (SUPABASE_URL.endsWith("/rest/v1")) {
    SUPABASE_URL = SUPABASE_URL.slice(0, -8);
  }
  if (SUPABASE_URL.endsWith("/")) {
    SUPABASE_URL = SUPABASE_URL.slice(0, -1);
  }
}

if (SUPABASE_KEY) {
  SUPABASE_KEY = SUPABASE_KEY.trim();
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Memory cache & disk persistence setup
let localComplaintsCache = [...DEMO_COMPLAINTS];
let localOfficersCache = [...CALL_CENTER_OFFICERS];
let localStationsCache = [...STATIONS];
let localEmailLogsCache: any[] = [];
let localCalendarCache: any[] = [
  {
    id: "default-1",
    station: "All",
    date: "2026-08-15",
    type: "off_day",
    reason: "Company Annual Holiday / Nikini Full Moon Poya",
    createdAt: new Date().toISOString(),
    createdBy: "System Admin",
  },
  {
    id: "default-2",
    station: "All",
    date: "2026-09-16",
    type: "off_day",
    reason: "Milad-Un-Nabi (Holy Prophet's Birthday)",
    createdAt: new Date().toISOString(),
    createdBy: "System Admin",
  },
  {
    id: "default-3",
    station: "Colombo",
    date: "2026-08-20",
    type: "off_day",
    reason: "Colombo Workshop Scheduled Equipment Maintenance",
    createdAt: new Date().toISOString(),
    createdBy: "Admin",
  },
];

const DB_FILE_PATH = path.join(process.cwd(), "persistent_database.json");

function loadPersistentData() {
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      const raw = fs.readFileSync(DB_FILE_PATH, "utf-8");
      const data = JSON.parse(raw);
      if (data.complaints && Array.isArray(data.complaints) && data.complaints.length > 0) {
        localComplaintsCache = data.complaints;
      }
      if (data.officers && Array.isArray(data.officers) && data.officers.length > 0) {
        localOfficersCache = data.officers;
      }
      if (data.stations && Array.isArray(data.stations) && data.stations.length > 0) {
        localStationsCache = data.stations;
      }
      if (data.calendar && Array.isArray(data.calendar)) {
        localCalendarCache = data.calendar;
      }
      if (data.emailLogs && Array.isArray(data.emailLogs)) {
        localEmailLogsCache = data.emailLogs;
      }
      console.log("Loaded persistent database store from disk successfully.");
    } else {
      savePersistentData();
    }
  } catch (err) {
    console.error("Error loading persistent database file:", err);
  }
}

function savePersistentData() {
  try {
    const payload = {
      complaints: localComplaintsCache,
      officers: localOfficersCache,
      stations: localStationsCache,
      calendar: localCalendarCache,
      emailLogs: localEmailLogsCache,
      lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(payload, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing persistent database file:", err);
  }
}

// Initial boot load
loadPersistentData();


async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API Route for Gemini analysis
  app.post("/api/analyze-complaint", async (req, res) => {
    try {
      const { category, description, customerName, station } = req.body;

      if (!description) {
        return res.status(400).json({ error: "Complaint description is required." });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Gemini API Key is not configured on the server. Please add GEMINI_API_KEY to your Secrets." });
      }

      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const prompt = `Analyze this customer complaint and provide:
1. A brief sentiment analysis of their frustration level (e.g., Extreme, High, Moderate) and their main emotional trigger.
2. A customized, highly empathetic phone call script for the service station agent to use when calling this customer. Keep it professional, warm, apologetic, and action-oriented. Keep it under 150 words.
3. A step-by-step resolution plan (up to 3 concrete steps) for the agent to resolve this specific issue and convert their satisfaction.
4. A suggested gesture of goodwill or minor compensation (e.g., 10% discount on next service, free washing/vacuuming, priority queue skip) appropriate for this complaint.

Customer Details:
Name: ${customerName || "Valued Customer"}
Service Station: ${station || "General"}
Complaint Category: ${category || "General Feedback"}
Complaint Description: ${description}

Ensure your response is highly detailed, professional, and directly actionable for the service station agent.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: "You are an elite Customer Experience (CX) Recovery Expert. Your goal is to guide service station agents on how to convert highly dissatisfied customers into loyal promoters using active listening, deep empathy, and swift, practical resolutions. Do not provide any conversational filler in your response output, only return the requested JSON object.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              sentimentAnalysis: {
                type: Type.STRING,
                description: "Summary of the customer's frustration level and emotional trigger.",
              },
              callScript: {
                type: Type.STRING,
                description: "A professional, empathetic, and clear verbal call script for the agent.",
              },
              resolutionSteps: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Up to 3 specific, actionable steps the service station can take to resolve the complaint.",
              },
              suggestedCompensation: {
                type: Type.STRING,
                description: "A suggested gesture of goodwill or minor compensation appropriate for this complaint.",
              }
            },
            required: ["sentimentAnalysis", "callScript", "resolutionSteps", "suggestedCompensation"],
          }
        }
      });

      const jsonText = response.text || "{}";
      const data = JSON.parse(jsonText.trim());
      res.json(data);
    } catch (error: any) {
      console.error("Gemini Error:", error);
      res.status(500).json({ error: error.message || "An error occurred during AI analysis." });
    }
  });

  // API Route to fetch all complaints from Supabase (Supabase is Single Source of Truth)
  app.get("/api/complaints", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("complaints")
        .select("*")
        .order("date", { ascending: false });

      if (error) {
        console.error("Supabase SELECT error:", error);
        return res.json({
          complaints: localComplaintsCache,
          isSupabaseActive: false,
          error: error.message,
          code: error.code,
          hint: "Table 'complaints' might not exist or lacks correct RLS policies. Run the DDL setup in your Supabase SQL Editor."
        });
      }

      if (data) {
        const normalized = data.map((sbRow: any) => normalizeComplaintFromSupabase(sbRow)) as any;
        localComplaintsCache = normalized;
        savePersistentData();
        return res.json({
          complaints: normalized,
          isSupabaseActive: true
        });
      }

      res.json({
        complaints: localComplaintsCache,
        isSupabaseActive: true
      });
    } catch (err: any) {
      console.error("Fetch complaints exception:", err);
      res.json({
        complaints: localComplaintsCache,
        isSupabaseActive: false,
        error: err.message
      });
    }
  });

  // API Route to upsert complaints in bulk or single
  app.post("/api/complaints", async (req, res) => {
    try {
      const { complaints } = req.body;
      if (!complaints) {
        return res.status(400).json({ error: "No complaints provided to save." });
      }

      const complaintsArray = Array.isArray(complaints) ? complaints : [complaints];

      // Perform resilient write to Supabase
      const { data, error, strippedColumns } = await performResilientSupabaseUpsert(supabase, complaintsArray);

      if (error) {
        console.error("Supabase UPSERT error:", error);
        return res.json({
          success: false,
          isSupabaseActive: false,
          error: error.message,
          code: error.code,
          complaints: localComplaintsCache
        });
      }

      // Re-fetch latest authoritative records from Supabase
      const { data: freshData } = await supabase
        .from("complaints")
        .select("*")
        .order("date", { ascending: false });

      if (freshData) {
        localComplaintsCache = freshData.map((sbRow: any) => normalizeComplaintFromSupabase(sbRow)) as any;
        savePersistentData();
      }

      res.json({
        success: true,
        isSupabaseActive: true,
        strippedColumns,
        complaints: localComplaintsCache
      });
    } catch (err: any) {
      console.error("Save complaints exception:", err);
      res.json({
        success: false,
        isSupabaseActive: false,
        error: err.message,
        complaints: localComplaintsCache
      });
    }
  });

  // API Route to delete a single complaint by ID or WO Number
  app.post("/api/complaints/delete", async (req, res) => {
    try {
      const { id, woNo } = req.body;
      if (!id && !woNo) {
        return res.status(400).json({ error: "Complaint ID or WO Number is required for deletion." });
      }

      const targetId = id ? String(id).trim().toUpperCase() : "";
      const targetWoNo = woNo ? String(woNo).trim().toUpperCase() : "";

      // Filter local memory cache thoroughly and persist to disk
      localComplaintsCache = localComplaintsCache.filter((c) => {
        const cId = (c.id || "").trim().toUpperCase();
        const cWo = (c.woNo || "").trim().toUpperCase();

        if (targetId && (cId === targetId || cWo === targetId)) return false;
        if (targetWoNo && (cId === targetWoNo || cWo === targetWoNo)) return false;
        if (targetWoNo && cId === `COMP-${targetWoNo}`) return false;
        if (targetId && cId === `COMP-${targetId}`) return false;
        return true;
      });
      savePersistentData();

      // Try deleting from Supabase
      const conditions: string[] = [];
      if (id) {
        conditions.push(`id.eq.${id}`);
        conditions.push(`woNo.eq.${id}`);
        conditions.push(`wo_no.eq.${id}`);
      }
      if (woNo) {
        conditions.push(`id.eq.${woNo}`);
        conditions.push(`woNo.eq.${woNo}`);
        conditions.push(`wo_no.eq.${woNo}`);
        conditions.push(`id.eq.COMP-${woNo}`);
      }

      const { error } = await supabase
        .from("complaints")
        .delete()
        .or(conditions.join(","));

      if (error) {
        console.error("Supabase DELETE single complaint error:", error);
        return res.json({
          success: true,
          isSupabaseActive: false,
          error: error.message,
          complaints: localComplaintsCache
        });
      }

      res.json({
        success: true,
        isSupabaseActive: true,
        complaints: localComplaintsCache
      });
    } catch (err: any) {
      console.error("Delete complaint exception:", err);
      res.json({
        success: true,
        isSupabaseActive: false,
        error: err.message,
        complaints: localComplaintsCache
      });
    }
  });

  // API Route to fetch workflow history for a complaint or all complaints
  app.get("/api/workflow-history", async (req, res) => {
    try {
      const complaintId = req.query.complaintId ? String(req.query.complaintId) : null;
      let query = supabase.from("complaint_workflow_history").select("*").order("created_at", { ascending: true });
      if (complaintId) {
        query = query.eq("complaint_id", complaintId);
      }
      const { data, error } = await query;
      if (error) {
        return res.json({ history: [], isSupabaseActive: false, error: error.message });
      }
      res.json({ history: data || [], isSupabaseActive: true });
    } catch (err: any) {
      res.json({ history: [], isSupabaseActive: false, error: err.message });
    }
  });

  // API Route to record a workflow event in complaint_workflow_history
  app.post("/api/workflow-history", async (req, res) => {
    try {
      const { event } = req.body;
      if (!event || !event.complaint_id) {
        return res.status(400).json({ error: "Workflow event with complaint_id is required." });
      }
      const newEvent = {
        id: event.id || `WF-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        complaint_id: event.complaint_id,
        customer_id: event.customer_id || null,
        customer_name: event.customer_name || null,
        customer_phone: event.customer_phone || null,
        previous_status: event.previous_status || null,
        new_status: event.new_status || null,
        previous_assigned_to: event.previous_assigned_to || null,
        new_assigned_to: event.new_assigned_to || null,
        assigned_service_station: event.assigned_service_station || null,
        action_type: event.action_type || "WORKFLOW_UPDATE",
        action_reason: event.action_reason || null,
        remarks: event.remarks || null,
        performed_by: event.performed_by || "User",
        performed_by_role: event.performed_by_role || "system",
        created_at: event.created_at || new Date().toISOString()
      };

      const { data, error } = await supabase
        .from("complaint_workflow_history")
        .upsert([newEvent], { onConflict: "id" });

      if (error) {
        console.warn("Supabase workflow_history upsert warning:", error.message);
        return res.json({ success: true, isSupabaseActive: false, event: newEvent, error: error.message });
      }

      res.json({ success: true, isSupabaseActive: true, event: newEvent });
    } catch (err: any) {
      res.json({ success: false, error: err.message });
    }
  });

  // API Route to fetch call center officers from Supabase
  app.get("/api/officers", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("call_center_officers")
        .select("*")
        .order("id", { ascending: true });

      if (error) {
        console.warn("Supabase officers fetch warning/fallback:", error.message);
        return res.json({
          officers: localOfficersCache,
          isSupabaseActive: false
        });
      }

      if (!data || data.length === 0) {
        // Pre-populate if empty in Supabase
        const { error: insertError } = await supabase
          .from("call_center_officers")
          .insert(CALL_CENTER_OFFICERS);

        if (!insertError) {
          localOfficersCache = [...CALL_CENTER_OFFICERS];
          savePersistentData();
          return res.json({
            officers: CALL_CENTER_OFFICERS,
            isSupabaseActive: true
          });
        }
      } else {
        localOfficersCache = data;
        savePersistentData();
      }

      res.json({
        officers: data || localOfficersCache,
        isSupabaseActive: true
      });
    } catch (err: any) {
      res.json({
        officers: localOfficersCache,
        isSupabaseActive: false,
        error: err.message
      });
    }
  });

  // API Route to upsert call center officers into Supabase
  app.post("/api/officers", async (req, res) => {
    try {
      const { officers } = req.body;
      if (!officers) {
        return res.status(400).json({ error: "No officers data provided." });
      }

      const officersArray = Array.isArray(officers) ? officers : [officers];
      localOfficersCache = officersArray;
      savePersistentData();

      const { data, error } = await supabase
        .from("call_center_officers")
        .upsert(officersArray, { onConflict: "id" });

      if (error) {
        console.error("Supabase officers UPSERT error:", error);
        return res.json({
          success: true,
          isSupabaseActive: false,
          error: error.message,
          officers: localOfficersCache
        });
      }

      res.json({
        success: true,
        isSupabaseActive: true,
        officers: localOfficersCache
      });
    } catch (err: any) {
      res.json({
        success: true,
        isSupabaseActive: false,
        error: err.message,
        officers: localOfficersCache
      });
    }
  });

  // API Route to fetch service stations from Supabase
  app.get("/api/stations", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("stations")
        .select("*")
        .order("code", { ascending: true });

      if (error) {
        console.warn("Supabase stations fetch warning/fallback:", error.message);
        return res.json({
          stations: localStationsCache,
          isSupabaseActive: false
        });
      }

      if (!data || data.length === 0) {
        // Pre-populate if empty in Supabase
        const { error: insertError } = await supabase
          .from("stations")
          .insert(STATIONS);

        if (!insertError) {
          localStationsCache = [...STATIONS];
          savePersistentData();
          return res.json({
            stations: STATIONS,
            isSupabaseActive: true
          });
        }
      } else {
        localStationsCache = data;
        savePersistentData();
      }

      res.json({
        stations: data || localStationsCache,
        isSupabaseActive: true
      });
    } catch (err: any) {
      res.json({
        stations: localStationsCache,
        isSupabaseActive: false,
        error: err.message
      });
    }
  });

  // API Route to upsert service stations into Supabase
  app.post("/api/stations", async (req, res) => {
    try {
      const { stations } = req.body;
      if (!stations) {
        return res.status(400).json({ error: "No stations data provided." });
      }

      const stationsArray = Array.isArray(stations) ? stations : [stations];
      localStationsCache = stationsArray;
      savePersistentData();

      const { data, error } = await supabase
        .from("stations")
        .upsert(stationsArray, { onConflict: "code" });

      if (error) {
        console.error("Supabase stations UPSERT error:", error);
        return res.json({
          success: true,
          isSupabaseActive: false,
          error: error.message,
          stations: localStationsCache
        });
      }

      res.json({
        success: true,
        isSupabaseActive: true,
        stations: localStationsCache
      });
    } catch (err: any) {
      res.json({
        success: true,
        isSupabaseActive: false,
        error: err.message,
        stations: localStationsCache
      });
    }
  });

  // API Routes for Workstation Calendar
  app.get("/api/calendar", async (req, res) => {
    try {
      const { data, error } = await supabase.from("workstation_calendar").select("*");
      if (error || !data || data.length === 0) {
        return res.json({ dates: localCalendarCache, isSupabaseActive: !error });
      }
      localCalendarCache = data;
      savePersistentData();
      res.json({ dates: data, isSupabaseActive: true });
    } catch (err: any) {
      res.json({ dates: localCalendarCache, isSupabaseActive: false });
    }
  });

  // API Route to Generate and Download SLA Performance Dashboard PDF
  app.get("/api/download-sla-pdf", (req, res) => {
    const pdfPath = path.join(process.cwd(), "SLA_Performance_Dashboard.pdf");
    const publicPdfPath = path.join(process.cwd(), "public", "SLA_Performance_Dashboard.pdf");

    const targetPath = fs.existsSync(pdfPath) ? pdfPath : (fs.existsSync(publicPdfPath) ? publicPdfPath : null);

    if (targetPath) {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=SLA_Performance_Dashboard.pdf");
      return res.sendFile(targetPath);
    } else {
      // Try running the python script synchronously if not yet generated
      try {
        const { execSync } = require("child_process");
        execSync("python3 generate_sla_dashboard.py", { stdio: "inherit" });
        if (fs.existsSync(pdfPath)) {
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader("Content-Disposition", "attachment; filename=SLA_Performance_Dashboard.pdf");
          return res.sendFile(pdfPath);
        }
      } catch (err: any) {
        console.error("PDF generation execution error:", err);
      }
      return res.status(404).json({ error: "SLA_Performance_Dashboard.pdf is being generated. Please retry in a few seconds." });
    }
  });

  app.post("/api/calendar", async (req, res) => {
    try {
      const { dates } = req.body;
      if (dates && Array.isArray(dates)) {
        localCalendarCache = dates;
        savePersistentData();
        const { error } = await supabase.from("workstation_calendar").upsert(dates, { onConflict: "id" });
        if (error) {
          console.error("Supabase calendar UPSERT error:", error);
        }
      }
      res.json({ success: true, dates: localCalendarCache });
    } catch (err: any) {
      res.json({ success: true, dates: localCalendarCache });
    }
  });

  app.delete("/api/calendar/:id", async (req, res) => {
    try {
      const { id } = req.params;
      localCalendarCache = localCalendarCache.filter((item) => item.id !== id);
      savePersistentData();
      const { error } = await supabase.from("workstation_calendar").delete().eq("id", id);
      if (error) {
        console.error("Supabase calendar DELETE error:", error);
      }
      res.json({ success: true, dates: localCalendarCache });
    } catch (err: any) {
      res.json({ success: true, dates: localCalendarCache });
    }
  });

  // API Routes for Systemic Email Logs
  app.get("/api/email-logs", async (req, res) => {
    try {
      const { data, error } = await supabase.from("systemic_email_logs").select("*").order("sentAt", { ascending: false });
      if (error || !data || data.length === 0) {
        return res.json({ logs: localEmailLogsCache });
      }
      localEmailLogsCache = data;
      savePersistentData();
      res.json({ logs: data });
    } catch (err) {
      res.json({ logs: localEmailLogsCache });
    }
  });

  app.post("/api/email-logs", async (req, res) => {
    try {
      const { logs } = req.body;
      if (logs && Array.isArray(logs)) {
        localEmailLogsCache = [...logs, ...localEmailLogsCache];
        savePersistentData();
        await supabase.from("systemic_email_logs").upsert(logs, { onConflict: "id" });
      }
      res.json({ success: true, logs: localEmailLogsCache });
    } catch (err) {
      res.json({ success: true, logs: localEmailLogsCache });
    }
  });


  // API Route to reset the database back to DEMO_COMPLAINTS
  app.post("/api/complaints/reset", async (req, res) => {
    try {
      localComplaintsCache = [...DEMO_COMPLAINTS];
      savePersistentData();

      // Attempt to clear and insert in Supabase
      const { error: deleteError } = await supabase
        .from("complaints")
        .delete()
        .neq("id", "FORCE_NONE_MATCHING_ID");

      if (deleteError) {
        console.error("Supabase DELETE during reset error:", deleteError);
      }

      const { error: insertError } = await performResilientSupabaseUpsert(supabase, DEMO_COMPLAINTS);

      if (insertError) {
        console.error("Supabase INSERT during reset error:", insertError);
        return res.json({
          success: true,
          isSupabaseActive: false,
          error: insertError.message,
          complaints: localComplaintsCache
        });
      }

      res.json({
        success: true,
        isSupabaseActive: true,
        complaints: localComplaintsCache
      });
    } catch (err: any) {
      console.error("Reset complaints exception:", err);
      res.json({
        success: true,
        isSupabaseActive: false,
        error: err.message,
        complaints: localComplaintsCache
      });
    }
  });

  // API Route to delete all complaints
  app.post("/api/complaints/clear", async (req, res) => {
    try {
      localComplaintsCache = [];
      savePersistentData();

      const { error: deleteError } = await supabase
        .from("complaints")
        .delete()
        .neq("id", "FORCE_NONE_MATCHING_ID");

      if (deleteError) {
        console.error("Supabase clear error:", deleteError);
        return res.json({
          success: true,
          isSupabaseActive: false,
          error: deleteError.message,
          complaints: []
        });
      }

      res.json({
        success: true,
        isSupabaseActive: true,
        complaints: []
      });
    } catch (err: any) {
      console.error("Clear complaints exception:", err);
      res.json({
        success: true,
        isSupabaseActive: false,
        error: err.message,
        complaints: []
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
