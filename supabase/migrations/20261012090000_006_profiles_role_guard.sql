-- ============================================================
-- Migration 006: Stop users from granting themselves admin roles
-- Idempotent: safe to re-run.
--
-- Before this migration:
--   * profiles_update_own let any user update every column of their own
--     profile, including role and tag_id.
--   * handle_new_user copied the role from user-supplied signup metadata.
--   * is_admin() treated role = 'admin' as admin even without a TAG.
--   * Any admin could delete profiles and edit TAGs.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. TAG admins need a TAG to count as admins
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND (role = 'institution_admin' OR (role = 'admin' AND tag_id IS NOT NULL))
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- ────────────────────────────────────────────────────────────
-- 2. Signup may only request faculty or admin; admin still needs a
--    TAG (set later by an admin) before it grants anything.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    CASE WHEN NEW.raw_user_meta_data->>'role' = 'admin' THEN 'admin' ELSE 'faculty' END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ────────────────────────────────────────────────────────────
-- 3. Guard role / tag_id changes made with a user's session.
--    Service role and internal triggers (no auth.uid()) are not limited.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION profiles_role_guard()
RETURNS TRIGGER AS $$
DECLARE
  caller   profiles%ROWTYPE;
  old_role TEXT;
  old_tag  UUID;
BEGIN
  -- No user (service role) or an update made by one of our own triggers
  IF auth.uid() IS NULL OR pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- An upsert fires BEFORE INSERT even when it ends up updating, so a new
  -- row is checked as if it were a plain faculty member with no TAG.
  IF TG_OP = 'INSERT' THEN
    old_role := 'faculty';
    old_tag  := NULL;
  ELSE
    old_role := OLD.role;
    old_tag  := OLD.tag_id;
  END IF;

  IF NEW.role IS NOT DISTINCT FROM old_role AND NEW.tag_id IS NOT DISTINCT FROM old_tag THEN
    RETURN NEW;
  END IF;

  SELECT * INTO caller FROM profiles WHERE id = auth.uid();

  IF caller.role = 'institution_admin' THEN
    RETURN NEW;
  END IF;

  -- A TAG admin may move faculty into their own TAG and switch them
  -- between faculty and admin there; nothing else.
  IF caller.role = 'admin' AND caller.tag_id IS NOT NULL
     AND old_role IN ('faculty', 'admin') AND NEW.role IN ('faculty', 'admin')
     AND NEW.tag_id = caller.tag_id
     AND (old_tag IS NULL OR old_tag = caller.tag_id) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Not allowed to change role or TAG for this profile' USING ERRCODE = '42501';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS profiles_role_guard ON profiles;
CREATE TRIGGER profiles_role_guard
  BEFORE INSERT OR UPDATE OF role, tag_id ON profiles
  FOR EACH ROW EXECUTE FUNCTION profiles_role_guard();

-- ────────────────────────────────────────────────────────────
-- 4. Only institution admins delete profiles or edit TAGs
--    (the app does both with the service role after its own check).
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_delete_admin" ON profiles;
CREATE POLICY "profiles_delete_admin" ON profiles FOR DELETE
  USING (is_institution_admin());

DROP POLICY IF EXISTS "tags_admin_write" ON tags;
CREATE POLICY "tags_admin_write" ON tags FOR ALL
  USING (is_institution_admin())
  WITH CHECK (is_institution_admin());
