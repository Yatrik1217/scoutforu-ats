import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Public job application from the careers page → creates a candidate in Sourced.
// No auth: uses the service role (RLS-bypassing) but only ever inserts a
// candidate tied to a real, open job.

const digits10 = (s: string) => (s || "").replace(/\D/g, "").slice(-10);

export async function POST(req: NextRequest) {
  let sb;
  try {
    sb = createServiceClient();
  } catch {
    return NextResponse.json({ ok: false, error: "Applications are not available right now." }, { status: 500 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid submission." }, { status: 400 });
  }

  const s = (k: string) => (form.get(k) ? String(form.get(k)).trim() : "");
  const jobId = s("jobId");
  const name = s("name");
  const email = s("email").toLowerCase();
  const phone = s("phone");
  if (!jobId || !name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return NextResponse.json({ ok: false, error: "Name and a valid email are required." }, { status: 400 });

  // Job must exist and be open.
  const { data: job } = await sb
    .from("jobs")
    .select("id,status,recruiter_id")
    .eq("id", jobId)
    .eq("approval_status", "approved")
    .maybeSingle();
  if (!job || (job.status !== "open" && job.status !== "hot"))
    return NextResponse.json({ ok: false, error: "This position is no longer open." }, { status: 400 });

  // Avoid duplicate applications to the same job.
  const { data: dupes } = await sb.from("candidates").select("id,email,phone").eq("job_id", jobId);
  const p10 = digits10(phone);
  for (const c of dupes ?? []) {
    if ((c.email && c.email.toLowerCase() === email) || (p10.length === 10 && digits10(c.phone || "") === p10))
      return NextResponse.json({ ok: true, status: "duplicate" });
  }

  // Optional résumé upload.
  let resumeUrl = "";
  const file = form.get("resume");
  if (file instanceof File && file.size > 0 && file.size <= 8 * 1024 * 1024) {
    try {
      const ext = (file.name.split(".").pop() || "pdf").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "pdf";
      const path = `${crypto.randomUUID()}.${ext}`;
      const buf = Buffer.from(await file.arrayBuffer());
      const { error } = await sb.storage.from("resumes").upload(path, buf, { contentType: file.type || undefined });
      if (!error) resumeUrl = path;
    } catch {
      /* résumé optional */
    }
  }

  const expYears = parseFloat(s("expYears"));
  const { data: created, error } = await sb
    .from("candidates")
    .insert({
      name,
      email: email || null,
      phone: phone || null,
      job_id: jobId,
      recruiter_id: job.recruiter_id,
      stage: "sourced",
      source: "Career Site",
      location: s("location") || null,
      current_company: s("currentCompany"),
      exp_years: Number.isFinite(expYears) ? expYears : 0,
      resume_url: resumeUrl,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ ok: false, error: "Could not submit. Please try again." }, { status: 500 });

  const message = s("message");
  if (message)
    await sb.from("candidate_notes").insert({ candidate_id: created.id, author_id: null, body: `Applied via Career Site: ${message}` });

  return NextResponse.json({ ok: true, status: "created" });
}
