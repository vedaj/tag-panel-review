-- ============================================================
-- Migration 008: Profile guard for per-program admins
-- Idempotent: safe to re-run.
--
-- The app now changes roles only through grant_role / revoke_role, so a
-- user session no longer needs to write profiles.role. TAG / program admins
-- of either program may add faculty without a TAG to a TAG they administer
-- (007 only allowed B.Tech admins); moving between TAGs is institution-only.
-- ============================================================

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

  IF is_institution_admin() THEN
    RETURN NEW;
  END IF;

  -- Roles change through grant_role / revoke_role only
  IF NEW.role IS DISTINCT FROM old_role THEN
    RAISE EXCEPTION 'Use grant_role / revoke_role to change roles' USING ERRCODE = '42501';
  END IF;

  -- Admins of a TAG (either program) may add faculty who have no TAG yet.
  -- Moving people between TAGs, or out of one, is for institution admins
  -- (a TAG is shared by both programs).
  IF old_tag IS NULL AND NEW.tag_id IS NOT NULL
     AND (can_admin('btech', NEW.tag_id) OR can_admin('mtech', NEW.tag_id)) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Not allowed to change the TAG of this profile' USING ERRCODE = '42501';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
