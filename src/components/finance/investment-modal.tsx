"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NumberInput } from "@/components/number-input";
import { FundPicker } from "@/components/finance/fund-picker";
import { saveEmi, type EmiForm } from "@/lib/actions/finance";
import type {
  FinanceEmiRow,
  FinanceScope,
  FinanceEmiStatus,
} from "@/lib/database.types";

const field =
  "w-full rounded-[9px] border border-[#e3e8f0] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#16a34a]";
const label = "block text-[12px] font-bold text-[#42506b] mb-1";

// SIPs / recurring investments. Contributions do NOT count as expenses — they
// grow an asset, so we track amount invested vs current value.
export function InvestmentModal({
  scope,
  emi,
  trigger,
}: {
  scope: FinanceScope;
  emi?: FinanceEmiRow;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const today = new Date().toISOString().slice(0, 10);

  const [schemeLabel, setSchemeLabel] = useState(emi?.scheme_code ? emi?.name ?? "" : "");
  const [f, setF] = useState<EmiForm>(() => ({
    scope,
    type: "sip",
    name: emi?.name ?? "",
    lender: emi?.lender ?? "",
    categoryId: null,
    principal: emi?.principal ?? 0,
    currentValue: emi?.current_value ?? 0,
    schemeCode: emi?.scheme_code ?? null,
    units: emi?.units ?? 0,
    emiAmount: emi?.emi_amount ?? 0,
    interestRate: emi?.interest_rate ?? 0,
    totalInstallments: emi?.total_installments ?? 0,
    paidInstallments: emi?.paid_installments ?? 0,
    startDate: emi?.start_date ?? today,
    dueDay: emi?.due_day ?? 5,
    status: emi?.status ?? "active",
    notes: emi?.notes ?? "",
  }));

  const set = <K extends keyof EmiForm>(k: K, v: EmiForm[K]) =>
    setF((p) => ({ ...p, [k]: v }));

  const submit = () =>
    start(async () => {
      const res = await saveEmi(emi?.id ?? null, f);
      if (res.ok) {
        toast.success(res.message ?? "Saved");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Something went wrong");
      }
    });

  return (
    <>
      <span className="contents" onClick={() => setOpen(true)}>
        {trigger}
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[16px] font-extrabold">
              {emi ? "Edit investment" : "Add investment / SIP"}
              <span className="ml-2 rounded-full bg-[#eafaf0] px-2 py-0.5 text-[11px] font-bold text-[#16a34a] capitalize">
                {scope}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Name</label>
                <input
                  className={field}
                  value={f.name}
                  autoFocus
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="e.g. Nifty 50 Index SIP"
                />
              </div>
              <div>
                <label className={label}>Fund / provider (optional)</label>
                <input
                  className={field}
                  value={f.lender}
                  onChange={(e) => set("lender", e.target.value)}
                  placeholder="e.g. Zerodha, HDFC MF"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={label}>Monthly SIP (₹)</label>
                <NumberInput
                  className={field}
                  value={f.emiAmount}
                  onChange={(n) => set("emiAmount", n)}
                  placeholder="0"
                />
              </div>
              <div>
                <label className={label}>Contributions made</label>
                <NumberInput
                  className={field}
                  value={f.paidInstallments}
                  onChange={(n) => set("paidInstallments", n)}
                  decimals={false}
                  placeholder="0"
                />
              </div>
              <div>
                <label className={label}>SIP day</label>
                <NumberInput
                  className={field}
                  value={f.dueDay}
                  onChange={(n) => set("dueDay", n)}
                  decimals={false}
                  placeholder="5"
                />
              </div>
            </div>

            {/* live NAV link */}
            <div>
              <label className={label}>Live NAV — link this fund (optional)</label>
              <FundPicker
                schemeCode={f.schemeCode}
                schemeLabel={schemeLabel}
                onSelect={(code, name) => {
                  set("schemeCode", code);
                  setSchemeLabel(name);
                  if (!f.name.trim()) set("name", name);
                }}
                onClear={() => {
                  set("schemeCode", null);
                  setSchemeLabel("");
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Units held</label>
                <NumberInput
                  className={field}
                  value={f.units}
                  onChange={(n) => set("units", n)}
                  placeholder="from your MF statement"
                />
              </div>
              <div>
                <label className={label}>Already invested (₹)</label>
                <NumberInput
                  className={field}
                  value={f.principal}
                  onChange={(n) => set("principal", n)}
                  placeholder="lump before tracking"
                />
              </div>
            </div>

            {!f.schemeCode && (
              <div>
                <label className={label}>Current value (₹) — manual</label>
                <NumberInput
                  className={field}
                  value={f.currentValue}
                  onChange={(n) => set("currentValue", n)}
                  placeholder="used only if no fund is linked"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Start date</label>
                <input
                  type="date"
                  className={field}
                  value={f.startDate}
                  onChange={(e) => set("startDate", e.target.value)}
                />
              </div>
              <div>
                <label className={label}>Status</label>
                <select
                  className={field}
                  value={f.status}
                  onChange={(e) => set("status", e.target.value as FinanceEmiStatus)}
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="closed">Closed / redeemed</option>
                </select>
              </div>
            </div>

            <div>
              <label className={label}>Notes (optional)</label>
              <input
                className={field}
                value={f.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </div>

            <div className="rounded-[9px] bg-[#eafaf0] p-2.5 text-[11.5px] font-medium leading-relaxed text-[#128a3e]">
              Invested = already invested + (contributions × monthly SIP). Update the current value
              anytime to see your gain/loss. SIP contributions are <b>not</b> counted as expenses.
            </div>
          </div>

          <div className="mt-1 flex justify-end gap-2">
            <button
              onClick={() => setOpen(false)}
              className="rounded-[9px] px-3.5 py-2 text-[13px] font-bold text-[#42506b] hover:bg-[#f1f4f9]"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={pending}
              className="rounded-[9px] bg-[#16a34a] px-4 py-2 text-[13px] font-bold text-white hover:bg-[#128a3e] disabled:opacity-50"
            >
              {pending ? "Saving…" : emi ? "Save changes" : "Add investment"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
