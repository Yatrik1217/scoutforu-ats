import Link from "next/link";
import { redirect } from "next/navigation";
import { loadWorkspace } from "@/lib/data";
import { CopyBlock } from "@/components/copy-block";
import { Globe, ExternalLink, CheckCircle2, MonitorSmartphone } from "lucide-react";

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "https://scoutforu-ats.vercel.app"
  );
}

const CAREERS_DOMAIN = process.env.NEXT_PUBLIC_CAREERS_DOMAIN || "careers.scoutforu.com";

export default async function CareerPageSettings() {
  const { ws, scope } = await loadWorkspace();
  if (scope.role !== "master_admin") redirect("/admin");

  const eligible = ws.jobs.filter(
    (j) => j.approval_status === "approved" && (j.status === "open" || j.status === "hot"),
  );
  // Pre-migration (no "published" column) the flag is undefined on every row —
  // the careers page then falls back to showing all eligible jobs.
  const migrated = eligible.some((j) => j.published !== undefined && j.published !== null);
  const liveCount = migrated ? eligible.filter((j) => j.published).length : eligible.length;

  const careersUrl = `https://${CAREERS_DOMAIN}`;
  const fallbackUrl = `${siteUrl()}/careers`;
  const embedSnippet = [
    `<!-- ScoutforU open roles — auto-syncs with the ATS -->`,
    `<iframe src="${careersUrl}/embed"`,
    `  title="Open positions at ScoutforU"`,
    `  style="width:100%;min-height:420px;border:0;border-radius:12px"`,
    `  loading="lazy"></iframe>`,
  ].join("\n");

  return (
    <div className="animate-sc-fadein mx-auto max-w-[720px] p-[22px_26px_40px]">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-[20px] font-extrabold text-[#16203a]">Career Page</h1>
        <Link href="/admin/settings" className="text-[12.5px] font-bold text-[#2a6fdb] hover:underline">
          ← General Settings
        </Link>
      </div>

      {/* Status */}
      <div className="mb-5 flex items-center gap-3 rounded-[12px] border border-[#bbf7d0] bg-[#f0fdf4] p-4">
        <CheckCircle2 className="text-[#16a34a]" />
        <div className="flex-1">
          <div className="text-[14px] font-extrabold text-[#16203a]">
            {liveCount} job{liveCount === 1 ? "" : "s"} live on your career page
          </div>
          <div className="text-[12.5px] text-[#6b7686]">
            Publish or unpublish jobs from <Link href="/jobs" className="font-bold text-[#2a6fdb] hover:underline">Open Jobs</Link> — each
            approved job card has a &ldquo;Publish to website&rdquo; bar.
          </div>
        </div>
        <a
          href="/careers"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 rounded-[9px] bg-[#2a6fdb] px-3.5 py-2 text-[12.5px] font-bold text-white hover:bg-[#2360c0]"
        >
          <ExternalLink size={13} /> View page
        </a>
      </div>

      {/* Custom domain */}
      <div className="mb-5 rounded-[12px] border border-[#e9edf3] bg-white p-5">
        <div className="mb-1 flex items-center gap-2 text-[14px] font-extrabold text-[#16203a]">
          <Globe size={16} /> Your own address — {CAREERS_DOMAIN}
        </div>
        <p className="mb-4 text-[12.5px] leading-[1.6] text-[#6b7686]">
          The app already answers on any <b>careers.*</b> domain and serves the career page there
          (the rest of the ATS stays private). Two one-time steps connect the address:
        </p>
        <ol className="space-y-3 text-[12.5px] leading-[1.65] text-[#42506b]">
          <li className="rounded-[10px] border border-[#eef1f6] p-[10px_14px]">
            <b>1 · Vercel</b> — open your ATS project → <b>Settings → Domains</b> →{" "}
            <b>Add Domain</b> → enter <code className="rounded bg-[#f4f6fa] px-1">{CAREERS_DOMAIN}</code> → Add.
          </li>
          <li className="rounded-[10px] border border-[#eef1f6] p-[10px_14px]">
            <b>2 · Your DNS</b> (where scoutforu.com is managed — GoDaddy, Cloudflare…) — add the
            record Vercel shows, normally:
            <div className="mt-2">
              <CopyBlock text={`Type: CNAME\nName: careers\nValue: cname.vercel-dns.com`} />
            </div>
          </li>
        </ol>
        <p className="mt-3 text-[12px] text-[#8a94a6]">
          Within a few minutes Vercel shows a ✓ and <b>https://{CAREERS_DOMAIN}</b> is live with SSL.
          Until then, the page is always available at{" "}
          <a href={fallbackUrl} className="font-bold text-[#2a6fdb] hover:underline">{fallbackUrl}</a>.
        </p>
      </div>

      {/* Embed on the main website */}
      <div className="rounded-[12px] border border-[#e9edf3] bg-white p-5">
        <div className="mb-1 flex items-center gap-2 text-[14px] font-extrabold text-[#16203a]">
          <MonitorSmartphone size={16} /> Show the jobs on www.scoutforu.com
        </div>
        <p className="mb-4 text-[12.5px] leading-[1.6] text-[#6b7686]">
          Paste this snippet into any page of your website (or hand it to whoever manages it). It
          renders the live job list and <b>stays in sync automatically</b> — publish or unpublish in
          the ATS and the website updates by itself. Candidates land on your career page to apply.
        </p>
        <CopyBlock label="Embed code" text={embedSnippet} />
        <p className="mt-3 text-[12px] text-[#8a94a6]">
          Prefer a simple link instead? Point your website&rsquo;s &ldquo;Careers&rdquo; menu item at{" "}
          <b>https://{CAREERS_DOMAIN}</b>.
        </p>
      </div>
    </div>
  );
}
