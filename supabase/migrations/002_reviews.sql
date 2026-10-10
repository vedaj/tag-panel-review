-- ============================================================
-- Migration 002: Multi-review system
-- Apply to test:  https://supabase.com/dashboard/project/aumqdoxkmepggdxpkaid/sql
-- Apply to prod:  https://supabase.com/dashboard/project/zjzqamyoeumoqoomtbgq/sql
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Reviews table (institution-wide)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  order_index  INT  NOT NULL DEFAULT 0,
  created_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed "Review 1" from existing data
INSERT INTO reviews (id, name, order_index)
VALUES ('00000000-0000-0000-0000-000000000001', 'Review 1', 0)
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 2. tag_reviews — per-TAG activation of a review
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tag_reviews (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id        UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  review_id     UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'upcoming'
                  CHECK (status IN ('upcoming', 'active', 'locked')),
  expires_at    TIMESTAMPTZ,
  activated_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  activated_at  TIMESTAMPTZ,
  locked_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  locked_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tag_id, review_id)
);

-- Seed one active tag_review per existing TAG pointing at Review 1
INSERT INTO tag_reviews (tag_id, review_id, status, activated_at)
SELECT id, '00000000-0000-0000-0000-000000000001', 'active', now()
FROM tags
ON CONFLICT (tag_id, review_id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 3. review_unlock_requests — TAG admin → institution admin
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS review_unlock_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id        UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  review_id     UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  requested_by  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason        TEXT,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 4. group_review_status — per-group, per-review guide approval
--    Replaces guide_approval_status on groups (kept for migration safety)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS group_review_status (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id              UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  review_id             UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  guide_approval_status TEXT NOT NULL DEFAULT 'pending'
                          CHECK (guide_approval_status IN ('pending', 'approved')),
  guide_approved_at     TIMESTAMPTZ,
  guide_approved_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  UNIQUE (group_id, review_id)
);

-- Seed from existing groups.guide_approval_status
INSERT INTO group_review_status (group_id, review_id, guide_approval_status, guide_approved_at, guide_approved_by)
SELECT
  id,
  '00000000-0000-0000-0000-000000000001',
  guide_approval_status,
  guide_approved_at,
  guide_approved_by
FROM groups
ON CONFLICT (group_id, review_id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 5. Add review_id to criteria
-- ────────────────────────────────────────────────────────────
ALTER TABLE criteria
  ADD COLUMN IF NOT EXISTS review_id UUID REFERENCES reviews(id) ON DELETE CASCADE;

-- Backfill existing criteria to Review 1
UPDATE criteria SET review_id = '00000000-0000-0000-0000-000000000001'
WHERE review_id IS NULL;

-- Make non-nullable after backfill
ALTER TABLE criteria
  ALTER COLUMN review_id SET NOT NULL;

-- ────────────────────────────────────────────────────────────
-- 6. Add review_id to grades
-- ────────────────────────────────────────────────────────────
ALTER TABLE grades
  ADD COLUMN IF NOT EXISTS review_id UUID REFERENCES reviews(id) ON DELETE CASCADE;

UPDATE grades SET review_id = '00000000-0000-0000-0000-000000000001'
WHERE review_id IS NULL;

ALTER TABLE grades
  ALTER COLUMN review_id SET NOT NULL;

-- ────────────────────────────────────────────────────────────
-- 7. Add review_id to feedback
-- ────────────────────────────────────────────────────────────
ALTER TABLE feedback
  ADD COLUMN IF NOT EXISTS review_id UUID REFERENCES reviews(id) ON DELETE CASCADE;

UPDATE feedback SET review_id = '00000000-0000-0000-0000-000000000001'
WHERE review_id IS NULL;

ALTER TABLE feedback
  ALTER COLUMN review_id SET NOT NULL;

-- ────────────────────────────────────────────────────────────
-- 8. RLS policies
-- ────────────────────────────────────────────────────────────

-- reviews: readable by all authenticated users; writable by institution_admin
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reviews_read" ON reviews;
CREATE POLICY "reviews_read" ON reviews FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "reviews_write" ON reviews;
CREATE POLICY "reviews_write" ON reviews FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'institution_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'institution_admin'));

-- tag_reviews: readable by all; writable by admin of that tag + institution_admin
ALTER TABLE tag_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tag_reviews_read" ON tag_reviews;
CREATE POLICY "tag_reviews_read" ON tag_reviews FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "tag_reviews_write" ON tag_reviews;
CREATE POLICY "tag_reviews_write" ON tag_reviews FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'institution_admin')
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND tag_id = tag_reviews.tag_id)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'institution_admin')
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND tag_id = tag_reviews.tag_id)
  );

-- review_unlock_requests: readable by institution_admin + requesting TAG admin
ALTER TABLE review_unlock_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "unlock_requests_read" ON review_unlock_requests;
CREATE POLICY "unlock_requests_read" ON review_unlock_requests FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'institution_admin')
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND tag_id = review_unlock_requests.tag_id)
  );
DROP POLICY IF EXISTS "unlock_requests_insert" ON review_unlock_requests;
CREATE POLICY "unlock_requests_insert" ON review_unlock_requests FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND tag_id = review_unlock_requests.tag_id)
  );
DROP POLICY IF EXISTS "unlock_requests_update" ON review_unlock_requests;
CREATE POLICY "unlock_requests_update" ON review_unlock_requests FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'institution_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'institution_admin'));

-- group_review_status: same access as groups
ALTER TABLE group_review_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "grs_read" ON group_review_status;
CREATE POLICY "grs_read" ON group_review_status FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "grs_write" ON group_review_status;
CREATE POLICY "grs_write" ON group_review_status FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ────────────────────────────────────────────────────────────
-- 8b. Update unique constraints on grades/feedback to include review_id
-- ────────────────────────────────────────────────────────────
ALTER TABLE grades
  DROP CONSTRAINT IF EXISTS grades_faculty_id_student_id_criteria_id_sub_criteria_id_key,
  ADD CONSTRAINT grades_review_faculty_student_criteria_sub_key
    UNIQUE (review_id, faculty_id, student_id, criteria_id, sub_criteria_id);

ALTER TABLE feedback
  DROP CONSTRAINT IF EXISTS feedback_faculty_id_group_id_student_id_key,
  ADD CONSTRAINT feedback_review_faculty_group_student_key
    UNIQUE (review_id, faculty_id, group_id, student_id);

-- ────────────────────────────────────────────────────────────
-- 9. Indexes
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS tag_reviews_tag_id_idx      ON tag_reviews (tag_id);
CREATE INDEX IF NOT EXISTS tag_reviews_review_id_idx   ON tag_reviews (review_id);
CREATE INDEX IF NOT EXISTS tag_reviews_status_idx      ON tag_reviews (status);
CREATE INDEX IF NOT EXISTS criteria_review_id_idx      ON criteria (review_id);
CREATE INDEX IF NOT EXISTS grades_review_id_idx        ON grades (review_id);
CREATE INDEX IF NOT EXISTS feedback_review_id_idx      ON feedback (review_id);
CREATE INDEX IF NOT EXISTS grs_group_review_idx        ON group_review_status (group_id, review_id);
CREATE INDEX IF NOT EXISTS unlock_req_tag_review_idx   ON review_unlock_requests (tag_id, review_id);

-- ────────────────────────────────────────────────────────────
-- 10. Useful view: active review per TAG
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW active_tag_reviews AS
SELECT
  tr.tag_id,
  tr.review_id,
  r.name  AS review_name,
  r.order_index,
  tr.status,
  tr.expires_at,
  tr.activated_at
FROM tag_reviews tr
JOIN reviews r ON r.id = tr.review_id
WHERE tr.status = 'active';
