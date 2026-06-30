import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

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
