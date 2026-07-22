"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  IndianRupee,
  FileText,
  MoreHorizontal,
  Pencil,
  RefreshCcw,
  Ban,
  FileX2,
  Trash2,
  Undo2,
  X,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import {
  recordPlacementPayment,
  deletePlacementPayment,
  setPlacementStatus,
  deletePlacement,
  invoiceFromPlacement,
  type PlacementPaymentForm,
} from "@/lib/actions/placements";
import { money, METHOD_LABEL } from "@/lib/invoice";
import { NumberInput } from "@/components/number-input";
import { placementBalance, OPEN_PLACEMENT_STATUSES } from "@/lib/placement";
import type { PlacementRow, PaymentMethod } from "@/lib/database.types";

const input =
  "w-full rounded-[9px] border border-[#e3e8f0] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#2a6fdb]";
const lbl = "block text-[12px] font-bold text-[#42506b]";

export function PlacementActions({ placement }: { placement: PlacementRow }) {
  const router = useRouter();
  const [payOpen, setPayOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [pending, start] = useTransition();

  const open = OPEN_PLACEMENT_STATUSES.includes(placement.status);
  const closed = ["cancelled", "written_off", "paid"].includes(placement.status);

  const run = (
    fn: () => Promise<{ ok: boolean; error?: string; message?: string; id?: string }>,
    after?: (id?: string) => void,
  ) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(res.message || "Done");
        after?.(res.id);
        router.refresh();
      } else toast.error(res.error || "Failed");
    });

  const ghostBtn =
    "flex items-center gap-2 rounded-[10px] border border-[#e6eaf1] bg-white px-4 py-2.5 text-[13px] font-bold text-[#42506b] hover:bg-[#f6f8fb] disabled:opacity-60";

  return (
    <div className="relative flex flex-wrap items-center gap-2">
      {open && (
        <button
          onClick={() => setPayOpen(true)}
          className="flex items-center gap-2 rounded-[10px] bg-[#16a34a] px-4 py-2.5 text-[13px] font-bold text-white hover:bg-[#15803d]"
        >
          <IndianRupee size={14} /> Record payment
        </button>
      )}
      {placement.invoice_id ? (
        <Link href={`/invoices/${placement.invoice_id}`} className={ghostBtn}>
          <ExternalLink size={14} /> View invoice
        </Link>
      ) : (
        !closed && (
          <button
            onClick={() =>
              run(() => invoiceFromPlacement(placement.id), (id) => id && router.push(`/invoices/${id}`))
            }
            disabled={pending}
            className={ghostBtn}
          >
            <FileText size={14} /> Generate invoice
          </button>
        )
      )}

      <button onClick={() => setMenu((m) => !m)} className={ghostBtn} aria-label="More actions">
        <MoreHorizontal size={16} />
      </button>
      {menu && (
        <>
          <div className="fixed inset-0 z-[90]" onClick={() => setMenu(false)} />
          <div className="absolute right-0 top-[46px] z-[95] w-[240px] overflow-hidden rounded-[12px] border border-[#e9edf3] bg-white py-1 shadow-[0_12px_34px_rgba(20,32,58,.16)]">
            <MenuItem icon={Pencil} label="Edit placement" onClick={() => router.push(`/placements/${placement.id}/edit`)} />
            {placement.status === "replaced" || placement.status === "cancelled" ? (
              <MenuItem icon={Undo2} label="Reopen (awaiting payment)" onClick={() => run(() => setPlacementStatus(placement.id, "pending"))} />
            ) : (
              <>
                <MenuItem
                  icon={RefreshCcw}
                  label="Mark as replacement"
                  onClick={() => run(() => setPlacementStatus(placement.id, "replaced"))}
                />
                {open && (
                  <MenuItem
                    icon={FileX2}
                    label="Write off fee"
                    onClick={() => run(() => setPlacementStatus(placement.id, "written_off"))}
                  />
                )}
                <MenuItem
                  icon={Ban}
                  label="Cancel placement"
                  danger
                  onClick={() => run(() => setPlacementStatus(placement.id, "cancelled"))}
                />
              </>
            )}
            {placement.amount_received === 0 && (
              <MenuItem
                icon={Trash2}
                label="Delete"
                danger
                onClick={() => {
                  if (confirm(`Delete this placement for ${placement.candidate_name}?`))
                    run(() => deletePlacement(placement.id), () => router.push("/placements/all"));
                }}
              />
            )}
          </div>
        </>
      )}

      {payOpen && <PaymentModal placement={placement} onClose={() => setPayOpen(false)} />}
      {pending && <span className="text-[12px] font-semibold text-[#8a94a6]">Working…</span>}
    </div>
  );

  function MenuItem({
    icon: Icon,
    label,
    onClick,
    danger,
  }: {
    icon: typeof Pencil;
    label: string;
    onClick: () => void;
    danger?: boolean;
  }) {
    return (
      <button
        onClick={() => {
          setMenu(false);
          onClick();
        }}
        className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[12.5px] font-bold hover:bg-[#f6f8fb] ${
          danger ? "text-[#dc2626]" : "text-[#42506b]"
        }`}
      >
        <Icon size={14} /> {label}
      </button>
    );
  }
}

function PaymentModal({ placement, onClose }: { placement: PlacementRow; onClose: () => void }) {
  const balance = placementBalance(placement);
  const [f, setF] = useState<PlacementPaymentForm>({
    amount: balance,
    paidOn: new Date().toISOString().slice(0, 10),
    method: "bank_transfer",
    reference: "",
    notes: "",
  });
  const [pending, start] = useTransition();
  const router = useRouter();

  const save = () =>
    start(async () => {
      const res = await recordPlacementPayment(placement.id, f);
      if (res.ok) {
        toast.success(res.message || "Recorded");
        onClose();
        router.refresh();
      } else toast.error(res.error || "Failed");
    });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-[560px] overflow-auto rounded-[16px] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#eef1f6] px-5 py-4">
          <h2 className="text-[15px] font-extrabold text-[#16203a]">
            Record payment — {placement.candidate_name}
          </h2>
          <button onClick={onClose} className="text-[#9aa4b6] hover:text-[#42506b]">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">
          <div className="mb-3 rounded-[10px] bg-[#f0fdf4] px-4 py-3 text-[13px] font-bold text-[#166534]">
            Balance due: {money(balance)}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className={lbl}>
              Amount received*
              <NumberInput
                value={f.amount}
                onChange={(n) => setF((p) => ({ ...p, amount: n }))}
                className={input + " mt-1 font-normal"}
              />
            </label>
            <label className={lbl}>
              Payment date
              <input
                type="date"
                value={f.paidOn}
                onChange={(e) => setF((p) => ({ ...p, paidOn: e.target.value }))}
                className={input + " mt-1 font-normal"}
              />
            </label>
            <label className={lbl}>
              Mode
              <select
                value={f.method}
                onChange={(e) => setF((p) => ({ ...p, method: e.target.value as PaymentMethod }))}
                className={input + " mt-1 font-normal"}
              >
                {(Object.keys(METHOD_LABEL) as PaymentMethod[]).map((m) => (
                  <option key={m} value={m}>
                    {METHOD_LABEL[m]}
                  </option>
                ))}
              </select>
            </label>
            <label className={lbl}>
              Reference #
              <input
                value={f.reference}
                onChange={(e) => setF((p) => ({ ...p, reference: e.target.value }))}
                className={input + " mt-1 font-normal"}
              />
            </label>
          </div>
          <label className={lbl + " mt-3"}>
            Notes
            <input
              value={f.notes}
              onChange={(e) => setF((p) => ({ ...p, notes: e.target.value }))}
              className={input + " mt-1 font-normal"}
            />
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={onClose} className="rounded-[9px] px-4 py-2 text-[13px] font-bold text-[#8a94a6] hover:bg-[#f1f4f9]">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={pending || !f.amount}
              className="flex items-center gap-2 rounded-[9px] bg-[#16a34a] px-5 py-2 text-[13px] font-bold text-white hover:bg-[#15803d] disabled:opacity-60"
            >
              <IndianRupee size={14} /> {pending ? "Saving…" : "Record payment"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DeletePlacementPaymentButton({ paymentId }: { paymentId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!confirm("Remove this payment? Status will be recalculated.")) return;
        start(async () => {
          const res = await deletePlacementPayment(paymentId);
          if (res.ok) {
            toast.success(res.message || "Removed");
            router.refresh();
          } else toast.error(res.error || "Failed");
        });
      }}
      className="flex h-7 w-7 items-center justify-center rounded-lg text-[#c2cad8] hover:bg-[#fef2f2] hover:text-[#dc2626] disabled:opacity-40"
      title="Remove payment"
    >
      <Trash2 size={13} />
    </button>
  );
}

export function NewPlacementButton() {
  return (
    <Link
      href="/placements/new"
      className="flex items-center gap-2 rounded-[10px] bg-[#2a6fdb] px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_4px_14px_rgba(42,111,219,.35)] hover:bg-[#245fc0]"
    >
      + Record Placement
    </Link>
  );
}
