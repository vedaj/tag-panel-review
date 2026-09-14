-- ============================================
-- TAG Panel Review - Supabase Schema
-- Run this in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/qfmaopcggyoulitosjrc/sql
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ────────────────────────────────────────────
-- TABLES
-- ────────────────────────────────────────────

-- Faculty profiles (linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'faculty' CHECK (role IN ('admin', 'faculty')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Student groups / teams
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  project_title TEXT NOT NULL DEFAULT '',
  guide1 TEXT NOT NULL DEFAULT '',
  guide2 TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual students
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  roll_number TEXT NOT NULL,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(roll_number)
);

-- Grading criteria (from rubric)
CREATE TABLE IF NOT EXISTS criteria (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  max_marks NUMERIC(5,1) NOT NULL DEFAULT 10,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sub-criteria (breakdown of a criterion)
CREATE TABLE IF NOT EXISTS sub_criteria (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  criteria_id UUID NOT NULL REFERENCES criteria(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  max_marks NUMERIC(5,1) NOT NULL DEFAULT 5,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Which faculty panels which group
CREATE TABLE IF NOT EXISTS panel_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  faculty_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(faculty_id, group_id)
);

-- Marks given by a faculty member per student per criterion
-- sub_criteria_id is NULL when grading at criterion level (no sub-criteria)
CREATE TABLE IF NOT EXISTS grades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  faculty_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  criteria_id UUID NOT NULL REFERENCES criteria(id) ON DELETE CASCADE,
  sub_criteria_id UUID REFERENCES sub_criteria(id) ON DELETE CASCADE,
  marks NUMERIC(5,1) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(faculty_id, student_id, criteria_id, sub_criteria_id)
);

-- Textual feedback (group-level when student_id IS NULL)
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  faculty_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(faculty_id, group_id, student_id)
);

-- ────────────────────────────────────────────
-- AUTO-UPDATE TRIGGER
-- ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER grades_updated_at
  BEFORE UPDATE ON grades
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER feedback_updated_at
  BEFORE UPDATE ON feedback
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ────────────────────────────────────────────
ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups            ENABLE ROW LEVEL SECURITY;
ALTER TABLE students          ENABLE ROW LEVEL SECURITY;
ALTER TABLE criteria          ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_criteria      ENABLE ROW LEVEL SECURITY;
ALTER TABLE panel_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades            ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback          ENABLE ROW LEVEL SECURITY;

-- Helper: is caller an admin?
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- profiles
CREATE POLICY "profiles_select"      ON profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "profiles_insert_own"  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own"  ON profiles FOR UPDATE USING (auth.uid() = id OR is_admin());
CREATE POLICY "profiles_delete_admin" ON profiles FOR DELETE USING (is_admin());

-- groups, students, criteria, sub_criteria, panel_assignments: everyone reads; admin writes
CREATE POLICY "groups_select"            ON groups            FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "groups_admin_write"       ON groups            FOR ALL    USING (is_admin());
CREATE POLICY "students_select"          ON students          FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "students_admin_write"     ON students          FOR ALL    USING (is_admin());
CREATE POLICY "criteria_select"          ON criteria          FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "criteria_admin_write"     ON criteria          FOR ALL    USING (is_admin());
CREATE POLICY "sub_criteria_select"      ON sub_criteria      FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "sub_criteria_admin_write" ON sub_criteria      FOR ALL    USING (is_admin());
CREATE POLICY "pa_select"                ON panel_assignments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "pa_admin_write"           ON panel_assignments FOR ALL    USING (is_admin());

-- grades: faculty manage their own; admin reads all
CREATE POLICY "grades_own"        ON grades FOR ALL    USING (faculty_id = auth.uid());
CREATE POLICY "grades_admin_read" ON grades FOR SELECT USING (is_admin());

-- feedback: faculty manage their own; admin reads all
CREATE POLICY "feedback_own"        ON feedback FOR ALL    USING (faculty_id = auth.uid());
CREATE POLICY "feedback_admin_read" ON feedback FOR SELECT USING (is_admin());

-- ────────────────────────────────────────────
-- AUTO-CREATE PROFILE ON SIGNUP
-- ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'faculty')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
