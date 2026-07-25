import { format } from "date-fns";
import { TrendingUp, TrendingDown, PiggyBank, Wallet, CalendarClock } from "lucide-react";
import { loadFinance } from "@/lib/finance-data";
import { investmentGain, portfolioSummary, daysUntil } from "@/lib/finance";
import { money, moneyShort } from "@/lib/invoice";
import { StatCard, Card, pct as pctFmt } from "@/components/finance/pieces";
import { InvestmentModal } from "@/components/finance/investment-modal";
import { InvestmentActions } from "@/components/finance/investment-actions";
import type { FinanceEmiRow } from "@/lib/database.types";

export default async function InvestmentsPage() {
  const { emis } = await loadFinance();
  const sips = emis.filter((e) => e.type === "sip");
  const p = portfolioSummary(sips);
  const up = p.gain >= 0;

  return (
    <div className="animate-sc-fadein p-[24px_26px_40px]">
      <p className="mb-4 max-w-2xl text-[13px] font-medium leading-relaxed text-[#8a94a6]">
        SIPs and recurring investments are tracked here as <b>assets</b> — update the current value
        anytime to see your gain/loss. They also appear under <b>Upcoming payments</b> on the dashboard
        (the cash does leave your account), but they&apos;re not counted as a business expense, so they
        don&apos;t dent your EBITDA.
      </p>

      <div className="mb-5 flex items-center gap-2">
        <div className="flex-1" />
        <InvestmentModal
          scope="company"
          trigger={
            <button className="rounded-[9px] border border-[#e3e8f0] bg-white px-3.5 py-2 text-[12.5px] font-bold text-[#42506b] hover:border-[#16a34a] hover:text-[#16a34a]">
              + Company investment
            </button>
          }
        />
        <InvestmentModal
          scope="personal"
          trigger={
            <button className="rounded-[9px] bg-[#16a34a] px-3.5 py-2 text-[12.5px] font-bold text-white hover:bg-[#128a3e]">
              + Personal SIP
            </button>
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Invested" value={moneyShort(p.invested)} sub={`${sips.length} investments`} icon={Wallet} color="#8b5cf6" />
        <StatCard label="Current Value" value={moneyShort(p.value)} sub="Latest you entered" icon={PiggyBank} color="#2a6fdb" />
        <StatCard
          label="Total Gain / Loss"
          value={`${p.gain >= 0 ? "+" : "−"}${moneyShort(Math.abs(p.gain))}`}
          sub={p.invested > 0 ? `${up ? "+" : "−"}${pctFmt(Math.abs(p.pct))} return` : "—"}
          icon={up ? TrendingUp : TrendingDown}
          color={up ? "#16a34a" : "#ef4444"}
        />
        <StatCard label="Monthly SIP" value={moneyShort(p.monthly)} sub="Active contributions" icon={CalendarClock} color="#06b6d4" />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {sips.length === 0 && (
          <Card className="lg:col-span-2">
            <div className="py-10 text-center text-[13px] text-[#8a94a6]">
              No investments yet. Add your SIPs, recurring deposits or mutual funds above — they&apos;ll be
              tracked as assets, kept out of your expense totals.
            </div>
          </Card>
        )}
        {sips.map((e) => (
          <InvestmentCard key={e.id} emi={e} />
        ))}
      </div>
    </div>
  );
}

function InvestmentCard({ emi }: { emi: FinanceEmiRow }) {
  const g = investmentGain(emi);
  const up = g.gain >= 0;
  const d = daysUntil(emi.next_due_date);

  const statusMeta =
    emi.status === "closed"
      ? { label: "Redeemed", color: "#16a34a", bg: "#eafaf0" }
      : emi.status === "paused"
        ? { label: "Paused", color: "#8a94a6", bg: "#f1f4f9" }
        : { label: "Active", color: "#2a6fdb", bg: "#eef4fe" };

  return (
    <div className="rounded-[14px] border border-[#e9edf3] bg-white p-[18px_20px]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-extrabold">{emi.name}</span>
            <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: statusMeta.bg, color: statusMeta.color }}>
              {statusMeta.label}
            </span>
            <span className="rounded-full bg-[#f1f4f9] px-2 py-0.5 text-[10.5px] font-bold capitalize text-[#8a94a6]">
              {emi.scope}
            </span>
          </div>
          <div className="mt-0.5 text-[12px] font-semibold text-[#8a94a6]">
            {emi.lender || "—"} · {money(emi.emi_amount)}/mo · {emi.paid_installments} done
          </div>
        </div>
        <div className="text-right">
          <div className={`text-[18px] font-extrabold tabular-nums ${up ? "text-[#16a34a]" : "text-[#ef4444]"}`}>
            {up ? "+" : "−"}
            {money(Math.abs(g.gain))}
          </div>
          <div className="text-[11px] font-semibold text-[#8a94a6]">
            {g.invested > 0 ? `${up ? "+" : "−"}${(Math.abs(g.pct) * 100).toFixed(1)}%` : "—"}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Mini label="Invested">{moneyShort(g.invested)}</Mini>
        <Mini label="Current value">{moneyShort(g.value)}</Mini>
        <Mini label="Next SIP">
          {emi.status === "active" && emi.next_due_date ? (
            <>
              {format(new Date(emi.next_due_date + "T00:00:00"), "d MMM")}
              {d !== null && (
                <div className="text-[10.5px] font-bold text-[#8a94a6]">
                  {d < 0 ? `${Math.abs(d)}d ago` : d === 0 ? "today" : `in ${d}d`}
                </div>
              )}
            </>
          ) : (
            "—"
          )}
        </Mini>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-[#f1f4f9] pt-3">
        <span className="text-[11.5px] font-medium text-[#9aa4b6]">
          {emi.status === "active" ? `SIP on the ${ordinal(emi.due_day)} each month` : "Not contributing"}
        </span>
        <InvestmentActions emi={emi} />
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
