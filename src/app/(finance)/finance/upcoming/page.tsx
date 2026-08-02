import Link from "next/link";
import { format } from "date-fns";
import { CalendarClock, Wallet, CalendarCheck } from "lucide-react";
import { loadFinance } from "@/lib/finance-data";
import { buildDueItems, nextDueOnOrAfter, daysUntil } from "@/lib/finance";
import { money, moneyShort } from "@/lib/invoice";
import { StatCard } from "@/components/finance/pieces";
import { PostDueButton } from "@/components/finance/post-due-button";
import { PayDueButton } from "@/components/finance/pay-due-button";

// Full list of everything due in the next 30 days, from ALL sources in one
// place — loans, insurance, recurring bills, SIPs and future-dated one-off
// bills. (The dashboard card shows only the first few; this shows them all.)
export default async function UpcomingPage() {
  const todayISO = new Date().toISOString().slice(0, 10);
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 30);
  const horizonISO = horizon.toISOString().slice(0, 10);

  const { categories, emis, expenses } = await loadFinance(undefined, {
    from: todayISO,
    to: horizonISO,
    label: "",
  });

  const items = buildDueItems(emis, expenses, categories, todayISO, horizonISO);
  const cutoff10 = nextDueOnOrAfter(todayISO, 10);
  const byCutoff = items.filter((i) => i.date <= cutoff10);
  const byCutoffTotal = byCutoff.reduce((s, i) => s + i.amount, 0);
  const total = items.reduce((s, i) => s + i.amount, 0);
  const companyTotal = items.filter((i) => i.scope === "company").reduce((s, i) => s + i.amount, 0);
  const personalTotal = items.filter((i) => i.scope === "personal").reduce((s, i) => s + i.amount, 0);

  return (
    <div className="animate-sc-fadein p-[24px_26px_40px]">
      <div className="mb-5 flex items-center gap-2">
        <p className="max-w-xl text-[13px] font-medium leading-relaxed text-[#8a94a6]">
          Everything leaving your account in the next 30 days — loans, insurance, recurring bills,
          SIPs and one-off bills, together.
        </p>
        <div className="flex-1" />
        <PostDueButton />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={`Due by ${format(new Date(cutoff10 + "T00:00:00"), "d MMM")}`} value={moneyShort(byCutoffTotal)} sub={`${byCutoff.length} payments`} icon={CalendarCheck} color="#b45309" />
        <StatCard label="Total 30 days" value={moneyShort(total)} sub={`${items.length} payments`} icon={CalendarClock} color="#2a6fdb" />
        <StatCard label="Company" value={moneyShort(companyTotal)} sub="next 30 days" icon={Wallet} color="#8b5cf6" />
        <StatCard label="Personal" value={moneyShort(personalTotal)} sub="next 30 days" icon={Wallet} color="#16a34a" />
      </div>

      <div className="mt-5 rounded-[14px] border border-[#e9edf3] bg-white">
        {items.length === 0 ? (
          <div className="py-12 text-center text-[13px] text-[#8a94a6]">Nothing due in the next 30 days.</div>
        ) : (
          <div className="flex flex-col divide-y divide-[#f1f4f9]">
            {items.map((it) => {
              const d = daysUntil(it.date);
              const byThe10 = it.date <= cutoff10;
              return (
                <div key={it.id} className="flex items-center gap-3 p-[13px_18px]">
                  <span className="flex h-9 w-9 items-center justify-center rounded-[9px]" style={{ background: `${it.color}18`, color: it.color }}>
                    <CalendarClock size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 truncate text-[13.5px] font-bold">
                      {it.label}
                      <span className="rounded-full px-1.5 py-px text-[9.5px] font-bold" style={{ background: `${it.color}18`, color: it.color }}>
                        {it.tag}
                      </span>
                    </div>
                    <div className="text-[11.5px] font-semibold text-[#8a94a6]">
                      {format(new Date(it.date + "T00:00:00"), "d MMM")}
                      {d !== null && (
                        <span className={d < 0 ? "text-[#dc2626]" : d <= 7 ? "text-[#b45309]" : ""}>
                          {" · "}
                          {d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? "today" : `in ${d}d`}
                        </span>
                      )}
                      <span className="ml-1 capitalize">· {it.scope}</span>
                      {byThe10 && <span className="ml-1 font-bold text-[#b45309]">· by the 10th</span>}
                    </div>
                  </div>
                  <div className="text-[14px] font-extrabold tabular-nums">{money(it.amount)}</div>
                  {(it.emiId || it.expenseId) && (
                    <PayDueButton emiId={it.emiId} expenseId={it.expenseId} paidOn={it.date} />
                  )}
                </div>
              );
            })}
            <div className="flex items-center justify-between p-[15px_18px] font-extrabold">
              <span>Total · next 30 days</span>
              <span className="tabular-nums">{money(total)}</span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 text-[12px] font-medium text-[#8a94a6]">
        Manage each item where it lives: <Link href="/finance/emis" className="font-bold text-[#2a6fdb]">EMIs &amp; Loans</Link> (loans,
        insurance, recurring bills), <Link href="/finance/investments" className="font-bold text-[#2a6fdb]">Investments</Link> (SIPs),
        or add a one-off bill from the dashboard.
      </div>
    </div>
  );
}
