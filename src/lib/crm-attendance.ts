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
function spans(a: CrmAttendance) {
  const s = sessionsOf(a);
  if (!s.length) return { firstIn: null as string | null, grossMin: 0, netMin: 0 };
  const now = Date.now();
  let netMs = 0;
  for (const x of s) {
    const inMs = new Date(x.in).getTime();
    const outMs = x.out ? new Date(x.out).getTime() : now;
    netMs += Math.max(0, outMs - inMs);
  }
  const firstIn = s[0].in;
  const lastRaw = s[s.length - 1].out;
  const lastMs = lastRaw ? new Date(lastRaw).getTime() : now;
  const grossMs = Math.max(0, lastMs - new Date(firstIn).getTime());
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

/**
 * Read-only CRM salespeople for the given month days. Returns [] (never throws)
 * if the CRM blob can't be read — the ATS register still renders its own staff.
 */
export async function getCrmSalespeopleAttendance(
  days: string[],
  todayISO: string,
): Promise<CrmAttnRow[]> {
  let db: CrmDB;
  try {
    const svc = createServiceClient();
    const { data, error } = await svc.storage.from(CRM_BUCKET).download(CRM_OBJECT);
    if (error || !data) return [];
    db = JSON.parse(await data.text()) as CrmDB;
  } catch {
    return [];
  }

  const cfg: CrmConfig = db.attendanceConfig || {};
  const attn = Array.isArray(db.attendance) ? db.attendance : [];
  const byUserDate = new Map<string, CrmAttendance>();
  for (const a of attn) byUserDate.set(`${a.userId}|${a.date}`, a);

  const salespeople = (db.users || []).filter(
    (u) => u.active !== false && u.role === "salesperson",
  );

  return salespeople.map((u) => {
    const statuses: Record<string, AttendanceStatus> = {};
    const summary = {
      present: 0,
      halfDay: 0,
      leave: 0,
      absent: 0,
      late: 0,
      grossMin: 0,
      netMin: 0,
    };
    for (const ds of days) {
      if (ds > todayISO) continue; // not yet due
      // Don't back-date absences before the person joined the CRM.
      if (u.createdAt && ds < u.createdAt) continue;
      const rec = byUserDate.get(`${u.id}|${ds}`);
      let st: string;
      if (rec) {
        const sp = spans(rec);
        st = rec.status || "present";
        if (attnLate(sp.firstIn, cfg)) summary.late++;
        summary.grossMin += sp.grossMin;
        summary.netMin += sp.netMin;
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
    return { id: String(u.id), name: u.name, statuses, summary };
  });
}
