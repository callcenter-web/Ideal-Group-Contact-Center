import React, { useRef, useState } from "react";
import { Upload, FileSpreadsheet, AlertCircle, FileText, Check, HelpCircle } from "lucide-react";
import * as XLSX from "xlsx";
import { Complaint } from "../types";

interface UploadZoneProps {
  onDataLoaded: (newComplaints: Complaint[], overwrite: boolean) => void;
  onResetDemo: () => void;
}

export default function UploadZone({ onDataLoaded, onResetDemo }: UploadZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string>("");
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [entryDate, setEntryDate] = useState(() => {
    const now = new Date();
    return now.toISOString().split("T")[0];
  });
  const [entryTime, setEntryTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [applyMode, setApplyMode] = useState<"fallback" | "force">("force");

  const getFormattedEntryDateTime = () => {
    if (!entryDate) return "";
    const [year, month, day] = entryDate.split("-");
    if (!entryTime) return `${year}-${month}-${day} 12:00 AM`;
    const [hoursStr, minutesStr] = entryTime.split(":");
    let hours = parseInt(hoursStr, 10);
    const minutes = minutesStr;
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${year}-${month}-${day} ${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  };

  const processFile = (file: File) => {
    setUploadError("");
    setSuccessCount(null);

    const isExcel = file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || 
                    file.type === "application/vnd.ms-excel" || 
                    file.name.endsWith(".xlsx") || 
                    file.name.endsWith(".xls");
    
    const isCsv = file.type === "text/csv" || file.name.endsWith(".csv");

    if (!isExcel && !isCsv) {
      setUploadError("Unsupported file format. Please upload an Excel (.xlsx, .xls) or CSV file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          setUploadError("Could not read file contents.");
          return;
        }

        let workbook;
        if (isExcel) {
          workbook = XLSX.read(data, { type: "binary" });
        } else {
          // Parse CSV as string
          const csvText = data as string;
          workbook = XLSX.read(csvText, { type: "string" });
        }

        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet) as any[];

        if (rows.length === 0) {
          setUploadError("The uploaded file is empty.");
          return;
        }

        // Map various possible headers to our Complaint schema
        const mappedComplaints: Complaint[] = rows.map((row: any, index: number) => {
          // Helper to check multiple typical column names
          const getValue = (keys: string[]) => {
            const foundKey = Object.keys(row).find((k) => {
              const cleanedK = k.trim().toLowerCase();
              return keys.some((key) => {
                const cleanedKey = key.trim().toLowerCase();
                return cleanedK === cleanedKey || cleanedK.includes(cleanedKey);
              });
            });
            return foundKey ? String(row[foundKey]).trim() : "";
          };

          // Columns requested by user:
          // Month, Company, Wo No, Wo State, C Vehicle Reg No, Mch Code Description, Work Type, Customer No, Name, Earliest Start Date, Finish Date, Phone No, Tel 2, Site, Mileage, Advisor, Chassi No, Overall, how satisfied are you with your recent service experience at dealership (10 - 0), Tell us more about the reason for this rating, Date Contacted by Call Center

          const month = getValue(["month"]);
          const company = getValue(["company"]);
          const woNo = getValue(["wo no", "wo_no", "work order"]);
          const woState = getValue(["wo state", "wo_state"]);
          const vehicleRegNo = getValue(["c vehicle reg no", "vehicle reg", "vehicle_reg"]);
          const mchCodeDescription = getValue(["mch code description", "model description", "mch_code"]);
          const workType = getValue(["work type", "work_type"]);
          const customerNo = getValue(["customer no", "customer_no"]);
          const customerName = getValue(["name", "customer name", "customername"]);
          const earliestStartDate = getValue(["earliest start date", "earliest start"]);
          const finishDate = getValue(["finish date", "finish_date"]);
          const customerPhone = getValue(["phone no", "phone_no", "phone number", "phone"]);
          const tel2 = getValue(["tel 2", "tel2", "telephone"]);
          const site = getValue(["site", "station", "service station", "branch"]);
          const mileage = getValue(["mileage", "milage"]);
          const advisorName = getValue(["advisor", "service advisor"]);
          const chassiNo = getValue(["chassi no", "chassi_no", "chassis"]);
          
          const npsScoreStr = getValue(["overall, how satisfied", "overall how satisfied", "satisfied", "rating", "nps"]);
          const descriptionStr = getValue(["tell us more about the reason", "tell us more", "reason for this rating", "description", "complaint"]);
          const callCenterDateStr = getValue(["date contacted by call center", "call center date", "callcenter contacted"]);

          // Parse rating score (0 to 10)
          let npsScore = 5; // Default middle-ground
          if (npsScoreStr) {
            const parsed = parseInt(npsScoreStr, 10);
            if (!isNaN(parsed)) {
              npsScore = parsed;
            }
          }

          // Decide initial satisfaction label
          // 0-4 -> Very Dissatisfied, 5-6 -> Dissatisfied
          const initialSat: "Very Dissatisfied" | "Dissatisfied" = (npsScore <= 3) ? "Very Dissatisfied" : "Dissatisfied";

          // Normalize service station site name
          const normalizeStation = (siteStr: string): string => {
            const normalized = siteStr.toLowerCase();
            if (normalized.includes("rathmalana")) return "Rathmalana";
            if (normalized.includes("wanawasala")) return "Wanawasala";
            if (normalized.includes("yakkala")) return "Yakkala";
            if (normalized.includes("kurunegala")) return "Kurunegala";
            if (normalized.includes("anuradhapura")) return "Anuradhapura";
            if (normalized.includes("jaffna")) return "Jaffna";
            if (normalized.includes("tissamaharama") || normalized.includes("tissa")) return "Tissamaharama";
            return "Rathmalana"; // Fallback default
          };

          const station = normalizeStation(site);

          const customDate = entryDate || new Date().toISOString().split("T")[0];
          const customDateTime = getFormattedEntryDateTime();

          const finalDate = (applyMode === "force" || !(finishDate || earliestStartDate))
            ? customDate
            : (finishDate || earliestStartDate);

          const finalReceivedDateTime = (applyMode === "force" || !(finishDate || earliestStartDate))
            ? customDateTime
            : `${finishDate || earliestStartDate} 08:00 AM`;

          return {
            id: woNo ? `COMP-${woNo}` : `COMP-UP-${Date.now()}-${index}`,
            customerName: customerName || "Unknown Customer",
            customerPhone: customerPhone || "",
            customerEmail: getValue(["customer email", "email"]),
            station: station,
            category: workType || "General Service",
            description: descriptionStr || "No feedback details provided.",
            date: finalDate,
            receivedDateTime: finalReceivedDateTime,
            initialSatisfaction: initialSat,
            currentSatisfaction: initialSat,
            status: "Pending",
            notes: "",
            agentName: "",
            
            // Excel custom fields
            month,
            company,
            woNo,
            woState,
            vehicleRegNo,
            mchCodeDescription,
            workType,
            customerNo,
            earliestStartDate,
            finishDate,
            tel2,
            mileage,
            advisorName,
            chassiNo,
            npsScore,

            // Workflow values
            stationContactedDate: "",
            stationResolutionNotes: "",
            callCenterContactedDate: callCenterDateStr || "",
            callCenterFinalRemarks: "",
            callCenterFinalSatisfaction: undefined
          };
        });

        onDataLoaded(mappedComplaints, false); // merge with existing or prompt
        setSuccessCount(mappedComplaints.length);
      } catch (err: any) {
        console.error("Spreadsheet Parsing Error:", err);
        setUploadError(`Failed to parse file: ${err.message || "Invalid spreadsheet format"}`);
      }
    };

    if (isExcel) {
      reader.readAsBinaryString(file);
    } else {
      reader.readAsText(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const downloadSampleCSV = () => {
    const csvContent = 
      "Month,Company,Wo No,Wo State,C Vehicle Reg No,Mch Code Description,Work Type,Customer No,Name,Earliest Start Date,Finish Date,Phone No,Tel 2,Site,Mileage,Advisor,Chassi No,Overall how satisfied are you with your recent service experience at dealership (10 - 0),Tell us more about the reason for this rating,Date Contacted by Call Center\n" +
      "2026-06,Ideal Motors,WO-10552,Completed,WP-CAF-1234,Mahindra KUV100,Running Repairs,C-1209,Nalaka Perera,2026-06-21,2026-06-22,+94771234567,,Rathmalana,42500,S. Priyantha,CHA-992381,2,Rattling noise in the steering column still persists even after standard service,2026-06-23\n" +
      "2026-06,Ideal Motors,WO-10553,Completed,WP-HN-5678,Mahindra Scorpio,Scheduled Maintenance,C-4302,Sharmila Fernando,2026-06-22,2026-06-23,+94719876543,,Yakkala,15000,G. Bandara,CHA-102944,4,Took more than 4 hours for simple lube oil replacement,";

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "cx_recovery_excel_template.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="upload-zone-wrapper" className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div>
          <h3 id="upload-zone-title" className="text-base font-bold text-slate-800 flex items-center">
            <FileSpreadsheet className="h-4 w-4 text-blue-600 mr-2" />
            Upload Customer Complaints Sheet
          </h3>
          <p className="text-slate-500 text-xs mt-1">
            Import Excel (.xlsx, .xls) or CSV files with customer feedback to populate the follow-up dashboard.
          </p>
        </div>
        
        <div className="flex gap-2 shrink-0 items-center">
          <button
            id="btn-sample-csv"
            type="button"
            onClick={downloadSampleCSV}
            className="flex items-center text-[11px] font-semibold text-slate-600 hover:text-slate-800 bg-slate-50 px-3 py-1.5 rounded border border-slate-200 transition-all cursor-pointer"
          >
            <FileText className="h-3.5 w-3.5 mr-1" />
            Get Template CSV
          </button>
          {!showResetConfirm ? (
            <button
              id="btn-reset-demo-data"
              type="button"
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center text-[11px] font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded border border-blue-200 transition-all cursor-pointer"
            >
              <HelpCircle className="h-3.5 w-3.5 mr-1" />
              Reset to Demo Data
            </button>
          ) : (
            <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded px-2 py-1">
              <span className="text-[10px] font-bold text-blue-800">Overwrite custom data?</span>
              <button
                type="button"
                onClick={() => {
                  onResetDemo();
                  setShowResetConfirm(false);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-extrabold px-2 py-0.5 rounded cursor-pointer transition-colors"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer transition-colors"
              >
                No
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Data Entry Date & Time Configuration */}
      <div id="data-entry-timestamp-config" className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 mb-4">
        <div className="text-slate-800 text-xs font-bold mb-2 flex items-center justify-between">
          <span className="uppercase tracking-wider text-[10px] text-slate-500 font-black">Data Entry Timestamp Configuration</span>
          <span className="text-[10px] text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded font-black">
            Selected Entry: {getFormattedEntryDateTime()}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Data Entry Date *
            </label>
            <input
              id="input-entry-date"
              type="date"
              required
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-md py-1.5 px-3 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-semibold"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Data Entry Time *
            </label>
            <input
              id="input-entry-time"
              type="time"
              required
              value={entryTime}
              onChange={(e) => setEntryTime(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-md py-1.5 px-3 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-semibold"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Timestamp Rule *
            </label>
            <select
              id="select-override-strategy"
              value={applyMode}
              onChange={(e) => setApplyMode(e.target.value as "fallback" | "force")}
              className="w-full bg-white border border-slate-200 rounded-md py-1.5 px-3 text-xs text-slate-800 focus:outline-none cursor-pointer font-bold"
            >
              <option value="fallback">Use as fallback only (if empty in file)</option>
              <option value="force">Force override all uploaded complaints</option>
            </select>
          </div>
        </div>
      </div>

      <div
        id="drag-drop-zone"
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={triggerFileSelect}
        className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
          dragActive 
            ? "border-blue-500 bg-blue-50/40" 
            : "border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-50"
        }`}
      >
        <input
          id="file-upload-input"
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".xlsx,.xls,.csv"
          className="hidden"
        />

        <div className="bg-white p-3 rounded-full border border-slate-200 mb-3 shadow-sm">
          <Upload className="h-5 w-5 text-slate-400" />
        </div>

        <p className="text-xs font-semibold text-slate-700">
          Drag and drop your spreadsheet here, or <span className="text-blue-600 underline">browse computer</span>
        </p>
        <p className="text-[10px] text-slate-400 mt-1">
          Supports Microsoft Excel (.xlsx, .xls) and CSV files
        </p>
      </div>

      {/* Column suggestions box */}
      <div className="mt-4 bg-slate-50 border border-slate-100 rounded p-3 text-slate-500 text-[10px]">
        <span className="font-bold text-slate-700 text-xs block mb-1">Detected Excel Columns:</span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-medium">
          <span>• Month</span>
          <span>• Company</span>
          <span>• Wo No (Work Order No)</span>
          <span>• Wo State</span>
          <span>• C Vehicle Reg No</span>
          <span>• Mch Code Description</span>
          <span>• Work Type</span>
          <span>• Customer No</span>
          <span>• Name (Customer Name)</span>
          <span>• Earliest Start Date</span>
          <span>• Finish Date</span>
          <span>• Phone No</span>
          <span>• Tel 2</span>
          <span>• Site (Service Station)</span>
          <span>• Mileage</span>
          <span>• Advisor</span>
          <span>• Chassi No</span>
          <span>• Overall how satisfied... (10-0)</span>
          <span>• Tell us more... (Complaint Details)</span>
          <span>• Date Contacted by Call Center</span>
        </div>
      </div>

      {uploadError && (
        <div id="upload-error-alert" className="mt-4 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs font-medium">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
          <span>{uploadError}</span>
        </div>
      )}

      {successCount !== null && (
        <div id="upload-success-alert" className="mt-4 flex items-start gap-2 bg-green-50 border border-green-200 text-green-700 p-3 rounded-lg text-xs font-medium animate-fade-in">
          <Check className="h-4 w-4 shrink-0 text-green-600 mt-0.5" />
          <span>Successfully imported <strong>{successCount}</strong> complaints from your spreadsheet! Complaints are now listed below and sorted by date.</span>
        </div>
      )}
    </div>
  );
}
