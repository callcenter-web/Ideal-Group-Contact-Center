import React, { useState } from "react";
import { Sparkles, Loader2, Copy, Check, MessageSquare, AlertCircle, Heart, Gift, ClipboardCheck } from "lucide-react";
import { Complaint, AIAnalysis } from "../types";

interface AIRecoveryAssistantProps {
  complaint: Complaint;
  onAnalysisSuccess: (analysis: AIAnalysis) => void;
}

export default function AIRecoveryAssistant({ complaint, onAnalysisSuccess }: AIRecoveryAssistantProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [checkedSteps, setCheckedSteps] = useState<Record<number, boolean>>({});

  const handleAnalyze = async () => {
    setLoading(true);
    setError("");
    setCheckedSteps({});

    try {
      const response = await fetch("/api/analyze-complaint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: complaint.category,
          description: complaint.description,
          customerName: complaint.customerName,
          station: complaint.station,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to analyze complaint.");
      }

      const data = await response.json() as AIAnalysis;
      onAnalysisSuccess(data);
    } catch (err: any) {
      console.error("AI Analysis Error:", err);
      setError(err.message || "An error occurred while connecting to the AI helper. Please verify your GEMINI_API_KEY.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleStep = (index: number) => {
    setCheckedSteps((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const analysis = complaint.aiAnalysis;

  return (
    <div id="ai-recovery-wrapper" className="bg-slate-50 rounded-lg border border-slate-200 p-4 mt-4">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4.5 w-4.5 text-blue-600" />
          <h4 className="text-xs font-black text-slate-800 font-sans uppercase tracking-wider">
            Gemini AI Recovery Assistant
          </h4>
        </div>
        {!analysis && !loading && (
          <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
            Analysis Ready
          </span>
        )}
      </div>

      {!analysis && !loading && (
        <div className="text-center py-6 px-4">
          <p className="text-slate-600 text-xs mb-4 max-w-sm mx-auto leading-relaxed">
            Need an empathy-driven resolution plan? Let Gemini AI analyze this complaint to generate a call script, a custom resolution plan, and recommended compensation.
          </p>
          <button
            id="btn-trigger-ai-analysis"
            type="button"
            onClick={handleAnalyze}
            className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs py-1.5 px-4 rounded-lg transition-all shadow-sm cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Generate Recovery Plan
          </button>
        </div>
      )}

      {loading && (
        <div id="ai-loading-state" className="flex flex-col items-center justify-center py-10 text-center">
          <Loader2 className="h-7 w-7 text-blue-600 animate-spin mb-3" />
          <p className="text-slate-800 text-xs font-bold animate-pulse">
            Analyzing customer sentiment...
          </p>
          <p className="text-slate-400 text-[10px] mt-1 max-w-xs">
            Reviewing details and generating customized empathetic phone scripts & goodwill recommendations.
          </p>
        </div>
      )}

      {error && (
        <div id="ai-error-state" className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 p-3.5 rounded-lg text-xs font-medium">
          <AlertCircle className="h-4.5 w-4.5 shrink-0 text-red-500 mt-0.5" />
          <div>
            <p className="font-bold text-slate-900">AI Analysis Unavailable</p>
            <p className="mt-1 leading-relaxed text-[11px] text-slate-600">{error}</p>
          </div>
        </div>
      )}

      {analysis && !loading && (
        <div id="ai-results-panel" className="space-y-3.5">
          
          {/* Sentiment Section */}
          <div className="bg-orange-50/50 border border-orange-100 rounded-lg p-3 flex items-start gap-3">
            <div className="bg-orange-100/50 p-1.5 rounded-md border border-orange-200/50 shrink-0">
              <Heart className="h-4 w-4 text-orange-600" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-orange-700 uppercase tracking-wide block">
                Frustration & Sentiment Check:
              </span>
              <p className="text-slate-700 text-xs mt-1 leading-relaxed">
                {analysis.sentimentAnalysis}
              </p>
            </div>
          </div>

          {/* Goodwill Token Section */}
          <div className="bg-green-50/50 border border-green-100 rounded-lg p-3 flex items-start gap-3">
            <div className="bg-green-100/50 p-1.5 rounded-md border border-green-200/50 shrink-0">
              <Gift className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-green-700 uppercase tracking-wide block">
                Recommended Goodwill Token:
              </span>
              <p className="text-slate-800 text-xs mt-1 leading-relaxed font-bold">
                {analysis.suggestedCompensation}
              </p>
            </div>
          </div>

          {/* Call Script Section */}
          <div className="border border-blue-100 rounded-lg overflow-hidden bg-blue-50/10">
            <div className="bg-blue-50/50 px-3 py-1.5 flex items-center justify-between border-b border-blue-100">
              <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wide flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" />
                Empathetic Call Script
              </span>
              <button
                id="btn-copy-script"
                type="button"
                onClick={() => copyToClipboard(analysis.callScript)}
                className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 px-2 py-0.5 rounded transition-all shadow-sm"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 text-green-600" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    Copy Script
                  </>
                )}
              </button>
            </div>
            <div className="p-3 bg-white font-sans text-xs text-slate-700 italic border-l-2 border-blue-500 leading-relaxed whitespace-pre-wrap">
              "{analysis.callScript}"
            </div>
          </div>

          {/* Action-Based Resolution Checklist */}
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-2 flex items-center gap-1.5">
              <ClipboardCheck className="h-3.5 w-3.5 text-blue-600" />
              Interactive Recovery Steps:
            </span>
            <div className="space-y-1.5">
              {analysis.resolutionSteps.map((step, idx) => (
                <div
                  key={idx}
                  onClick={() => toggleStep(idx)}
                  className={`flex items-start gap-2.5 p-2 rounded-md border cursor-pointer select-none transition-all ${
                    checkedSteps[idx]
                      ? "bg-slate-100/60 border-slate-200 text-slate-400"
                      : "bg-white border-slate-200 text-slate-800 hover:bg-slate-50/80"
                  }`}
                >
                  <div className={`h-4 w-4 rounded flex items-center justify-center border mt-0.5 shrink-0 ${
                    checkedSteps[idx]
                      ? "bg-green-600 border-green-600 text-white"
                      : "border-slate-300 bg-white"
                  }`}>
                    {checkedSteps[idx] && <Check className="h-3 w-3 stroke-[3px]" />}
                  </div>
                  <span className={`text-xs leading-relaxed ${checkedSteps[idx] ? "line-through text-slate-400" : ""}`}>
                    {step}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Regenerate Trigger */}
          <div className="flex justify-end pt-2 border-t border-slate-200">
            <button
              id="btn-re-analyze"
              type="button"
              onClick={handleAnalyze}
              className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-blue-600 transition-colors"
            >
              <Sparkles className="h-3 w-3" />
              Regenerate Plan
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
