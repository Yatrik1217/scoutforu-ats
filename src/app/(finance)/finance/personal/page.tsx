import Link from "next/link";
import { Wallet, ArrowUpRight, ArrowDownRight, Scale } from "lucide-react";
import { loadFinance } from "@/lib/finance-data";
import { monthPeriod, financialYearPeriod, categoryTotals, type Period } from "@/lib/finance";
import { moneyShort } from "@/lib/invoice";
import { StatCard, Card, CategoryBars } from "@/components/finance/pieces";
import { ExpenseModal } from "@/components/finance/expense-modal";
import { ExpenseLedger } from "@/components/finance/ledger";

type SP = { period?: string };

export default async function PersonalFinancePage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const isFY = sp.period === "fy";
  const period: Period = isFY ? financialYearPeriod() : monthPeriod();

  const { categories, expenses } = await loadFinance("personal", period);
  const totals = categoryTotals(expenses, categories);
  const net = totals.totalIncome - totals.totalExpense;

  return (
    <div className="animate-sc-fadein p-[24px_26px_40px]">
      <div className="mb-5 flex items-center gap-2">
        <PeriodTab active={!isFY} href="/finance/personal?period=month" label={monthPeriod().label} />
        <PeriodTab active={isFY} href="/finance/personal?period=fy" label={financialYearPeriod().label} />
        <div className="flex-1" />
        <ExpenseModal
          scope="personal"
          categories={categories}
          trigger={
            <button className="rounded-[9px] bg-[#16a34a] px-3.5 py-2 text-[12.5px] font-bold text-white hover:bg-[#128a3e]">
              + Add personal entry
            </button>
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Spend" value={moneyShort(totals.totalExpense)} sub={period.label} icon={ArrowDownRight} color="#ef4444" />
        <StatCard label="Income" value={moneyShort(totals.totalIncome)} sub={period.label} icon={ArrowUpRight} color="#16a34a" />
        <StatCard label="Net" value={moneyShort(net)} sub={net >= 0 ? "Saved" : "Overspent"} icon={Scale} color={net >= 0 ? "#16a34a" : "#ef4444"} />
        <StatCard label="Entries" value={String(expenses.length)} sub="This period" icon={Wallet} color="#8b5cf6" />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card title="Spend by category" className="lg:col-span-2">
          <CategoryBars rows={totals.expenses} total={totals.totalExpense} />
        </Card>
        <Card title="Transactions" className="lg:col-span-3">
          <ExpenseLedger expenses={expenses} categories={categories} />
        </Card>
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
