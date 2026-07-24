import Link from "next/link";
import { CircleDollarSign, TrendingUp, PiggyBank, Receipt } from "lucide-react";
import { loadFinance, loadCollectedRevenue } from "@/lib/finance-data";
import {
  monthPeriod,
  financialYearPeriod,
  computeProfitAndLoss,
  type Period,
} from "@/lib/finance";
import { moneyShort } from "@/lib/invoice";
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
  const period: Period = isFY ? financialYearPeriod() : monthPeriod();

  const [{ categories, expenses }, revenue] = await Promise.all([
    loadFinance("company", period),
    loadCollectedRevenue(period),
  ]);

  const pl = computeProfitAndLoss(expenses, categories, revenue);
  const totalExp = pl.operatingExpenses + pl.addBacks;

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
        <StatCard label="Revenue" value={moneyShort(pl.revenue)} sub="Collected" icon={CircleDollarSign} color="#2a6fdb" />
        <StatCard label="Total Expenses" value={moneyShort(totalExp)} sub={`${expenses.filter((e) => !e.is_income).length} entries`} icon={Receipt} color="#ef4444" />
        <StatCard label="EBITDA" value={moneyShort(pl.ebitda)} sub={pl.revenue > 0 ? `${pct(pl.ebitdaMargin)} margin` : "—"} icon={TrendingUp} color="#16a34a" />
        <StatCard label="Net Profit" value={moneyShort(pl.netProfit)} sub={pl.netProfit >= 0 ? "In profit" : "In loss"} icon={PiggyBank} color={pl.netProfit >= 0 ? "#16a34a" : "#ef4444"} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Profit & Loss statement">
          <div className="mb-1 text-[11.5px] font-semibold text-[#8a94a6]">{period.label}</div>
          <PLLine label="Revenue (collected)" value={pl.revenue} accent="#16a34a" />
          <PLLine label="Operating expenses" value={-pl.operatingExpenses} />
          <PLLine label="EBITDA" value={pl.ebitda} strong accent="#16a34a" hint={pl.revenue > 0 ? `${pct(pl.ebitdaMargin)} margin` : undefined} />
          <PLLine label="Interest, tax & depreciation" value={-pl.addBacks} />
          <PLLine label="Net Profit" value={pl.netProfit} strong accent={pl.netProfit >= 0 ? "#16a34a" : "#ef4444"} hint={pl.revenue > 0 ? `${pct(pl.netMargin)} margin` : undefined} />
        </Card>
        <Card title="Expenses by category">
          <CategoryBars rows={pl.byCategory} total={totalExp} />
        </Card>
      </div>

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
