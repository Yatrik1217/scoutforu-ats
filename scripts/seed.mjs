// ScoutforU ATS — seed script.
// Provisions auth users (3 roles + recruiter team) and loads the prototype
// dataset (clients, jobs, candidates, interviews, offers) plus a synthetic
// stage-event history so timeline / activity / time-in-stage analytics are real.
//
// Run with:  node scripts/seed.mjs       (reads .env.local)
// Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- load .env.local ---
function loadEnv() {
  try {
    const raw = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* env may be set externally */
  }
}
loadEnv();

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = process.env.SEED_PASSWORD || "scoutforu123";

if (!URL || !SERVICE_KEY) {
  console.error(
    "✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const db = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DAY = 86_400_000;
const ago = (days) => new Date(Date.now() - days * DAY).toISOString();
const fromNow = (days, h = 9, min = 0) => {
  const d = new Date(Date.now() + days * DAY);
  d.setHours(h, min, 0, 0);
  return d.toISOString();
};

const STAGE_SLUG = {
  Sourced: "sourced",
  Screening: "screening",
  Interview: "interview",
  "Practical Interview": "practical_interview",
  Selected: "selected",
  Offered: "offered",
  "Offer Accepted": "offer_accepted",
  Joined: "joined",
  "Not Joined": "not_joined",
};
const STAGE_ORDER = Object.values(STAGE_SLUG);
const STAGE_DAYS = {
  sourced: 2,
  screening: 3,
  interview: 4,
  practical_interview: 3,
  selected: 2,
  offered: 4,
  offer_accepted: 3,
  joined: 5,
};

// ---- people ----
const ADMIN = {
  email: "yatrik@scoutforu.com",
  name: "Yatrik",
  role: "master_admin",
  color: "#2a6fdb",
};
const RECRUITERS = [
  { email: "yashashvi.shah@scoutforu.com", name: "Yashashvi Shah", color: "#2a6fdb" },
  { email: "shivani.meena@scoutforu.com", name: "Shivani Meena", color: "#8b5cf6" },
];
const CLIENT_USER = {
  email: "hr@acme.com",
  name: "Acme Corp Portal",
  role: "client",
  color: "#f59e0b",
  clientName: "Acme Corp",
};

// The prototype dataset references four demo recruiters; remap their work onto
// the two real recruiters so jobs/candidates/interviews stay populated.
const REMAP = {
  "Aisha Khan": "Yashashvi Shah",
  "Meera Nair": "Yashashvi Shah",
  "Rahul Verma": "Shivani Meena",
  "Tom Brooks": "Shivani Meena",
};
const recName = (name) => REMAP[name] ?? name;

const CLIENTS = [
  { name: "Acme Corp", status: "Active", contact_email: "hr@acme.com" },
  { name: "Nimbus Tech", status: "Active", contact_email: "talent@nimbus.tech" },
  { name: "Internal", status: "Active", contact_email: "internal@scoutforu.in" },
];

const JOBS = [
  ["J1", "Senior Frontend Engineer", "Engineering", "Bangalore", "full_time", 4, "Acme Corp", "Aisha Khan", 12, 38, "open", ["React", "TypeScript"]],
  ["J2", "Product Designer", "Design", "Remote", "full_time", 2, "Nimbus Tech", "Meera Nair", 8, 27, "open", ["Figma", "UX Research"]],
  ["J3", "Backend Engineer (Go)", "Engineering", "Pune", "full_time", 3, "Acme Corp", "Rahul Verma", 15, 31, "open", ["Go", "Microservices"]],
  ["J4", "Product Manager", "Product", "Mumbai", "full_time", 1, "Nimbus Tech", "Meera Nair", 6, 44, "hot", ["Roadmapping", "Analytics"]],
  ["J5", "DevOps Engineer", "Infrastructure", "Remote", "full_time", 2, "Acme Corp", "Rahul Verma", 10, 19, "open", ["AWS", "Kubernetes"]],
  ["J6", "Data Scientist", "Data", "Bangalore", "full_time", 2, "Nimbus Tech", "Tom Brooks", 4, 22, "open", ["Python", "ML"]],
  ["J7", "QA Automation Engineer", "Engineering", "Hyderabad", "contract", 2, "Internal", "Tom Brooks", 18, 16, "open", ["Selenium", "CI/CD"]],
  ["J8", "Engineering Manager", "Engineering", "Bangalore", "full_time", 1, "Acme Corp", "Aisha Khan", 2, 11, "hot", ["Leadership", "Scaling"]],
];

// name, jobCode, stage, rating, exp, loc, source, recruiter, days, salaryLpa
const CANDIDATES = [
  ["Arjun Mehta", "J1", "Sourced", 4.0, 6, "Bangalore", "LinkedIn", "Aisha Khan", 2, 32],
  ["Sara Pillai", "J2", "Sourced", 4.5, 5, "Remote", "Referral", "Meera Nair", 1, 28],
  ["Vikram Sethi", "J3", "Sourced", 3.5, 7, "Pune", "Naukri", "Rahul Verma", 3, 36],
  ["Neha Gupta", "J6", "Sourced", 4.0, 4, "Bangalore", "LinkedIn", "Tom Brooks", 1, 30],
  ["Manish Tiwari", "J3", "Sourced", 3.5, 5, "Pune", "Naukri", "Rahul Verma", 1, 30],
  ["Daniel Roy", "J1", "Screening", 4.0, 5, "Hyderabad", "Career Site", "Aisha Khan", 2, 29],
  ["Pooja Nair", "J4", "Screening", 4.5, 8, "Mumbai", "Referral", "Meera Nair", 4, 42],
  ["Karthik Iyer", "J5", "Screening", 3.5, 6, "Remote", "LinkedIn", "Rahul Verma", 2, 34],
  ["Ananya Bose", "J7", "Screening", 4.0, 4, "Hyderabad", "Naukri", "Tom Brooks", 1, 22],
  ["Lekha Suresh", "J2", "Screening", 4.0, 4, "Remote", "LinkedIn", "Meera Nair", 2, 27],
  ["Rohan Kapoor", "J3", "Interview", 4.5, 8, "Pune", "Referral", "Rahul Verma", 3, 40],
  ["Isha Verma", "J2", "Interview", 4.0, 6, "Remote", "LinkedIn", "Meera Nair", 2, 33],
  ["Aditya Rao", "J1", "Interview", 3.5, 5, "Bangalore", "Agency", "Aisha Khan", 5, 31],
  ["Gaurav Malhotra", "J5", "Interview", 4.0, 7, "Remote", "Referral", "Tom Brooks", 3, 40],
  ["Meghna Shah", "J6", "Practical Interview", 4.5, 5, "Bangalore", "Referral", "Tom Brooks", 2, 38],
  ["Sameer Khan", "J5", "Practical Interview", 4.0, 7, "Remote", "LinkedIn", "Rahul Verma", 3, 41],
  ["Priya Menon", "J4", "Selected", 5.0, 9, "Mumbai", "Referral", "Meera Nair", 1, 48],
  ["Nikhil Jain", "J1", "Selected", 4.5, 6, "Bangalore", "LinkedIn", "Aisha Khan", 2, 37],
  ["Tanvi Desai", "J2", "Offered", 4.5, 7, "Remote", "Referral", "Meera Nair", 3, 35],
  ["Harsh Patel", "J3", "Offered", 4.0, 8, "Pune", "LinkedIn", "Rahul Verma", 4, 44],
  ["Aman Sinha", "J8", "Offer Accepted", 5.0, 11, "Bangalore", "Referral", "Aisha Khan", 5, 62],
  ["Riya Kapadia", "J7", "Offer Accepted", 4.5, 5, "Hyderabad", "Naukri", "Tom Brooks", 2, 26],
  ["Kabir Anand", "J1", "Joined", 4.5, 6, "Bangalore", "LinkedIn", "Aisha Khan", 10, 38],
  ["Divya Reddy", "J6", "Joined", 4.0, 5, "Bangalore", "Referral", "Tom Brooks", 14, 33],
  ["Farhan Ali", "J5", "Not Joined", 3.5, 6, "Remote", "Agency", "Rahul Verma", 7, 39],
  ["Sneha Kulkarni", "J4", "Not Joined", 4.0, 8, "Mumbai", "LinkedIn", "Meera Nair", 9, 46],
];

// candidateName, daysFromNow, hour, min, type, interviewer
const INTERVIEWS = [
  ["Rohan Kapoor", 0, 11, 0, "video", "Aisha Khan"],
  ["Isha Verma", 0, 14, 30, "onsite", "Meera Nair"],
  ["Aditya Rao", 1, 10, 0, "video", "Aisha Khan"],
  ["Sameer Khan", 1, 16, 0, "practical", "Rahul Verma"],
  ["Meghna Shah", 3, 12, 0, "practical", "Tom Brooks"],
  ["Pooja Nair", 4, 15, 0, "phone", "Meera Nair"],
];

async function wipe() {
  console.log("• Clearing existing data…");
  for (const t of ["offers", "stage_events", "interviews", "candidates", "jobs", "clients"]) {
    const { error } = await db.from(t).delete().not("id", "is", null);
    if (error) throw new Error(`wipe ${t}: ${error.message}`);
  }
  // delete seed auth users (cascades their profiles), including any superseded
  // emails from earlier seed runs so they don't linger.
  const LEGACY_EMAILS = [
    "yashashvi.shsh@scoutforu.com",
    "riya.sharma@scoutforu.in",
    "aisha.khan@scoutforu.in",
    "rahul.verma@scoutforu.in",
    "meera.nair@scoutforu.in",
    "tom.brooks@scoutforu.in",
  ];
  const emails = new Set([
    ADMIN.email,
    CLIENT_USER.email,
    ...RECRUITERS.map((r) => r.email),
    ...LEGACY_EMAILS,
  ]);
  let page = 1;
  for (;;) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    for (const u of data.users) {
      if (emails.has(u.email)) await db.auth.admin.deleteUser(u.id);
    }
    if (data.users.length < 200) break;
    page += 1;
  }
}

async function createUser({ email, name, role, color, client_id }) {
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { name, role, color, client_id: client_id ?? "" },
  });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  return data.user.id; // profile row is auto-created by the on_auth_user_created trigger
}

async function main() {
  await wipe();

  console.log("• Seeding clients…");
  const { data: clientRows, error: cErr } = await db
    .from("clients")
    .insert(CLIENTS)
    .select();
  if (cErr) throw new Error(`clients: ${cErr.message}`);
  const clientId = Object.fromEntries(clientRows.map((c) => [c.name, c.id]));

  console.log("• Creating users…");
  const userId = {}; // name -> profile/auth id
  userId[ADMIN.name] = await createUser(ADMIN);
  for (const r of RECRUITERS) {
    userId[r.name] = await createUser({ ...r, role: "recruiter" });
  }
  await createUser({ ...CLIENT_USER, client_id: clientId[CLIENT_USER.clientName] });

  console.log("• Seeding jobs…");
  const jobRows = JOBS.map((j) => ({
    title: j[1],
    dept: j[2],
    location: j[3],
    type: j[4],
    openings: j[5],
    client_id: clientId[j[6]] ?? null,
    recruiter_id: userId[recName(j[7])] ?? null,
    posted_at: ago(j[8]),
    applicants_count: j[9],
    status: j[10],
    description: "",
  }));
  const { data: insertedJobs, error: jErr } = await db.from("jobs").insert(jobRows).select();
  if (jErr) throw new Error(`jobs: ${jErr.message}`);
  // map prototype code (J1..) -> real id, by array order
  const jobIdByCode = Object.fromEntries(JOBS.map((j, i) => [j[0], insertedJobs[i].id]));
  const tagsByCode = Object.fromEntries(JOBS.map((j) => [j[0], j[11]]));

  console.log("• Seeding candidates + stage history…");
  const candIdByName = {};
  for (const c of CANDIDATES) {
    const [name, code, stageLabel, rating, exp, loc, source, recruiter, days, salary] = c;
    const stage = STAGE_SLUG[stageLabel];
    const enteredAt = ago(days);
    const { data: row, error } = await db
      .from("candidates")
      .insert({
        name,
        email: name.toLowerCase().replace(/ /g, ".") + "@email.com",
        job_id: jobIdByCode[code],
        stage,
        rating,
        exp_years: exp,
        location: loc,
        source,
        recruiter_id: userId[recName(recruiter)] ?? null,
        salary_lpa: salary,
        tags: tagsByCode[code] ?? [],
        entered_stage_at: enteredAt,
      })
      .select()
      .single();
    if (error) throw new Error(`candidate ${name}: ${error.message}`);
    candIdByName[name] = row.id;

    // Build the prior-stage history (the INSERT trigger already logged the
    // current-stage entry at enteredAt). Walk backwards from current stage.
    const k = STAGE_ORDER.indexOf(stage);
    const history = [];
    let t = days; // days-ago of entering current stage
    for (let i = k - 1; i >= 0; i--) {
      const prevSlug = STAGE_ORDER[i];
      t += STAGE_DAYS[prevSlug] ?? 3;
      history.push({
        candidate_id: row.id,
        from_stage: i === 0 ? null : STAGE_ORDER[i - 1],
        to_stage: prevSlug,
        by_user_id: userId[recName(recruiter)] ?? null,
        created_at: ago(t),
      });
    }
    if (history.length) {
      const { error: hErr } = await db.from("stage_events").insert(history);
      if (hErr) throw new Error(`history ${name}: ${hErr.message}`);
    }
  }

  console.log("• Seeding interviews…");
  const interviewRows = INTERVIEWS.map((iv) => ({
    candidate_id: candIdByName[iv[0]],
    scheduled_at: fromNow(iv[1], iv[2], iv[3]),
    type: iv[4],
    interviewer_id: userId[recName(iv[5])] ?? null,
    created_by: userId[ADMIN.name],
  })).filter((r) => r.candidate_id);
  const { error: iErr } = await db.from("interviews").insert(interviewRows);
  if (iErr) throw new Error(`interviews: ${iErr.message}`);

  console.log("• Seeding offers…");
  const offerRows = CANDIDATES.filter((c) =>
    ["Offered", "Offer Accepted"].includes(c[2]),
  ).map((c) => {
    const accepted = c[2] === "Offer Accepted";
    const days = c[8];
    return {
      candidate_id: candIdByName[c[0]],
      salary_lpa: c[9],
      sent_at: ago(days),
      expires_at: fromNow(7 - Math.min(6, days)),
      status: accepted ? "accepted" : "pending",
    };
  });
  const { error: oErr } = await db.from("offers").insert(offerRows);
  if (oErr) throw new Error(`offers: ${oErr.message}`);

  console.log("\n✓ Seed complete.");
  console.log(`  Demo password for all accounts: ${PASSWORD}`);
  console.log("  Logins:");
  console.log(`   • Master Admin → ${ADMIN.email}`);
  console.log(`   • Recruiters   → ${RECRUITERS.map((r) => r.email).join(", ")}`);
  console.log(`   • Client       → ${CLIENT_USER.email}`);
}

main().catch((e) => {
  console.error("\n✗ Seed failed:", e.message);
  process.exit(1);
});
