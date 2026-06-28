# ScoutforU ATS

A standalone, multi-tenant **Applicant Tracking System** for ScoutforU Consultants —
a 9-stage candidate pipeline with drag-and-drop, role-based access (Master Admin /
Recruiter / Client), and live multi-user updates. Built natively from the design
reference in [`design-reference/`](./design-reference).

## Stack

- **Next.js 16** (App Router) + **TypeScript** + **Tailwind CSS v4**
- **shadcn/ui** (Base UI primitives) for components
- **Supabase** — Postgres + Auth + Row-Level Security + Realtime
- **@dnd-kit** for accessible drag-and-drop
- Deploy target: **Vercel + Supabase**

## Architecture

```
src/
  app/
    login/                 # auth screen (email/password + demo accounts)
    (app)/                 # authenticated shell + every view
      layout.tsx           # sidebar + topbar + global drawer/modals + realtime
      pipeline/ jobs/ candidates/ interviews/ offers/
      overview/ analytics/ team/ talent/ admin/
  components/              # sidebar, topbar, drawer, modals, shared bits
  lib/
    domain.ts              # 9 stages, colors, helpers (single source of truth)
    data.ts                # scope-aware workspace loader + analytics
    auth.ts  preview.ts    # profile/session + admin "Preview as"
    actions/               # server actions (mutations, auth, preview)
    supabase/              # browser / server / proxy clients
    database.types.ts      # typed schema
supabase/
  migrations/              # schema -> functions/triggers -> RLS -> settings
scripts/seed.mjs           # auth users + full prototype dataset
```

**Key design points**

- Every stage change is logged by a **Postgres trigger** (`stage_events`), and
  `entered_stage_at` is reset automatically — so the candidate timeline, activity
  feed, and time-in-stage analytics are all driven by real history, never local state.
- **RLS enforces scoping server-side**: Master Admin & Recruiter see everything;
  Client logins can only ever read their own client's jobs/candidates (SELECT-only).
- The Master Admin topbar has a **Preview as** switch that narrows the UI to a
  recruiter or a specific client for testing — real security always rides on the RLS
  of whoever is authenticated.
- A single Realtime subscription refreshes the UI when anyone changes shared data.

## Setup

### 1. Create a Supabase project

At [app.supabase.com](https://app.supabase.com) create a project, then copy
**Project URL**, **anon key**, and **service_role key** from Project Settings → API.

### 2. Environment

```bash
cp .env.local.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
```

### 3. Apply migrations

**Option A — Supabase CLI (recommended):**

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

**Option B — SQL editor:** paste the files in `supabase/migrations/` in numeric
order (0001 → 0004) into the Supabase SQL editor and run them.

### 4. Seed data

```bash
node scripts/seed.mjs
```

Creates the demo accounts and loads the full dataset (3 clients, 8 roles,
26 candidates, interviews, offers, and stage history).

### 5. Run

```bash
npm install
npm run dev      # http://localhost:3000
```

## Demo accounts

Password for all: **`scoutforu123`** (override with `SEED_PASSWORD`).

| Role          | Email                          | Sees                                  |
| ------------- | ------------------------------ | ------------------------------------- |
| Master Admin  | `yatrik@scoutforu.com`         | Everything; can Preview-as any role   |
| Recruiter     | `yashashvi.shsh@scoutforu.com` | All jobs/candidates, read + write     |
| Recruiter     | `shivani.meena@scoutforu.com`  | All jobs/candidates, read + write     |
| Client        | `hr@acme.com`                  | Acme Corp pipelines only, read-only   |

Admins can **activate / deactivate recruiters** from Admin → Users & Roles.
Deactivated recruiters can't sign in (and are locked out mid-session), and they
no longer appear in assignment dropdowns; their historical data is preserved.

## Scripts

| Command                 | Description          |
| ----------------------- | -------------------- |
| `npm run dev`           | Dev server           |
| `npm run build`         | Production build     |
| `npm run lint`          | ESLint               |
| `node scripts/seed.mjs` | Reset + reseed data  |

## Deploy

Push to GitHub, import into Vercel, set the three Supabase env vars in the Vercel
project, and point Supabase Auth → URL Configuration at your deployed domain.
