-- ============================================================
-- TAG Panel Review — Full Schema + Student Seed
-- Run in: https://supabase.com/dashboard/project/zjzqamyoeumoqoomtbgq/sql
-- ============================================================

-- 1. TABLES --------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'faculty' CHECK (role IN ('admin', 'faculty')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  project_title TEXT NOT NULL DEFAULT '',
  guide1 TEXT NOT NULL DEFAULT '',
  guide2 TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  roll_number TEXT NOT NULL,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(roll_number)
);

CREATE TABLE IF NOT EXISTS criteria (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  max_marks NUMERIC(5,1) NOT NULL DEFAULT 10,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sub_criteria (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  criteria_id UUID NOT NULL REFERENCES criteria(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  max_marks NUMERIC(5,1) NOT NULL DEFAULT 5,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS panel_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  faculty_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(faculty_id, group_id)
);

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

-- 2. TRIGGERS ------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS grades_updated_at   ON grades;
DROP TRIGGER IF EXISTS feedback_updated_at ON feedback;

CREATE TRIGGER grades_updated_at   BEFORE UPDATE ON grades   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER feedback_updated_at BEFORE UPDATE ON feedback FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on signup (fault-tolerant)
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

-- 3. RLS -----------------------------------------------------
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

-- Drop existing policies first to avoid conflicts
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

-- 4. STUDENT DATA --------------------------------------------
INSERT INTO groups (name) VALUES
  ('Team 3'),
  ('Team 12'),
  ('Team 16'),
  ('Team 18'),
  ('Team 22'),
  ('Team 28'),
  ('Team 64'),
  ('Team 65'),
  ('Team 74'),
  ('Team 78'),
  ('Team 86'),
  ('Team 88'),
  ('Team 89'),
  ('Team 113')
ON CONFLICT (name) DO NOTHING;

INSERT INTO students (name, roll_number, group_id) VALUES
  ('KAVINESH P',                          'CB.SC.U4CSE23121', (SELECT id FROM groups WHERE name = 'Team 3')),
  ('SANTHOSH A S',                        'CB.SC.U4CSE23047', (SELECT id FROM groups WHERE name = 'Team 3')),
  ('RAAM PRATHAP R V',                    'CB.SC.U4CSE23046', (SELECT id FROM groups WHERE name = 'Team 3')),
  ('KASAM SAI VENKATA SIDDARDHA',         'CB.SC.U4CSE23220', (SELECT id FROM groups WHERE name = 'Team 3')),
  ('ASHISH M',                            'CB.SC.U4CSE23209', (SELECT id FROM groups WHERE name = 'Team 3')),

  ('MANDUVA JASWITA',                     'CB.SC.U4CSE23430', (SELECT id FROM groups WHERE name = 'Team 12')),
  ('DUNGI MANVITHA',                      'CB.SC.U4CSE23318', (SELECT id FROM groups WHERE name = 'Team 12')),
  ('DUDDEKUNTA YUVA HASINI',              'CB.SC.U4CSE23412', (SELECT id FROM groups WHERE name = 'Team 12')),
  ('C V KHYATHI',                         'CB.SC.U4CSE23558', (SELECT id FROM groups WHERE name = 'Team 12')),
  ('KUSUMANCHI P NAGA LAKSHMI KALYANI MAHITHA', 'CB.SC.U4CSE23034', (SELECT id FROM groups WHERE name = 'Team 12')),

  ('K. KANISHTHIKA',                      'CB.SC.U4CSE23520', (SELECT id FROM groups WHERE name = 'Team 16')),
  ('HARINIE C B',                         'CB.SC.U4CSE23516', (SELECT id FROM groups WHERE name = 'Team 16')),
  ('PON GOPIKA P',                        'CB.SC.U4CSE23542', (SELECT id FROM groups WHERE name = 'Team 16')),
  ('SUBIKSHA MANGAYARKARASI VISWANATHAN', 'CB.SC.U4CSE23150', (SELECT id FROM groups WHERE name = 'Team 16')),

  ('KUKKADAPU DATTA',                     'CB.SC.U4CSE23422', (SELECT id FROM groups WHERE name = 'Team 18')),
  ('E. RATANRAJA',                        'CB.SC.U4CSE23414', (SELECT id FROM groups WHERE name = 'Team 18')),
  ('UDAYAGIRI SRIJA',                     'CB.SC.U4CSE23452', (SELECT id FROM groups WHERE name = 'Team 18')),
  ('UDAYAGIRI SRIYA',                     'CB.SC.U4CSE23554', (SELECT id FROM groups WHERE name = 'Team 18')),

  ('SANJAY AK',                           'CB.SC.U4CSE23051', (SELECT id FROM groups WHERE name = 'Team 22')),
  ('ADITYA VIJAY',                        'CB.SC.U4CSE23359', (SELECT id FROM groups WHERE name = 'Team 22')),
  ('ESWARA RAJ M',                        'CB.SC.U4CSE23022', (SELECT id FROM groups WHERE name = 'Team 22')),
  ('HIMANEESH REDDY JANGALAPLLI',         'CB.SC.U4CSE23324', (SELECT id FROM groups WHERE name = 'Team 22')),

  ('MADDIPATLA HASINI REDDY',             'CB.SC.U4CSE23529', (SELECT id FROM groups WHERE name = 'Team 28')),
  ('SHEELA AKSHAR SAKHI',                 'CB.SC.U4CSE23547', (SELECT id FROM groups WHERE name = 'Team 28')),
  ('KAMBOJI HASWITHESWARI',               'CB.SC.U4CSE23363', (SELECT id FROM groups WHERE name = 'Team 28')),
  ('LAKKARAJU KOUSIK SARMA',              'CB.SC.U4CSE23761', (SELECT id FROM groups WHERE name = 'Team 28')),
  ('VEMULA CHAKRAVARTHY',                 'CB.SC.U4CSE23753', (SELECT id FROM groups WHERE name = 'Team 28')),

  ('CHAPPIDI KULADEEP REDDY',             'CB.SC.U4CSE23313', (SELECT id FROM groups WHERE name = 'Team 64')),
  ('VEJJU SASI KIRAN YASASWI',            'CB.SC.U4CSE23356', (SELECT id FROM groups WHERE name = 'Team 64')),
  ('BALLA KUMAR BASAVARAJU',              'CB.SC.U4CSE23312', (SELECT id FROM groups WHERE name = 'Team 64')),
  ('UPPARA VEERANJANEYULU',               'CB.SC.U4CSE23351', (SELECT id FROM groups WHERE name = 'Team 64')),
  ('VULLAM TEJA',                         'CB.SC.U4CSE23355', (SELECT id FROM groups WHERE name = 'Team 64')),

  ('GAYATHRI U',                          'CB.SC.U4CSE23026', (SELECT id FROM groups WHERE name = 'Team 65')),
  ('SARAVANA PRIYAA C R',                 'CB.SC.U4CSE23149', (SELECT id FROM groups WHERE name = 'Team 65')),
  ('IRENE DIVYA J',                       'CB.SC.U4CSE23167', (SELECT id FROM groups WHERE name = 'Team 65')),
  ('SHRAVANTHI S',                        'CB.SC.U4CSE23147', (SELECT id FROM groups WHERE name = 'Team 65')),
  ('RITHANYA K A',                        'CB.SC.U4CSE23140', (SELECT id FROM groups WHERE name = 'Team 65')),

  ('UHASHINI N',                          'CB.SC.U4CSE23352', (SELECT id FROM groups WHERE name = 'Team 74')),
  ('KANISHKA S',                          'CB.SC.U4CSE23328', (SELECT id FROM groups WHERE name = 'Team 74')),
  ('ANAND PRIYADARSHINI',                 'CB.SC.U4CSE23306', (SELECT id FROM groups WHERE name = 'Team 74')),
  ('BANDA VYSHNAVI SAI',                  'CB.SC.U4CSE23712', (SELECT id FROM groups WHERE name = 'Team 74')),
  ('VALIKALA TEJASWINI',                  'CB.SC.U4CSE23752', (SELECT id FROM groups WHERE name = 'Team 74')),

  ('NANDIGAM PRAKYATH',                   'CB.SC.U4CSE23635', (SELECT id FROM groups WHERE name = 'Team 78')),
  ('KANISHKHAN J',                        'CB.SC.U4CSE23626', (SELECT id FROM groups WHERE name = 'Team 78')),
  ('GUDI HEMANTH',                        'CB.SC.U4CSE23619', (SELECT id FROM groups WHERE name = 'Team 78')),
  ('JALLIPALLI YASWANTH SIVA SAI VENKATA RAJENDRA', 'CB.SC.U4CSE23622', (SELECT id FROM groups WHERE name = 'Team 78')),

  ('HONNESHA EPPALA',                     'CB.SC.U4CSE23461', (SELECT id FROM groups WHERE name = 'Team 86')),
  ('SRIJA KESAVARAPU',                    'CB.SC.U4CSE23448', (SELECT id FROM groups WHERE name = 'Team 86')),
  ('LAKKINENI JATHIN',                    'CB.SC.U4CSE23426', (SELECT id FROM groups WHERE name = 'Team 86')),
  ('KHANDAVILLI V V S D GNANESH',         'CB.SC.U4CSE23662', (SELECT id FROM groups WHERE name = 'Team 86')),
  ('MUDIGONDA HIMANSHU',                  'CB.SC.U4CSE23040', (SELECT id FROM groups WHERE name = 'Team 86')),

  ('ANANTHA RAM G S',                     'CB.SC.U4CSE23408', (SELECT id FROM groups WHERE name = 'Team 88')),
  ('RAVINDRAN G',                         'CB.SC.U4CSE23647', (SELECT id FROM groups WHERE name = 'Team 88')),
  ('RAMA ROSHINEE S V',                   'CB.SC.U4CSE23645', (SELECT id FROM groups WHERE name = 'Team 88')),
  ('GUGAN S S',                           'CB.SC.U4CSE23416', (SELECT id FROM groups WHERE name = 'Team 88')),

  ('KAMPAMALLA SATWIQ REDDY',             'CB.SC.U4CSE23521', (SELECT id FROM groups WHERE name = 'Team 89')),
  ('NARNE MITHILESH',                     'CB.SC.U4CSE23564', (SELECT id FROM groups WHERE name = 'Team 89')),
  ('THIKKAVARAPU HEMA SAI REDDY',         'CB.SC.U4CSE23266', (SELECT id FROM groups WHERE name = 'Team 89')),
  ('TANIKONDA GOWTHAM',                   'CB.SC.U4CSE23767', (SELECT id FROM groups WHERE name = 'Team 89')),
  ('RAVI KARTHIKEYA PIDIKITI',            'CB.SC.U4CSE23737', (SELECT id FROM groups WHERE name = 'Team 89')),

  ('KALLAM JAISIMHA REDDY',               'CB.SC.U4CSE23219', (SELECT id FROM groups WHERE name = 'Team 113')),
  ('VALLURU PHRANAV REDDY',               'CB.SC.U4CSE23067', (SELECT id FROM groups WHERE name = 'Team 113')),
  ('YEDULA PRANEEL KUMAR REDDY',          'CB.SC.U4CSE23252', (SELECT id FROM groups WHERE name = 'Team 113')),
  ('ADWAITH RAVEENDRAN',                  'CB.SC.U4CSE23603', (SELECT id FROM groups WHERE name = 'Team 113'))
ON CONFLICT (roll_number) DO NOTHING;

SELECT 'Done! Groups: ' || (SELECT COUNT(*) FROM groups) || ', Students: ' || (SELECT COUNT(*) FROM students);
