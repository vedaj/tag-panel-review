-- ============================================================
-- Migration 005: project_type check + tag_id ON DELETE SET NULL
-- Idempotent: safe to re-run.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. groups.project_type may only hold a known type or '' (unset)
-- ────────────────────────────────────────────────────────────
ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_project_type_check;
ALTER TABLE groups ADD CONSTRAINT groups_project_type_check
  CHECK (project_type IN ('research', 'application', 'software', ''));

-- ────────────────────────────────────────────────────────────
-- 2. Deleting a TAG unassigns its profiles, groups and criteria
--    instead of failing on the foreign key.
-- ────────────────────────────────────────────────────────────
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_tag_id_fkey,
  ADD CONSTRAINT profiles_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE SET NULL;

ALTER TABLE groups
  DROP CONSTRAINT IF EXISTS groups_tag_id_fkey,
  ADD CONSTRAINT groups_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE SET NULL;

ALTER TABLE criteria
  DROP CONSTRAINT IF EXISTS criteria_tag_id_fkey,
  ADD CONSTRAINT criteria_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE SET NULL;
