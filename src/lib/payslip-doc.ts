import "server-only";
import { Pdf, A4 } from "@/lib/pdf";
import { money, amountInWords, orgAddressLine } from "@/lib/invoice";
import { monthLabel, sumLines } from "@/lib/hr";
import type {
  EmployeeRow,
  PayrollLineRow,
  PayrollRunRow,
  OrganizationRow,
} from "@/lib/database.types";

const M = 46;
const NAVY = "#16203a";
const MUTED = "#7a8696";
const BLUE = "#2a6fdb";
const LINE = "#e3e8f0";

export function buildPayslipPdf(opts: {
  line: PayrollLineRow;
  employee: EmployeeRow;
  run: PayrollRunRow;
  org: OrganizationRow | null;
  logoBytes?: Buffer | null;
}): Buffer {
  const { line, employee, run, org } = opts;
  const pdf = new Pdf();
  const right = A4.w - M;
  const logo = opts.logoBytes ? pdf.addImage(opts.logoBytes) : null;

  // Small logo top-left; company details right-aligned in the top-right corner.
  const topY = 56;
  let logoBottom = topY;
  if (logo) {
    const lh = 30;
    const lw = Math.min(130, (logo.width / logo.height) * lh);
    pdf.drawImage(logo.idx, M, topY, lw, lh);
    logoBottom = topY + lh;
  }
  let ry = topY + 2;
  pdf.text(org?.name || "ScoutforU", right, ry, { size: 15, font: "bold", color: NAVY, align: "right" });
  ry += 14;
  const addr = orgAddressLine(org?.address, org?.city);
  if (addr) {
    pdf.text(addr, right, ry, { size: 8.5, color: MUTED, align: "right" });
    ry += 11;
  }
  const contact = [org?.phone, org?.email, org?.website].filter(Boolean).join("  |  ");
  if (contact) {
    pdf.text(contact, right, ry, { size: 8.5, color: MUTED, align: "right" });
    ry += 11;
  }
  let y = Math.max(logoBottom, ry) + 14;
  pdf.line(M, y, right, y, LINE, 1);
  y += 22;

  // employee block
  const col2 = M + 250;
  const pair = (label: string, value: string, x: number, yy: number) => {
    pdf.text(label, x, yy, { size: 8.5, color: MUTED });
    pdf.text(value || "—", x, yy + 12, { size: 10, font: "bold", color: NAVY });
  };
  pair("EMPLOYEE", employee.name, M, y);
  pair("EMPLOYEE CODE", employee.employee_code || "—", col2, y);
  y += 30;
  pair("DESIGNATION", employee.designation || "—", M, y);
  pair("DATE OF JOINING", employee.joined_on || "—", col2, y);
  y += 30;
  if (employee.pan || employee.uan) {
    pair("PAN", employee.pan || "—", M, y);
    pair("UAN", employee.uan || "—", col2, y);
    y += 30;
  }
  if (employee.bank_account) {
    pair("BANK A/C", `${employee.bank_account}${employee.bank_ifsc ? ` · ${employee.bank_ifsc}` : ""}`, M, y);
    y += 30;
  }

  // Attendance & pay-basis strip — shows exactly how the month was prorated:
  // monthly gross, total days, days actually paid, and loss-of-pay (LWP) days.
  const paidDays = Math.max(0, Math.round((line.total_days - line.lop_days) * 100) / 100);
  const cells: [string, string][] = [
    ["MONTHLY GROSS", money(line.monthly_gross)],
    ["TOTAL DAYS", String(line.total_days)],
    ["PAID DAYS", String(paidDays)],
    ["LOSS OF PAY (LWP)", String(line.lop_days)],
  ];
  const stripW = right - M + 12;
  const stripH = 42;
  pdf.rect(M - 6, y - 10, stripW, stripH, "#f6f8fb");
  const cw = stripW / cells.length;
  cells.forEach(([lbl, val], i) => {
    const cx = M - 6 + cw * i + 12;
    if (i > 0) pdf.line(M - 6 + cw * i, y - 6, M - 6 + cw * i, y + stripH - 16, LINE, 0.6);
    pdf.text(lbl, cx, y + 2, { size: 7, color: MUTED });
    pdf.text(val, cx, y + 18, {
      size: 12.5,
      font: "bold",
      color: i === 3 && line.lop_days > 0 ? "#dc2626" : NAVY,
    });
  });
  y += stripH + 20;

  // Centered document title, just above the earnings structure table.
  pdf.text(`PAYSLIP · ${monthLabel(run.period_month).toUpperCase()}`, (M + right) / 2, y, {
    size: 13,
    font: "bold",
    color: BLUE,
    align: "center",
  });
  y += 22;

  // earnings / deductions table
  const midX = M + (right - M) / 2;
  pdf.rect(M - 6, y - 11, right - M + 12, 20, NAVY);
  pdf.text("EARNINGS", M, y + 3, { size: 8.5, font: "bold", color: "#ffffff" });
  pdf.text("AMOUNT", midX - 12, y + 3, { size: 8.5, font: "bold", color: "#ffffff", align: "right" });
  pdf.text("DEDUCTIONS", midX + 12, y + 3, { size: 8.5, font: "bold", color: "#ffffff" });
  pdf.text("AMOUNT", right, y + 3, { size: 8.5, font: "bold", color: "#ffffff", align: "right" });
  y += 24;

  const earnings: [string, number][] = [
    [`Earned gross (${paidDays}/${line.total_days} days)`, line.earned_gross],
  ];
  if (line.incentive > 0) earnings.push(["Incentive", line.incentive]);
  for (const a of line.additions ?? []) earnings.push([a.label || "Addition", a.amount]);
  const deductions: [string, number][] = (line.deductions ?? []).map((d) => [
    d.label || "Deduction",
    d.amount,
  ]);

  const rows = Math.max(earnings.length, deductions.length);
  const startY = y;
  for (let i = 0; i < rows; i++) {
    const e = earnings[i];
    const d = deductions[i];
    if (e) {
      pdf.text(e[0], M, y, { size: 9.5, color: "#42506b" });
      pdf.text(money(e[1]), midX - 12, y, { size: 9.5, font: "bold", align: "right" });
    }
    if (d) {
      pdf.text(d[0], midX + 12, y, { size: 9.5, color: "#42506b" });
      pdf.text(money(d[1]), right, y, { size: 9.5, font: "bold", align: "right" });
    }
    y += 16;
  }
  y = Math.max(y, startY + 16) + 4;
  pdf.line(M - 6, y - 8, right + 6, y - 8, LINE, 0.8);

  const grossTotal = line.earned_gross + line.incentive + sumLines(line.additions);
  const dedTotal = sumLines(line.deductions);
  pdf.text("Total earnings", M, y + 4, { size: 9.5, font: "bold", color: NAVY });
  pdf.text(money(grossTotal), midX - 12, y + 4, { size: 9.5, font: "bold", align: "right" });
  pdf.text("Total deductions", midX + 12, y + 4, { size: 9.5, font: "bold", color: NAVY });
  pdf.text(money(dedTotal), right, y + 4, { size: 9.5, font: "bold", align: "right" });
  y += 26;

  // net pay
  pdf.rect(M - 6, y - 12, right - M + 12, 26, "#eef4fe");
  pdf.text("NET PAY", M, y + 4, { size: 11, font: "bold", color: NAVY });
  pdf.text(money(line.net_pay), right, y + 4, {
    size: 13,
    font: "bold",
    color: BLUE,
    align: "right",
  });
  y += 32;

  pdf.text("Amount in words", M, y, { size: 8, font: "bold", color: MUTED });
  y = pdf.textBlock(amountInWords(line.net_pay), M, y + 13, right - M, {
    size: 9,
    font: "italic",
    color: "#42506b",
  });

  if (line.lop_days > 0) {
    y += 8;
    pdf.text(
      `Salary prorated: paid for ${paidDays} of ${line.total_days} days · ${line.lop_days} day(s) loss of pay (unpaid / LWP).`,
      M,
      y,
      { size: 8.5, color: MUTED },
    );
    y += 12;
  }
  if (line.notes) {
    y += 4;
    pdf.textBlock(line.notes, M, y, right - M, { size: 8.5, color: MUTED });
  }

  pdf.line(M, A4.h - 52, right, A4.h - 52, LINE, 0.7);
  pdf.text("This is a computer-generated payslip and does not require a signature.", M, A4.h - 38, {
    size: 8,
    color: MUTED,
  });
  pdf.text(`${org?.name || "ScoutforU"} · ${monthLabel(run.period_month)}`, right, A4.h - 38, {
    size: 8,
    color: MUTED,
    align: "right",
  });

  return pdf.render();
}
