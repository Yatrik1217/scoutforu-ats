# Claude Code kickoff prompt — ScoutforU ATS (standalone project)

Create a new empty folder for the project, drop this `design_handoff_scoutforu_ats/` folder inside it, open the folder in Claude Code, and paste the prompt below.

---

```
Build a brand-new, standalone Applicant Tracking System (ATS) web app for a recruitment
consultancy called "ScoutforU Consultants". This is a greenfield project — there is no
existing codebase to integrate with.

First, read design_handoff_scoutforu_ats/README.md in full, then open
design_handoff_scoutforu_ats/frontend/ScoutforU ATS.dc.html in a browser (or read it) to
study the exact layout, colors, spacing, and interactions. That HTML is a HIGH-FIDELITY
DESIGN REFERENCE — recreate it natively with real components, a real database, and real
auth. Do not ship the HTML itself.

Recommended stack (propose alternatives if you think something fits better, but confirm
with me before scaffolding):
- Next.js (App Router) + TypeScript + Tailwind CSS
- shadcn/ui for components
- Supabase (Postgres + Auth + Row-Level Security) for data and auth
- @dnd-kit for accessible drag-and-drop
- Deploy target: Vercel + Supabase

Before writing code:
1. Confirm the stack and project setup (repo, env, lint, deploy). Project name: scoutforu-ats.
2. Propose the database schema + migrations from README Section 8, plus realistic seed data
   (ScoutforU-style: tech roles, Indian locations, ₹ LPA salaries, sample clients).
3. Propose how the three roles (Master Admin, Recruiter, Client) are implemented, including
   server-enforced ROW-LEVEL scoping so Client users only ever see their own client's jobs
   and candidates.

Then implement in this order, pausing for my review after each step:
  0. Scaffold project + auth (login, the three roles) + schema/migrations + seed data.
  A. Pipeline board: 9 stages (exact order/colors in README 5.1), drag-and-drop that
     persists, role/recruiter filters, Board / Compact / Table layouts.
  B. Candidate drawer: facts, skills, stage-progress timeline, Move-to-next, Reject.
  C. Open Jobs + Create Requisition (validated, persists).
  D. Interviews + Schedule Interview modal (validated, persists).
  E. Offers view with stage-advance actions.
  F. Overview dashboard (metrics, funnel, activity, upcoming) computed from real data.
  G. Analytics (funnel, time-in-stage from stage-change events, source effectiveness).
  H. Team, Talent Pool, Admin (users/roles, clients, settings).

Requirements:
- Stages 8 (Joined) and 9 (Not Joined) are terminal.
- Everything persists to the database and is visible to other users in real time
  (real multi-user software, not local state).
- Product name "ScoutforU" everywhere (the prototype still says "TalentFlow" in a few
  spots in older copies — use ScoutforU). Currency is Indian Rupee, shown as "₹{n} LPA".
- Match the design tokens in README Section 9 (Plus Jakarta Sans + Space Grotesk, the
  accent #2A6FDB, the 9 stage colors, radii/shadows). Keep the information architecture
  and interaction model intact.
- Keep the topbar layout robust (search flexes, action items never collapse/wrap).
- Log every stage change as an event so the candidate timeline, activity feed, and
  time-in-stage analytics are all driven by real history.

Start with step 1: confirm the stack and share your schema + RBAC plan before coding.
```

---

### Tips
- Run it locally early (`npm run dev`) and check each step against the prototype side-by-side.
- Ask Claude Code to write migrations + seed scripts so you can reset/repopulate the DB easily.
- Set up Supabase auth + RLS policies before building the Client portal, so scoping is correct from day one.
- When you have real candidate photos/logos, swap the initials-avatars for images (README Section 10).
