export type SatisfactionLevel = "Very Dissatisfied" | "Dissatisfied" | "Neutral" | "Satisfied" | "Very Satisfied";
export type FollowUpStatus = "Pending" | "In Progress" | "Contacted" | "Resolved";

export type ServiceStationContactStatus = 
  | "PENDING_CONTACT" 
  | "CONTACT_ATTEMPTED" 
  | "CONTACTED" 
  | "CUSTOMER_UNREACHABLE" 
  | "NOT_CONTACTED";

export interface ContactAttemptEvent {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: "agent" | "callcenter" | "admin" | "system";
  contactMethod: "Phone Call" | "Workshop In-Person" | "WhatsApp / SMS" | "Email" | "Field Visit" | string;
  outcome: ServiceStationContactStatus | string;
  customerResponse?: string;
  remarks?: string;
  nextFollowUpDate?: string;
}

export interface AIAnalysis {
  sentimentAnalysis: string;
  callScript: string;
  resolutionSteps: string[];
  suggestedCompensation: string;
}

export interface CaseHistoryEntry {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: "callcenter" | "agent" | "admin" | "system";
  action: string;
  notes?: string;
  rejectionReason?: string;
  stationName?: string;
  previousStatus?: string;
  newStatus?: string;
}

export interface Complaint {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  station: string;
  category: string;
  description: string;
  date: string;
  receivedDateTime?: string; // Automatically captured Date and Time when submitted or parsed
  initialSatisfaction: "Very Dissatisfied" | "Dissatisfied";
  currentSatisfaction: SatisfactionLevel;
  status: FollowUpStatus;
  notes: string;
  agentName: string;
  aiAnalysis?: AIAnalysis;
  updatedAt?: string;

  // Case history tracking
  caseHistory?: CaseHistoryEntry[];

  // Primary Service Station Contact Tracking Fields (Database Synchronized)
  serviceStationContactStatus?: ServiceStationContactStatus | string;
  serviceStationContactedAt?: string;
  serviceStationContactedBy?: string;
  serviceStationContactMethod?: string;
  serviceStationContactRemark?: string;
  serviceStationCustomerResponse?: string;
  nextFollowUpDate?: string;
  lastContactAttemptAt?: string;
  contactAttemptCount?: number;
  contactAttempts?: ContactAttemptEvent[];

  // New fields from Excel spreadsheet
  month?: string;
  company?: string;
  woNo?: string;
  woState?: string;
  vehicleRegNo?: string;
  mchCodeDescription?: string;
  workType?: string;
  customerNo?: string;
  earliestStartDate?: string;
  finishDate?: string;
  tel2?: string;
  mileage?: string;
  advisorName?: string; // Original advisor who did the work
  chassiNo?: string;
  npsScore?: number; // 0-10 satisfaction score

  // Workflow variables
  stationContactedDate?: string; // Date service station contacted the customer (Date Forwarded to Aftermarket)
  stationResolutionNotes?: string; // Resolution/action logged by service station
  callCenterContactedDate?: string; // Date Call Center contacted customer (Follow-up Date)
  callCenterFinalRemarks?: string; // Customer final remark / Final Remark
  callCenterFinalSatisfaction?: SatisfactionLevel; // Call Center logged final satisfaction
  
  // Custom data fields for parallel tracking
  feedbackStatus?: string; // Satisfied, Not Satisfied, No solution Received, Customer Unreachable, Follow Up Required, Escalated, Connected, Customer Busy, Invalid Details, Invalid Number, No Answer
  finalStatus?: string; // Open, Pending with Aftermarket, Solution Received, Pending Customer Verification, Closed, Unreachable
  solutionProvidedByAftermarket?: string;
  solutionDate?: string;
  followUpDate?: string;

  // Call center officer and tracking fields
  callCenterOfficer?: string;
  callCenterContactedBy?: string;
  updatedBy?: string;

  // Station Response Rejection & Verification tracking
  stationResponseStatus?: "Pending Station" | "Submitted to Call Center" | "Approved" | "Rejected" | string;
  stationResponseRejectionReason?: string;
  stationResponseRejectedDate?: string;
  stationResponseRejectedBy?: string;

  // Multi-attempt follow-up tracking
  firstAttemptCallStatus?: "Connected" | "Customer Busy" | "Customer Unreachable" | "Invalid Details" | "Invalid Number" | "No Answer" | string;
  firstAttemptDate?: string;
  firstAttemptNotes?: string;
  secondAttemptCallStatus?: "Connected" | "Customer Busy" | "Customer Unreachable" | "Invalid Details" | "Invalid Number" | "No Answer" | string;
  secondAttemptFeedbackStatus?: "Satisfied" | "Not Satisfied" | "No solution Received" | "Customer Unreachable" | "Follow Up Required" | "Escalated" | string;
  secondAttemptDate?: string;
  secondAttemptNotes?: string;
  attemptCount?: number;
}

export interface StationOfficerContact {
  name: string;
  role: string;
  email: string;
  phone: string;
}

export interface StationProfile {
  name: string;
  code: string;
  passwordHash: string; // Passkey for station login
  address?: string;
  managerName?: string;
  email?: string;
  phone?: string;
  officers?: StationOfficerContact[];
}

export interface SystemicEmailLog {
  id: string;
  station: string;
  sentAt: string;
  fromEmail: string;
  recipients: string[];
  subject: string;
  complaintCount: number;
  complaintIds: string[];
  bodyHtml: string;
  status: "Sent" | "Delivered";
}

export interface CallCenterOfficer {
  id: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  avatar: string;
  department: string;
  passwordHash?: string;
}

export interface UserProfile {
  id?: string;
  auth_user_id?: string | null;
  user_id?: string;
  role: "admin" | "agent" | "callcenter";
  station?: string;
  name?: string;
  officerId?: string;
  title?: string;
  email?: string;
  phone?: string;
  avatar?: string;
  department?: string;
  communication_preferences?: Record<string, any>;
  working_permissions?: Record<string, any>;
  emergency_hotline?: string | null;
  backup_contact_name?: string | null;
  backup_contact_phone?: string | null;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
  last_updated_by?: string | null;
}

export interface WorkstationCalendarDate {
  id: string;
  station: string; // "All" or specific station name e.g. "Colombo"
  date: string; // YYYY-MM-DD
  type: "off_day" | "working_day"; // "off_day" (cancelled work day) or "working_day" (extra work day)
  reason: string;
  createdAt: string;
  createdBy: string;
}

