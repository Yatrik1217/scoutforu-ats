// Creates the private "resumes" Storage bucket (idempotent).
// Run: node scripts/setup-storage.mjs
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
const db = createClient(URL, KEY, { auth: { persistSession: false } });

const opts = { public: false, fileSizeLimit: 8 * 1024 * 1024 };
const { error } = await db.storage.createBucket("resumes", opts);
if (error && !/already exists/i.test(error.message)) {
  console.error("✗ createBucket failed:", error.message);
  process.exit(1);
}
// Ensure settings are current even if the bucket already existed.
await db.storage.updateBucket("resumes", opts);
console.log(error ? "✓ Bucket 'resumes' ready (already existed)." : "✓ Created private bucket 'resumes'.");
