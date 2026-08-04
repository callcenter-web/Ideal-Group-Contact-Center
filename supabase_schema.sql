-- ====================================================================
-- IDEAL MOTORS CX RECOVERY DATABASE SCHEMA (CONNECTED RELATIONAL ARCHITECTURE)
-- Database: Supabase PostgreSQL (Single Database with Connected Tables)
-- ====================================================================

-- 1. MIGRATION FOR EXISTING TABLES (Safe column additions if tables exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'complaints') THEN
        ALTER TABLE complaints ADD COLUMN IF NOT EXISTS "woNo" text;
        ALTER TABLE complaints ADD COLUMN IF NOT EXISTS wo_no text;
        ALTER TABLE complaints ADD COLUMN IF NOT EXISTS "firstAttemptNotes" text;
        ALTER TABLE complaints ADD COLUMN IF NOT EXISTS "secondAttemptNotes" text;
        ALTER TABLE complaints ADD COLUMN IF NOT EXISTS "attemptCount" integer DEFAULT 0;
    END IF;
END $$;


-- 2. STATIONS TABLE
CREATE TABLE IF NOT EXISTS stations (
  code text PRIMARY KEY,
  name text NOT NULL,
  manager_name text,
  email text,
  phone text,
  password_hash text DEFAULT 'station123',
  created_at timestamptz DEFAULT now()
);

-- Seed Workstations
INSERT INTO stations (code, name, manager_name, email, phone) VALUES
('Rathmalana', 'Rathmalana (CWS)', 'Kusal Silva', 'rathmalana.cws@idealgroup.lk', '+94 11 263 4455'),
('Wanawasala', 'Wanawasala', 'Amila Fernando', 'wanawasala.station@idealgroup.lk', '+94 11 291 3322'),
('Yakkala', 'Yakkala', 'Dhanushka Perera', 'yakkala.station@idealgroup.lk', '+94 33 222 1100'),
('Kurunegala', 'Kurunegala', 'Sunil Bandara', 'kurunegala.station@idealgroup.lk', '+94 37 223 4455'),
('Anuradhapura', 'Anuradhapura', 'Rohan Jayasuriya', 'anuradhapura.station@idealgroup.lk', '+94 25 222 3344'),
('Jaffna', 'Jaffna', 'T. Selvakumar', 'jaffna.station@idealgroup.lk', '+94 21 222 5566'),
('Tissamaharama', 'Tissamaharama', 'Chinthaka Weerasinghe', 'tissamaharama.station@idealgroup.lk', '+94 47 223 9988')
ON CONFLICT (code) DO NOTHING;


-- 3. CALL CENTER OFFICERS TABLE
CREATE TABLE IF NOT EXISTS call_center_officers (
  id text PRIMARY KEY,
  name text NOT NULL,
  title text NOT NULL,
  email text UNIQUE NOT NULL,
  phone text,
  avatar text,
  department text DEFAULT 'Ideal Motors Central CX Call Center',
  created_at timestamptz DEFAULT now()
);

-- Seed Officers
INSERT INTO call_center_officers (id, name, title, email, phone, avatar) VALUES
('CC-101', 'Usha', 'Senior CX Call Center Executive', 'usha@idealgroup.lk', '+94 77 111 2233', 'US'),
('CC-102', 'Irshana', 'CX Resolution Specialist', 'irshana@idealgroup.lk', '+94 77 222 3344', 'IR'),
('CC-103', 'Yathish', 'Aftermarket Follow-Up Officer', 'yathish@idealgroup.lk', '+94 77 333 4455', 'YA'),
('CC-104', 'Pawani', 'Customer Verification Executive', 'pawani@idealgroup.lk', '+94 77 444 5566', 'PA'),
('CC-105', 'Shevon', 'Call Center Operations Lead', 'shevon@idealgroup.lk', '+94 77 555 6677', 'SH')
ON CONFLICT (id) DO NOTHING;


-- 4. WORKSTATION CALENDAR & HOLIDAYS TABLE (SLA & AGING CALCULATIONS)
CREATE TABLE IF NOT EXISTS workstation_calendar (
  id text PRIMARY KEY,
  station text DEFAULT 'All',
  date text NOT NULL,
  type text NOT NULL DEFAULT 'off_day',
  reason text,
  "createdAt" timestamptz DEFAULT now(),
  "createdBy" text DEFAULT 'System Admin'
);

-- Seed Initial Holidays / Off-Days
INSERT INTO workstation_calendar (id, station, date, type, reason, "createdBy") VALUES
('default-1', 'All', '2026-08-15', 'off_day', 'Company Annual Holiday / Nikini Full Moon Poya', 'System Admin'),
('default-2', 'All', '2026-09-16', 'off_day', 'Milad-Un-Nabi (Holy Prophet Birthday)', 'System Admin'),
('default-3', 'Colombo', '2026-08-20', 'off_day', 'Colombo Workshop Scheduled Equipment Maintenance', 'Admin')
ON CONFLICT (id) DO NOTHING;


-- 5. SYSTEMIC EMAIL DISPATCH LOGS TABLE
CREATE TABLE IF NOT EXISTS systemic_email_logs (
  id text PRIMARY KEY,
  "sentAt" timestamptz DEFAULT now(),
  sender text DEFAULT 'callcenter@idealgroup.lk',
  recipients jsonb NOT NULL,
  subject text NOT NULL,
  "complaintIds" jsonb,
  "stationTarget" text,
  "htmlBody" text,
  "triggerEvent" text
);


-- 6. MASTER COMPLAINTS TABLE
CREATE TABLE IF NOT EXISTS complaints (
  id text PRIMARY KEY,
  "woNo" text,
  wo_no text,
  "customerName" text,
  "customerPhone" text,
  "customerEmail" text,
  station text,
  category text,
  description text,
  date text,
  "receivedDateTime" text,
  "initialSatisfaction" text,
  "currentSatisfaction" text,
  status text DEFAULT 'Pending',
  notes text,
  "agentName" text,
  assigned_officer_id text REFERENCES call_center_officers(id) ON DELETE SET NULL,
  "aiAnalysis" jsonb,
  "updatedAt" timestamptz DEFAULT now(),
  month text,
  company text,
  "woState" text,
  "vehicleRegNo" text,
  "mchCodeDescription" text,
  "workType" text,
  "customerNo" text,
  "earliestStartDate" text,
  "finishDate" text,
  tel2 text,
  mileage text,
  "advisorName" text,
  "chassiNo" text,
  "npsScore" integer DEFAULT 0,
  "stationContactedDate" text,
  "stationResolutionNotes" text,
  "callCenterContactedDate" text,
  "callCenterFinalRemarks" text,
  "callCenterFinalSatisfaction" text,
  "feedbackStatus" text,
  "finalStatus" text,
  "solutionProvidedByAftermarket" text,
  "solutionDate" text,
  "followUpDate" text,
  "firstAttemptCallStatus" text,
  "firstAttemptDate" text,
  "firstAttemptNotes" text,
  "secondAttemptFeedbackStatus" text,
  "secondAttemptDate" text,
  "secondAttemptNotes" text,
  "attemptCount" integer DEFAULT 0
);

-- SERVICE STATIONS VIEW ALIAS FOR COMPATIBILITY
CREATE OR REPLACE VIEW service_stations AS SELECT * FROM stations;


-- 7. CALL CENTER LOGS TABLE (CHILD RELATION TO COMPLAINTS)
CREATE TABLE IF NOT EXISTS call_center_logs (
  id bigserial PRIMARY KEY,
  complaint_id text NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  officer_id text REFERENCES call_center_officers(id) ON DELETE SET NULL,
  officer_name text,
  call_date timestamptz DEFAULT now(),
  remarks text,
  satisfaction_score integer
);


-- 8. HIGH-PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_complaints_wono ON complaints("woNo");
CREATE INDEX IF NOT EXISTS idx_complaints_wo_no ON complaints(wo_no);
CREATE INDEX IF NOT EXISTS idx_complaints_station ON complaints(station);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_call_logs_complaint_id ON call_center_logs(complaint_id);
CREATE INDEX IF NOT EXISTS idx_calendar_date ON workstation_calendar(date);
CREATE INDEX IF NOT EXISTS idx_calendar_station ON workstation_calendar(station);


-- 9. CONNECTED RELATIONAL VIEW
CREATE OR REPLACE VIEW view_complaints_with_station_and_officer AS
SELECT 
  c.id,
  COALESCE(c."woNo", c.wo_no) as wo_no,
  c."customerName",
  c."customerPhone",
  c.station,
  s.name as station_full_name,
  s.manager_name as station_manager,
  c.category,
  c.description,
  c.status,
  c."initialSatisfaction",
  c."currentSatisfaction",
  c."agentName",
  o.title as agent_title,
  o.department as agent_department
FROM complaints c
LEFT JOIN stations s ON c.station = s.code OR c.station = s.name
LEFT JOIN call_center_officers o ON c.assigned_officer_id = o.id;


-- 10. SECURITY & ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_center_officers ENABLE ROW LEVEL SECURITY;
ALTER TABLE workstation_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE systemic_email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_center_logs ENABLE ROW LEVEL SECURITY;

-- Allow public access for multi-PC & multi-station collaboration
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read stations') THEN
    CREATE POLICY "Allow public read stations" ON stations FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public insert stations') THEN
    CREATE POLICY "Allow public insert stations" ON stations FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public update stations') THEN
    CREATE POLICY "Allow public update stations" ON stations FOR UPDATE USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read officers') THEN
    CREATE POLICY "Allow public read officers" ON call_center_officers FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public insert officers') THEN
    CREATE POLICY "Allow public insert officers" ON call_center_officers FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public update officers') THEN
    CREATE POLICY "Allow public update officers" ON call_center_officers FOR UPDATE USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read calendar') THEN
    CREATE POLICY "Allow public read calendar" ON workstation_calendar FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public insert calendar') THEN
    CREATE POLICY "Allow public insert calendar" ON workstation_calendar FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public update calendar') THEN
    CREATE POLICY "Allow public update calendar" ON workstation_calendar FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public delete calendar') THEN
    CREATE POLICY "Allow public delete calendar" ON workstation_calendar FOR DELETE USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read systemic_email_logs') THEN
    CREATE POLICY "Allow public read systemic_email_logs" ON systemic_email_logs FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public insert systemic_email_logs') THEN
    CREATE POLICY "Allow public insert systemic_email_logs" ON systemic_email_logs FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read complaints') THEN
    CREATE POLICY "Allow public read complaints" ON complaints FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public insert complaints') THEN
    CREATE POLICY "Allow public insert complaints" ON complaints FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public update complaints') THEN
    CREATE POLICY "Allow public update complaints" ON complaints FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public delete complaints') THEN
    CREATE POLICY "Allow public delete complaints" ON complaints FOR DELETE USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read logs') THEN
    CREATE POLICY "Allow public read logs" ON call_center_logs FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public insert logs') THEN
    CREATE POLICY "Allow public insert logs" ON call_center_logs FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- 11. RELOAD POSTGREST SCHEMA CACHE INSTANTLY
NOTIFY pgrst, 'reload schema';
