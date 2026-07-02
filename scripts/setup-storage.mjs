import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(), l.slice(i+1).trim()];}));
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });
const { error } = await db.storage.createBucket("resumes", { public:false, fileSizeLimit:"8MB", allowedMimeTypes:["application/pdf","application/vnd.openxmlformats-officedocument.wordprocessingml.document","text/plain"] });
if (error && !/already exists/i.test(error.message)) { console.error("✗", error.message); process.exit(1); }
console.log(error ? "• bucket 'resumes' already exists" : "✓ created private bucket 'resumes'");
