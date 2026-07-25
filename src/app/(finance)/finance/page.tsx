import Link from "next/link";
import { format } from "date-fns";
import {
  CircleDollarSign,
  TrendingUp,
  Wallet,
  PiggyBank,
  CalendarClock,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { loadFinance, loadCollectedRevenue } from "@/lib/finance-data";
import {
  monthPeriod,
  financialYearPeriod,
  computeProfitAndLoss,
  categoryTotals,
  commitmentsDueBetween,
  monthlySipOutflow,
  nextDueOnOrAfter,
  portfolioSummary,
  daysUntil,
  COMMITMENT_LABEL,
  COMMITMENT_COLOR,
  type Period,
} from "@/lib/finance";
import { money, moneyShort } from "@/lib/invoice";
import { StatCard, Card, CategoryBars, PLLine, pct } from "@/components/finance/pieces";
import { ExpenseModal } from "@/components/finance/expense-modal";

type SP = { period?: string };

export default async function FinanceDashboard({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const isFY = sp.period !== "month";
  const period: Period = isFY ? financialYearPeriod() : monthPeriod();

  const [{ categories, expenses, emis }, revenue] = await Promise.all([
    loadFinance(undefined, period),
    loadCollectedRevenue(period),
  ]);

  const companyCats = categories.filter((c) => c.scope === "company");
  const personalCats = categories.filter((c) => c.scope === "personal");
  const companyExp = expenses.filter((e) => e.scope === "company");
  const personalExp = expenses.filter((e) => e.scope === "personal");

  const pl = computeProfitAndLoss(companyExp, companyCats, revenue);
  const personal = categoryTotals(personalExp, personalCats);
  const portfolio = portfolioSummary(emis);

  // "What do I need to pay?" — all active commitments (EMIs, premiums AND SIPs,
  // since that cash leaves the account too) due in the next 60 days, with the
  // subtotal payable by the upcoming 10th of the month called out.
  const todayISO = new Date().toISOString().slice(0, 10);
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 60);
  const horizonISO = horizon.toISOString().slice(0, 10);
  const cutoff10 = nextDueOnOrAfter(todayISO, 10);
  const dues = commitmentsDueBetween(emis, todayISO, horizonISO);
  const dueBy10 = dues.filter((e) => (e.next_due_date ?? "") <= cutoff10);
  const dueBy10Total = dueBy10.reduce((s, e) => s + e.emi_amount, 0);
  const duesTotal = dues.reduce((s, e) => s + e.emi_amount, 0);
  const sipMonthly = monthlySipOutflow(emis);

  const recent = expenses.slice(0, 8);

  return (
    <div className="animate-sc-fadein p-[24px_26px_40px]">
      {/* period toggle */}
      <div className="mb-5 flex items-center gap-2">
        <PeriodTab active={isFY} href="/finance?period=fy" label={financialYearPeriod().label} />
        <PeriodTab active={!isFY} href="/finance?period=month" label={monthPeriod().label} />
        <div className="flex-1" />
        <ExpenseModal
          scope="company"
          categories={companyCats}
          trigger={
            <button className="rounded-[9px] border border-[#e3e8f0] bg-white px-3.5 py-2 text-[12.5px] font-bold text-[#42506b] hover:border-[#16a34a] hover:text-[#16a34a]">
              + Company expense
            </button>
          }
        />
        <ExpenseModal
          scope="personal"
          categories={personalCats}
          trigger={
            <button className="rounded-[9px] bg-[#16a34a] px-3.5 py-2 text-[12.5px] font-bold text-white hover:bg-[#128a3e]">
              + Personal expense
            </button>
          }
        />
      </div>

      {/* headline KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="ScoutforU Revenue"
          value={moneyShort(pl.revenue)}
          sub="Collected from placements"
          icon={CircleDollarSign}
          color="#2a6fdb"
          href="/finance/company"
        />
        <StatCard
          label="EBITDA"
          value={moneyShort(pl.ebitda)}
          sub={`Margin ${pl.revenue > 0 ? pct(pl.ebitdaMargin) : "—"}`}
          icon={TrendingUp}
          color="#16a34a"
          href="/finance/company"
        />
        <StatCard
          label="Net Profit"
          value={moneyShort(pl.netProfit)}
          sub={pl.netProfit >= 0 ? "In profit" : "In loss"}
          icon={PiggyBank}
          color={pl.netProfit >= 0 ? "#16a34a" : "#ef4444"}
          href="/finance/company"
        />
        <StatCard
          label="Personal Spend"
          value={moneyShort(personal.totalExpense)}
          sub={`${personalExp.length} entries`}
          icon={Wallet}
          color="#8b5cf6"
          href="/finance/personal"
        />
      </div>

      {/* Investments strip — assets, tracked apart from expenses */}
      {(portfolio.invested > 0 || portfolio.value > 0) && (
        <Link
          href="/finance/investments"
          className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-[14px] border border-[#e9edf3] bg-white p-[16px_20px] transition hover:border-[#d6deea]"
        >
          <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-[#16a34a]">
            <TrendingUp size={16} /> Investments
          </div>
          <StripStat label="Invested" value={moneyShort(portfolio.invested)} />
          <StripStat label="Current value" value={moneyShort(portfolio.value)} />
          <StripStat
            label="Gain / loss"
            value={`${portfolio.gain >= 0 ? "+" : "−"}${moneyShort(Math.abs(portfolio.gain))}`}
            accent={portfolio.gain >= 0 ? "#16a34a" : "#ef4444"}
            sub={portfolio.invested > 0 ? `${portfolio.gain >= 0 ? "+" : "−"}${pct(Math.abs(portfolio.pct))}` : undefined}
          />
          <StripStat label="Monthly SIP" value={moneyShort(portfolio.monthly)} />
          <span className="ml-auto text-[12px] font-bold text-[#2a6fdb]">View all →</span>
        </Link>
      )}

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Company P&L */}
        <Card title="ScoutforU — Profit & Loss" className="lg:col-span-2">
          <div className="mb-1 text-[11.5px] font-semibold text-[#8a94a6]">
            {period.label}
          </div>
          <PLLine label="Revenue (collected)" value={pl.revenue} accent="#16a34a" />
          <PLLine label="Operating expenses" value={-pl.operatingExpenses} />
          <PLLine label="EBITDA" value={pl.ebitda} strong accent="#16a34a" hint={pl.revenue > 0 ? `${pct(pl.ebitdaMargin)} margin` : undefined} />
          <PLLine label="Interest, tax & depreciation" value={-pl.addBacks} />
          <PLLine
            label="Net Profit"
            value={pl.netProfit}
            strong
            accent={pl.netProfit >= 0 ? "#16a34a" : "#ef4444"}
            hint={pl.revenue > 0 ? `${pct(pl.netMargin)} margin` : undefined}
          />
          <div className="mt-3 rounded-[10px] bg-[#f6f8fb] p-3 text-[11.5px] font-medium leading-relaxed text-[#8a94a6]">
            Revenue is pulled automatically from ScoutforU placement receipts in {period.label}.
            EBITDA excludes interest, taxes and depreciation — mark those categories as
            &ldquo;below EBITDA&rdquo; so the split stays correct.
          </div>
        </Card>

        {/* Upcoming payments — what leaves the account, incl. SIPs */}
        <Card
          title="Upcoming payments"
          action={<Link href="/finance/emis" className="text-[12px] font-bold text-[#2a6fdb]">Manage</Link>}
        >
          <div className="mb-3 rounded-[10px] bg-[#fef3e2] p-3">
            <div className="text-[11px] font-bold uppercase tracking-wide text-[#b45309]">
              Due by {format(new Date(cutoff10 + "T00:00:00"), "d MMM")}
            </div>
            <div className="mt-0.5 text-[20px] font-extrabold tabular-nums text-[#92400e]">
              {money(dueBy10Total)}
            </div>
            <div className="text-[11px] font-semibold text-[#b45309]">
              {dueBy10.length} payment{dueBy10.length === 1 ? "" : "s"}
              {sipMonthly > 0 && ` · incl. SIP`}
            </div>
          </div>
          {dues.length === 0 ? (
            <div className="py-4 text-center text-[13px] text-[#8a94a6]">Nothing due in the next 60 days.</div>
          ) : (
            <>
              <div className="flex flex-col divide-y divide-[#f1f4f9]">
                {dues.slice(0, 7).map((e) => {
                  const d = daysUntil(e.next_due_date);
                  return (
                    <div key={e.id} className="flex items-center gap-3 py-2.5">
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-[9px]"
                        style={{ background: `${COMMITMENT_COLOR[e.type]}18`, color: COMMITMENT_COLOR[e.type] }}
                      >
                        <CalendarClock size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-bold">
                          {e.name}
                          <span
                            className="ml-1.5 rounded-full px-1.5 py-px text-[9.5px] font-bold align-middle"
                            style={{ background: `${COMMITMENT_COLOR[e.type]}18`, color: COMMITMENT_COLOR[e.type] }}
                          >
                            {COMMITMENT_LABEL[e.type]}
                          </span>
                        </div>
                        <div className="text-[11.5px] font-semibold text-[#8a94a6]">
                          {e.next_due_date ? format(new Date(e.next_due_date + "T00:00:00"), "d MMM") : "—"}
                          {d !== null && (
                            <span className={d < 0 ? "text-[#dc2626]" : d <= 7 ? "text-[#b45309]" : ""}>
                              {" · "}
                              {d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? "today" : `in ${d}d`}
                            </span>
                          )}
                          <span className="ml-1 capitalize">· {e.scope}</span>
                        </div>
                      </div>
                      <div className="text-[13px] font-bold tabular-nums">{moneyShort(e.emi_amount)}</div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-[#e9edf3] pt-3 text-[12.5px]">
                <span className="font-semibold text-[#8a94a6]">Total next 60 days</span>
                <span className="font-extrabold tabular-nums">{money(duesTotal)}</span>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* breakdowns */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Company expenses by category">
          <CategoryBars rows={pl.byCategory} total={pl.operatingExpenses + pl.addBacks} />
        </Card>
        <Card title="Personal spend by category">
          <CategoryBars rows={personal.expenses} total={personal.totalExpense} />
        </Card>
      </div>

      {/* recent */}
      <Card title="Recent activity" className="mt-4">
        {recent.length === 0 ? (
          <div className="py-6 text-center text-[13px] text-[#8a94a6]">
            No entries in {period.label} yet — add your first expense above.
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-[#f1f4f9]">
            {recent.map((r) => {
              const cat = categories.find((c) => c.id === r.category_id);
              return (
                <div key={r.id} className="flex items-center gap-3 py-2.5">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                    style={{ background: r.is_income ? "#eafaf0" : "#fef2f2", color: r.is_income ? "#16a34a" : "#dc2626" }}
                  >
                    {r.is_income ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-bold">{r.title}</div>
                    <div className="text-[11.5px] font-semibold text-[#8a94a6]">
                      {format(new Date(r.txn_date + "T00:00:00"), "d MMM")} · {cat?.name ?? "Uncategorised"}
                      <span className="ml-1 capitalize">· {r.scope}</span>
                    </div>
                  </div>
                  <div
                    className="text-[13.5px] font-extrabold tabular-nums"
                    style={{ color: r.is_income ? "#16a34a" : "#0e1320" }}
                  >
                    {r.is_income ? "+" : "−"}
                    {money(r.amount)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function StripStat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div>
      <div className="text-[10.5px] font-bold uppercase tracking-wide text-[#9aa4b6]">{label}</div>
      <div className="text-[17px] font-extrabold tabular-nums" style={accent ? { color: accent } : undefined}>
        {value}
        {sub && <span className="ml-1 text-[12px] font-bold">{sub}</span>}
      </div>
    </div>
  );
}

function PeriodTab({ active, href, label }: { active: boolean; href: string; label: string }) {
  return (
    <Link
      href={href}
      className={`rounded-[9px] px-3.5 py-2 text-[12.5px] font-bold transition ${
        active ? "bg-[#0e1320] text-white" : "border border-[#e3e8f0] bg-white text-[#42506b] hover:border-[#cdd6e4]"
      }`}
    >
      {label}
    </Link>
  );
}
