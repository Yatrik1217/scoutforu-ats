import ExcelJS from "exceljs";
import type { EnrichedCandidate, Workspace } from "@/lib/data";
import type { ClientRow, OrganizationRow } from "@/lib/database.types";

// One row of the client-facing submissions tracker.
export type SubmissionRow = {
  candidate: string;
  position: string;
  experience: number | null;
  currentCompany: string;
  currentDesignation: string;
  currentCtc: number | null;
  expectedCtc: number | null;
  noticeDays: number | null;
  location: string;
  email: string;
  phone: string;
  status: string;
  submittedOn: string | null; // ISO
  updatedOn: string | null; // ISO
  recruiterComment: string; // recruiter's assessment for the client
};

// Candidates submitted to a client = anyone who reached the Client-Submit stage
// (or beyond) on a job belonging to that client. Collapsed-stage safety: we use
// the pipeline-resolved stagePosition, not the raw slug.
export function submissionsForClient(ws: Workspace, clientId: string): SubmissionRow[] {
  const stages = ws.pipeline.default;
  const submitPos =
    stages.find((s) => s.slug === "client_submit")?.position ??
    (stages.find((s) => s.slug === "screening")?.position ?? 1) + 1;

  const rows = ws.candidates
    .filter((c) => c.clientId === clientId && c.stagePosition >= submitPos)
    .sort(
      (a, b) =>
        b.stagePosition - a.stagePosition ||
        (b.created_at ?? "").localeCompare(a.created_at ?? ""),
    )
    .map((c: EnrichedCandidate): SubmissionRow => ({
      candidate: c.name ?? "",
      position: c.jobTitle ?? "",
      experience: c.exp_years ?? null,
      currentCompany: c.current_company ?? "",
      currentDesignation: c.current_designation ?? "",
      currentCtc: c.current_ctc_lpa ?? null,
      expectedCtc: c.expected_ctc_lpa ?? null,
      noticeDays: c.notice_period_days ?? null,
      location: c.location ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
      status: c.on_hold ? `${c.stageName} (On hold)` : c.stageName,
      submittedOn: c.created_at ?? null,
      updatedOn: c.entered_stage_at ?? null,
      recruiterComment: c.recruiter_comment ?? "",
    }));
  return rows;
}

const BRAND = "FF2A6FDB"; // ScoutforU blue
const HEADER_TEXT = "FFFFFFFF";

const fmtDate = (iso: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(+d)
    ? ""
    : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};
const lpa = (n: number | null): string => (n == null ? "" : `${n} LPA`);

// Build a formatted .xlsx workbook for one client's submissions. Returns the
// file bytes ready to stream as a download.
export async function buildSubmissionsWorkbook(input: {
  client: ClientRow;
  org: OrganizationRow | null;
  rows: SubmissionRow[];
}): Promise<Buffer> {
  const { client, org, rows } = input;
  const wb = new ExcelJS.Workbook();
  wb.creator = org?.name || "ScoutforU";
  wb.created = new Date();
  const ws = wb.addWorksheet("Submissions", {
    views: [{ state: "frozen", ySplit: 4 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const columns: { header: string; key: keyof SubmissionRow | "sno"; width: number }[] = [
    { header: "#", key: "sno", width: 5 },
    { header: "Candidate", key: "candidate", width: 22 },
    { header: "Position", key: "position", width: 26 },
    { header: "Exp (yrs)", key: "experience", width: 9 },
    { header: "Current Company", key: "currentCompany", width: 22 },
    { header: "Current Designation", key: "currentDesignation", width: 24 },
    { header: "Current CTC", key: "currentCtc", width: 12 },
    { header: "Expected CTC", key: "expectedCtc", width: 12 },
    { header: "Notice (days)", key: "noticeDays", width: 12 },
    { header: "Location", key: "location", width: 16 },
    { header: "Email", key: "email", width: 26 },
    { header: "Phone", key: "phone", width: 15 },
    { header: "Current Status", key: "status", width: 20 },
    { header: "Recruiter Comments", key: "recruiterComment", width: 44 },
    { header: "Submitted On", key: "submittedOn", width: 14 },
    { header: "Updated On", key: "updatedOn", width: 14 },
  ];
  const lastCol = columns.length;
  const colLetter = (n: number) => wb.worksheets[0].getColumn(n).letter;

  // Row 1: company / title. Row 2: client + meta. Row 3: blank. Row 4: headers.
  ws.mergeCells(1, 1, 1, lastCol);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = `${org?.name || "ScoutforU"} — Candidate Submissions`;
  titleCell.font = { bold: true, size: 15, color: { argb: BRAND } };
  titleCell.alignment = { vertical: "middle" };
  ws.getRow(1).height = 22;

  ws.mergeCells(2, 1, 2, lastCol);
  const subCell = ws.getCell(2, 1);
  subCell.value = `Client: ${client.name}    •    ${rows.length} candidate${
    rows.length === 1 ? "" : "s"
  }    •    Generated ${fmtDate(new Date().toISOString())}`;
  subCell.font = { size: 10.5, color: { argb: "FF6B7280" } };
  ws.getRow(3).height = 4;

  // Header row (row 4).
  const headerRow = ws.getRow(4);
  columns.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, size: 10.5, color: { argb: HEADER_TEXT } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { bottom: { style: "thin", color: { argb: "FFBFD0EE" } } };
  });
  headerRow.height = 26;
  columns.forEach((c, i) => (ws.getColumn(i + 1).width = c.width));

  // Data rows (from row 5).
  rows.forEach((r, idx) => {
    const row = ws.getRow(5 + idx);
    const vals: (string | number)[] = [
      idx + 1,
      r.candidate,
      r.position,
      r.experience ?? "",
      r.currentCompany,
      r.currentDesignation,
      lpa(r.currentCtc),
      lpa(r.expectedCtc),
      r.noticeDays ?? "",
      r.location,
      r.email,
      r.phone,
      r.status,
      r.recruiterComment,
      fmtDate(r.submittedOn),
      fmtDate(r.updatedOn),
    ];
    const commentCol = 13; // 0-based index of "Recruiter Comments"
    vals.forEach((v, i) => {
      const cell = row.getCell(i + 1);
      cell.value = v;
      cell.font = { size: 10 };
      cell.alignment = {
        vertical: "middle",
        horizontal: i === 0 || i === 3 || i === 8 ? "center" : "left",
        wrapText: i === commentCol, // wrap the (long) recruiter comment
      };
    });
    // Zebra striping for readability.
    if (idx % 2 === 1) {
      for (let i = 1; i <= lastCol; i++)
        row.getCell(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF6F8FB" } };
    }
    // No fixed height — Excel auto-fits so wrapped recruiter comments show fully.
  });

  // Thin outer border around the table.
  const firstDataRow = 4;
  const lastRow = 4 + rows.length;
  for (let r = firstDataRow; r <= lastRow; r++) {
    for (let c = 1; c <= lastCol; c++) {
      const cell = ws.getCell(r, c);
      cell.border = {
        ...cell.border,
        top: { style: "hair", color: { argb: "FFE5E9F0" } },
        left: { style: "hair", color: { argb: "FFE5E9F0" } },
        right: { style: "hair", color: { argb: "FFE5E9F0" } },
        bottom: { style: "hair", color: { argb: "FFE5E9F0" } },
      };
    }
  }

  // Auto-filter over the header + data.
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: Math.max(4, lastRow), column: lastCol } };
  void colLetter;

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
