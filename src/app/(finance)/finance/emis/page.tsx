import { format } from "date-fns";
import { Landmark, CalendarClock, CheckCircle2, Wallet, ShieldCheck } from "lucide-react";
import { loadFinance } from "@/lib/finance-data";
import {
  emiOutstanding,
  emiRemainingCount,
  emiProgress,
  daysUntil,
} from "@/lib/finance";
import { money, moneyShort } from "@/lib/invoice";
import { Repeat } from "lucide-react";
import { StatCard, Card } from "@/components/finance/pieces";
import { EmiModal } from "@/components/finance/emi-modal";
import { EmiActions } from "@/components/finance/emi-actions";
import { PostDueButton } from "@/components/finance/post-due-button";
import type { FinanceEmiRow, FinanceCategoryRow } from "@/lib/database.types";

export default async function EmisPage() {
  const { categories, emis } = await loadFinance();

  const personalCats = categories.filter((c) => c.scope === "personal");
  const companyCats = categories.filter((c) => c.scope === "company");

  // SIPs live on the Investments page; here we only show money going OUT.
  const commitments = emis.filter((e) => e.type !== "sip");
  const loans = commitments.filter((e) => e.type === "loan");
  const insurance = commitments.filter((e) => e.type === "insurance");
  const bills = commitments.filter((e) => e.type === "bill");

  const active = commitments.filter((e) => e.status === "active");
  const monthlyOutgo = active.reduce((s, e) => s + e.emi_amount, 0);
  const totalOutstanding = loans.reduce((s, e) => s + emiOutstanding(e), 0);
  const dueThisMonth = active.filter((e) => {
    const d = daysUntil(e.next_due_date);
    return d !== null && d >= 0 && d <= 31;
  });
  const dueThisMonthTotal = dueThisMonth.reduce((s, e) => s + e.emi_amount, 0);

  return (
    <div className="animate-sc-fadein p-[24px_26px_40px]">
      <div className="mb-5 flex items-center gap-2">
        <div className="flex-1" />
        <PostDueButton />
        <EmiModal
          scope="company"
          categories={companyCats}
          trigger={
            <button className="rounded-[9px] border border-[#e3e8f0] bg-white px-3.5 py-2 text-[12.5px] font-bold text-[#42506b] hover:border-[#16a34a] hover:text-[#16a34a]">
              + Company
            </button>
          }
        />
        <EmiModal
          scope="personal"
          categories={personalCats}
          trigger={
            <button className="rounded-[9px] bg-[#16a34a] px-3.5 py-2 text-[12.5px] font-bold text-white hover:bg-[#128a3e]">
              + Personal
            </button>
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Monthly Outgo" value={moneyShort(monthlyOutgo)} sub={`${active.length} active`} icon={Wallet} color="#8b5cf6" />
        <StatCard label="Due This Month" value={moneyShort(dueThisMonthTotal)} sub={`${dueThisMonth.length} payments`} icon={CalendarClock} color="#b45309" />
        <StatCard label="Loan Outstanding" value={moneyShort(totalOutstanding)} sub={`${loans.length} loans`} icon={Landmark} color="#2a6fdb" />
        <StatCard label="Closed" value={String(commitments.filter((e) => e.status === "closed").length)} sub="Fully repaid" icon={CheckCircle2} color="#16a34a" />
      </div>

      {/* Loans */}
      <Section title="Loans & EMIs" icon={Landmark} count={loans.length} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {loans.length === 0 && (
          <Card className="lg:col-span-2">
            <div className="py-8 text-center text-[13px] text-[#8a94a6]">
              No loans yet. Add a home loan, car loan or any EMI with the <b>+ Personal / + Company</b> button.
            </div>
          </Card>
        )}
        {loans.map((e) => (
          <EmiCard key={e.id} emi={e} categories={e.scope === "company" ? companyCats : personalCats} />
        ))}
      </div>

      {/* Insurance */}
      <Section title="Insurance & Premiums" icon={ShieldCheck} count={insurance.length} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {insurance.length === 0 && (
          <Card className="lg:col-span-2">
            <div className="py-8 text-center text-[13px] text-[#8a94a6]">
              No premiums yet. Add term/health insurance via <b>+ Personal / + Company</b> → choose <b>Insurance</b>.
              These are recurring expenses (not loans), so paying one posts an expense.
            </div>
          </Card>
        )}
        {insurance.map((e) => (
          <EmiCard key={e.id} emi={e} categories={e.scope === "company" ? companyCats : personalCats} />
        ))}
      </div>

      {/* Recurring bills */}
      <Section title="Recurring bills" icon={Repeat} count={bills.length} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {bills.length === 0 && (
          <Card className="lg:col-span-2">
            <div className="py-8 text-center text-[13px] text-[#8a94a6]">
              No recurring bills yet. Add monthly costs like <b>office rent, software subscriptions or salaries</b> via
              <b> + Personal / + Company</b> → choose <b>Recurring bill</b>. Use <b>Post due payments</b> to auto-fill each month.
            </div>
          </Card>
        )}
        {bills.map((e) => (
          <EmiCard key={e.id} emi={e} categories={e.scope === "company" ? companyCats : personalCats} />
        ))}
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, count }: { title: string; icon: typeof Landmark; count: number }) {
  return (
    <div className="mb-3 mt-7 flex items-center gap-2">
      <Icon size={17} className="text-[#42506b]" />
      <h2 className="text-[15px] font-extrabold">{title}</h2>
      <span className="rounded-full bg-[#f1f4f9] px-2 py-0.5 text-[11px] font-bold text-[#8a94a6]">{count}</span>
    </div>
  );
}

function EmiCard({
  emi,
  categories,
}: {
  emi: FinanceEmiRow;
  categories: FinanceCategoryRow[];
}) {
  const remaining = emiRemainingCount(emi);
  const outstanding = emiOutstanding(emi);
  const progress = emiProgress(emi);
  const d = daysUntil(emi.next_due_date);
  const tracked = emi.total_installments > 0;
  const isInsurance = emi.type === "insurance";
  const isBill = emi.type === "bill";
  const openEnded = isInsurance || isBill; // no payoff / outstanding

  const statusMeta =
    emi.status === "closed"
      ? { label: "Closed", color: "#16a34a", bg: "#eafaf0" }
      : emi.status === "paused"
        ? { label: "Paused", color: "#8a94a6", bg: "#f1f4f9" }
        : { label: "Active", color: "#2a6fdb", bg: "#eef4fe" };

  return (
    <div className="rounded-[14px] border border-[#e9edf3] bg-white p-[18px_20px]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-[15px] font-extrabold">{emi.name}</span>
            <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: statusMeta.bg, color: statusMeta.color }}>
              {statusMeta.label}
            </span>
            <span className="rounded-full bg-[#f1f4f9] px-2 py-0.5 text-[10.5px] font-bold capitalize text-[#8a94a6]">
              {emi.scope}
            </span>
            {isInsurance && (
              <span className="rounded-full bg-[#fff7ed] px-2 py-0.5 text-[10.5px] font-bold text-[#b45309]">
                Premium · expense
              </span>
            )}
            {isBill && (
              <span className="rounded-full bg-[#f3effe] px-2 py-0.5 text-[10.5px] font-bold text-[#6d28d9]">
                Recurring · expense
              </span>
            )}
          </div>
          <div className="mt-0.5 text-[12px] font-semibold text-[#8a94a6]">
            {emi.lender || "—"}
            {!openEnded && emi.interest_rate > 0 && ` · ${emi.interest_rate}% p.a.`}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[18px] font-extrabold tabular-nums">{money(emi.emi_amount)}</div>
          <div className="text-[11px] font-semibold text-[#8a94a6]">per month</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Mini label="Next due">
          {emi.next_due_date ? (
            <>
              {format(new Date(emi.next_due_date + "T00:00:00"), "d MMM")}
              {d !== null && emi.status === "active" && (
                <div className={`text-[10.5px] font-bold ${d < 0 ? "text-[#dc2626]" : d <= 7 ? "text-[#b45309]" : "text-[#8a94a6]"}`}>
                  {d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? "today" : `in ${d}d`}
                </div>
              )}
            </>
          ) : (
            "—"
          )}
        </Mini>
        <Mini label={openEnded ? "Type" : "Remaining"}>
          {openEnded ? "Recurring" : tracked ? `${remaining} EMIs` : "—"}
        </Mini>
        <Mini label={isInsurance ? "Cover" : "Outstanding"}>
          {isInsurance ? (emi.principal > 0 ? moneyShort(emi.principal) : "—") : openEnded ? "—" : tracked ? moneyShort(outstanding) : "—"}
        </Mini>
      </div>

      {tracked && !openEnded && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[11px] font-bold text-[#8a94a6]">
            <span>
              {emi.paid_installments}/{emi.total_installments} paid
            </span>
            <span>{Math.round(progress * 100)}%</span>
          </div>
          <div className="h-[7px] overflow-hidden rounded-full bg-[#f1f4f9]">
            <div className="h-full rounded-full bg-[#16a34a]" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-[#f1f4f9] pt-3">
        <span className="text-[11.5px] font-medium text-[#9aa4b6]">
          {isInsurance ? "Premium" : isBill ? "Bill" : "Due"} on the {ordinal(emi.due_day)} each month
        </span>
        <EmiActions emi={emi} categories={categories} />
      </div>
    </div>
  );
}

function Mini({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[9px] bg-[#f6f8fb] p-2">
      <div className="text-[10px] font-bold uppercase tracking-wide text-[#9aa4b6]">{label}</div>
      <div className="mt-0.5 text-[12.5px] font-extrabold tabular-nums">{children}</div>
    </div>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
