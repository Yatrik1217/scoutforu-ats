"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Send,
  X,
  IndianRupee,
  BellRing,
  Download,
  Link2,
  MoreHorizontal,
  Pencil,
  Copy,
  Ban,
  FileX2,
  Trash2,
  Undo2,
  CheckCheck,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  sendInvoice,
  markInvoiceSent,
  recordPayment,
  setInvoiceStatus,
  deleteInvoice,
  duplicateInvoice,
  type PaymentForm,
} from "@/lib/actions/invoices";
import { money, balanceDue, METHOD_LABEL, OPEN_STATUSES } from "@/lib/invoice";
import type { InvoiceRow, PaymentMethod } from "@/lib/database.types";

const input =
  "w-full rounded-[9px] border border-[#e3e8f0] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#2a6fdb]";
const lbl = "block text-[12px] font-bold text-[#42506b]";

export function InvoiceActions({ invoice }: { invoice: InvoiceRow }) {
  const router = useRouter();
  const [sendOpen, setSendOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [reminder, setReminder] = useState(false);
  const [menu, setMenu] = useState(false);
  const [pending, start] = useTransition();

  const open = OPEN_STATUSES.includes(invoice.status);
  const editable = ["draft", "sent", "viewed", "partial"].includes(invoice.status);
  const canPay = open;
  const closed = ["void", "written_off", "paid"].includes(invoice.status);

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string; id?: string }>, after?: (id?: string) => void) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(res.message || "Done");
        after?.(res.id);
      } else toast.error(res.error || "Failed");
    });

  const primaryBtn =
    "flex items-center gap-2 rounded-[10px] bg-[#2a6fdb] px-4 py-2.5 text-[13px] font-bold text-white hover:bg-[#245fc0] disabled:opacity-60";
  const ghostBtn =
    "flex items-center gap-2 rounded-[10px] border border-[#e6eaf1] bg-white px-4 py-2.5 text-[13px] font-bold text-[#42506b] hover:bg-[#f6f8fb] disabled:opacity-60";

  return (
    <div className="relative flex flex-wrap items-center gap-2">
      {!closed && (
        <button onClick={() => { setReminder(false); setSendOpen(true); }} className={primaryBtn}>
          <Send size={14} /> {invoice.status === "draft" ? "Send invoice" : "Resend"}
        </button>
      )}
      {canPay && (
        <button onClick={() => setPayOpen(true)} className="flex items-center gap-2 rounded-[10px] bg-[#16a34a] px-4 py-2.5 text-[13px] font-bold text-white hover:bg-[#15803d]">
          <IndianRupee size={14} /> Record payment
        </button>
      )}
      {open && (
        <button
          onClick={() => { setReminder(true); setSendOpen(true); }}
          className={ghostBtn}
        >
          <BellRing size={14} /> Remind
        </button>
      )}
      <a
        href={`/api/invoice/${invoice.public_token}/pdf`}
        target="_blank"
        rel="noreferrer"
        className={ghostBtn}
      >
        <Download size={14} /> PDF
      </a>
      <button
        onClick={() => {
          const url = `${window.location.origin}/invoice/${invoice.public_token}`;
          navigator.clipboard.writeText(url);
          toast.success("Public invoice link copied");
        }}
        className={ghostBtn}
      >
        <Link2 size={14} /> Copy link
      </button>

      <button onClick={() => setMenu((m) => !m)} className={ghostBtn} aria-label="More actions">
        <MoreHorizontal size={16} />
      </button>
      {menu && (
        <>
          <div className="fixed inset-0 z-[90]" onClick={() => setMenu(false)} />
          <div className="absolute right-0 top-[46px] z-[95] w-[230px] overflow-hidden rounded-[12px] border border-[#e9edf3] bg-white py-1 shadow-[0_12px_34px_rgba(20,32,58,.16)]">
            {editable && (
              <MenuItem icon={Pencil} label="Edit invoice" onClick={() => router.push(`/invoices/${invoice.id}/edit`)} />
            )}
            {invoice.status === "draft" && (
              <MenuItem
                icon={CheckCheck}
                label="Mark as sent (no email)"
                onClick={() => run(() => markInvoiceSent(invoice.id))}
              />
            )}
            <MenuItem
              icon={Copy}
              label="Duplicate"
              onClick={() => run(() => duplicateInvoice(invoice.id), (id) => id && router.push(`/invoices/${id}`))}
            />
            {invoice.status === "sent" && invoice.amount_paid === 0 && (
              <MenuItem
                icon={Undo2}
                label="Revert to draft"
                onClick={() => run(() => setInvoiceStatus(invoice.id, "draft"))}
              />
            )}
            {open && (
              <MenuItem
                icon={FileX2}
                label="Write off balance"
                onClick={() => run(() => setInvoiceStatus(invoice.id, "written_off"))}
              />
            )}
            {!closed && (
              <MenuItem
                icon={Ban}
                label="Void invoice"
                danger
                onClick={() => run(() => setInvoiceStatus(invoice.id, "void"))}
              />
            )}
            {(invoice.status === "draft" || invoice.status === "void") && (
              <MenuItem
                icon={Trash2}
                label="Delete"
                danger
                onClick={() => {
                  if (confirm(`Delete ${invoice.invoice_no}? This cannot be undone.`))
                    run(() => deleteInvoice(invoice.id), () => router.push("/invoices/all"));
                }}
              />
            )}
          </div>
        </>
      )}

      {sendOpen && (
        <SendModal invoice={invoice} reminder={reminder} onClose={() => setSendOpen(false)} />
      )}
      {payOpen && <PaymentModal invoice={invoice} onClose={() => setPayOpen(false)} />}
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

// ---- send / remind modal ------------------------------------------------------

function SendModal({
  invoice,
  reminder,
  onClose,
}: {
  invoice: InvoiceRow;
  reminder: boolean;
  onClose: () => void;
}) {
  const [to, setTo] = useState(invoice.bill_to_email || "");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState(
    reminder
      ? `Hi ${invoice.bill_to_name},\n\nThis is a gentle reminder that ${money(balanceDue(invoice))} is due on invoice ${invoice.invoice_no}. The invoice is attached for reference.\n\nThank you!`
      : `Hi ${invoice.bill_to_name},\n\nPlease find attached invoice ${invoice.invoice_no} for ${money(invoice.total)}. You can also view it online using the button below.\n\nThank you for your business!`,
  );
  const [pending, start] = useTransition();
  const router = useRouter();

  const send = () =>
    start(async () => {
      const res = await sendInvoice(invoice.id, { to, cc, subject, message, reminder });
      if (res.ok) {
        toast.success(res.message || "Sent");
        onClose();
        router.refresh();
      } else toast.error(res.error || "Failed to send");
    });

  return (
    <Modal title={reminder ? `Payment reminder — ${invoice.invoice_no}` : `Send ${invoice.invoice_no}`} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <label className={lbl}>
          To <span className="text-[#dc2626]">*</span>
          <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="accounts@client.com" className={input + " mt-1 font-normal"} />
        </label>
        <label className={lbl}>
          CC
          <input value={cc} onChange={(e) => setCc(e.target.value)} className={input + " mt-1 font-normal"} />
        </label>
      </div>
      <label className={lbl + " mt-3"}>
        Subject
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={
            reminder
              ? `Payment reminder — ${invoice.invoice_no} (${money(balanceDue(invoice))} due)`
              : `Invoice ${invoice.invoice_no}`
          }
          className={input + " mt-1 font-normal"}
        />
      </label>
      <label className={lbl + " mt-3"}>
        Message
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6} className={input + " mt-1 resize-y font-normal"} />
      </label>
      <div className="mt-2 text-[11.5px] text-[#8a94a6]">
        The invoice PDF is attached automatically, with a “View Invoice” link for the client.
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-[9px] px-4 py-2 text-[13px] font-bold text-[#8a94a6] hover:bg-[#f1f4f9]">
          Cancel
        </button>
        <button
          onClick={send}
          disabled={pending || !to.trim()}
          className="flex items-center gap-2 rounded-[9px] bg-[#2a6fdb] px-5 py-2 text-[13px] font-bold text-white hover:bg-[#245fc0] disabled:opacity-60"
        >
          <Send size={14} /> {pending ? "Sending…" : reminder ? "Send reminder" : "Send invoice"}
        </button>
      </div>
    </Modal>
  );
}

// ---- record payment modal -------------------------------------------------------

function PaymentModal({ invoice, onClose }: { invoice: InvoiceRow; onClose: () => void }) {
  const balance = balanceDue(invoice);
  const [f, setF] = useState<PaymentForm>({
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
      const res = await recordPayment(invoice.id, f);
      if (res.ok) {
        toast.success(res.message || "Payment recorded");
        onClose();
        router.refresh();
      } else toast.error(res.error || "Failed");
    });

  return (
    <Modal title={`Record payment — ${invoice.invoice_no}`} onClose={onClose}>
      <div className="mb-3 rounded-[10px] bg-[#f0fdf4] px-4 py-3 text-[13px] font-bold text-[#166534]">
        Balance due: {money(balance)}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className={lbl}>
          Amount received <span className="text-[#dc2626]">*</span>
          <input
            inputMode="decimal"
            value={String(f.amount)}
            onChange={(e) =>
              setF((p) => ({ ...p, amount: parseFloat(e.target.value.replace(/[^0-9.]/g, "")) || 0 }))
            }
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
          Reference # (UTR / cheque no.)
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
    </Modal>
  );
}

// ---- shared modal shell -----------------------------------------------------------

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[88vh] w-full max-w-[560px] overflow-auto rounded-[16px] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#eef1f6] px-5 py-4">
          <h2 className="text-[15px] font-extrabold text-[#16203a]">{title}</h2>
          <button onClick={onClose} className="text-[#9aa4b6] hover:text-[#42506b]">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

// Delete-payment button used on the detail page's payments list.
export function DeletePaymentButton({ paymentId }: { paymentId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!confirm("Remove this payment? Invoice status will be recalculated.")) return;
        start(async () => {
          const { deletePayment } = await import("@/lib/actions/invoices");
          const res = await deletePayment(paymentId);
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

// "New invoice" header button used on list/dashboard pages.
export function NewInvoiceButton() {
  return (
    <Link
      href="/invoices/new"
      className="flex items-center gap-2 rounded-[10px] bg-[#2a6fdb] px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_4px_14px_rgba(42,111,219,.35)] hover:bg-[#245fc0]"
    >
      + New Invoice
    </Link>
  );
}
