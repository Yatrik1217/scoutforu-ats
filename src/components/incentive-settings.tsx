"use client";

import { useState, useTransition } from "react";
import { Save, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { updateIncentiveSettings, setRecruiterIncentive } from "@/lib/actions/incentives";
import { NumberInput } from "@/components/number-input";
import { Avatar } from "@/components/bits";
import { money } from "@/lib/invoice";
import type {
  IncentiveSettingsRow,
  IncentiveBasis,
  IncentiveMode,
  IncentiveSlab,
  QuarterTier,
  BonusTier,
} from "@/lib/database.types";

const field =
  "w-full rounded-[9px] border border-[#e3e8f0] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#2a6fdb]";

export function IncentiveSettingsForm({
  settings,
  recruiters,
}: {
  settings: IncentiveSettingsRow | null;
  recruiters: { id: string; name: string; email: string; incentive_percent: number | null }[];
}) {
  const [basis, setBasis] = useState<IncentiveBasis>(settings?.basis ?? "collected");
  const [mode, setMode] = useState<IncentiveMode>(settings?.mode ?? "flat");
  const [flatPercent, setFlatPercent] = useState<number>(settings?.flat_percent ?? 5);
  const [slabs, setSlabs] = useState<IncentiveSlab[]>(
    settings?.slabs?.length
      ? settings.slabs
      : [
          { upto: 500000, percent: 3 },
          { upto: 1000000, percent: 5 },
          { upto: null, percent: 8 },
        ],
  );
  const [qTiers, setQTiers] = useState<QuarterTier[]>(
    settings?.quarterly_tiers?.length
      ? settings.quarterly_tiers
      : [
          { from: 1, to: 2, per_closure: 2000, bonus: 0, bonus_at: null },
          { from: 3, to: 4, per_closure: 3000, bonus: 3000, bonus_at: 4 },
          { from: 5, to: null, per_closure: 4000, bonus: 6000, bonus_at: 6 },
        ],
  );
  const [hTiers, setHTiers] = useState<BonusTier[]>(
    settings?.halfyearly_tiers?.length
      ? settings.halfyearly_tiers
      : [
          { from: 5, to: 6, bonus: 5000 },
          { from: 7, to: 9, bonus: 10000 },
          { from: 10, to: null, bonus: 18000 },
        ],
  );
  const [aTiers, setATiers] = useState<BonusTier[]>(
    settings?.annual_tiers?.length
      ? settings.annual_tiers
      : [
          { from: 10, to: 13, bonus: 15000, reward: "" },
          { from: 14, to: 18, bonus: 30000, reward: "" },
          { from: 19, to: null, bonus: 50000, reward: "Domestic trip for 2" },
        ],
  );
  const [minTenure, setMinTenure] = useState(settings?.min_tenure_days ?? 30);
  const [requireCollected, setRequireCollected] = useState(settings?.require_collected ?? true);
  const [minTarget, setMinTarget] = useState(settings?.quarterly_min_target ?? 2);
  const [requireBoth, setRequireBoth] = useState(settings?.halfyearly_requires_both ?? true);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const res = await updateIncentiveSettings({
        basis,
        mode,
        flatPercent,
        slabs,
        quarterlyTiers: qTiers,
        halfyearlyTiers: hTiers,
        annualTiers: aTiers,
        minTenureDays: minTenure,
        requireCollected,
        quarterlyMinTarget: minTarget,
        halfyearlyRequiresBoth: requireBoth,
      });
      if (res.ok) toast.success(res.message || "Saved");
      else toast.error(res.error || "Failed");
    });

  return (
    <div className="space-y-[18px]">
      <div className="rounded-[12px] border border-[#e9edf3] bg-white p-5">
        <div className="text-[13px] font-extrabold text-[#16203a]">Pay incentive on</div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(
            [
              {
                key: "collected" as IncentiveBasis,
                title: "Money collected",
                desc: "Paid only once the client's payment actually lands. Protects cash flow.",
              },
              {
                key: "booked" as IncentiveBasis,
                title: "Fee booked",
                desc: "Paid as soon as the candidate joins, even if the invoice is unpaid.",
              },
            ]
          ).map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => setBasis(o.key)}
              className={`rounded-[10px] border p-3 text-left transition ${
                basis === o.key
                  ? "border-[#2a6fdb] bg-[#eef4fe]"
                  : "border-[#e6eaf1] hover:border-[#cbd7ea]"
              }`}
            >
              <div className="text-[12.5px] font-extrabold text-[#16203a]">{o.title}</div>
              <div className="mt-0.5 text-[11px] leading-snug text-[#8a94a6]">{o.desc}</div>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11.5px] text-[#8a94a6]">
          Incentive is always calculated on the <b>base fee</b> — excluding GST and before TDS.
        </p>
      </div>

      <div className="rounded-[12px] border border-[#e9edf3] bg-white p-5">
        <div className="mb-3 flex gap-1 rounded-[10px] bg-[#f1f4f9] p-1">
          {(["flat", "slab", "closure"] as IncentiveMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 rounded-[8px] px-2 py-1.5 text-[12px] font-bold transition ${
                mode === m ? "bg-white text-[#16203a] shadow-sm" : "text-[#8a94a6]"
              }`}
            >
              {m === "flat" ? "Flat %" : m === "slab" ? "Slab on value" : "Closure tiers"}
            </button>
          ))}
        </div>

        {mode === "closure" ? (
          <ClosureTierEditor
            qTiers={qTiers}
            setQTiers={setQTiers}
            hTiers={hTiers}
            setHTiers={setHTiers}
            aTiers={aTiers}
            setATiers={setATiers}
            minTenure={minTenure}
            setMinTenure={setMinTenure}
            requireCollected={requireCollected}
            setRequireCollected={setRequireCollected}
            minTarget={minTarget}
            setMinTarget={setMinTarget}
            requireBoth={requireBoth}
            setRequireBoth={setRequireBoth}
          />
        ) : mode === "flat" ? (
          <label className="block text-[12px] font-bold text-[#42506b]">
            Incentive %
            <NumberInput
              value={flatPercent}
              onChange={setFlatPercent}
              className={field + " mt-1 font-normal"}
              placeholder="5"
            />
            <span className="mt-1 block text-[11px] font-medium text-[#a3acbd]">
              Applies to everyone unless a recruiter has an override below.
            </span>
          </label>
        ) : (
          <div>
            <div className="mb-1 grid grid-cols-[1fr_110px_34px] gap-2 px-1 text-[10.5px] font-bold uppercase tracking-wide text-[#8a94a6]">
              <div>Period total up to (₹)</div>
              <div className="text-right">Rate %</div>
              <div />
            </div>
            {slabs.map((s, i) => (
              <div key={i} className="mb-2 grid grid-cols-[1fr_110px_34px] items-center gap-2">
                <NumberInput
                  value={s.upto ?? 0}
                  onChange={(n) =>
                    setSlabs((p) => p.map((x, j) => (j === i ? { ...x, upto: n || null } : x)))
                  }
                  className={field}
                  placeholder={i === slabs.length - 1 ? "Leave blank = and above" : "500000"}
                />
                <NumberInput
                  value={s.percent}
                  onChange={(n) =>
                    setSlabs((p) => p.map((x, j) => (j === i ? { ...x, percent: n } : x)))
                  }
                  className={field + " text-right"}
                />
                <button
                  onClick={() => setSlabs((p) => p.filter((_, j) => j !== i))}
                  disabled={slabs.length === 1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[#c2cad8] hover:bg-[#fef2f2] hover:text-[#dc2626] disabled:opacity-30"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button
              onClick={() => setSlabs((p) => [...p, { upto: null, percent: 0 }])}
              className="mt-1 flex items-center gap-1.5 rounded-[9px] bg-[#eef4fe] px-3 py-1.5 text-[12px] font-bold text-[#2a6fdb] hover:bg-[#e0ebfd]"
            >
              <Plus size={13} /> Add slab
            </button>
            <p className="mt-2 text-[11.5px] text-[#8a94a6]">
              The bracket the period total falls into sets the rate for the whole amount. Leave the
              last slab&apos;s limit blank so anything above it is covered.
            </p>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            onClick={save}
            disabled={pending}
            className="flex items-center gap-2 rounded-[9px] bg-[#2a6fdb] px-4 py-2 text-[13px] font-bold text-white hover:bg-[#245fc0] disabled:opacity-60"
          >
            <Save size={15} /> {pending ? "Saving…" : "Save scheme"}
          </button>
        </div>
      </div>

      <div className="rounded-[12px] border border-[#e9edf3] bg-white p-5">
        <div className="text-[13px] font-extrabold text-[#16203a]">Per-recruiter override</div>
        <p className="mb-3 mt-0.5 text-[11.5px] text-[#8a94a6]">
          Leave blank to use the firm scheme. Overrides apply to the flat percentage only.
        </p>
        {recruiters.map((r) => (
          <RecruiterRow key={r.id} recruiter={r} />
        ))}
        {recruiters.length === 0 && (
          <div className="py-4 text-center text-[12px] font-semibold text-[#a3acbd]">
            No recruiters yet.
          </div>
        )}
      </div>

      {mode !== "closure" && (
        <div className="rounded-[12px] bg-[#f8fafc] p-4 text-[12px] text-[#7a8696]">
          <b className="text-[#16203a]">Example:</b> a placement with a base fee of {money(129411)}{" "}
          at 5% earns {money(6470.55)} once{" "}
          {basis === "collected" ? "the client's payment is received" : "the candidate joins"}.
        </div>
      )}
    </div>
  );
}

// ---- closure-count tier editor -------------------------------------------------

const numCell =
  "w-full rounded-[8px] border border-[#e3e8f0] bg-white px-2 py-1.5 text-[12.5px] outline-none focus:border-[#2a6fdb]";

function ClosureTierEditor({
  qTiers,
  setQTiers,
  hTiers,
  setHTiers,
  aTiers,
  setATiers,
  minTenure,
  setMinTenure,
  requireCollected,
  setRequireCollected,
  minTarget,
  setMinTarget,
  requireBoth,
  setRequireBoth,
}: {
  qTiers: QuarterTier[];
  setQTiers: (f: (p: QuarterTier[]) => QuarterTier[]) => void;
  hTiers: BonusTier[];
  setHTiers: (f: (p: BonusTier[]) => BonusTier[]) => void;
  aTiers: BonusTier[];
  setATiers: (f: (p: BonusTier[]) => BonusTier[]) => void;
  minTenure: number;
  setMinTenure: (n: number) => void;
  requireCollected: boolean;
  setRequireCollected: (b: boolean) => void;
  minTarget: number;
  setMinTarget: (n: number) => void;
  requireBoth: boolean;
  setRequireBoth: (b: boolean) => void;
}) {
  const setQ = (i: number, patch: Partial<QuarterTier>) =>
    setQTiers((p) => p.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  return (
    <div className="space-y-5">
      <p className="rounded-[10px] bg-[#eef4fe] p-3 text-[11.5px] leading-relaxed text-[#42506b]">
        Targets are <b>per recruiter</b>, counted on the Indian financial year — Q1 Apr–Jun, Q2
        Jul–Sep, Q3 Oct–Dec, Q4 Jan–Mar.
      </p>

      {/* quarterly */}
      <div>
        <div className="mb-1.5 text-[12.5px] font-extrabold text-[#16203a]">Quarterly</div>
        <div className="mb-1 grid grid-cols-[54px_54px_1fr_1fr_60px_30px] gap-1.5 px-1 text-[10px] font-bold uppercase tracking-wide text-[#8a94a6]">
          <div>From</div>
          <div>To</div>
          <div>Per closure ₹</div>
          <div>Bonus ₹</div>
          <div>Bonus at</div>
          <div />
        </div>
        {qTiers.map((t, i) => (
          <div key={i} className="mb-1.5 grid grid-cols-[54px_54px_1fr_1fr_60px_30px] items-center gap-1.5">
            <NumberInput value={t.from} decimals={false} onChange={(n) => setQ(i, { from: n })} className={numCell} />
            <NumberInput
              value={t.to ?? 0}
              decimals={false}
              onChange={(n) => setQ(i, { to: n || null })}
              className={numCell}
              placeholder="∞"
            />
            <NumberInput value={t.per_closure} onChange={(n) => setQ(i, { per_closure: n })} className={numCell} />
            <NumberInput value={t.bonus} onChange={(n) => setQ(i, { bonus: n })} className={numCell} />
            <NumberInput
              value={t.bonus_at ?? 0}
              decimals={false}
              onChange={(n) => setQ(i, { bonus_at: n || null })}
              className={numCell}
              placeholder="—"
            />
            <button
              onClick={() => setQTiers((p) => p.filter((_, j) => j !== i))}
              disabled={qTiers.length === 1}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[#c2cad8] hover:text-[#dc2626] disabled:opacity-30"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        <button
          onClick={() =>
            setQTiers((p) => [...p, { from: 1, to: null, per_closure: 0, bonus: 0, bonus_at: null }])
          }
          className="mt-1 flex items-center gap-1.5 rounded-[9px] bg-[#eef4fe] px-3 py-1.5 text-[12px] font-bold text-[#2a6fdb] hover:bg-[#e0ebfd]"
        >
          <Plus size={13} /> Add tier
        </button>
        <p className="mt-1.5 text-[11px] text-[#8a94a6]">
          Leave the top tier&apos;s <b>To</b> blank for &ldquo;and above&rdquo;. <b>Bonus at</b> is
          the closure count that unlocks the extra bonus.
        </p>
      </div>

      <BonusTierTable
        title="Half-yearly (cumulative)"
        rows={hTiers}
        setRows={setHTiers}
        withReward={false}
      />
      <BonusTierTable title="Annual (financial year)" rows={aTiers} setRows={setATiers} withReward />

      {/* eligibility */}
      <div className="rounded-[10px] border border-[#eef1f6] p-4">
        <div className="mb-2 text-[12.5px] font-extrabold text-[#16203a]">
          When does a closure count?
        </div>
        <label className="flex items-center gap-2 text-[12px] font-bold text-[#42506b]">
          Candidate must complete
          <NumberInput
            value={minTenure}
            decimals={false}
            onChange={setMinTenure}
            className="w-[70px] rounded-[8px] border border-[#e3e8f0] px-2 py-1 text-[12px] font-normal outline-none focus:border-[#2a6fdb]"
          />
          days
        </label>
        <label className="mt-2 flex items-center gap-2 text-[12px] font-bold text-[#42506b]">
          <input
            type="checkbox"
            checked={requireCollected}
            onChange={(e) => setRequireCollected(e.target.checked)}
            className="h-4 w-4 accent-[#2a6fdb]"
          />
          Client&apos;s invoice must be fully settled
        </label>
        <label className="mt-2 flex flex-wrap items-center gap-2 text-[12px] font-bold text-[#42506b]">
          <input
            type="checkbox"
            checked={requireBoth}
            onChange={(e) => setRequireBoth(e.target.checked)}
            className="h-4 w-4 accent-[#2a6fdb]"
          />
          Half-yearly bonus needs at least
          <NumberInput
            value={minTarget}
            decimals={false}
            onChange={setMinTarget}
            className="w-[56px] rounded-[8px] border border-[#e3e8f0] px-2 py-1 text-[12px] font-normal outline-none focus:border-[#2a6fdb]"
          />
          closures in <span className="font-normal">each</span> quarter
        </label>
      </div>
    </div>
  );
}

function BonusTierTable({
  title,
  rows,
  setRows,
  withReward,
}: {
  title: string;
  rows: BonusTier[];
  setRows: (f: (p: BonusTier[]) => BonusTier[]) => void;
  withReward: boolean;
}) {
  const set = (i: number, patch: Partial<BonusTier>) =>
    setRows((p) => p.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  const cols = withReward
    ? "grid-cols-[54px_54px_1fr_1.3fr_30px]"
    : "grid-cols-[54px_54px_1fr_30px]";

  return (
    <div>
      <div className="mb-1.5 text-[12.5px] font-extrabold text-[#16203a]">{title}</div>
      <div className={`mb-1 grid ${cols} gap-1.5 px-1 text-[10px] font-bold uppercase tracking-wide text-[#8a94a6]`}>
        <div>From</div>
        <div>To</div>
        <div>Bonus ₹</div>
        {withReward && <div>Extra reward</div>}
        <div />
      </div>
      {rows.map((t, i) => (
        <div key={i} className={`mb-1.5 grid ${cols} items-center gap-1.5`}>
          <NumberInput value={t.from} decimals={false} onChange={(n) => set(i, { from: n })} className={numCell} />
          <NumberInput
            value={t.to ?? 0}
            decimals={false}
            onChange={(n) => set(i, { to: n || null })}
            className={numCell}
            placeholder="∞"
          />
          <NumberInput value={t.bonus} onChange={(n) => set(i, { bonus: n })} className={numCell} />
          {withReward && (
            <input
              value={t.reward ?? ""}
              onChange={(e) => set(i, { reward: e.target.value })}
              placeholder="e.g. Domestic trip for 2"
              className={numCell}
            />
          )}
          <button
            onClick={() => setRows((p) => p.filter((_, j) => j !== i))}
            disabled={rows.length === 1}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#c2cad8] hover:text-[#dc2626] disabled:opacity-30"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <button
        onClick={() => setRows((p) => [...p, { from: 1, to: null, bonus: 0, reward: "" }])}
        className="mt-1 flex items-center gap-1.5 rounded-[9px] bg-[#eef4fe] px-3 py-1.5 text-[12px] font-bold text-[#2a6fdb] hover:bg-[#e0ebfd]"
      >
        <Plus size={13} /> Add tier
      </button>
    </div>
  );
}

function RecruiterRow({
  recruiter,
}: {
  recruiter: { id: string; name: string; email: string; incentive_percent: number | null };
}) {
  const [value, setValue] = useState<string>(
    recruiter.incentive_percent == null ? "" : String(recruiter.incentive_percent),
  );
  const [pending, start] = useTransition();

  const commit = () =>
    start(async () => {
      const trimmed = value.trim();
      const res = await setRecruiterIncentive(
        recruiter.id,
        trimmed === "" ? null : parseFloat(trimmed),
      );
      if (res.ok) toast.success(`${recruiter.name}: ${res.message}`);
      else toast.error(res.error || "Failed");
    });

  return (
    <div className="flex items-center gap-3 border-b border-[#f4f6fa] py-2.5 last:border-0">
      <Avatar name={recruiter.name} size={32} />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-bold text-[#16203a]">{recruiter.name}</div>
        <div className="truncate text-[11px] text-[#9aa4b6]">{recruiter.email}</div>
      </div>
      <input
        inputMode="decimal"
        value={value}
        disabled={pending}
        onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ""))}
        onBlur={commit}
        placeholder="Default"
        className="w-[92px] rounded-[9px] border border-[#e3e8f0] px-3 py-1.5 text-right text-[13px] outline-none focus:border-[#2a6fdb]"
      />
      <span className="text-[12px] font-bold text-[#8a94a6]">%</span>
    </div>
  );
}
