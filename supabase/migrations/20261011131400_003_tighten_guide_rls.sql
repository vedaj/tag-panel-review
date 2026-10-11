-- ============================================================
-- Migration 003: Tighten guide-review RLS
-- Apply to test:  https://supabase.com/dashboard/project/aumqdoxkmepggdxpkaid/sql
-- Apply to prod:  https://supabase.com/dashboard/project/zjzqamyoeumoqoomtbgq/sql
-- Idempotent: safe to re-run.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. group_review_status: only the group's guide, the TAG admin
--    for the group's TAG, or an institution_admin may write.
--    (grs_read is unchanged: all authenticated users can read.)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION can_manage_group_review(gid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM groups g
    WHERE g.id = gid
      AND (
        g.guide1_id = auth.uid()
        OR g.guide2_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
            AND (p.role = 'institution_admin'
                 OR (p.role = 'admin' AND p.tag_id = g.tag_id))
        )
      )
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

DROP POLICY IF EXISTS "grs_write" ON group_review_status;
CREATE POLICY "grs_write" ON group_review_status FOR ALL
  USING (can_manage_group_review(group_id))
  WITH CHECK (can_manage_group_review(group_id));

-- ────────────────────────────────────────────────────────────
-- 2. groups: a guide may only change the approval columns.
--    RLS can't restrict columns, so a BEFORE UPDATE trigger rejects
--    any other change unless the caller is an admin/institution_admin
--    or has no JWT user (service role, SQL editor, migrations).
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "groups_guide_approve" ON groups;
CREATE POLICY "groups_guide_approve" ON groups
  FOR UPDATE
  USING (guide1_id = auth.uid() OR guide2_id = auth.uid())
  WITH CHECK (guide1_id = auth.uid() OR guide2_id = auth.uid());

CREATE OR REPLACE FUNCTION groups_guide_column_guard()
RETURNS TRIGGER AS $$
DECLARE
  approval_cols CONSTANT TEXT[] := ARRAY['guide_approval_status', 'guide_approved_at', 'guide_approved_by'];
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

  IF (to_jsonb(NEW) - approval_cols) IS DISTINCT FROM (to_jsonb(OLD) - approval_cols) THEN
    RAISE EXCEPTION 'Guides may only update guide approval fields on groups'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS groups_guide_column_guard ON groups;
CREATE TRIGGER groups_guide_column_guard
  BEFORE UPDATE ON groups
  FOR EACH ROW EXECUTE FUNCTION groups_guide_column_guard();
