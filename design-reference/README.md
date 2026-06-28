# Handoff: ScoutforU Consultants — Applicant Tracking System (ATS)

> **For the developer / Claude Code:** This package contains a **design reference** for a recruitment ATS, built as an interactive HTML prototype. It shows the intended look, layout, and behavior at high fidelity — it is **not** production code to copy verbatim. Your task is to **scaffold a brand-new standalone web application** and recreate this design natively in it, choosing an appropriate modern stack (see Section 3). The HTML/CSS is the spec for visual and interaction detail; rebuild it with real components, a real database, and real auth — do not ship the HTML directly.

---

## 1. Overview

ScoutforU Consultants is a recruitment consultancy that places candidates into roles for multiple **client companies**. This ATS lets the team run the entire hiring lifecycle in one place — from creating a job requisition, sourcing and screening candidates, running interviews, through to offer and joining — without leaving the app.

**Primary view:** a Kanban **Pipeline** of candidates across 9 stages with drag-and-drop.

**Users / access tiers (multi-tenant by client):**
- **Master Admin** — full access across all clients, users, and settings.
- **Recruiter** — works their assigned requisitions and candidates.
- **Client** — read-only view of *their own* pipelines only (client portal).

This is a **new, self-contained product** for ScoutforU Consultants — built from scratch as its own application (it is not part of, and does not depend on, the existing CRM).

---

## 2. Fidelity

**High-fidelity.** Final colors, typography, spacing, and interaction behavior are specified below and present in the HTML. Recreate the UI faithfully using the CRM's existing component library; match the tokens in Section 9. If the CRM has its own design system, prefer its tokens but keep the *information architecture, density, and interaction model* intact.

---

## 3. Recommended implementation approach (Claude Code)

This is a **greenfield standalone project** — scaffold it fresh.

1. **Pick a modern, cohesive stack.** A solid default: **Next.js (App Router) + TypeScript + Tailwind CSS** for the UI, **Supabase (Postgres + Auth + Row-Level Security)** for data/auth, and a component layer like **shadcn/ui**. For drag-and-drop use **@dnd-kit** (keyboard-accessible). If you/the user prefer another stack, propose it first. Avoid a bare CRA/vanilla setup — this app needs auth, a DB, and RBAC.
2. **Project name:** `scoutforu-ats`. Set up repo, env, linting, and a deploy target (e.g. Vercel + Supabase) from the start.
3. **Model the domain from scratch** per Section 8 — no dependency on any existing system. A `Client` here is simply a client-company record this app owns.
4. **Auth & RBAC built in.** Implement the three tiers (Master Admin / Recruiter / Client) with **server-enforced row-level scoping** so Client users only ever see their own client's jobs and candidates.
5. **Persistence.** Every action (create requisition, move stage, schedule interview, edit settings) writes to the database and is visible to other users in real time — real multi-user software, not local state.
6. **Build order suggestion:** Scaffold + auth + schema/migrations + seed data → Pipeline board (core) → Candidate drawer + stage actions → Jobs + Create Requisition → Interviews + Scheduling → Offers → Overview dashboard → Analytics → Team / Talent Pool / Admin.

A ready-to-paste kickoff prompt is in **`CLAUDE_CODE_PROMPT.md`**.

---

## 4. Global layout (app shell)

Three-region layout, full viewport height, no page scroll on the shell (regions scroll internally):

```
┌──────────┬─────────────────────────────────────────────┐
│ Sidebar  │ Topbar (66px)                                │
│ (248px,  ├─────────────────────────────────────────────┤
│  dark)   │ Content (scrolls)                            │
│          │                                              │
└──────────┴─────────────────────────────────────────────┘
```

### Sidebar — width `248px`, background `#0E1320`, padding `20px 14px`
- **Logo block:** 34×34 rounded-9px gradient mark (`linear-gradient(135deg,#2A6FDB,#5b96f0)`) with a small line-chart glyph; wordmark **"ScoutforU"** (Space Grotesk, 700, 17px, white) + caption **"ATS PLATFORM"** (10.5px, `#5d6b85`, uppercase, letter-spacing .5px).
- **Section label** "WORKSPACE" (10px, 700, `#4a566f`, letter-spacing 1px).
- **Nav items (WORKSPACE):** Overview, Pipeline, Open Jobs (badge: open-job count), Candidates, Interviews (badge: interview count), Offers, Analytics.
- **Section label** "ADMINISTRATION" then **Team, Talent Pool, Admin**.
- **Nav item style:** flex row, gap 12px, padding `10px 12px`, radius 10px, font 13.5px. Inactive: color `#8c99b3`, weight 600, transparent bg. Active: white text, weight 700, background `linear-gradient(90deg,#2A6FDB,#3f7ee0)`, shadow `0 4px 14px rgba(42,111,219,.4)`. Hover: brightness up. Each has a 18px stroke icon (currentColor).
- **Badge pill:** right-aligned, 11px/800, radius 20px; active `rgba(255,255,255,.25)`/white, inactive `#1c2438`/`#7e8cab`.
- **Bottom user card:** pinned to bottom (`margin-top:auto`), bg `#171d2e`, radius 12px, 34px gradient avatar + name + sub-role.

### Topbar — height `66px`, background `#fff`, bottom border `1px solid #e6eaf1`, padding `0 26px`, flex row gap 18px
Left→right: **view title** block (title 18px/800 + subtitle 12px `#8a94a6`, both `white-space:nowrap`, `flex-shrink:0`) · flexible spacer · **search** (`flex:1 1 240px; max-width:300px; min-width:150px`, input radius 10px, bg `#f6f8fb`, left search icon, focus border `#2A6FDB` + white bg) · **New Requisition** button (`flex-shrink:0`, bg `#2A6FDB`, white, radius 10px, plus icon, shadow) · **bell** (40×40, bordered, red unread dot) · **role switcher** (`flex-shrink:0`, bordered button: colored dot + current role + scope + chevron; opens a dropdown of the three roles).

> **Layout note:** every topbar action must keep `flex-shrink:0` and labels `white-space:nowrap`; only the search is allowed to flex. (This was a real bug in an earlier pass — items collapsed/wrapped at ~676px content width.)

### Content region
`flex:1; overflow:auto`. Each view fades in (`@keyframes fadein`, .25s). Standard view padding `22px 26px 40px` (Overview uses `24px 26px 40px`).

---

## 5. Screens / Views

### 5.1 Pipeline (default landing view) — **the core**
**Purpose:** see and progress every candidate by stage.

**Toolbar** (`padding:16px 26px`): Role filter `<select>` (All Roles + each job) · Recruiter filter `<select>` (All Recruiters + each) · "{n} candidates" count · spacer · **layout switch** segmented control (Board / Compact / Table) in a `#eef1f6` pill; active segment = white bg, `#2A6FDB` text, subtle shadow.

**The 9 stages (fixed order):**
| # | Stage | Color |
|---|-------|-------|
| 1 | Sourced | `#64748b` |
| 2 | Screening | `#2A6FDB` |
| 3 | Interview | `#6366f1` |
| 4 | Practical Interview | `#8b5cf6` |
| 5 | Selected | `#06b6d4` |
| 6 | Offered | `#f59e0b` |
| 7 | Offer Accepted | `#10b981` |
| 8 | Joined | `#16a34a` |
| 9 | Not Joined | `#ef4444` (terminal / rejection) |

**Board / Compact layouts:** horizontal scroll row of columns.
- Column: width `284px` (Board) / `248px` (Compact), `flex-shrink:0`, full height.
- Column header: 9px rounded stage-color dot · stage name (13px/800 `#1c2840`) · count pill (stage color on 12%-alpha bg).
- Column body = **drop zone** (`data-stage`): vertical stack gap 9px, scrollable, bg `#f4f6fa`, radius 12px, min-height 120px. When a card is dragged over: bg → stage color @ 8% alpha, border → `2px dashed {stageColor}`. Empty column shows a dashed "Drop candidates here" placeholder.
- **Candidate card** (`draggable`): white, border `1px solid #eaeef4` with a `3px solid {stageColor}` **left border**, radius 12px, padding 13px, shadow `0 1px 2px rgba(20,40,80,.04)`. Hover: border `#c3d4f0`, shadow `0 6px 18px rgba(20,40,80,.10)`, `translateY(-1px)`.
  - Top row: 36px rounded avatar (initials, deterministic color from name) · name (13.5px/700) + role/job title (11.5px `#8a94a6`) · rating chip (star + `4.5` on `#fff7e6`, text `#b27400`).
  - **Board only:** skill tags (10.5px chips, `#556680` on `#eef2f8`).
  - Footer (border-top): 20px recruiter mini-avatar + "{n}y exp" · clock icon + "{n}d" in stage.
- **Compact** hides the tag row and narrows columns.

**Table layout:** single card-wrapped `<table>` of the filtered candidates. Columns: Candidate (avatar + name + location), Role, Stage (badge), Rating (★ value), Recruiter, Days, and a "View →" action. Row click opens the drawer; hover bg `#f9fbfe`.

**Interactions:**
- **Drag a card** to another column → candidate's stage updates, "days in stage" resets to 0, toast "{name} moved to {stage}". (HTML5 DnD; persist the change.)
- **Click a card / row** → opens Candidate Drawer (5.10).
- Role/Recruiter filters and global search all narrow the visible set live.

### 5.2 Overview (dashboard)
- **5 metric cards** (grid, 5 cols): Open Jobs, Active Candidates, Interviews/wk, Offers Out, Avg Time-to-Hire. Each: tinted 38px icon tile + green/red delta pill (top), big number (30px/800 Space Grotesk), label.
- **Hiring Funnel** card (1.55fr): horizontal bars per stage (stages 1–8), right-aligned stage label · gradient bar (width ∝ count/max) · count. "Open Pipeline →" button navigates to Pipeline.
- **Upcoming Interviews** card (1fr): list of next 5 — day/time block · avatar · name + role · type pill.
- **Recent Activity** card: avatar-dot + "**Who** action **target**" + relative time.
- **Open Roles** card: clickable job rows (dept color dot · title · dept·loc·openings · "{n} in pipeline").

### 5.3 Open Jobs
2-col grid of job cards. Each: dept-colored 44px icon tile · title + status badge (Open green / Hot red) · "dept · loc · type" · ⋯ menu. Stat strip: Openings / Applicants / In Pipeline (blue). Footer: recruiter mini-avatar + name, "client · posted". Actions: **View Pipeline** (→ Pipeline) · **Schedule** (→ schedule modal).

### 5.4 Candidates
Full table of all candidates (respects global search). Columns: Candidate (avatar + name + "exp · loc"), Role, Stage badge, Rating, Source, Recruiter, View →. Row click → drawer.

### 5.5 Interviews
- 3 stat chips: This Week, Today, Practical Rounds. **Schedule Interview** button (→ modal).
- Grouped by day; each group: day label + date + count. Each interview row (clickable → drawer): time block · avatar · name + role · type pill (Video `#2A6FDB` / Onsite `#8b5cf6` / Phone `#06b6d4` / Practical `#f59e0b`) · interviewer mini-avatar + name.

### 5.6 Offers
2-col grid of offer cards for candidates in **Offered** / **Offer Accepted**. Card: 46px avatar · name + role · status badge (Pending amber / Accepted green). Detail strip (`#f7f9fc`): Package (₹ LPA) · Sent · Expires (red if close, green if accepted). Actions: **Mark Accepted / Mark Joined** (advances stage) · **View Profile**.

### 5.7 Analytics
- 4 KPI cards: Offer Accept Rate, Avg Time-to-Hire, Pipeline Velocity, Total Hires (QTD).
- **Source Effectiveness** — horizontal bars per source (LinkedIn/Referral/Naukri/Career Site/Agency), counts derived from candidates.
- **Avg Time in Stage** — horizontal bars (days per stage).
- **Conversion Funnel** — vertical bars per stage (full width).

### 5.8 Team
2-col grid, one card per recruiter: 46px avatar · name + role · "Active" badge. Three stat tiles: Active (blue), Interviews (purple), Hires (green). Workload bar (green <55% / amber <80% / red ≥80%).

### 5.9 Talent Pool
3-col grid of candidates currently in **Sourced**. Card: avatar · name + role · ★ rating · "exp · loc · via {source}" · skill tags · **Move to Screening →** (advances stage).

### 5.10 Candidate Drawer (slide-over)
Opens from the right (480px, `@keyframes flyin` .26s cubic-bezier(.22,1,.36,1)) over a `rgba(16,24,40,.45)` scrim (click scrim or ✕ to close).
- **Header:** background `linear-gradient(135deg,{stageColor},{stageColor}@78%)`, 60px avatar, name (21px/800 white), role, stage pill + ★ rating.
- **Quick actions:** Email (mailto) · Schedule (→ modal, pre-fills this candidate).
- **Facts grid** (2-col): Experience, Location, Source, Expected (₹ LPA), Recruiter, Days in stage.
- **Skills** chips.
- **Stage Progress timeline:** vertical, stages 1–8; completed = green check dot + connecting line, current = stage-color ringed dot, upcoming = gray.
- **Footer actions:** **Reject** (→ Not Joined) · **Move to {next stage}** (primary; disabled/"Final Stage" at the end).

### 5.11 Admin
2-col. **Users & Roles** list (Master Admin / Recruiter / Client badges). **Clients** list (Acme Corp, Nimbus Tech, Internal — each with role count, candidate count, status). **Settings** toggles: Email Notifications, Auto-reject stale (>30 days idle), Client Portal Access, Two-Factor Auth.

### 5.12 Create Requisition (modal)
Centered modal 560px (`@keyframes popin`). Fields: **Job Title** (required, inline error), Department, Location, Employment Type, Openings (number), Client, Assign Recruiter, Description (textarea). Cancel · **Create & Publish Role** → adds the job, navigates to Open Jobs, toast.

### 5.13 Schedule Interview (modal)
Centered 480px. Fields: **Candidate** (required select of active candidates), **Date** (required), **Time** (required), Type, Interviewer. Validates the three required fields. Confirm → adds to Interviews, toast.

---

## 6. Interactions & behavior summary

- **Navigation:** sidebar sets active view; several in-view buttons also navigate (deep links recommended: `/ats/pipeline`, `/ats/jobs`, etc.).
- **Drag & drop:** HTML5 DnD on cards; column body is the drop target keyed by `data-stage`. On drop: update stage, reset days-in-stage, toast. (Consider a library that supports keyboard DnD for accessibility.)
- **Stage transitions:** Move-next (drawer), Reject (→ Not Joined), Accept offer (Offered→Offer Accepted→Joined), Talent advance (Sourced→Screening). Each writes to DB + toast.
- **Search:** matches candidate name, job title, and skills.
- **Filters:** by job and by recruiter on the pipeline.
- **Role switching:** changes the current viewing scope; **Client** scope must be enforced server-side (row-level security), not just UI.
- **Toasts:** bottom-center dark pill with green check, auto-dismiss ~2.6s (`@keyframes toastin`).
- **Animations:** `fadein` (views .25s), `flyin` (drawer .26s), `popin` (modals .24s), `toastin` (.26s). Easing for drawer/modal/toast: `cubic-bezier(.22,1,.36,1)`.

---

## 7. State / data the UI needs (runtime)

`activeView`, `role` + `roleScope`, `search`, `filterJob`, `filterRec`, `layout` (board/compact/table), `dragOver` (stage being hovered), `selectedCandidateId` (drawer), `showCreateReq` + `reqForm`, `showSchedule` + `schedForm`, `settings` toggles, `toast`. In production these become a mix of URL state (view/filters), local UI state (modals/drawer), and server data (everything in Section 8).

---

## 8. Data model (build from scratch)

Define these as new tables/migrations in the project's database:

```
Client        { id, name, status, contactEmail }                       // = CRM client company
Job (Req)     { id, title, dept, location, type, openings, status,     // status: Open | Hot | Closed
                clientId, recruiterId, postedAt, applicantsCount, description }
User          { id, name, email, role, color }                         // role: master_admin | recruiter | client
Candidate     { id, name, email, phone, jobId, stage, rating(0–5),     // stage = one of the 9
                expYears, location, source, recruiterId, salaryLpa,
                daysInStage, enteredStageAt, tags[] }
Interview     { id, candidateId, datetime, type, interviewerId }       // type: Video|Phone|Onsite|Practical
StageEvent    { id, candidateId, fromStage, toStage, byUserId, at }    // drives timeline + activity feed + time-in-stage analytics
Offer (opt)   { id, candidateId, salaryLpa, sentAt, expiresAt, status} // or derive from Candidate stage + fields
```

Notes:
- `Client` is owned by this app (a client-company record) — no external dependency.
- **Stage** is an enum of the 9 stages, ordered. "Move next" = next index; terminal stages (Joined, Not Joined) have no next.
- **Skills/tags** were derived per-job in the prototype; in production attach tags to the candidate.
- **Analytics** (funnel, time-in-stage, source effectiveness, accept rate) should be computed from `Candidate` + `StageEvent`, not hardcoded.
- **Activity feed** = recent `StageEvent`s + interview/req creation events.

---

## 9. Design tokens

**Brand / accent**
- Primary `#2A6FDB`, primary-hover `#1f5bc0`, primary-soft bg `#eef4fe`

**Stage colors** — see table in 5.1. Pattern: badges/fills use the stage color on a **12% alpha** background; bars use a gradient from ~85%→100% of the color.

**Type pills:** Video `#2A6FDB`, Onsite `#8b5cf6`, Phone `#06b6d4`, Practical `#f59e0b` (all on 12%-alpha bg).

**Neutrals**
- Sidebar `#0E1320`, sidebar card `#171d2e`, sidebar inactive text `#8c99b3`, sidebar label `#4a566f`
- App bg `#EEF1F6`, surface `#FFFFFF`, card border `#e9edf3` / `#eaeef4`, hairline `#f0f3f8`
- Soft fill `#f6f8fb` / `#f7f9fc`, board lane `#f4f6fa`, tag bg `#eef2f8`
- Text: primary `#0E1320`/`#15213c`/`#16203a`, secondary `#42506b`, muted `#8a94a6`, faint `#a3acbd`

**Semantic**
- Success `#16a34a` (bg `#e9f9ef`), warning `#b27400` (bg `#fff7e6`), danger `#ef4444` (bg `#fef2f2`)

**Typography**
- UI/body: **Plus Jakarta Sans** (400/500/600/700/800)
- Display (logo, big metric numbers): **Space Grotesk** (500/600/700)
- Numeric: enable `font-variant-numeric: tabular-nums` for stats/counts.
- Scale seen: 30px/800 (metrics), 21px/800 (drawer name), 18px/800 (view title), 15.5px/800 (card headers), 13.5px (body/buttons), 12.5px (controls), 11–11.5px (meta), 10–10.5px (labels/tags).

**Radius:** cards 16px · inner cards/inputs 10–12px · pills/badges 20px · avatars 9–15px · nav items 10px.

**Shadows:** card rest `0 1px 2px rgba(20,40,80,.04)`; card hover `0 6px 18px rgba(20,40,80,.10)`; primary button `0 3px 10px rgba(42,111,219,.32)`; drawer `-12px 0 40px rgba(16,24,40,.2)`; modal `0 24px 60px rgba(16,24,40,.3)`; toast `0 12px 32px rgba(16,24,40,.35)`.

**Spacing:** content padding 22–26px; card padding 18–22px; grid gaps 16–18px; board column gap 14px; card stack gap 9px.

---

## 10. Assets

- **Icons:** simple stroke icons (Lucide/Feather-style, 24px viewBox, `stroke="currentColor"`, width 2). Use the CRM's existing icon set / Lucide.
- **Avatars:** initials on a deterministic color (hash of name → palette `#2A6FDB,#8b5cf6,#06b6d4,#f59e0b,#ec4899,#10b981,#6366f1,#14b8a6,#f97316,#ef4444`). Swap for real photos when available.
- **No raster image assets** are required. **Rename all "TalentFlow" copy to "ScoutforU"** (the prototype file still says TalentFlow in places — the product name is **ScoutforU**).
- **Currency:** Indian Rupee, salaries shown as "₹{n} LPA".
- **Fonts:** Plus Jakarta Sans + Space Grotesk (Google Fonts) — or the CRM's equivalents.

---

## 11. Files in this bundle

- `frontend/ScoutforU ATS.dc.html` — the full interactive prototype (all 10 views, drawer, both modals, drag-and-drop, toasts). Open in a browser to explore every state. **Reference only.**
- `CLAUDE_CODE_PROMPT.md` — a ready-to-paste prompt to scaffold and build the standalone app.
- `README.md` — this document.

---

## 12. Acceptance checklist

- [ ] Standalone app scaffolded with a modern stack (auth + database + RBAC), deployable.
- [ ] 9-stage pipeline with working drag-and-drop that persists.
- [ ] Candidate drawer with stage timeline, move-next, reject.
- [ ] Create Requisition + Schedule Interview persist and validate.
- [ ] Offers, Interviews, Candidates, Jobs, Overview, Analytics, Team, Talent Pool, Admin all populated from real data.
- [ ] Three roles enforced; Client users see only their own client's data (server-enforced).
- [ ] Product named **ScoutforU**, currency ₹/LPA, tokens per Section 9.
