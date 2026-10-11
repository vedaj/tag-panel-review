-- ============================================================
-- Migration 004: Panel members can set project_type
-- Apply to test:  https://supabase.com/dashboard/project/aumqdoxkmepggdxpkaid/sql
-- Apply to prod:  https://supabase.com/dashboard/project/zjzqamyoeumoqoomtbgq/sql
-- Idempotent: safe to re-run.
--
-- The grading sheet sets groups.project_type with the user's session.
-- Panelists had no UPDATE policy on groups, and 003's column guard blocked
-- guides who also sit on their group's panel. A panel member (guide or not)
-- may now change project_type; guides may still change the approval fields.
-- ============================================================

DROP POLICY IF EXISTS "groups_panel_update" ON groups;
CREATE POLICY "groups_panel_update" ON groups
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM panel_assignments pa WHERE pa.group_id = groups.id AND pa.faculty_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM panel_assignments pa WHERE pa.group_id = groups.id AND pa.faculty_id = auth.uid()));

CREATE OR REPLACE FUNCTION groups_guide_column_guard()
RETURNS TRIGGER AS $$
DECLARE
  allowed_cols TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'institution_admin')
  ) THEN
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
