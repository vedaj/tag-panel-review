-- Project type on criteria: which type of group this criterion applies to
ALTER TABLE criteria
  ADD COLUMN IF NOT EXISTS project_type TEXT NOT NULL DEFAULT 'all'
  CHECK (project_type IN ('research', 'application', 'software', 'all'));

-- Allowed mark values for each sub-criterion (comma-separated, e.g. "0,3,5")
ALTER TABLE sub_criteria
  ADD COLUMN IF NOT EXISTS allowed_marks TEXT NOT NULL DEFAULT '';

-- Selected project type for each group (set by the first faculty who opens the grade sheet)
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS project_type TEXT NOT NULL DEFAULT '';
