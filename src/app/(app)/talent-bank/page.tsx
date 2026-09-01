import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TalentBankUploader } from "@/components/talent-bank-uploader";
import { TalentBankView } from "@/components/talent-bank-view";
import type { TalentBankRow } from "@/lib/database.types";

export const dynamic = "force-dynamic";

type SB = Awaited<ReturnType<typeof createClient>>;

// Supabase/PostgREST returns at most 1000 rows per request, so once the bank
// grows past 1000 a plain select silently drops the rest (and the newest-first
// order means the OLDEST resumes vanish first, shrinking older folders like
// .NET). Page through every row so the counts and folders are always complete.
async function loadAllTalent(sb: SB): Promise<TalentBankRow[]> {
  const PAGE = 1000;
  const all: TalentBankRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from("talent_bank")
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    all.push(...(data as TalentBankRow[]));
    if (data.length < PAGE) break;
  }
  return all;
}

export default async function TalentBankPage() {
  const me = await requireProfile();
  if (me.role === "client") redirect("/overview");

  const sb = await createClient();
  const [bank, { data: jobs }] = await Promise.all([
    loadAllTalent(sb),
    sb.from("jobs").select("id,title").in("status", ["open", "hot"]).order("title"),
  ]);
  const jobList = (jobs ?? []) as { id: string; title: string }[];

  return (
    <div className="animate-sc-fadein p-[22px_26px_40px]">
      <div className="mb-4">
        <h1 className="font-display text-[22px] font-extrabold tracking-tight text-[#16203a]">
          Talent Bank
        </h1>
        <p className="text-[13px] text-[#8a94a6]">
          Dump resumes with no opening attached — they&apos;re parsed and auto-filed by technology.
          Kept <b>out of the candidate pipeline</b>; promote anyone into an opening when you need to.
        </p>
      </div>

      <TalentBankUploader />

      <div className="mt-6">
        <TalentBankView rows={bank} jobs={jobList} />
      </div>
    </div>
  );
}
