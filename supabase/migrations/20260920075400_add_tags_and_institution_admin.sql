
-- 1. Create tags table
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  short_name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Update role CHECK constraint to include institution_admin
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'faculty', 'institution_admin'));

-- 3. Add tag_id to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tag_id UUID REFERENCES tags(id);

-- 4. Add tag_id to groups
ALTER TABLE groups ADD COLUMN IF NOT EXISTS tag_id UUID REFERENCES tags(id);

-- 5. Add tag_id to criteria
ALTER TABLE criteria ADD COLUMN IF NOT EXISTS tag_id UUID REFERENCES tags(id);

-- 6. Update is_admin() to include institution_admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'institution_admin')
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- 7. New helper: is_institution_admin()
CREATE OR REPLACE FUNCTION is_institution_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'institution_admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- 8. Enable RLS on tags
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

-- 9. RLS policies for tags
DROP POLICY IF EXISTS "tags_select" ON tags;
DROP POLICY IF EXISTS "tags_admin_write" ON tags;
CREATE POLICY "tags_select" ON tags FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "tags_admin_write" ON tags FOR ALL USING (is_admin());
