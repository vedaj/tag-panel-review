
-- updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS grades_updated_at   ON grades;
DROP TRIGGER IF EXISTS feedback_updated_at ON feedback;
CREATE TRIGGER grades_updated_at   BEFORE UPDATE ON grades   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER feedback_updated_at BEFORE UPDATE ON feedback FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on signup
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
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- RLS
ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups            ENABLE ROW LEVEL SECURITY;
ALTER TABLE students          ENABLE ROW LEVEL SECURITY;
ALTER TABLE criteria          ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_criteria      ENABLE ROW LEVEL SECURITY;
ALTER TABLE panel_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades            ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback          ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
$$ LANGUAGE sql SECURITY DEFINER;

-- Drop existing policies to avoid conflicts
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

CREATE POLICY "profiles_select"       ON profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "profiles_insert_own"   ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own"   ON profiles FOR UPDATE USING (auth.uid() = id OR is_admin());
CREATE POLICY "profiles_delete_admin" ON profiles FOR DELETE USING (is_admin());

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
CREATE POLICY "grades_own"               ON grades            FOR ALL    USING (faculty_id = auth.uid());
CREATE POLICY "grades_admin_read"        ON grades            FOR SELECT USING (is_admin());
CREATE POLICY "feedback_own"             ON feedback          FOR ALL    USING (faculty_id = auth.uid());
CREATE POLICY "feedback_admin_read"      ON feedback          FOR SELECT USING (is_admin());
