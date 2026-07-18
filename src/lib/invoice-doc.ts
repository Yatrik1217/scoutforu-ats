import "server-only";
import { format } from "date-fns";
import { Pdf, A4 } from "@/lib/pdf";
import { money, amountInWords, balanceDue, STATUS_META, isOverdue, orgAddressLine } from "@/lib/invoice";
import type {
  InvoiceRow,
  InvoiceItemRow,
  InvoicePaymentRow,
  OrganizationRow,
  InvoiceSettingsRow,
} from "@/lib/database.types";

const M = 46; // page margin
const NAVY = "#16203a";
const MUTED = "#7a8696";
const BLUE = "#2a6fdb";
const LINE = "#e3e8f0";

const fmtDate = (d: string | null) => (d ? format(new Date(d + "T00:00:00"), "dd MMM yyyy") : "—");

// Fetch the organization logo (JPEG/PNG URL) for embedding; best-effort.
export async function fetchLogoBytes(url: string | null | undefined): Promise<Buffer | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    if (ab.byteLength > 2_000_000) return null; // keep the PDF small
    return Buffer.from(ab);
  } catch {
    return null;
  }
}

export function buildInvoicePdf(opts: {
  invoice: InvoiceRow;
  items: InvoiceItemRow[];
  payments: InvoicePaymentRow[];
  org: OrganizationRow | null;
  settings: InvoiceSettingsRow | null;
  logoBytes?: Buffer | null;
}): Buffer {
  const { invoice: inv, items, payments, org, settings } = opts;
  const pdf = new Pdf();
  const right = A4.w - M;
  let y = 0;

  const logo = opts.logoBytes ? pdf.addImage(opts.logoBytes) : null;

  const header = () => {
    y = 64;
    let textX = M;
    if (logo) {
      const lh = 38;
      const lw = Math.min(130, (logo.width / logo.height) * lh);
      pdf.drawImage(logo.idx, M, y - 26, lw, lh);
      textX = M + lw + 14;
    }
    pdf.text(org?.name || "ScoutforU", textX, y, { size: 19, font: "bold", color: NAVY });
    pdf.text("TAX INVOICE", right, y, { size: 17, font: "bold", color: BLUE, align: "right" });
    y += 15;
    if (org?.tagline) {
      pdf.text(org.tagline, textX, y, { size: 9, color: MUTED });
    }
    pdf.text(inv.invoice_no, right, y, { size: 10.5, font: "bold", color: NAVY, align: "right" });
    y += 13;
    const orgLine2 = orgAddressLine(org?.address, org?.city);
    if (orgLine2) {
      pdf.text(orgLine2, textX, y, { size: 9, color: MUTED });
      y += 12;
    }
    const contact = [org?.phone, org?.email, org?.website].filter(Boolean).join("  |  ");
    if (contact) {
      pdf.text(contact, textX, y, { size: 9, color: MUTED });
      y += 12;
    }
    const tax = [
      settings?.gstin ? `GSTIN: ${settings.gstin}` : "",
      settings?.pan ? `PAN: ${settings.pan}` : "",
    ]
      .filter(Boolean)
      .join("   ");
    if (tax) {
      pdf.text(tax, textX, y, { size: 9, font: "bold", color: NAVY });
      y += 12;
    }
    y += 8;
    pdf.line(M, y, right, y, LINE, 1);
    y += 24;
  };

  header();

  // ---- meta row: bill-to (left) + invoice facts (right) ----
  const metaTop = y;
  pdf.text("BILL TO", M, y, { size: 8, font: "bold", color: MUTED });
  y += 14;
  pdf.text(inv.bill_to_name || "—", M, y, { size: 11.5, font: "bold", color: NAVY });
  y += 14;
  if (inv.bill_to_address)
    y = pdf.textBlock(inv.bill_to_address, M, y, 250, { size: 9, color: "#42506b" });
  if (inv.bill_to_email) {
    pdf.text(inv.bill_to_email, M, y, { size: 9, color: "#42506b" });
    y += 13;
  }
  if (inv.bill_to_gstin) {
    pdf.text(`GSTIN: ${inv.bill_to_gstin}`, M, y, { size: 9, font: "bold", color: "#42506b" });
    y += 13;
  }

  let fy = metaTop;
  const factLabel = right - 170;
  const fact = (label: string, value: string, bold = false, color = NAVY) => {
    pdf.text(label, factLabel, fy, { size: 9, color: MUTED });
    pdf.text(value, right, fy, { size: 9.5, font: bold ? "bold" : "regular", color, align: "right" });
    fy += 16;
  };
  fact("Invoice date", fmtDate(inv.issue_date));
  fact("Due date", fmtDate(inv.due_date), isOverdue(inv), isOverdue(inv) ? "#dc2626" : NAVY);
  fact(
    "Payment terms",
    inv.payment_terms_days === 0 ? "Due on receipt" : `Net ${inv.payment_terms_days}`,
  );
  fact("Status", isOverdue(inv) ? "Overdue" : STATUS_META[inv.status].label, true);
  fact("Balance due", money(balanceDue(inv)), true, BLUE);

  y = Math.max(y, fy) + 18;

  // ---- items table ----
  const cols = {
    idx: M,
    item: M + 26,
    qty: right - 190,
    rate: right - 100,
    amount: right,
  };
  const tableHeader = () => {
    pdf.rect(M - 6, y - 11, right - M + 12, 20, NAVY);
    pdf.text("#", cols.idx, y + 3, { size: 8.5, font: "bold", color: "#ffffff" });
    pdf.text("ITEM & DESCRIPTION", cols.item, y + 3, { size: 8.5, font: "bold", color: "#ffffff" });
    pdf.text("QTY", cols.qty, y + 3, { size: 8.5, font: "bold", color: "#ffffff", align: "right" });
    pdf.text("RATE", cols.rate, y + 3, { size: 8.5, font: "bold", color: "#ffffff", align: "right" });
    pdf.text("AMOUNT", cols.amount, y + 3, { size: 8.5, font: "bold", color: "#ffffff", align: "right" });
    y += 26;
  };
  tableHeader();

  const bottomLimit = A4.h - 90;
  items.forEach((it, i) => {
    const detailLines = it.details ? Math.ceil(it.details.length / 78) : 0;
    const rowH = 20 + detailLines * 12;
    if (y + rowH > bottomLimit) {
      pdf.addPage();
      y = 56;
      tableHeader();
    }
    pdf.text(String(i + 1), cols.idx, y, { size: 9, color: MUTED });
    pdf.text(it.description || "—", cols.item, y, { size: 9.5, font: "bold", color: NAVY });
    pdf.text(String(it.qty), cols.qty, y, { size: 9.5, align: "right" });
    pdf.text(money(it.rate), cols.rate, y, { size: 9.5, align: "right" });
    pdf.text(money(it.amount), cols.amount, y, { size: 9.5, font: "bold", align: "right" });
    y += 13;
    if (it.details) {
      y = pdf.textBlock(it.details, cols.item, y, cols.qty - cols.item - 30, {
        size: 8.5,
        color: MUTED,
      });
    }
    y += 7;
    pdf.line(M - 6, y - 6, right + 6, y - 6, "#eef1f6", 0.7);
  });

  // ---- totals ----
  if (y + 190 > A4.h - 60) {
    pdf.addPage();
    y = 56;
  }
  y += 8;
  const tLabel = right - 220;
  const trow = (label: string, value: string, opts?: { bold?: boolean; color?: string }) => {
    pdf.text(label, tLabel, y, { size: 9.5, color: opts?.color ?? "#42506b" });
    pdf.text(value, right, y, {
      size: 9.5,
      font: opts?.bold ? "bold" : "regular",
      color: opts?.color ?? NAVY,
      align: "right",
    });
    y += 17;
  };
  trow("Subtotal", money(inv.subtotal));
  if (inv.discount_amount > 0)
    trow(`Discount (${inv.discount_percent}%)`, `- ${money(inv.discount_amount)}`, { color: "#dc2626" });
  if (inv.tax_mode === "cgst_sgst" && inv.tax_amount > 0) {
    trow(`CGST (${inv.gst_percent / 2}%)`, money(inv.tax_amount / 2));
    trow(`SGST (${inv.gst_percent / 2}%)`, money(inv.tax_amount / 2));
  } else if (inv.tax_mode === "igst" && inv.tax_amount > 0) {
    trow(`IGST (${inv.gst_percent}%)`, money(inv.tax_amount));
  }
  pdf.line(tLabel - 8, y - 8, right, y - 8, LINE, 1);
  y += 4;
  pdf.rect(tLabel - 12, y - 12, right - tLabel + 18, 22, "#eef4fe");
  pdf.text("TOTAL", tLabel, y + 2, { size: 10, font: "bold", color: NAVY });
  pdf.text(money(inv.total), right, y + 2, { size: 11, font: "bold", color: BLUE, align: "right" });
  y += 24;
  if (inv.amount_paid > 0) {
    trow("Payments received", `- ${money(inv.amount_paid)}`, { color: "#16a34a" });
    trow("Balance due", money(balanceDue(inv)), { bold: true });
  }

  // amount in words (left of totals block)
  pdf.text("Amount in words", M, y - 40, { size: 8, font: "bold", color: MUTED });
  pdf.textBlock(amountInWords(inv.total), M, y - 27, 260, {
    size: 9,
    font: "italic",
    color: "#42506b",
  });

  y += 14;

  // ---- payments detail ----
  if (payments.length) {
    pdf.text("PAYMENTS RECEIVED", M, y, { size: 8, font: "bold", color: MUTED });
    y += 14;
    for (const p of payments) {
      pdf.text(
        `${fmtDate(p.paid_on)}  -  ${money(p.amount)}${p.reference ? `  -  Ref: ${p.reference}` : ""}`,
        M,
        y,
        { size: 9, color: "#42506b" },
      );
      y += 13;
    }
    y += 8;
  }

  // ---- bank + terms ----
  if (settings?.bank_details) {
    if (y + 80 > A4.h - 50) {
      pdf.addPage();
      y = 56;
    }
    pdf.text("BANK DETAILS", M, y, { size: 8, font: "bold", color: MUTED });
    y = pdf.textBlock(settings.bank_details, M, y + 14, 300, { size: 9, color: "#42506b" }) + 8;
  }
  const terms = inv.terms || settings?.terms || "";
  if (terms) {
    if (y + 60 > A4.h - 50) {
      pdf.addPage();
      y = 56;
    }
    pdf.text("TERMS & NOTES", M, y, { size: 8, font: "bold", color: MUTED });
    y = pdf.textBlock(terms, M, y + 14, right - M, { size: 8.5, color: MUTED });
  }
  if (inv.notes) {
    pdf.textBlock(inv.notes, M, y + 6, right - M, { size: 8.5, color: MUTED });
  }

  // footer on last page
  pdf.line(M, A4.h - 42, right, A4.h - 42, LINE, 0.7);
  pdf.text(`${org?.name || "ScoutforU"} - ${inv.invoice_no}`, M, A4.h - 28, {
    size: 8,
    color: MUTED,
  });
  pdf.text("Generated by ScoutforU Invoices", right, A4.h - 28, {
    size: 8,
    color: MUTED,
    align: "right",
  });

  return pdf.render();
}
