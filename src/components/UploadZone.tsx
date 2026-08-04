import React, { useRef, useState } from "react";
import { 
  Upload, 
  FileSpreadsheet, 
  AlertCircle, 
  FileText, 
  Check, 
  HelpCircle,
  AlertTriangle,
  CheckCircle,
  Copy,
  Loader2,
  ListCheck,
  RotateCcw,
  Sparkles,
  Info
} from "lucide-react";
import * as XLSX from "xlsx";
import { Complaint } from "../types";

interface UploadZoneProps {
  onDataLoaded: (newComplaints: Complaint[], overwrite: boolean) => void;
  onResetDemo: () => void;
  existingComplaints?: Complaint[];
}

export interface StagedItem {
  id: string;
  complaint: Complaint;
  selected: boolean;
  isDuplicateInDb: boolean;
  isDuplicateInFile: boolean;
  missingFields: string[];
  woNo: string;
}

export default function UploadZone({ 
  onDataLoaded, 
  onResetDemo,
  existingComplaints = []
}: UploadZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string>("");
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Data Staging & Confirmation States
  const [stagedItems, setStagedItems] = useState<StagedItem[] | null>(null);
  const [stagedFileName, setStagedFileName] = useState<string>("");
  const [stagingFilter, setStagingFilter] = useState<"all" | "new" | "duplicate">("all");
  
  // Upload Progress Bar States
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [progressStatusText, setProgressStatusText] = useState("");

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
    setStagedItems(null);
    setStagedFileName(file.name);

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

        const normalizeAlpha = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, "");
        
        // Track existing WO Numbers in current system database
        const existingWoNumbers = new Set(
          existingComplaints.map(c => (c.woNo || c.id).trim().toUpperCase())
        );

        // Track WO Numbers inside this uploaded file batch
        const seenInFileWoNumbers = new Map<string, number>();

        const staged: StagedItem[] = rows.map((row: any, index: number) => {
          const rowKeys = Object.keys(row);

          const getValue = (keys: string[]) => {
            for (const key of keys) {
              const targetNorm = normalizeAlpha(key);
              const matchKey = rowKeys.find((rk) => normalizeAlpha(rk) === targetNorm);
              if (matchKey && row[matchKey] !== undefined && String(row[matchKey]).trim() !== "") {
                return String(row[matchKey]).trim();
              }
            }

            for (const key of keys) {
              const targetNorm = normalizeAlpha(key);
              const matchKey = rowKeys.find((rk) => {
                const rkNorm = normalizeAlpha(rk);
                return rkNorm.includes(targetNorm) || (targetNorm.length > 5 && targetNorm.includes(rkNorm));
              });
              if (matchKey && row[matchKey] !== undefined && String(row[matchKey]).trim() !== "") {
                return String(row[matchKey]).trim();
              }
            }

            return "";
          };

          const month = getValue(["month"]);
          const company = getValue(["company"]);
          const woNo = getValue(["wo no", "wo_no", "work order", "wono"]);
          const woState = getValue(["wo state", "wo_state", "wostate"]);
          const vehicleRegNo = getValue(["c vehicle reg no", "vehicle reg no", "vehicle reg", "vehicle_reg", "reg no"]);
          const mchCodeDescription = getValue(["mch code description", "model description", "mch_code", "mch code"]);
          const workType = getValue(["work type", "work_type", "worktype"]);
          const customerNo = getValue(["customer no", "customer_no", "customerno"]);
          const customerName = getValue(["name", "customer name", "customername"]);
          const earliestStartDate = getValue(["earliest start date", "earliest start"]);
          const finishDate = getValue(["finish date", "finish_date"]);
          const customerPhone = getValue(["phone no", "phone_no", "phone number", "phone"]);
          const tel2 = getValue(["tel 2", "tel2", "telephone"]);
          const site = getValue(["site", "station", "service station", "branch"]);
          const mileage = getValue(["mileage", "milage"]);
          const advisorName = getValue(["advisor", "service advisor"]);
          const chassiNo = getValue(["chassi no", "chassi_no", "chassis"]);
          
          const npsScoreStr = getValue([
            "overall, how satisfied are you with your recent service experience at dealership (10 - 0)",
            "overall how satisfied are you with your recent service experience at dealership",
            "overall, how satisfied",
            "overall how satisfied",
            "satisfied",
            "rating",
            "nps"
          ]);

          const descriptionStr = getValue([
            "tell us more about the reason for this rating .",
            "tell us more about the reason for this rating",
            "tell us more about the reason for this rating.",
            "tell us more about the reason",
            "reason for this rating",
            "tell us more",
            "customer complaint description",
            "complaint description",
            "customer feedback",
            "customer comment",
            "customer comments",
            "description",
            "complaint",
            "feedback",
            "reason"
          ]);

          const callCenterDateStr = getValue(["date contacted by call center", "call center date", "callcenter contacted"]);

          let npsScore = 5;
          if (npsScoreStr) {
            const parsed = parseInt(npsScoreStr, 10);
            if (!isNaN(parsed)) {
              npsScore = parsed;
            }
          }

          const initialSat: "Very Dissatisfied" | "Dissatisfied" = (npsScore <= 3) ? "Very Dissatisfied" : "Dissatisfied";

          const normalizeStation = (siteStr: string): string => {
            const normalized = siteStr.toLowerCase();
            if (normalized.includes("rathmalana")) return "Rathmalana";
            if (normalized.includes("wanawasala")) return "Wanawasala";
            if (normalized.includes("yakkala")) return "Yakkala";
            if (normalized.includes("kurunegala")) return "Kurunegala";
            if (normalized.includes("anuradhapura")) return "Anuradhapura";
            if (normalized.includes("jaffna")) return "Jaffna";
            if (normalized.includes("tissamaharama") || normalized.includes("tissa")) return "Tissamaharama";
            return "Rathmalana";
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

          // Generate primary ID strictly based on WO Number if available
          const primaryWoNo = woNo ? woNo.trim() : "";
          const primaryId = primaryWoNo ? `COMP-${primaryWoNo}` : `COMP-UP-${Date.now()}-${index}`;

          // Check duplicate conditions
          const normalizedWoUpper = primaryWoNo.toUpperCase();
          const isDuplicateInDb = primaryWoNo ? existingWoNumbers.has(normalizedWoUpper) : false;

          let isDuplicateInFile = false;
          if (primaryWoNo) {
            const count = seenInFileWoNumbers.get(normalizedWoUpper) || 0;
            if (count > 0) {
              isDuplicateInFile = true;
            }
            seenInFileWoNumbers.set(normalizedWoUpper, count + 1);
          }

          // Check missing required fields
          const missingFields: string[] = [];
          if (!customerName) missingFields.push("Customer Name");
          if (!customerPhone) missingFields.push("Phone No");
          if (!primaryWoNo) missingFields.push("WO Number");

          const complaintObj: Complaint = {
            id: primaryId,
            customerName: customerName || "Unknown Customer",
            customerPhone: customerPhone || "N/A",
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
            
            month,
            company,
            woNo: primaryWoNo,
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

            stationContactedDate: "",
            stationResolutionNotes: "",
            callCenterContactedDate: callCenterDateStr || "",
            callCenterFinalRemarks: "",
            callCenterFinalSatisfaction: undefined
          };

          return {
            id: primaryId,
            complaint: complaintObj,
            selected: true,
            isDuplicateInDb,
            isDuplicateInFile,
            missingFields,
            woNo: primaryWoNo
          };
        });

        setStagedItems(staged);
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

  // Toggle selection in staging preview
  const toggleItemSelection = (id: string) => {
    if (!stagedItems) return;
    setStagedItems(prev => 
      prev ? prev.map(item => item.id === id ? { ...item, selected: !item.selected } : item) : null
    );
  };

  const toggleSelectAll = (select: boolean) => {
    if (!stagedItems) return;
    setStagedItems(prev => prev ? prev.map(item => ({ ...item, selected: select })) : null);
  };

  // Execute Admin Confirmed Import with Progress Bar
  const handleAdminConfirmImport = () => {
    if (!stagedItems) return;

    const selectedToImport = stagedItems.filter(s => s.selected).map(s => s.complaint);

    if (selectedToImport.length === 0) {
      setUploadError("Please select at least one record to import.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);
    setProgressStatusText("Initializing Admin Confirmation & Validating WO Records...");

    let current = 15;
    const totalRecords = selectedToImport.length;

    const interval = setInterval(() => {
      current += Math.floor(Math.random() * 20) + 15;
      if (current < 90) {
        setUploadProgress(current);
        setProgressStatusText(`Processing record ${Math.min(Math.floor((current / 100) * totalRecords), totalRecords)} of ${totalRecords}... Syncing with Master Database...`);
      } else {
        clearInterval(interval);
        setUploadProgress(100);
        setProgressStatusText("Import complete! Database and analytics successfully updated.");

        setTimeout(() => {
          onDataLoaded(selectedToImport, false);
          setSuccessCount(selectedToImport.length);
          setIsUploading(false);
          setStagedItems(null);
        }, 600);
      }
    }, 250);
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

  // Calculations for staging UI
  const stagedCount = stagedItems?.length || 0;
  const selectedCount = stagedItems?.filter(s => s.selected).length || 0;
  const duplicateDbCount = stagedItems?.filter(s => s.isDuplicateInDb).length || 0;
  const duplicateFileCount = stagedItems?.filter(s => s.isDuplicateInFile).length || 0;
  const newRecordsCount = stagedItems?.filter(s => !s.isDuplicateInDb && !s.isDuplicateInFile).length || 0;

  const filteredStagedItems = (stagedItems || []).filter(item => {
    if (stagingFilter === "new") return !item.isDuplicateInDb && !item.isDuplicateInFile;
    if (stagingFilter === "duplicate") return item.isDuplicateInDb || item.isDuplicateInFile;
    return true;
  });

  return (
    <div id="upload-zone-wrapper" className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs mb-6 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 id="upload-zone-title" className="text-base font-black text-slate-800 flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-blue-600" />
            Upload Customer Complaints Sheet (WO Number Indexed)
          </h3>
          <p className="text-slate-500 text-xs mt-1 font-medium">
            Import Excel (.xlsx, .xls) or CSV files indexed by WO Number with Admin preview & duplicate detection.
          </p>
        </div>
        
        <div className="flex gap-2 shrink-0 items-center">
          <button
            id="btn-sample-csv"
            type="button"
            onClick={downloadSampleCSV}
            className="flex items-center text-[11px] font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg border border-slate-200 transition-all cursor-pointer"
          >
            <FileText className="h-3.5 w-3.5 mr-1" />
            Get Template CSV
          </button>
          {!showResetConfirm ? (
            <button
              id="btn-reset-demo-data"
              type="button"
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center text-[11px] font-bold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition-all cursor-pointer"
            >
              <HelpCircle className="h-3.5 w-3.5 mr-1" />
              Reset to Demo Data
            </button>
          ) : (
            <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1">
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
      <div id="data-entry-timestamp-config" className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
        <div className="text-slate-800 text-xs font-bold flex items-center justify-between">
          <span className="uppercase tracking-wider text-[10px] text-slate-500 font-black">Data Entry Timestamp Configuration</span>
          <span className="text-[10px] text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-100 font-bold">
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

      {/* Main Drag & Drop Zone */}
      {!stagedItems && !isUploading && (
        <div
          id="drag-drop-zone"
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={triggerFileSelect}
          className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
            dragActive 
              ? "border-blue-500 bg-blue-50/50 scale-[0.99]" 
              : "border-slate-300 hover:border-slate-400 bg-slate-50/60 hover:bg-slate-50"
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

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 mb-3 shadow-xs">
            <Upload className="h-6 w-6 text-blue-600" />
          </div>

          <p className="text-xs font-bold text-slate-800">
            Drag and drop your Excel spreadsheet here, or <span className="text-blue-600 underline">browse computer</span>
          </p>
          <p className="text-[10px] text-slate-400 mt-1 font-medium">
            Supports Microsoft Excel (.xlsx, .xls) and CSV files. Automatic WO Number index matching.
          </p>
        </div>
      )}

      {/* Uploading Progress Bar Modal / Overlay */}
      {isUploading && (
        <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-6 space-y-3 animate-fade-in text-center">
          <div className="flex items-center justify-center gap-2 text-blue-800 font-bold text-sm">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <span>Processing & Importing Spreadsheet Records...</span>
          </div>

          {/* Progress Bar Container */}
          <div className="w-full bg-slate-200 h-3.5 rounded-full overflow-hidden shadow-inner">
            <div 
              className="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out flex items-center justify-end pr-2 text-[9px] font-black text-white"
              style={{ width: `${uploadProgress}%` }}
            >
              {uploadProgress > 15 && `${uploadProgress}%`}
            </div>
          </div>

          <p className="text-xs font-semibold text-slate-600 animate-pulse">
            {progressStatusText}
          </p>
        </div>
      )}

      {/* Admin Pre-Upload Staging Preview & Confirmation Panel */}
      {stagedItems && !isUploading && (
        <div className="bg-slate-50/90 border border-slate-300 rounded-xl p-4 space-y-4 shadow-sm animate-fade-in">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <ListCheck className="h-5 w-5 text-amber-600" />
                <h4 className="text-sm font-black text-slate-800">
                  Admin Pre-Upload Confirmation ({stagedFileName})
                </h4>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Review parsed records, duplicate WO numbers, and select rows to confirm import into system database.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStagedItems(null)}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-lg cursor-pointer"
              >
                Cancel / Choose Another File
              </button>
              <button
                type="button"
                onClick={handleAdminConfirmImport}
                className="px-4 py-1.5 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle className="h-4 w-4 text-white" />
                <span>Admin Confirm & Import Selected ({selectedCount})</span>
              </button>
            </div>
          </div>

          {/* Stats Badges */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div className="bg-white p-2.5 rounded-lg border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Parsed</span>
              <span className="text-base font-black text-slate-800">{stagedCount} Records</span>
            </div>

            <div className="bg-green-50 p-2.5 rounded-lg border border-green-200">
              <span className="text-[10px] font-bold text-green-700 uppercase block">New WO Records</span>
              <span className="text-base font-black text-green-800">{newRecordsCount} New</span>
            </div>

            <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200">
              <span className="text-[10px] font-bold text-amber-700 uppercase block">WO Duplicates Found</span>
              <span className="text-base font-black text-amber-800">{duplicateDbCount + duplicateFileCount} Duplicates</span>
            </div>

            <div className="bg-blue-50 p-2.5 rounded-lg border border-blue-200">
              <span className="text-[10px] font-bold text-blue-700 uppercase block">Selected to Import</span>
              <span className="text-base font-black text-blue-900">{selectedCount} Selected</span>
            </div>
          </div>

          {/* Staging Filters & Quick Selections */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 bg-white p-2.5 rounded-lg border border-slate-200 text-xs">
            <div className="flex items-center gap-1">
              <span className="text-slate-500 font-bold mr-1">Filter Staging:</span>
              <button
                type="button"
                onClick={() => setStagingFilter("all")}
                className={`px-2.5 py-1 rounded font-bold transition-all cursor-pointer ${
                  stagingFilter === "all" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                All ({stagedCount})
              </button>
              <button
                type="button"
                onClick={() => setStagingFilter("new")}
                className={`px-2.5 py-1 rounded font-bold transition-all cursor-pointer ${
                  stagingFilter === "new" ? "bg-green-600 text-white" : "bg-green-50 text-green-700"
                }`}
              >
                New Only ({newRecordsCount})
              </button>
              <button
                type="button"
                onClick={() => setStagingFilter("duplicate")}
                className={`px-2.5 py-1 rounded font-bold transition-all cursor-pointer ${
                  stagingFilter === "duplicate" ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-700"
                }`}
              >
                Duplicates ({duplicateDbCount + duplicateFileCount})
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleSelectAll(true)}
                className="text-blue-600 hover:underline font-bold text-[11px] cursor-pointer"
              >
                Select All
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={() => toggleSelectAll(false)}
                className="text-slate-500 hover:underline font-bold text-[11px] cursor-pointer"
              >
                Deselect All
              </button>
            </div>
          </div>

          {/* Staging Table */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden max-h-72 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold text-[10px] uppercase sticky top-0 z-10">
                <tr>
                  <th className="py-2 px-3 text-center">Import</th>
                  <th className="py-2 px-3">WO No</th>
                  <th className="py-2 px-3">Customer Name</th>
                  <th className="py-2 px-3">Phone</th>
                  <th className="py-2 px-3">Station</th>
                  <th className="py-2 px-3">WO Status / Indicator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredStagedItems.map((item) => (
                  <tr key={item.id} className={item.selected ? "bg-white" : "bg-slate-50 opacity-60"}>
                    <td className="py-2 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={() => toggleItemSelection(item.id)}
                        className="rounded border-slate-300 text-blue-600 cursor-pointer h-4 w-4"
                      />
                    </td>
                    <td className="py-2 px-3 font-bold text-slate-900">
                      {item.woNo || <span className="text-red-500 italic">Missing WO</span>}
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-800">{item.complaint.customerName}</td>
                    <td className="py-2 px-3 text-slate-600">{item.complaint.customerPhone}</td>
                    <td className="py-2 px-3 text-slate-700 font-medium">{item.complaint.station}</td>
                    <td className="py-2 px-3">
                      {item.isDuplicateInDb ? (
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300 flex items-center gap-1 w-fit">
                          <AlertTriangle className="h-3 w-3 text-amber-600" />
                          WO Exists in DB (Will Update)
                        </span>
                      ) : item.isDuplicateInFile ? (
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300 flex items-center gap-1 w-fit">
                          <Copy className="h-3 w-3 text-amber-600" />
                          Duplicate WO in File
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-green-800 bg-green-100 px-2 py-0.5 rounded border border-green-300 flex items-center gap-1 w-fit">
                          <CheckCircle className="h-3 w-3 text-green-600" />
                          New WO Record
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Column suggestions box */}
      <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-slate-500 text-[10px]">
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
        <div id="upload-error-alert" className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs font-medium">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
          <span>{uploadError}</span>
        </div>
      )}

      {successCount !== null && (
        <div id="upload-success-alert" className="flex items-start gap-2 bg-green-50 border border-green-200 text-green-700 p-3 rounded-lg text-xs font-medium animate-fade-in">
          <Check className="h-4 w-4 shrink-0 text-green-600 mt-0.5" />
          <span>Successfully imported <strong>{successCount}</strong> complaints into the master database!</span>
        </div>
      )}
    </div>
  );
}
