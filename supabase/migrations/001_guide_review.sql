-- ============================================================
-- Migration 001: Guide review system
-- Apply to test:  https://supabase.com/dashboard/project/aumqdoxkmepggdxpkaid/sql
-- Apply to prod:  https://supabase.com/dashboard/project/zjzqamyoeumoqoomtbgq/sql
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Link guides to profiles (replaces free-text guide1/guide2)
-- ────────────────────────────────────────────────────────────
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS guide1_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS guide2_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────
-- 2. Guide approval workflow on groups
-- ────────────────────────────────────────────────────────────
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS guide_approval_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (guide_approval_status IN ('pending', 'approved')),
  ADD COLUMN IF NOT EXISTS guide_approved_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS guide_approved_by  UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────
-- 3. Distinguish guide rubrics from panel rubrics
-- ────────────────────────────────────────────────────────────
ALTER TABLE criteria
  ADD COLUMN IF NOT EXISTS review_type TEXT NOT NULL DEFAULT 'panel'
    CHECK (review_type IN ('panel', 'guide'));

-- ────────────────────────────────────────────────────────────
-- 4. RLS: guides can read their own groups
--    A guide is anyone whose profile id matches guide1_id or
--    guide2_id on a group. They are still role='faculty'.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_guide_of(gid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM groups
    WHERE id = gid
      AND (guide1_id = auth.uid() OR guide2_id = auth.uid())
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Allow guides to update guide_approval_status + guide_approved_* on their groups
DROP POLICY IF EXISTS "groups_guide_approve" ON groups;
CREATE POLICY "groups_guide_approve" ON groups
  FOR UPDATE
  USING (guide1_id = auth.uid() OR guide2_id = auth.uid())
  WITH CHECK (guide1_id = auth.uid() OR guide2_id = auth.uid());

-- ────────────────────────────────────────────────────────────
-- 5. Index for fast guide dashboard queries
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS groups_guide1_id_idx ON groups (guide1_id);
CREATE INDEX IF NOT EXISTS groups_guide2_id_idx ON groups (guide2_id);
CREATE INDEX IF NOT EXISTS criteria_review_type_idx ON criteria (review_type);
