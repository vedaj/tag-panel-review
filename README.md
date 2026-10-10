# TAG Panel Review Portal

A web-based grading portal built for engineering colleges that run a structured project review process across multiple Technology Advancement Groups (TAGs). Coordinators spend less time chasing spreadsheets and more time actually reviewing student work.

---

## Why we built this

End-of-semester project reviews at most colleges are a logistical headache. Guides collect marks in spreadsheets, panel faculty jot scores on paper, and someone spends a weekend aggregating everything while hoping nobody sent the wrong version. Grades get lost, criteria drift between reviewers, and there's no easy way to see how a cohort is doing until well after the reviews wrap up.

This portal replaces all of that. Guides and panel faculty log in, see exactly their assigned groups, fill in scores against a common rubric, and submit. Admins get live progress dashboards and can export everything to Excel with one click. The whole process becomes auditable, consistent, and a lot less stressful for everyone involved.

---

## Features

### For faculty
- Clean per-group grading interface with rubric criteria and sub-criteria
- Separate guide and panel review workflows — no confusion about which hat you're wearing
- See your own grading progress at a glance

### For TAG admins
- Create and activate review cycles with optional deadlines
- Lock reviews when the window closes; request unlocks from the institution admin if you need more time
- Full rubric management — add, edit, and order criteria independently for guide and panel reviews
- Assign students to groups and faculty to guide roles
- Download reports as XLSX — guide-only, panel-only, or combined

### For institution admins
- Create and manage TAGs across the institution
- Add and remove members; move faculty between TAGs (admin privileges auto-revoke on move)
- Elevate any TAG member to TAG admin, or demote them back to faculty
- Create institution-wide review cycles that flow down to every TAG
- Approve or reject TAG unlock requests
- Cross-TAG analytics: see grading coverage, active faculty, and student progress side by side

### Analytics
- Review-scoped analytics: switch between review cycles with one click
- Drill down from TAG → group → student to see exactly where scores stand
- Per-criteria breakdown for both guide and panel reviews
- Group ranking tables, reviewer coverage, and score distribution charts

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, React Server Components) |
| Database | Supabase (PostgreSQL + Row Level Security) |
| Auth | Supabase Auth |
| UI | Custom CSS variables + Lucide icons + Recharts |
| Exports | ExcelJS (XLSX) |
| Language | TypeScript throughout |

---

## Roles

| Role | What they can do |
|------|-----------------|
| `faculty` | Grade assigned groups in active reviews |
| `admin` | TAG-level admin: manage rubrics, assignments, unlock requests, reports |
| `institution_admin` | Full access: create TAGs, manage members, create reviews, cross-TAG analytics |

---

## Getting started

### Prerequisites
- Node.js 20+
- A Supabase project (free tier works)

### Setup

```bash
git clone https://github.com/your-org/tag-panel-review
cd tag-panel-review
npm install
```

Create `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Apply the database migrations (in order):

```bash
# In the Supabase SQL editor, run:
# supabase/migrations/001_initial.sql
# supabase/migrations/002_reviews.sql
```

Then start the dev server:

```bash
npm run dev
```

---

## Test accounts

Use these to explore the portal without setting anything up from scratch:

| Account | Email | Password | Role |
|---------|-------|----------|------|
| Institution Admin | `admin@amrita.edu` | `Test@1234` | Institution admin — full access |
| TAG Admin (CSE) | `tagadmin@amrita.edu` | `Test@1234` | TAG admin for CSE |

The test database includes:
- 1 TAG: **CSE** (Computer Science Engineering)
- 14 student groups with assignments
- 1 active review cycle (Review 1)
- A handful of faculty accounts ready to grade

---

## Project structure

```
src/
  app/
    (dashboard)/         # All authenticated pages
      analytics/         # Review-scoped analytics
      admin/
        institution/     # Institution admin: TAG management
        reviews/         # Institution admin: review cycles
        tag-reviews/     # TAG admin: activate reviews, set deadlines
        rubrics/         # Criteria management
        assignments/     # Group / student / faculty assignments
        report/          # XLSX export
        import/          # Bulk data import
        users/           # User management
    actions/             # Server actions (auth-gated mutations)
  components/
    analytics/           # AnalyticsClient, InstitutionAnalyticsClient
    institution/         # TagManager
    ui/                  # shadcn/ui primitives
  lib/                   # Supabase clients, review helpers, admin scope
  types/                 # Database type definitions
supabase/
  migrations/            # SQL migrations
```

---

## License

MIT
