-- ====================================================================
-- IDEAL MOTORS CX RECOVERY DATABASE SCHEMA (CONNECTED RELATIONAL ARCHITECTURE)
-- Database: Supabase PostgreSQL (Single Database with Connected Tables)
-- ====================================================================

-- 1. STATIONS TABLE
DROP TABLE IF EXISTS call_center_logs CASCADE;
DROP TABLE IF EXISTS complaints CASCADE;
DROP TABLE IF EXISTS call_center_officers CASCADE;
DROP TABLE IF EXISTS stations CASCADE;

CREATE TABLE stations (
  code text PRIMARY KEY,
  name text NOT NULL,
  manager_name text,
  email text,
  phone text,
  password_hash text DEFAULT 'station123',
  created_at timestamptz DEFAULT now()
);

-- Seed Stations
INSERT INTO stations (code, name, manager_name, email, phone) VALUES
('Rathmalana', 'Rathmalana (CWS)', 'Kusal Silva', 'rathmalana.cws@idealgroup.lk', '+94 11 263 4455'),
('Wanawasala', 'Wanawasala', 'Amila Fernando', 'wanawasala.station@idealgroup.lk', '+94 11 291 3322'),
('Yakkala', 'Yakkala', 'Dhanushka Perera', 'yakkala.station@idealgroup.lk', '+94 33 222 1100'),
('Kurunegala', 'Kurunegala', 'Sunil Bandara', 'kurunegala.station@idealgroup.lk', '+94 37 223 4455'),
('Anuradhapura', 'Anuradhapura', 'Rohan Jayasuriya', 'anuradhapura.station@idealgroup.lk', '+94 25 222 3344'),
('Jaffna', 'Jaffna', 'T. Selvakumar', 'jaffna.station@idealgroup.lk', '+94 21 222 5566'),
('Tissamaharama', 'Tissamaharama', 'Chinthaka Weerasinghe', 'tissamaharama.station@idealgroup.lk', '+94 47 223 9988')
ON CONFLICT (code) DO NOTHING;


-- 2. CALL CENTER OFFICERS TABLE
CREATE TABLE call_center_officers (
  id text PRIMARY KEY,
  name text NOT NULL,
  title text NOT NULL,
  email text UNIQUE NOT NULL,
  phone text,
  avatar text,
  department text DEFAULT 'Ideal Motors Central CX Call Center',
  created_at timestamptz DEFAULT now()
);

-- Seed Officers with Distinct Titles & Designations
INSERT INTO call_center_officers (id, name, title, email, phone, avatar) VALUES
('CC-101', 'Usha', 'Senior CX Call Center Executive', 'usha@idealgroup.lk', '+94 77 111 2233', 'US'),
('CC-102', 'Irshana', 'CX Resolution Specialist', 'irshana@idealgroup.lk', '+94 77 222 3344', 'IR'),
('CC-103', 'Yathish', 'Aftermarket Follow-Up Officer', 'yathish@idealgroup.lk', '+94 77 333 4455', 'YA'),
('CC-104', 'Pawani', 'Customer Verification Executive', 'pawani@idealgroup.lk', '+94 77 444 5566', 'PA'),
('CC-105', 'Shevon', 'Call Center Operations Lead', 'shevon@idealgroup.lk', '+94 77 555 6677', 'SH')
ON CONFLICT (id) DO NOTHING;


-- 3. MASTER COMPLAINTS TABLE (CONNECTED RELATIONAL FOREIGN KEYS)
CREATE TABLE complaints (
  id text PRIMARY KEY,
  wo_no text UNIQUE,
  "customerName" text,
  "customerPhone" text,
  "customerEmail" text,
  station text REFERENCES stations(code) ON DELETE SET NULL,
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
  "followUpDate" text
);


-- 4. CALL CENTER LOGS TABLE (CHILD RELATION TO COMPLAINTS)
CREATE TABLE call_center_logs (
  id bigserial PRIMARY KEY,
  complaint_id text NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  officer_id text REFERENCES call_center_officers(id) ON DELETE SET NULL,
  officer_name text,
  call_date timestamptz DEFAULT now(),
  remarks text,
  satisfaction_score integer
);


-- 5. RELATIONAL INDEXES FOR HIGH-SPEED QUERYING
CREATE INDEX IF NOT EXISTS idx_complaints_wo_no ON complaints(wo_no);
CREATE INDEX IF NOT EXISTS idx_complaints_station ON complaints(station);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_call_logs_complaint_id ON call_center_logs(complaint_id);


-- 6. CONNECTED RELATIONAL VIEW
CREATE OR REPLACE VIEW view_complaints_with_station_and_officer AS
SELECT 
  c.id,
  c.wo_no,
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
LEFT JOIN stations s ON c.station = s.code
LEFT JOIN call_center_officers o ON c.assigned_officer_id = o.id;


-- 7. SECURITY & ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_center_officers ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_center_logs ENABLE ROW LEVEL SECURITY;

-- Allow public access for multi-PC collaboration
CREATE POLICY "Allow public read stations" ON stations FOR SELECT USING (true);
CREATE POLICY "Allow public read officers" ON call_center_officers FOR SELECT USING (true);

CREATE POLICY "Allow public read complaints" ON complaints FOR SELECT USING (true);
CREATE POLICY "Allow public insert complaints" ON complaints FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update complaints" ON complaints FOR UPDATE USING (true);
CREATE POLICY "Allow public delete complaints" ON complaints FOR DELETE USING (true);

CREATE POLICY "Allow public read logs" ON call_center_logs FOR SELECT USING (true);
CREATE POLICY "Allow public insert logs" ON call_center_logs FOR INSERT WITH CHECK (true);
