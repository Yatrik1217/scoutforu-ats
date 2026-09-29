"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { HandCoins, Plus, Trash2, X } from "lucide-react";
import { money } from "@/lib/invoice";
import type { PaymentMethod } from "@/lib/database.types";
import { recordIncentivePayout, deleteIncentivePayout } from "@/lib/actions/incentives";

export type PayoutItem = {
  id: string;
  amount: number;
  paid_on: string;
  method: PaymentMethod;
  reference: string;
  notes: string;
  placement_id: string | null;
  candidateName: string | null;
};

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "upi", label: "UPI" },
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
];

const METHOD_LABEL: Record<PaymentMethod, string> = {
  bank_transfer: "Bank transfer",
  upi: "UPI",
  cash: "Cash",
  cheque: "Cheque",
  card: "Card",
  other: "Other",
};

export function IncentivePayouts({
  recruiterId,
  recruiterName,
  fyLabel,
  earned,
  payouts,
  placements,
}: {
  recruiterId: string;
  recruiterName: string;
  fyLabel: string;
  earned: number;
  payouts: PayoutItem[];
  placements: { id: string; candidate_name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const today = new Date().toISOString().slice(0, 10);
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(today);
  const [placementId, setPlacementId] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("bank_transfer");
  const [notes, setNotes] = useState("");

  const paid = Math.round(payouts.reduce((s, p) => s + p.amount, 0) * 100) / 100;
  const balance = Math.round((earned - paid) * 100) / 100;
  const firstName = recruiterName.split(" ")[0];

  const reset = () => {
    setAmount("");
    setPaidOn(today);
    setPlacementId("");
    setMethod("bank_transfer");
    setNotes("");
  };

  const submit = () => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Enter a payout amount greater than zero.");
      return;
    }
    start(async () => {
      const r = await recordIncentivePayout({
        recruiterId,
        amount: amt,
        paidOn,
        placementId: placementId || null,
        method,
        notes,
      });
      if (r.ok) {
        toast.success(r.message ?? "Payout recorded");
        reset();
        setOpen(false);
        router.refresh();
      } else toast.error(r.error ?? "Failed");
    });
  };

  const remove = (id: string) => {
    start(async () => {
      const r = await deleteIncentivePayout(id);
      if (r.ok) {
        toast.success(r.message ?? "Removed");
        router.refresh();
      } else toast.error(r.error ?? "Failed");
    });
  };

  return (
    <div className="mt-[18px] rounded-2xl border border-[#e9edf3] bg-white p-[22px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[15px] font-extrabold text-[#16203a]">
          <HandCoins size={16} className="text-[#8b5cf6]" /> Incentive paid to {firstName}
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded-[9px] bg-[#8b5cf6] px-3 py-1.5 text-[12px] font-bold text-white hover:bg-[#7c42f0]"
        >
          {open ? <X size={14} /> : <Plus size={14} strokeWidth={2.6} />}
          {open ? "Close" : "Record payout"}
        </button>
      </div>

      {/* Earned → Paid → Balance */}
      <div className="mt-3.5 grid grid-cols-3 gap-3">
        <Stat label={`Earned · ${fyLabel}`} value={money(earned)} color="#8b5cf6" />
        <Stat label="Paid so far" value={money(paid)} color="#16a34a" />
        <Stat
          label={balance > 0 ? "Balance to pay" : balance < 0 ? "Overpaid" : "Fully settled"}
          value={money(Math.abs(balance))}
          color={balance > 0 ? "#e8833a" : balance < 0 ? "#dc2626" : "#16a34a"}
        />
      </div>

      {/* record form */}
      {open && (
        <div className="mt-3.5 rounded-[12px] border border-[#ece5fb] bg-[#faf8ff] p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Amount paid (₹)">
              <input
                type="number"
                min={0}
                step="0.01"
                value={amount}
                autoFocus
                onChange={(e) => setAmount(e.target.value)}
                placeholder="5000"
                className="w-full rounded-[8px] border border-[#e3e8f0] bg-white px-3 py-2 text-[13px] font-bold text-[#16203a] outline-none focus:border-[#8b5cf6]"
              />
            </Field>
            <Field label="Paid on">
              <input
                type="date"
                value={paidOn}
                onChange={(e) => setPaidOn(e.target.value)}
                className="w-full rounded-[8px] border border-[#e3e8f0] bg-white px-3 py-2 text-[13px] font-semibold text-[#16203a] outline-none focus:border-[#8b5cf6]"
              />
            </Field>
            <Field label="Against candidate (optional)">
              <select
                value={placementId}
                onChange={(e) => setPlacementId(e.target.value)}
                className="w-full rounded-[8px] border border-[#e3e8f0] bg-white px-3 py-2 text-[13px] font-semibold text-[#16203a] outline-none focus:border-[#8b5cf6]"
              >
                <option value="">General / advance</option>
                {placements.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.candidate_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Method">
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                className="w-full rounded-[8px] border border-[#e3e8f0] bg-white px-3 py-2 text-[13px] font-semibold text-[#16203a] outline-none focus:border-[#8b5cf6]"
              >
                {METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Note (optional)">
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. part payment against Sept closures"
                  className="w-full rounded-[8px] border border-[#e3e8f0] bg-white px-3 py-2 text-[13px] font-medium text-[#16203a] outline-none focus:border-[#8b5cf6]"
                />
              </Field>
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => {
                reset();
                setOpen(false);
              }}
              className="rounded-[8px] border border-[#e3e8f0] bg-white px-3.5 py-2 text-[12.5px] font-bold text-[#68758c] hover:bg-[#f6f8fb]"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={pending}
              className="rounded-[8px] bg-[#8b5cf6] px-4 py-2 text-[12.5px] font-bold text-white hover:bg-[#7c42f0] disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save payout"}
            </button>
          </div>
        </div>
      )}

      {/* ledger */}
      <div className="mt-4">
        {payouts.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-[#e3e8f0] py-6 text-center text-[12.5px] font-semibold text-[#a3acbd]">
            No payouts recorded yet. Use “Record payout” each time you pay {firstName}.
          </div>
        ) : (
          <div className="overflow-hidden rounded-[10px] border border-[#eef1f6]">
            <div className="grid grid-cols-[92px_1fr_120px_88px_32px] gap-2 bg-[#f8fafc] px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-[#8a94a6]">
              <div>Date</div>
              <div>Against</div>
              <div>Method</div>
              <div className="text-right">Amount</div>
              <div />
            </div>
            {payouts.map((p) => (
              <div
                key={p.id}
                className="grid grid-cols-[92px_1fr_120px_88px_32px] items-center gap-2 border-t border-[#f4f6fa] px-4 py-2.5 text-[12.5px]"
              >
                <div className="tf-num font-semibold text-[#42506b]">
                  {format(new Date(p.paid_on + "T00:00:00"), "dd MMM yy")}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-bold text-[#16203a]">
                    {p.candidateName ?? (
                      <span className="text-[#8a94a6]">General / advance</span>
                    )}
                  </div>
                  {p.notes && (
                    <div className="truncate text-[11px] font-medium text-[#a3acbd]">
                      {p.notes}
                    </div>
                  )}
                </div>
                <div className="text-[11.5px] font-semibold text-[#7a8696]">
                  {METHOD_LABEL[p.method] ?? p.method}
                </div>
                <div className="tf-num text-right font-extrabold text-[#16a34a]">
                  {money(p.amount)}
                </div>
                <button
                  onClick={() => remove(p.id)}
                  disabled={pending}
                  title="Delete payout"
                  className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] text-[#c3ccdb] hover:bg-[#fdecec] hover:text-[#dc2626] disabled:opacity-50"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-[10px] border border-[#eef1f6] bg-[#fafbfe] px-3.5 py-2.5">
      <div className="tf-num text-[18px] font-extrabold tracking-tight" style={{ color }}>
        {value}
      </div>
      <div className="mt-0.5 text-[11px] font-semibold text-[#8a94a6]">{label}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[#8a94a6]">
        {label}
      </span>
      {children}
    </label>
  );
}
