import Link from "next/link";
import { CircleDollarSign, TrendingUp, PiggyBank, Receipt } from "lucide-react";
import { loadFinance, loadPlacementRevenue, loadPlacementRevenueByMonth } from "@/lib/finance-data";
import {
  monthPeriod,
  financialYearPeriod,
  computeProfitAndLoss,
  monthsInRange,
  inPeriod,
  type Period,
} from "@/lib/finance";
import { money, moneyShort } from "@/lib/invoice";
import { StatCard, Card, CategoryBars, PLLine, pct } from "@/components/finance/pieces";
import { ExpenseModal } from "@/components/finance/expense-modal";
import { ExpenseLedger } from "@/components/finance/ledger";

type SP = { period?: string };

export default async function CompanyFinancePage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const isFY = sp.period !== "month";
  const fy = financialYearPeriod();
  const period: Period = isFY ? fy : monthPeriod();

  const [{ categories, expenses }, rev, fyBundle, revByMonth] = await Promise.all([
    loadFinance("company", period),
    loadPlacementRevenue(period),
    isFY ? Promise.resolve(null) : loadFinance("company", fy),
    loadPlacementRevenueByMonth(fy),
  ]);

  // Revenue = professional fees earned (ex-GST). TDS is advance tax, shown below
  // EBITDA; GST is a pass-through liability. EBITDA is unaffected by both.
  const pl = computeProfitAndLoss(expenses, categories, rev.grossFee);
  const totalExp = pl.operatingExpenses + pl.addBacks;
  const profitAfterTds = pl.netProfit; // TDS is a prepaid tax credit, not a P&L cost

  // Month-by-month P&L across FY 26-27, from April up to the current month.
  const fyExpenses = isFY ? expenses : fyBundle!.expenses;
  const todayMonthEnd = monthPeriod().to;
  const monthCap = todayMonthEnd < fy.to ? todayMonthEnd : fy.to;
  const monthRows = monthsInRange(fy.from, monthCap).map((mo) => {
    const mExp = fyExpenses.filter((e) => inPeriod(e.txn_date, mo));
    const mRev = revByMonth.get(mo.key) ?? { grossFee: 0, gst: 0, tds: 0, collected: 0 };
    const mpl = computeProfitAndLoss(mExp, categories, mRev.grossFee);
    return {
      label: mo.label,
      revenue: mpl.revenue,
      expenses: mpl.operatingExpenses + mpl.addBacks,
      ebitda: mpl.ebitda,
      net: mpl.netProfit,
      tds: mRev.tds,
    };
  });
  const fyTotals = monthRows.reduce(
    (a, r) => ({
      revenue: a.revenue + r.revenue,
      expenses: a.expenses + r.expenses,
      ebitda: a.ebitda + r.ebitda,
      net: a.net + r.net,
      tds: a.tds + r.tds,
    }),
    { revenue: 0, expenses: 0, ebitda: 0, net: 0, tds: 0 },
  );

  return (
    <div className="animate-sc-fadein p-[24px_26px_40px]">
      <div className="mb-5 flex items-center gap-2">
        <PeriodTab active={isFY} href="/finance/company?period=fy" label={financialYearPeriod().label} />
        <PeriodTab active={!isFY} href="/finance/company?period=month" label={monthPeriod().label} />
        <div className="flex-1" />
        <ExpenseModal
          scope="company"
          categories={categories}
          trigger={
            <button className="rounded-[9px] bg-[#16a34a] px-3.5 py-2 text-[12.5px] font-bold text-white hover:bg-[#128a3e]">
              + Add company entry
            </button>
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Revenue" value={moneyShort(pl.revenue)} sub="Fees earned, ex-GST" icon={CircleDollarSign} color="#2a6fdb" />
        <StatCard label="Total Expenses" value={moneyShort(totalExp)} sub={`${expenses.filter((e) => !e.is_income).length} entries`} icon={Receipt} color="#ef4444" />
        <StatCard label="EBITDA" value={moneyShort(pl.ebitda)} sub={pl.revenue > 0 ? `${pct(pl.ebitdaMargin)} margin` : "—"} icon={TrendingUp} color="#16a34a" />
        <StatCard label="Net Profit" value={moneyShort(pl.netProfit)} sub={pl.netProfit >= 0 ? "In profit" : "In loss"} icon={PiggyBank} color={pl.netProfit >= 0 ? "#16a34a" : "#ef4444"} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Profit & Loss statement">
          <div className="mb-1 text-[11.5px] font-semibold text-[#8a94a6]">{period.label}</div>
          <PLLine label="Revenue (fees, ex-GST)" value={pl.revenue} accent="#16a34a" />
          <PLLine label="Operating expenses" value={-pl.operatingExpenses} />
          <PLLine label="EBITDA" value={pl.ebitda} strong accent="#16a34a" hint={pl.revenue > 0 ? `${pct(pl.ebitdaMargin)} margin` : undefined} />
          <PLLine label="Interest, tax & depreciation" value={-pl.addBacks} />
          <PLLine label="Net Profit (before tax)" value={profitAfterTds} strong accent={profitAfterTds >= 0 ? "#16a34a" : "#ef4444"} hint={pl.revenue > 0 ? `${pct(pl.netMargin)} margin` : undefined} />
        </Card>

        {/* TDS & receipts — TDS is advance tax, deliberately outside EBITDA */}
        <Card title="Receipts & TDS" action={<Link href="/placements" className="text-[12px] font-bold text-[#2a6fdb]">Placements</Link>}>
          <div className="mb-1 text-[11.5px] font-semibold text-[#8a94a6]">{period.label} · from placement receipts</div>
          <PLLine label="Fees earned (ex-GST)" value={rev.grossFee} />
          <PLLine label="GST collected" value={rev.gst} hint="liability — remitted to govt" />
          <PLLine label="TDS deducted by clients" value={-rev.tds} accent="#b45309" hint="advance tax — you get credit" />
          <PLLine label="Cash actually received" value={rev.collected} strong accent="#2a6fdb" />
          <div className="mt-3 rounded-[10px] bg-[#fff7ed] p-3">
            <div className="text-[11px] font-bold uppercase tracking-wide text-[#b45309]">TDS credit for {period.label}</div>
            <div className="mt-0.5 text-[20px] font-extrabold tabular-nums text-[#92400e]">{money(rev.tds)}</div>
            <div className="text-[11px] font-medium text-[#b45309]">
              Claim this against ScoutforU&apos;s income-tax at year-end. It does <b>not</b> reduce EBITDA or profit.
            </div>
          </div>
        </Card>
      </div>

      <Card title="Expenses by category" className="mt-4">
        <CategoryBars rows={pl.byCategory} total={totalExp} />
      </Card>

      {/* Month-by-month across the financial year */}
      <Card title={`Month-by-month · ${fy.label}`} className="mt-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-[13px]">
            <thead>
              <tr className="border-b border-[#e9edf3] text-[11px] font-bold uppercase tracking-wide text-[#8a94a6]">
                <th className="py-2 text-left">Month</th>
                <th className="py-2 text-right">Revenue</th>
                <th className="py-2 text-right">Expenses</th>
                <th className="py-2 text-right">EBITDA</th>
                <th className="py-2 text-right">Net Profit</th>
                <th className="py-2 text-right">TDS</th>
              </tr>
            </thead>
            <tbody>
              {monthRows.map((r) => (
                <tr key={r.label} className="border-b border-[#f1f4f9]">
                  <td className="py-2 font-bold">{r.label}</td>
                  <td className="py-2 text-right tabular-nums">{money(r.revenue)}</td>
                  <td className="py-2 text-right tabular-nums text-[#ef4444]">{r.expenses > 0 ? `(${money(r.expenses)})` : money(0)}</td>
                  <td className="py-2 text-right tabular-nums">{money(r.ebitda)}</td>
                  <td className="py-2 text-right font-bold tabular-nums" style={{ color: r.net >= 0 ? "#16a34a" : "#ef4444" }}>
                    {r.net < 0 ? `(${money(Math.abs(r.net))})` : money(r.net)}
                  </td>
                  <td className="py-2 text-right tabular-nums text-[#b45309]">{money(r.tds)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-[#e9edf3] font-extrabold">
                <td className="py-2.5">FY total</td>
                <td className="py-2.5 text-right tabular-nums">{money(fyTotals.revenue)}</td>
                <td className="py-2.5 text-right tabular-nums text-[#ef4444]">({money(fyTotals.expenses)})</td>
                <td className="py-2.5 text-right tabular-nums">{money(fyTotals.ebitda)}</td>
                <td className="py-2.5 text-right tabular-nums" style={{ color: fyTotals.net >= 0 ? "#16a34a" : "#ef4444" }}>
                  {fyTotals.net < 0 ? `(${money(Math.abs(fyTotals.net))})` : money(fyTotals.net)}
                </td>
                <td className="py-2.5 text-right tabular-nums text-[#b45309]">{money(fyTotals.tds)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-2 text-[11.5px] font-medium text-[#8a94a6]">
          Revenue = fees earned (ex-GST) from placement receipts that month; expenses = company entries dated that month.
          EBITDA excludes interest/tax/depreciation; TDS is advance tax shown for reference (outside the P&L).
        </div>
      </Card>

      <Card title="Company ledger" className="mt-4">
        <ExpenseLedger expenses={expenses} categories={categories} />
      </Card>
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
