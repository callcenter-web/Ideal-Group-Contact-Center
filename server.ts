import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { DEMO_COMPLAINTS, CALL_CENTER_OFFICERS, STATIONS } from "./src/demoData";
import { sanitizeComplaintForSupabase, deduplicateAndSanitizeComplaints } from "./src/utils/supabaseSanitizer";

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

// Memory cache fallback
let localComplaintsCache = [...DEMO_COMPLAINTS];
let localOfficersCache = [...CALL_CENTER_OFFICERS];
let localStationsCache = [...STATIONS];

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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

  // API Route to fetch all complaints from Supabase with fallback
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

      // If database is active but completely empty, pre-populate it with DEMO_COMPLAINTS
      if (data && data.length === 0 && localComplaintsCache.length > 0) {
        console.log("Supabase table is empty. Pre-populating with default complaints...");
        const cleanDemo = deduplicateAndSanitizeComplaints(DEMO_COMPLAINTS);
        const { error: insertError } = await supabase
          .from("complaints")
          .insert(cleanDemo);
        
        if (!insertError) {
          const { data: refreshedData } = await supabase
            .from("complaints")
            .select("*")
            .order("date", { ascending: false });
          return res.json({
            complaints: refreshedData || DEMO_COMPLAINTS,
            isSupabaseActive: true,
            isSeeded: true
          });
        } else {
          console.error("Failed to pre-populate Supabase:", insertError);
        }
      }

      // Keep cache in sync with active db
      if (data) {
        localComplaintsCache = data;
      }

      res.json({
        complaints: data || localComplaintsCache,
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

      // Update local memory cache first
      complaintsArray.forEach(newC => {
        const idx = localComplaintsCache.findIndex(c => c.id === newC.id);
        if (idx !== -1) {
          localComplaintsCache[idx] = newC;
        } else {
          localComplaintsCache.unshift(newC);
        }
      });

      // Try writing to Supabase with deduplicated and sanitized data
      const cleanComplaints = deduplicateAndSanitizeComplaints(complaintsArray);
      const { data, error } = await supabase
        .from("complaints")
        .upsert(cleanComplaints, { onConflict: "id" });

      if (error) {
        console.error("Supabase UPSERT error:", error);
        return res.json({
          success: true, // Mark true because we saved in local memory cache successfully
          isSupabaseActive: false,
          error: error.message,
          code: error.code,
          complaints: localComplaintsCache
        });
      }

      res.json({
        success: true,
        isSupabaseActive: true,
        complaints: localComplaintsCache
      });
    } catch (err: any) {
      console.error("Save complaints exception:", err);
      res.json({
        success: true,
        isSupabaseActive: false,
        error: err.message,
        complaints: localComplaintsCache
      });
    }
  });

  // API Route to delete a single complaint by ID or WO Number
  app.post("/api/complaints/delete", async (req, res) => {
    try {
      const { id } = req.body;
      if (!id) {
        return res.status(400).json({ error: "Complaint ID is required for deletion." });
      }

      // Filter local memory cache
      localComplaintsCache = localComplaintsCache.filter(
        (c) => c.id !== id && c.woNo !== id
      );

      // Try deleting from Supabase
      const { error } = await supabase
        .from("complaints")
        .delete()
        .or(`id.eq.${id},wo_no.eq.${id}`);

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
          return res.json({
            officers: CALL_CENTER_OFFICERS,
            isSupabaseActive: true
          });
        }
      } else {
        localOfficersCache = data;
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
        .from("service_stations")
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
          .from("service_stations")
          .insert(STATIONS);

        if (!insertError) {
          return res.json({
            stations: STATIONS,
            isSupabaseActive: true
          });
        }
      } else {
        localStationsCache = data;
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

      const { data, error } = await supabase
        .from("service_stations")
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

  // API Route to reset the database back to DEMO_COMPLAINTS
  app.post("/api/complaints/reset", async (req, res) => {
    try {
      localComplaintsCache = [...DEMO_COMPLAINTS];

      // Attempt to clear and insert in Supabase
      const { error: deleteError } = await supabase
        .from("complaints")
        .delete()
        .neq("id", "FORCE_NONE_MATCHING_ID");

      if (deleteError) {
        console.error("Supabase DELETE during reset error:", deleteError);
      }

      const cleanDemo = deduplicateAndSanitizeComplaints(DEMO_COMPLAINTS);
      const { error: insertError } = await supabase
        .from("complaints")
        .insert(cleanDemo);

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
