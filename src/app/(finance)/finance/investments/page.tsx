import { format } from "date-fns";
import { TrendingUp, TrendingDown, PiggyBank, Wallet, CalendarClock } from "lucide-react";
import { loadFinance, loadNavs, type NavQuote } from "@/lib/finance-data";
import { liveInvestment, daysUntil } from "@/lib/finance";
import { money, moneyShort, round2 } from "@/lib/invoice";
import { StatCard, Card, pct as pctFmt } from "@/components/finance/pieces";
import { InvestmentModal } from "@/components/finance/investment-modal";
import { InvestmentActions } from "@/components/finance/investment-actions";
import { RefreshNavsButton } from "@/components/finance/refresh-navs-button";
import type { FinanceEmiRow } from "@/lib/database.types";

// DD-MM-YYYY (AMFI) → "24 Jul 26"
function navDateLabel(d: string): string {
  const [dd, mm, yyyy] = d.split("-");
  if (!yyyy) return d;
  return format(new Date(Number(yyyy), Number(mm) - 1, Number(dd)), "d MMM yy");
}

export default async function InvestmentsPage() {
  const { emis } = await loadFinance();
  const sips = emis.filter((e) => e.type === "sip");
  const navs = await loadNavs(sips.map((e) => e.scheme_code ?? "").filter(Boolean));

  // portfolio roll-up from live values (falls back to stored value per fund)
  let invested = 0;
  let value = 0;
  let dayChange = 0;
  let monthly = 0;
  let anyLive = false;
  let asOf = "";
  for (const e of sips) {
    const q = e.scheme_code ? navs.get(e.scheme_code) : undefined;
    const li = liveInvestment(e, q);
    invested += li.invested;
    value += li.value;
    dayChange += li.dayChange;
    if (e.status === "active") monthly += e.emi_amount || 0;
    if (li.live) anyLive = true;
    if (q && (!asOf || q.navDate > asOf)) asOf = q.navDate;
  }
  invested = round2(invested);
  value = round2(value);
  dayChange = round2(dayChange);
  const gain = round2(value - invested);
  const gainPct = invested > 0 ? gain / invested : 0;
  const prevValue = value - dayChange;
  const dayPct = prevValue > 0 ? dayChange / prevValue : 0;
  const up = gain >= 0;
  const dayUp = dayChange >= 0;

  return (
    <div className="animate-sc-fadein p-[24px_26px_40px]">
      <p className="mb-4 max-w-2xl text-[13px] font-medium leading-relaxed text-[#8a94a6]">
        Link each SIP to its fund to value it <b>live</b> — current value = units × latest NAV. Mutual-fund
        NAVs are declared once a day by AMFI, so &ldquo;today&rsquo;s change&rdquo; is the latest NAV vs the
        previous day. SIPs are assets (not a business expense), so they don&apos;t dent EBITDA.
      </p>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {anyLive && (
          <span className="rounded-full bg-[#eafaf0] px-2.5 py-1 text-[11px] font-bold text-[#16a34a]">
            Live · NAV as of {asOf ? navDateLabel(asOf) : "—"}
          </span>
        )}
        <RefreshNavsButton />
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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Invested" value={moneyShort(invested)} sub={`${sips.length} investments`} icon={Wallet} color="#8b5cf6" />
        <StatCard label="Current Value" value={moneyShort(value)} sub={anyLive ? "Live NAV" : "Manual"} icon={PiggyBank} color="#2a6fdb" />
        <StatCard
          label="Today's Change"
          value={`${dayUp ? "+" : "−"}${moneyShort(Math.abs(dayChange))}`}
          sub={prevValue > 0 ? `${dayUp ? "+" : "−"}${pctFmt(Math.abs(dayPct))} today` : "—"}
          icon={dayUp ? TrendingUp : TrendingDown}
          color={dayUp ? "#16a34a" : "#ef4444"}
        />
        <StatCard
          label="Total Gain / Loss"
          value={`${up ? "+" : "−"}${moneyShort(Math.abs(gain))}`}
          sub={invested > 0 ? `${up ? "+" : "−"}${pctFmt(Math.abs(gainPct))} return` : "—"}
          icon={up ? TrendingUp : TrendingDown}
          color={up ? "#16a34a" : "#ef4444"}
        />
        <StatCard label="Monthly SIP" value={moneyShort(monthly)} sub="Active contributions" icon={CalendarClock} color="#06b6d4" />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {sips.length === 0 && (
          <Card className="lg:col-span-2">
            <div className="py-10 text-center text-[13px] text-[#8a94a6]">
              No investments yet. Add your SIPs or mutual funds above, link the fund and enter your units to
              value them live.
            </div>
          </Card>
        )}
        {sips.map((e) => (
          <InvestmentCard key={e.id} emi={e} quote={e.scheme_code ? navs.get(e.scheme_code) : undefined} />
        ))}
      </div>
    </div>
  );
}

function InvestmentCard({ emi, quote }: { emi: FinanceEmiRow; quote?: NavQuote }) {
  const g = liveInvestment(emi, quote);
  const up = g.gain >= 0;
  const dayUp = g.dayChange >= 0;
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
            {g.live && (
              <span className="rounded-full bg-[#eafaf0] px-2 py-0.5 text-[10.5px] font-bold text-[#16a34a]">Live</span>
            )}
          </div>
          <div className="mt-0.5 text-[12px] font-semibold text-[#8a94a6]">
            {emi.lender || "—"} · {money(emi.emi_amount)}/mo
            {g.live && quote ? ` · NAV ₹${quote.nav.toFixed(2)}` : ""}
            {emi.units > 0 ? ` · ${emi.units} units` : ""}
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

      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
        <Mini label="Invested">{moneyShort(g.invested)}</Mini>
        <Mini label="Value">{moneyShort(g.value)}</Mini>
        <Mini label="Today">
          <span style={{ color: g.live ? (dayUp ? "#16a34a" : "#ef4444") : undefined }}>
            {g.live ? `${dayUp ? "+" : "−"}${moneyShort(Math.abs(g.dayChange))}` : "—"}
          </span>
        </Mini>
        <Mini label="Next SIP">
          {emi.status === "active" && emi.next_due_date ? (
            <>
              {format(new Date(emi.next_due_date + "T00:00:00"), "d MMM")}
              {d !== null && (
                <div className="text-[10px] font-bold text-[#8a94a6]">
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
          {emi.scheme_code ? "Live from AMFI" : "Link a fund for live NAV"}
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
