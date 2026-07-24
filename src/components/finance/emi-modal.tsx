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
import { saveEmi, type EmiForm } from "@/lib/actions/finance";
import type {
  FinanceCategoryRow,
  FinanceEmiRow,
  FinanceScope,
  FinanceEmiStatus,
} from "@/lib/database.types";

const field =
  "w-full rounded-[9px] border border-[#e3e8f0] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#16a34a]";
const label = "block text-[12px] font-bold text-[#42506b] mb-1";

export function EmiModal({
  scope,
  categories,
  emi,
  trigger,
}: {
  scope: FinanceScope;
  categories: FinanceCategoryRow[];
  emi?: FinanceEmiRow;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const today = new Date().toISOString().slice(0, 10);

  const [f, setF] = useState<EmiForm>(() => ({
    scope,
    name: emi?.name ?? "",
    lender: emi?.lender ?? "",
    categoryId: emi?.category_id ?? null,
    principal: emi?.principal ?? 0,
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

  const cats = categories.filter((c) => c.kind === "expense" && !c.archived);

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
              {emi ? "Edit loan / EMI" : "Add loan / EMI"}
              <span className="ml-2 rounded-full bg-[#eef4fe] px-2 py-0.5 text-[11px] font-bold text-[#2a6fdb] capitalize">
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
                  placeholder="e.g. Car Loan"
                />
              </div>
              <div>
                <label className={label}>Lender (optional)</label>
                <input
                  className={field}
                  value={f.lender}
                  onChange={(e) => set("lender", e.target.value)}
                  placeholder="e.g. HDFC Bank"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={label}>Monthly EMI (₹)</label>
                <NumberInput
                  className={field}
                  value={f.emiAmount}
                  onChange={(n) => set("emiAmount", n)}
                  placeholder="0"
                />
              </div>
              <div>
                <label className={label}>Loan amount (₹)</label>
                <NumberInput
                  className={field}
                  value={f.principal}
                  onChange={(n) => set("principal", n)}
                  placeholder="optional"
                />
              </div>
              <div>
                <label className={label}>Interest % p.a.</label>
                <NumberInput
                  className={field}
                  value={f.interestRate}
                  onChange={(n) => set("interestRate", n)}
                  placeholder="optional"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={label}>Total EMIs</label>
                <NumberInput
                  className={field}
                  value={f.totalInstallments}
                  onChange={(n) => set("totalInstallments", n)}
                  decimals={false}
                  placeholder="e.g. 60"
                />
              </div>
              <div>
                <label className={label}>Already paid</label>
                <NumberInput
                  className={field}
                  value={f.paidInstallments}
                  onChange={(n) => set("paidInstallments", n)}
                  decimals={false}
                  placeholder="0"
                />
              </div>
              <div>
                <label className={label}>Due day</label>
                <NumberInput
                  className={field}
                  value={f.dueDay}
                  onChange={(n) => set("dueDay", n)}
                  decimals={false}
                  placeholder="5"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
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
                <label className={label}>Category</label>
                <select
                  className={field}
                  value={f.categoryId ?? ""}
                  onChange={(e) => set("categoryId", e.target.value || null)}
                >
                  <option value="">— none —</option>
                  {cats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
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
                  <option value="closed">Closed</option>
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
              {pending ? "Saving…" : emi ? "Save changes" : "Add loan"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
