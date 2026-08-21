// Read-only bridge into the Outreach CRM's attendance.
//
// The CRM stores its entire database as a single JSON blob in the Supabase
// STORAGE bucket "crm" (object "db.json") — the same Supabase project as this
// ATS. Salespeople (e.g. Sweta) check in from the CRM, never from the ATS, so
// they have no `employees` row here. To show their attendance alongside ATS
// staff on the Register, we download that blob server-side with the service
// role and compute each CRM salesperson's month the same way the CRM does
// (IST wall-clock, sessions → gross/net, un-marked past working day = absent).
//
// This is strictly DISPLAY-ONLY: nothing here writes back to the CRM, and these
// rows never feed ATS payroll / loss-of-pay.

import { createServiceClient } from "@/lib/supabase/server";
import type { AttendanceStatus } from "@/lib/database.types";

const CRM_BUCKET = process.env.CRM_BUCKET || "crm";
const CRM_OBJECT = "db.json";

// ---- CRM data shapes (only the parts we read) ---------------------------------
type CrmSession = { in: string; out: string | null };
type CrmAttendance = {
  userId: string | number;
  date: string; // YYYY-MM-DD
  status?: string;
  sessions?: CrmSession[];
  checkInAt?: string | null;
  checkOutAt?: string | null;
};
type CrmUser = {
  id: string | number;
  name: string;
  role: string;
  active?: boolean;
  createdAt?: string;
};
type CrmHoliday = { date: string; name?: string };
type CrmConfig = {
  shiftStart?: string;
  shiftEnd?: string;
  graceMinutes?: number;
  fullDayHours?: number;
  halfDayHours?: number;
  weeklyOffs?: number[];
  saturdayOffWeeks?: number[];
  holidays?: CrmHoliday[];
};
type CrmDB = {
  users?: CrmUser[];
  attendance?: CrmAttendance[];
  attendanceConfig?: CrmConfig;
};

// ---- IST wall-clock helpers (mirror the CRM's app.js) -------------------------
const IST_MS = 5.5 * 3600 * 1000;
const istDateStr = (d = new Date()) =>
  new Date(d.getTime() + IST_MS).toISOString().slice(0, 10);
const istHM = (d: Date) => new Date(d.getTime() + IST_MS).toISOString().slice(11, 16);

function isWorkingDay(dateStr: string, cfg: CrmConfig): boolean {
  const d = new Date(dateStr + "T00:00:00Z");
  const dow = d.getUTCDay(); // 0=Sun..6=Sat
  if ((cfg.weeklyOffs || []).includes(dow)) return false;
  if (dow === 6) {
    const nth = Math.ceil(d.getUTCDate() / 7);
    if ((cfg.saturdayOffWeeks || []).includes(nth)) return false;
  }
  if ((cfg.holidays || []).some((h) => h.date === dateStr)) return false;
  return true;
}

function attnLate(checkInAt: string | null, cfg: CrmConfig): boolean {
  if (!checkInAt) return false;
  const [h, m] = istHM(new Date(checkInAt)).split(":").map(Number);
  const [sh, sm] = String(cfg.shiftStart || "10:00").split(":").map(Number);
  return h * 60 + m > sh * 60 + sm + (Number(cfg.graceMinutes) || 0);
}

function sessionsOf(a: CrmAttendance): CrmSession[] {
  if (Array.isArray(a.sessions)) return a.sessions;
  return a.checkInAt ? [{ in: a.checkInAt, out: a.checkOutAt || null }] : [];
}

// Gross = first-in → last-out (minutes); Net = sum of sessions (minutes).
// A session with out=null is still open. On TODAY that means "clocked in now",
// so it runs to the current time. On a PAST day it means someone forgot to
// check out — we must NOT count it until now (that inflates to hundreds of
// hours), so we cap it at that day's shift end.
function spans(a: CrmAttendance, cfg: CrmConfig, todayISO: string) {
  const s = sessionsOf(a);
  if (!s.length) return { firstIn: null as string | null, grossMin: 0, netMin: 0 };
  const now = Date.now();
  const isToday = a.date === todayISO;
  // Shift end on this record's day, in IST.
  const shiftEndMs = new Date(`${a.date}T${cfg.shiftEnd || "19:00"}:00+05:30`).getTime();
  const closeOf = (inMs: number) => (isToday ? now : Math.max(inMs, shiftEndMs));

  let netMs = 0;
  let lastOutMs = 0;
  for (const x of s) {
    const inMs = new Date(x.in).getTime();
    const outMs = x.out ? new Date(x.out).getTime() : closeOf(inMs);
    netMs += Math.max(0, outMs - inMs);
    if (outMs > lastOutMs) lastOutMs = outMs;
  }
  const firstIn = s[0].in;
  const grossMs = Math.max(0, lastOutMs - new Date(firstIn).getTime());
  return {
    firstIn,
    grossMin: Math.round(grossMs / 60000),
    netMin: Math.round(netMs / 60000),
  };
}

function statusForDay(dateStr: string, cfg: CrmConfig): string {
  if (!isWorkingDay(dateStr, cfg))
    return (cfg.holidays || []).some((h) => h.date === dateStr) ? "holiday" : "week_off";
  return dateStr < istDateStr() ? "absent" : "none";
}

const CRM_STATUSES: AttendanceStatus[] = [
  "present",
  "absent",
  "half_day",
  "leave",
  "week_off",
  "holiday",
];

// ---- public shape -------------------------------------------------------------
export type CrmAttnRow = {
  id: string;
  name: string;
  statuses: Record<string, AttendanceStatus>; // date → status (real days only)
  times: Record<string, { in: string | null; out: string | null }>; // date → login/logout ISO
  summary: {
    present: number;
    halfDay: number;
    leave: number;
    absent: number;
    late: number;
    grossMin: number;
    netMin: number;
  };
};

// A CRM person we can link an ATS employee record to.
export type CrmUserLite = { id: string; name: string; role: string; active: boolean };

// Download + parse the CRM blob. Returns null (never throws) when unreadable.
async function loadCrmDb(): Promise<CrmDB | null> {
  try {
    const svc = createServiceClient();
    const { data, error } = await svc.storage.from(CRM_BUCKET).download(CRM_OBJECT);
    if (error || !data) return null;
    return JSON.parse(await data.text()) as CrmDB;
  } catch {
    return null;
  }
}

// Compute one CRM user's month from a prepared lookup — shared by the Register
// (many salespeople) and a single employee's profile page.
function computeUserRow(
  u: CrmUser,
  byUserDate: Map<string, CrmAttendance>,
  cfg: CrmConfig,
  days: string[],
  todayISO: string,
): CrmAttnRow {
  const statuses: Record<string, AttendanceStatus> = {};
  const times: Record<string, { in: string | null; out: string | null }> = {};
  const summary = { present: 0, halfDay: 0, leave: 0, absent: 0, late: 0, grossMin: 0, netMin: 0 };
  for (const ds of days) {
    if (ds > todayISO) continue; // not yet due
    // Don't back-date absences before the person joined the CRM.
    if (u.createdAt && ds < u.createdAt) continue;
    const rec = byUserDate.get(`${u.id}|${ds}`);
    let st: string;
    if (rec) {
      const sp = spans(rec, cfg, todayISO);
      st = rec.status || "present";
      if (attnLate(sp.firstIn, cfg)) summary.late++;
      summary.grossMin += sp.grossMin;
      summary.netMin += sp.netMin;
      const sess = sessionsOf(rec);
      times[ds] = { in: sp.firstIn, out: sess.length ? sess[sess.length - 1].out : null };
    } else {
      st = statusForDay(ds, cfg);
    }
    if (st === "none") continue;
    if (!CRM_STATUSES.includes(st as AttendanceStatus)) continue;
    statuses[ds] = st as AttendanceStatus;
    if (st === "present") summary.present++;
    else if (st === "half_day") summary.halfDay++;
    else if (st === "leave") summary.leave++;
    else if (st === "absent") summary.absent++;
  }
  return { id: String(u.id), name: u.name, statuses, times, summary };
}

function indexAttendance(db: CrmDB): Map<string, CrmAttendance> {
  const byUserDate = new Map<string, CrmAttendance>();
  for (const a of Array.isArray(db.attendance) ? db.attendance : []) {
    byUserDate.set(`${a.userId}|${a.date}`, a);
  }
  return byUserDate;
}

/**
 * Read-only CRM salespeople for the given month days. Returns [] (never throws)
 * if the CRM blob can't be read — the ATS register still renders its own staff.
 */
export async function getCrmSalespeopleAttendance(
  days: string[],
  todayISO: string,
): Promise<CrmAttnRow[]> {
  const db = await loadCrmDb();
  if (!db) return [];
  const cfg: CrmConfig = db.attendanceConfig || {};
  const byUserDate = indexAttendance(db);
  return (db.users || [])
    .filter((u) => u.active !== false && u.role === "salesperson")
    .map((u) => computeUserRow(u, byUserDate, cfg, days, todayISO));
}

/**
 * One CRM person's attendance for the given month days, keyed by their CRM user
 * id. Returns null when the blob can't be read or the id isn't found — the ATS
 * employee profile still renders everything else.
 */
export async function getCrmPersonAttendance(
  crmUserId: string,
  days: string[],
  todayISO: string,
): Promise<CrmAttnRow | null> {
  if (!crmUserId) return null;
  const db = await loadCrmDb();
  if (!db) return null;
  const u = (db.users || []).find((x) => String(x.id) === String(crmUserId));
  if (!u) return null;
  const cfg: CrmConfig = db.attendanceConfig || {};
  return computeUserRow(u, indexAttendance(db), cfg, days, todayISO);
}

/**
 * All CRM users, so the admin can link an ATS employee record to a CRM identity.
 * Returns [] when the blob can't be read.
 */
export async function getCrmUsers(): Promise<CrmUserLite[]> {
  const db = await loadCrmDb();
  if (!db) return [];
  return (db.users || []).map((u) => ({
    id: String(u.id),
    name: u.name,
    role: u.role,
    active: u.active !== false,
  }));
}
