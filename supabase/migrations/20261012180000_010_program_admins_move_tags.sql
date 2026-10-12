-- ============================================================
-- Migration 010: Program admins can move users between TAGs
-- Idempotent: safe to re-run.
--
-- A TAG is shared by both programs, so a move applies to both and ends the
-- user's TAG-admin roles in the old TAG (profiles_tag_change_roles, 009).
-- Taking someone out of every TAG stays institution-only.
-- ============================================================

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

  -- Program admins (either program) may move people from one TAG to another
  IF old_tag IS NOT NULL AND NEW.tag_id IS NOT NULL
     AND (is_program_admin('btech') OR is_program_admin('mtech')) THEN
    RETURN NEW;
  END IF;

  -- Admins of a TAG (either program) may add faculty who have no TAG yet
  IF old_tag IS NULL AND NEW.tag_id IS NOT NULL
     AND (can_admin('btech', NEW.tag_id) OR can_admin('mtech', NEW.tag_id)) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Not allowed to change the TAG of this profile' USING ERRCODE = '42501';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
