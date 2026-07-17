import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { money, balanceDue, isOverdue, daysOverdue, OPEN_STATUSES } from "@/lib/invoice";
import { InvoiceStatusBadge } from "@/components/invoice-bits";
import { NewInvoiceButton } from "@/components/invoice-actions";
import type { InvoiceRow } from "@/lib/database.types";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "draft", label: "Drafts" },
  { key: "unpaid", label: "Unpaid" },
  { key: "overdue", label: "Overdue" },
  { key: "paid", label: "Paid" },
  { key: "closed", label: "Void / Written off" },
] as const;

export default async function AllInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; q?: string }>;
}) {
  const me = await requireProfile();
  if (me.role !== "master_admin") redirect("/overview");
  const { f = "all", q = "" } = await searchParams;

  const sb = await createClient();
  const { data } = await sb
    .from("invoices")
    .select("*")
    .order("created_at", { ascending: false });
  let invoices = (data ?? []) as InvoiceRow[];

  const now = new Date();
  if (f === "draft") invoices = invoices.filter((i) => i.status === "draft");
  else if (f === "unpaid") invoices = invoices.filter((i) => OPEN_STATUSES.includes(i.status));
  else if (f === "overdue") invoices = invoices.filter((i) => isOverdue(i, now));
  else if (f === "paid") invoices = invoices.filter((i) => i.status === "paid");
  else if (f === "closed")
    invoices = invoices.filter((i) => ["void", "written_off"].includes(i.status));

  const needle = q.trim().toLowerCase();
  if (needle)
    invoices = invoices.filter(
      (i) =>
        i.invoice_no.toLowerCase().includes(needle) ||
        i.bill_to_name.toLowerCase().includes(needle) ||
        i.bill_to_email.toLowerCase().includes(needle),
    );

  const sumTotal = invoices.reduce((s, i) => s + i.total, 0);
  const sumDue = invoices.reduce((s, i) => s + balanceDue(i), 0);

  return (
    <div className="animate-sc-fadein p-[24px_26px_40px]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-[22px] font-extrabold tracking-tight text-[#16203a]">
            All Invoices
          </h1>
          <p className="text-[13px] text-[#8a94a6]">
            {invoices.length} invoice{invoices.length === 1 ? "" : "s"} · {money(sumTotal)} billed ·{" "}
            {money(sumDue)} outstanding
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/invoices"
            className="rounded-[10px] border border-[#e6eaf1] bg-white px-4 py-2.5 text-[13px] font-bold text-[#42506b] hover:bg-[#f6f8fb]"
          >
            ← Dashboard
          </Link>
          <NewInvoiceButton />
        </div>
      </div>

      {/* filter tabs + search */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex gap-1 rounded-[11px] bg-[#e6eaf1] p-1">
          {FILTERS.map((t) => (
            <Link
              key={t.key}
              href={`/invoices/all?f=${t.key}${needle ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={`rounded-[8px] px-3.5 py-1.5 text-[12.5px] font-bold transition ${
                f === t.key ? "bg-white text-[#16203a] shadow-sm" : "text-[#68758c] hover:text-[#42506b]"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
        <form action="/invoices/all" className="flex items-center gap-2">
          <input type="hidden" name="f" value={f} />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search invoice #, client…"
            className="w-[240px] rounded-[9px] border border-[#e3e8f0] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#2a6fdb]"
          />
        </form>
      </div>

      {/* table */}
      <div className="overflow-hidden rounded-2xl border border-[#e9edf3] bg-white">
        <div className="grid grid-cols-[110px_1.4fr_110px_110px_130px_130px_120px] gap-2 border-b border-[#eef1f6] bg-[#f8fafc] px-5 py-3 text-[10.5px] font-bold uppercase tracking-wide text-[#8a94a6]">
          <div>Invoice #</div>
          <div>Client</div>
          <div>Issued</div>
          <div>Due</div>
          <div className="text-right">Total</div>
          <div className="text-right">Balance due</div>
          <div className="text-right">Status</div>
        </div>
        {invoices.map((inv) => {
          const od = isOverdue(inv, now);
          return (
            <Link
              key={inv.id}
              href={`/invoices/${inv.id}`}
              className="grid grid-cols-[110px_1.4fr_110px_110px_130px_130px_120px] items-center gap-2 border-b border-[#f4f6fa] px-5 py-[13px] last:border-0 hover:bg-[#f6f8fb]"
            >
              <div className="text-[12.5px] font-extrabold text-[#2a6fdb]">{inv.invoice_no}</div>
              <div className="min-w-0">
                <div className="truncate text-[13px] font-bold text-[#16203a]">
                  {inv.bill_to_name || "—"}
                </div>
                {inv.bill_to_email && (
                  <div className="truncate text-[11px] font-medium text-[#a3acbd]">
                    {inv.bill_to_email}
                  </div>
                )}
              </div>
              <div className="tf-num text-[12px] font-semibold text-[#42506b]">
                {format(new Date(inv.issue_date + "T00:00:00"), "dd MMM yy")}
              </div>
              <div className={`tf-num text-[12px] font-semibold ${od ? "text-[#dc2626]" : "text-[#42506b]"}`}>
                {inv.due_date ? format(new Date(inv.due_date + "T00:00:00"), "dd MMM yy") : "—"}
                {od && (
                  <span className="block text-[10px] font-bold">{daysOverdue(inv, now)}d late</span>
                )}
              </div>
              <div className="tf-num text-right text-[13px] font-extrabold">{money(inv.total)}</div>
              <div className={`tf-num text-right text-[13px] font-extrabold ${balanceDue(inv) > 0 && OPEN_STATUSES.includes(inv.status) ? "text-[#16203a]" : "text-[#a3acbd]"}`}>
                {["void", "written_off"].includes(inv.status) ? "—" : money(balanceDue(inv))}
              </div>
              <div className="text-right">
                <InvoiceStatusBadge invoice={inv} />
              </div>
            </Link>
          );
        })}
        {invoices.length === 0 && (
          <div className="py-14 text-center text-[13px] font-semibold text-[#a3acbd]">
            No invoices match this view.
          </div>
        )}
      </div>
    </div>
  );
}
