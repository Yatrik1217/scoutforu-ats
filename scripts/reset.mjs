// ScoutforU ATS — clean reset.
// Clears all candidate/job/interview data so you can enter your own, while
// KEEPING your user accounts, clients, and settings.
//
// Run with:  node scripts/reset.mjs    (reads .env.local)

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const raw = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const db = createClient(URL, KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // Order respects FKs. Clients, profiles (users), and settings are preserved.
  for (const t of ["offers", "stage_events", "interviews", "candidates", "jobs"]) {
    const { error } = await db.from(t).delete().not("id", "is", null);
    if (error) throw new Error(`${t}: ${error.message}`);
    console.log(`• cleared ${t}`);
  }
  console.log("\n✓ Clean slate ready. Your accounts and clients are kept.");
}

main().catch((e) => {
  console.error("✗ Reset failed:", e.message);
  process.exit(1);
});
