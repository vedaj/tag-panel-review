-- ============================================================
-- Migration 009: Drop profiles.role
-- Idempotent: safe to re-run.
--
-- Admin roles live in user_roles (007) and the app reads only those (PR 4),
-- so the legacy profiles.role column and the triggers that kept it in sync
-- are removed. Everyone is faculty; admin roles are rows in user_roles.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Stop syncing profiles.role <-> user_roles
-- ────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS profiles_sync_roles ON profiles;
DROP FUNCTION IF EXISTS profiles_sync_roles();

DROP TRIGGER IF EXISTS user_roles_sync_profile ON user_roles;
DROP FUNCTION IF EXISTS user_roles_sync_profile();

-- ────────────────────────────────────────────────────────────
-- 2. Moving a member to another TAG still ends their TAG-admin roles there
--    (this used to happen in profiles_sync_roles)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION profiles_tag_change_roles()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM user_roles
  WHERE user_id = NEW.id AND role = 'tag_admin' AND tag_id IS DISTINCT FROM NEW.tag_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS profiles_tag_change_roles ON profiles;
CREATE TRIGGER profiles_tag_change_roles
  AFTER UPDATE OF tag_id ON profiles
  FOR EACH ROW
  WHEN (NEW.tag_id IS DISTINCT FROM OLD.tag_id)
  EXECUTE FUNCTION profiles_tag_change_roles();

-- ────────────────────────────────────────────────────────────
-- 3. Profile guard: only tag_id is left to protect
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION profiles_role_guard()
RETURNS TRIGGER AS $$
DECLARE
  old_tag UUID;
BEGIN
  -- No user (service role) or an update made by one of our own triggers
  IF auth.uid() IS NULL OR pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- An upsert fires BEFORE INSERT even when it ends up updating, so a new
  -- row is checked as if it had no TAG.
  IF TG_OP = 'INSERT' THEN
    old_tag := NULL;
  ELSE
    old_tag := OLD.tag_id;
  END IF;

  IF NEW.tag_id IS NOT DISTINCT FROM old_tag THEN
    RETURN NEW;
  END IF;

  IF is_institution_admin() THEN
    RETURN NEW;
  END IF;

  -- Admins of a TAG (either program) may add faculty who have no TAG yet.
  -- Moving people between TAGs, or out of one, is for institution admins.
  IF old_tag IS NULL AND NEW.tag_id IS NOT NULL
     AND (can_admin('btech', NEW.tag_id) OR can_admin('mtech', NEW.tag_id)) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Not allowed to change the TAG of this profile' USING ERRCODE = '42501';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate without the role column, which the old trigger was defined on
DROP TRIGGER IF EXISTS profiles_role_guard ON profiles;
CREATE TRIGGER profiles_role_guard
  BEFORE INSERT OR UPDATE OF tag_id ON profiles
  FOR EACH ROW EXECUTE FUNCTION profiles_role_guard();

-- ────────────────────────────────────────────────────────────
-- 4. New sign-ups get a plain profile (faculty, no admin roles)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ────────────────────────────────────────────────────────────
-- 5. Drop the column (and its CHECK constraint)
-- ────────────────────────────────────────────────────────────
ALTER TABLE profiles DROP COLUMN IF EXISTS role;
