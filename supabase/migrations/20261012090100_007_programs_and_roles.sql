-- ============================================================
-- Migration 007: B.Tech / M.Tech programs and per-program admin roles
-- Idempotent: safe to re-run.
--
--   * groups and reviews get a program ('btech' | 'mtech'). Criteria,
--     tag_reviews and unlock requests take their program from their review.
--     Existing rows become B.Tech.
--   * An M.Tech project is a group with exactly one student.
--   * user_roles holds admin roles:
--       institution_admin                    (global)
--       program_admin  + program             (B.Tech Admin / M.Tech Admin)
--       tag_admin      + program + tag_id    (tag_id = the member's home TAG)
--     Everyone is faculty; admins are faculty with extra rows here.
--   * grant_role / revoke_role are the only way to change user_roles from a
--     user session, and enforce who may grant what.
--   * profiles.role is kept in sync both ways for the existing app:
--       institution_admin row      <-> role = 'institution_admin'
--       B.Tech tag_admin row       <-> role = 'admin'
--   * Admin RLS is now per program.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Program on groups and reviews
-- ────────────────────────────────────────────────────────────
ALTER TABLE groups  ADD COLUMN IF NOT EXISTS program TEXT NOT NULL DEFAULT 'btech';
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS program TEXT NOT NULL DEFAULT 'btech';

ALTER TABLE groups  DROP CONSTRAINT IF EXISTS groups_program_check;
ALTER TABLE groups  ADD  CONSTRAINT groups_program_check  CHECK (program IN ('btech', 'mtech'));
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_program_check;
ALTER TABLE reviews ADD  CONSTRAINT reviews_program_check CHECK (program IN ('btech', 'mtech'));

-- Group names only need to be unique within a program
-- (prod calls the old constraint groups_name_unique, the migrations groups_name_key)
ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_name_unique;
ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_name_key;
ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_program_name_key;
ALTER TABLE groups ADD  CONSTRAINT groups_program_name_key UNIQUE (program, name);

CREATE INDEX IF NOT EXISTS groups_program_idx  ON groups (program);
CREATE INDEX IF NOT EXISTS reviews_program_idx ON reviews (program);

-- ────────────────────────────────────────────────────────────
-- 2. An M.Tech project has exactly one student
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION students_mtech_single()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM groups WHERE id = NEW.group_id AND program = 'mtech')
     AND EXISTS (SELECT 1 FROM students WHERE group_id = NEW.group_id AND id <> NEW.id) THEN
    RAISE EXCEPTION 'An M.Tech project can only have one student' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS students_mtech_single ON students;
CREATE TRIGGER students_mtech_single
  BEFORE INSERT OR UPDATE OF group_id ON students
  FOR EACH ROW EXECUTE FUNCTION students_mtech_single();

CREATE OR REPLACE FUNCTION groups_mtech_single()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.program = 'mtech' AND (SELECT count(*) FROM students WHERE group_id = NEW.id) > 1 THEN
    RAISE EXCEPTION 'An M.Tech project can only have one student' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS groups_mtech_single ON groups;
CREATE TRIGGER groups_mtech_single
  BEFORE UPDATE OF program ON groups
  FOR EACH ROW EXECUTE FUNCTION groups_mtech_single();

-- ────────────────────────────────────────────────────────────
-- 3. user_roles
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('institution_admin', 'program_admin', 'tag_admin')),
  program     TEXT CHECK (program IN ('btech', 'mtech')),
  tag_id      UUID REFERENCES tags(id) ON DELETE CASCADE,
  granted_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_roles_scope_check CHECK (
       (role = 'institution_admin' AND program IS NULL     AND tag_id IS NULL)
    OR (role = 'program_admin'     AND program IS NOT NULL AND tag_id IS NULL)
    OR (role = 'tag_admin'         AND program IS NOT NULL AND tag_id IS NOT NULL)
  ),
  CONSTRAINT user_roles_unique UNIQUE NULLS NOT DISTINCT (user_id, role, program, tag_id)
);

CREATE INDEX IF NOT EXISTS user_roles_user_idx        ON user_roles (user_id);
CREATE INDEX IF NOT EXISTS user_roles_program_tag_idx ON user_roles (program, tag_id);

-- Readable by everyone signed in; written only through grant_role / revoke_role
-- (SECURITY DEFINER) or the service role.
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_roles_read" ON user_roles;
CREATE POLICY "user_roles_read" ON user_roles FOR SELECT USING (auth.role() = 'authenticated');

-- A TAG admin row is always for the member's home TAG
CREATE OR REPLACE FUNCTION user_roles_home_tag()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'tag_admin'
     AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = NEW.user_id AND tag_id = NEW.tag_id) THEN
    RAISE EXCEPTION 'A TAG admin must be a member of that TAG' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS user_roles_home_tag ON user_roles;
CREATE TRIGGER user_roles_home_tag
  BEFORE INSERT OR UPDATE ON user_roles
  FOR EACH ROW EXECUTE FUNCTION user_roles_home_tag();

-- ────────────────────────────────────────────────────────────
-- 4. Backfill from profiles.role
-- ────────────────────────────────────────────────────────────
INSERT INTO user_roles (user_id, role)
SELECT id, 'institution_admin' FROM profiles WHERE role = 'institution_admin'
ON CONFLICT ON CONSTRAINT user_roles_unique DO NOTHING;

INSERT INTO user_roles (user_id, role, program, tag_id)
SELECT id, 'tag_admin', 'btech', tag_id FROM profiles WHERE role = 'admin' AND tag_id IS NOT NULL
ON CONFLICT ON CONSTRAINT user_roles_unique DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 5. Role helpers (all read user_roles)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_institution_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'institution_admin');
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_program_admin(p TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'program_admin' AND program = p);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_tag_admin(p TEXT, t UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'tag_admin' AND program = p AND tag_id = t);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Can the caller administer data of program p in TAG t?
CREATE OR REPLACE FUNCTION can_admin(p TEXT, t UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND (role = 'institution_admin'
           OR (role = 'program_admin' AND program = p)
           OR (role = 'tag_admin' AND program = p AND tag_id = t))
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Any admin role at all (used where data is not yet program-scoped)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid());
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- ────────────────────────────────────────────────────────────
-- 6. grant_role / revoke_role
--    institution admin: anything
--    program admin:     tag_admin in their program
--    TAG admin:         tag_admin in their own program + TAG
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION can_assign_role(r TEXT, p TEXT, t UUID)
RETURNS BOOLEAN AS $$
  SELECT is_institution_admin()
      OR (r = 'tag_admin' AND (is_program_admin(p) OR is_tag_admin(p, t)));
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION grant_role(target UUID, r TEXT, p TEXT DEFAULT NULL)
RETURNS VOID AS $$
DECLARE
  t UUID;
BEGIN
  IF r = 'tag_admin' THEN
    SELECT tag_id INTO t FROM profiles WHERE id = target;
    IF t IS NULL THEN
      RAISE EXCEPTION 'User is not a member of any TAG' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NOT can_assign_role(r, p, t) THEN
    RAISE EXCEPTION 'Not allowed to grant this role' USING ERRCODE = '42501';
  END IF;

  INSERT INTO user_roles (user_id, role, program, tag_id, granted_by)
  VALUES (target, r, CASE WHEN r = 'institution_admin' THEN NULL ELSE p END, t, auth.uid())
  ON CONFLICT ON CONSTRAINT user_roles_unique DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION revoke_role(target UUID, r TEXT, p TEXT DEFAULT NULL)
RETURNS VOID AS $$
DECLARE
  t UUID;
BEGIN
  IF r = 'tag_admin' THEN
    SELECT tag_id INTO t FROM profiles WHERE id = target;
  END IF;

  IF NOT can_assign_role(r, p, t) THEN
    RAISE EXCEPTION 'Not allowed to remove this role' USING ERRCODE = '42501';
  END IF;

  IF r = 'institution_admin'
     AND (SELECT count(*) FROM user_roles WHERE role = 'institution_admin' AND user_id <> target) = 0 THEN
    RAISE EXCEPTION 'Cannot remove the last institution admin' USING ERRCODE = '23514';
  END IF;

  -- A TAG admin (acting only as TAG admin) cannot remove the last TAG admin
  IF r = 'tag_admin' AND NOT is_institution_admin() AND NOT is_program_admin(p)
     AND (SELECT count(*) FROM user_roles
          WHERE role = 'tag_admin' AND program = p AND tag_id = t AND user_id <> target) = 0 THEN
    RAISE EXCEPTION 'Cannot remove the last TAG admin' USING ERRCODE = '23514';
  END IF;

  DELETE FROM user_roles
  WHERE user_id = target AND role = r
    AND program IS NOT DISTINCT FROM (CASE WHEN r = 'institution_admin' THEN NULL ELSE p END)
    AND tag_id  IS NOT DISTINCT FROM t;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION grant_role(UUID, TEXT, TEXT)  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION revoke_role(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION grant_role(UUID, TEXT, TEXT)  TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_role(UUID, TEXT, TEXT) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 7. Keep profiles.role and user_roles in sync (until the app stops
--    reading profiles.role)
-- ────────────────────────────────────────────────────────────

-- user_roles -> profiles.role
CREATE OR REPLACE FUNCTION user_roles_sync_profile()
RETURNS TRIGGER AS $$
DECLARE
  uid UUID := COALESCE(NEW.user_id, OLD.user_id);
  legacy TEXT;
  prev TEXT := COALESCE(current_setting('app.role_sync', true), 'off');
BEGIN
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM user_roles WHERE user_id = uid AND role = 'institution_admin') THEN 'institution_admin'
    WHEN EXISTS (SELECT 1 FROM user_roles ur JOIN profiles pr ON pr.id = ur.user_id
                 WHERE ur.user_id = uid AND ur.role = 'tag_admin' AND ur.program = 'btech'
                   AND ur.tag_id = pr.tag_id) THEN 'admin'
    ELSE 'faculty'
  END INTO legacy;

  PERFORM set_config('app.role_sync', 'on', true);
  UPDATE profiles SET role = legacy WHERE id = uid AND role IS DISTINCT FROM legacy;
  PERFORM set_config('app.role_sync', prev, true);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS user_roles_sync_profile ON user_roles;
CREATE TRIGGER user_roles_sync_profile
  AFTER INSERT OR UPDATE OR DELETE ON user_roles
  FOR EACH ROW EXECUTE FUNCTION user_roles_sync_profile();

-- profiles.role / tag_id -> user_roles (writes made by the existing app)
CREATE OR REPLACE FUNCTION profiles_sync_roles()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('app.role_sync', true) = 'on' THEN
    RETURN NULL;
  END IF;

  -- Stays on while user_roles_sync_profile runs for the rows changed below,
  -- so its profiles updates don't re-enter this trigger.
  PERFORM set_config('app.role_sync', 'on', true);

  -- Moving to another TAG ends TAG-admin roles for the old TAG
  IF TG_OP = 'UPDATE' AND NEW.tag_id IS DISTINCT FROM OLD.tag_id THEN
    DELETE FROM user_roles WHERE user_id = NEW.id AND role = 'tag_admin' AND tag_id IS DISTINCT FROM NEW.tag_id;
  END IF;

  IF NEW.role = 'institution_admin' THEN
    INSERT INTO user_roles (user_id, role) VALUES (NEW.id, 'institution_admin')
    ON CONFLICT ON CONSTRAINT user_roles_unique DO NOTHING;
  ELSE
    DELETE FROM user_roles WHERE user_id = NEW.id AND role = 'institution_admin';
  END IF;

  IF NEW.role = 'admin' AND NEW.tag_id IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role, program, tag_id) VALUES (NEW.id, 'tag_admin', 'btech', NEW.tag_id)
    ON CONFLICT ON CONSTRAINT user_roles_unique DO NOTHING;
  ELSIF NEW.role = 'faculty' THEN
    DELETE FROM user_roles WHERE user_id = NEW.id AND role = 'tag_admin' AND program = 'btech';
  END IF;

  PERFORM set_config('app.role_sync', 'off', true);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS profiles_sync_roles ON profiles;
CREATE TRIGGER profiles_sync_roles
  AFTER INSERT OR UPDATE OF role, tag_id ON profiles
  FOR EACH ROW EXECUTE FUNCTION profiles_sync_roles();

-- ────────────────────────────────────────────────────────────
-- 8. Profile guard (replaces 006's version): role / tag_id changes made
--    with a user session follow the grant rules above.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION profiles_role_guard()
RETURNS TRIGGER AS $$
DECLARE
  old_role TEXT;
  old_tag  UUID;
BEGIN
  -- No user (service role) or an update made by one of our own triggers
  IF auth.uid() IS NULL OR pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

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

  IF is_institution_admin() THEN
    RETURN NEW;
  END IF;

  -- B.Tech TAG / program admins may move faculty into a TAG they administer
  -- and switch them between faculty and (B.Tech TAG) admin there.
  IF old_role IN ('faculty', 'admin') AND NEW.role IN ('faculty', 'admin')
     AND NEW.tag_id IS NOT NULL AND can_admin('btech', NEW.tag_id)
     AND (old_tag IS NULL OR can_admin('btech', old_tag)) THEN
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
-- 9. Per-program admin RLS
-- ────────────────────────────────────────────────────────────

-- groups
DROP POLICY IF EXISTS "groups_admin_write" ON groups;
CREATE POLICY "groups_admin_write" ON groups FOR ALL
  USING (can_admin(program, tag_id))
  WITH CHECK (can_admin(program, tag_id));

-- students, panel_assignments: through their group
DROP POLICY IF EXISTS "students_admin_write" ON students;
CREATE POLICY "students_admin_write" ON students FOR ALL
  USING (EXISTS (SELECT 1 FROM groups g WHERE g.id = students.group_id AND can_admin(g.program, g.tag_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM groups g WHERE g.id = students.group_id AND can_admin(g.program, g.tag_id)));

DROP POLICY IF EXISTS "pa_admin_write" ON panel_assignments;
CREATE POLICY "pa_admin_write" ON panel_assignments FOR ALL
  USING (EXISTS (SELECT 1 FROM groups g WHERE g.id = panel_assignments.group_id AND can_admin(g.program, g.tag_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM groups g WHERE g.id = panel_assignments.group_id AND can_admin(g.program, g.tag_id)));

-- criteria, sub_criteria: program from the criterion's review
DROP POLICY IF EXISTS "criteria_admin_write" ON criteria;
CREATE POLICY "criteria_admin_write" ON criteria FOR ALL
  USING (EXISTS (SELECT 1 FROM reviews r WHERE r.id = criteria.review_id AND can_admin(r.program, criteria.tag_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM reviews r WHERE r.id = criteria.review_id AND can_admin(r.program, criteria.tag_id)));

DROP POLICY IF EXISTS "sub_criteria_admin_write" ON sub_criteria;
CREATE POLICY "sub_criteria_admin_write" ON sub_criteria FOR ALL
  USING (EXISTS (SELECT 1 FROM criteria c JOIN reviews r ON r.id = c.review_id
                 WHERE c.id = sub_criteria.criteria_id AND can_admin(r.program, c.tag_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM criteria c JOIN reviews r ON r.id = c.review_id
                      WHERE c.id = sub_criteria.criteria_id AND can_admin(r.program, c.tag_id)));

-- reviews: institution admin or that program's admin
DROP POLICY IF EXISTS "reviews_write" ON reviews;
CREATE POLICY "reviews_write" ON reviews FOR ALL
  USING (is_institution_admin() OR is_program_admin(program))
  WITH CHECK (is_institution_admin() OR is_program_admin(program));

-- tag_reviews: admins of that review's program + TAG
DROP POLICY IF EXISTS "tag_reviews_write" ON tag_reviews;
CREATE POLICY "tag_reviews_write" ON tag_reviews FOR ALL
  USING (EXISTS (SELECT 1 FROM reviews r WHERE r.id = tag_reviews.review_id AND can_admin(r.program, tag_reviews.tag_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM reviews r WHERE r.id = tag_reviews.review_id AND can_admin(r.program, tag_reviews.tag_id)));

-- review_unlock_requests: TAG admin asks; institution or program admin decides
DROP POLICY IF EXISTS "unlock_requests_read" ON review_unlock_requests;
CREATE POLICY "unlock_requests_read" ON review_unlock_requests FOR SELECT
  USING (EXISTS (SELECT 1 FROM reviews r WHERE r.id = review_unlock_requests.review_id
                 AND can_admin(r.program, review_unlock_requests.tag_id)));

DROP POLICY IF EXISTS "unlock_requests_insert" ON review_unlock_requests;
CREATE POLICY "unlock_requests_insert" ON review_unlock_requests FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM reviews r WHERE r.id = review_unlock_requests.review_id
                      AND is_tag_admin(r.program, review_unlock_requests.tag_id)));

DROP POLICY IF EXISTS "unlock_requests_update" ON review_unlock_requests;
CREATE POLICY "unlock_requests_update" ON review_unlock_requests FOR UPDATE
  USING (EXISTS (SELECT 1 FROM reviews r WHERE r.id = review_unlock_requests.review_id
                 AND (is_institution_admin() OR is_program_admin(r.program))))
  WITH CHECK (EXISTS (SELECT 1 FROM reviews r WHERE r.id = review_unlock_requests.review_id
                      AND (is_institution_admin() OR is_program_admin(r.program))));

-- profiles: own row or any admin (the import page updates other members);
-- role / tag_id changes are limited by profiles_role_guard
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  USING (auth.uid() = id OR is_admin());

-- group_review_status writers (003): guide, or admin of the group's program + TAG
CREATE OR REPLACE FUNCTION can_manage_group_review(gid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM groups g
    WHERE g.id = gid
      AND (g.guide1_id = auth.uid() OR g.guide2_id = auth.uid() OR can_admin(g.program, g.tag_id))
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- groups column guard (003/004): admins of the group's program + TAG are not limited
CREATE OR REPLACE FUNCTION groups_guide_column_guard()
RETURNS TRIGGER AS $$
DECLARE
  allowed_cols TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF can_admin(OLD.program, OLD.tag_id) AND can_admin(NEW.program, NEW.tag_id) THEN
    RETURN NEW;
  END IF;

  IF OLD.guide1_id = auth.uid() OR OLD.guide2_id = auth.uid() THEN
    allowed_cols := allowed_cols || ARRAY['guide_approval_status', 'guide_approved_at', 'guide_approved_by'];
  END IF;

  IF EXISTS (
    SELECT 1 FROM panel_assignments
    WHERE group_id = OLD.id AND faculty_id = auth.uid()
  ) THEN
    allowed_cols := allowed_cols || ARRAY['project_type'];
  END IF;

  IF (to_jsonb(NEW) - allowed_cols) IS DISTINCT FROM (to_jsonb(OLD) - allowed_cols) THEN
    RAISE EXCEPTION 'Not allowed to update these fields on groups'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
