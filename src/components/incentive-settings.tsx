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
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const res = await updateIncentiveSettings({ basis, mode, flatPercent, slabs });
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
          {(["flat", "slab"] as IncentiveMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 rounded-[8px] px-2 py-1.5 text-[12px] font-bold transition ${
                mode === m ? "bg-white text-[#16203a] shadow-sm" : "text-[#8a94a6]"
              }`}
            >
              {m === "flat" ? "Flat percentage" : "Slab-based"}
            </button>
          ))}
        </div>

        {mode === "flat" ? (
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

      <div className="rounded-[12px] bg-[#f8fafc] p-4 text-[12px] text-[#7a8696]">
        <b className="text-[#16203a]">Example:</b> a placement with a base fee of {money(129411)}{" "}
        at 5% earns {money(6470.55)} once{" "}
        {basis === "collected" ? "the client's payment is received" : "the candidate joins"}.
      </div>
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
