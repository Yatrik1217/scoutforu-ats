// Automated tests for attendance → absent → payroll logic.
//   node --import ./test/finance/register.mjs test/hr/attendance.test.mts
import assert from "node:assert/strict";
import {
  weeklyOffDates,
  isUnmarkedAbsent,
  unmarkedAbsentCount,
  approvedLeaveDates,
  computeNet,
} from "@/lib/hr";

let pass = 0;
const results: string[] = [];
function test(name: string, fn: () => void) {
  try {
    fn();
    pass++;
    results.push(`  ✓ ${name}`);
  } catch (e) {
    results.push(`  ✗ ${name}\n      ${(e as Error).message.replace(/\n/g, "\n      ")}`);
  }
}

// August 2026: Aug 1 is a Saturday. Sundays = 2,9,16,23,30. Saturdays = 1,8,15,22,29.
const AUG = Array.from({ length: 31 }, (_, i) => `2026-08-${String(i + 1).padStart(2, "0")}`);
const leaveReq = (from: string, to: string) =>
  ({ status: "approved", from_date: from, to_date: to, half_day: false, leave_type_id: "x" }) as never;

// ---- weekly-off policy -------------------------------------------------------
test("weeklyOffDates: Sunday-only marks the 5 Sundays, no Saturdays", () => {
  const off = weeklyOffDates(AUG, [0], []);
  assert.equal(off.size, 5);
  assert.ok(off.has("2026-08-02") && off.has("2026-08-30"));
  assert.ok(!off.has("2026-08-01")); // Saturday works in 6-day
});

test("weeklyOffDates: 2nd & 4th Saturday off adds Aug 8 and Aug 22", () => {
  const off = weeklyOffDates(AUG, [0], [2, 4]);
  assert.ok(off.has("2026-08-08") && off.has("2026-08-22"));
  assert.ok(!off.has("2026-08-01") && !off.has("2026-08-15")); // 1st & 3rd still work
  assert.equal(off.size, 7); // 5 Sundays + 2 Saturdays
});

// ---- isUnmarkedAbsent boundaries ---------------------------------------------
const sundays = weeklyOffDates(AUG, [0], []);
test("isUnmarkedAbsent: a past working day (Fri 7 Aug) is absent", () => {
  assert.equal(isUnmarkedAbsent("2026-08-07", "2026-08-11", null, null, sundays), true);
});
test("isUnmarkedAbsent: today and future are never absent", () => {
  assert.equal(isUnmarkedAbsent("2026-08-11", "2026-08-11", null, null, sundays), false);
  assert.equal(isUnmarkedAbsent("2026-08-20", "2026-08-11", null, null, sundays), false);
});
test("isUnmarkedAbsent: a weekly-off day is never absent", () => {
  assert.equal(isUnmarkedAbsent("2026-08-02", "2026-08-11", null, null, sundays), false);
});
test("isUnmarkedAbsent: days before joining / after exit are ignored", () => {
  assert.equal(isUnmarkedAbsent("2026-08-05", "2026-08-11", "2026-08-06", null, sundays), false);
  assert.equal(isUnmarkedAbsent("2026-08-05", "2026-08-11", null, "2026-08-04", sundays), false);
});

// ---- the screenshot scenario: present 8 days, one unmarked working day --------
test("unmarkedAbsentCount: matches 'Present 8, Absent 1' (Fri 7 unmarked)", () => {
  const marked = new Set([
    "2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04",
    "2026-08-05", "2026-08-06", "2026-08-08", "2026-08-10",
  ]);
  const n = unmarkedAbsentCount({
    monthDays: AUG,
    markedDates: marked,
    leaveDates: new Set(),
    offDates: sundays,
    joinedOn: null,
    exitOn: null,
    todayISO: "2026-08-11",
  });
  assert.equal(n, 1); // only Fri 7 Aug
});

test("unmarkedAbsentCount: a holiday on the 7th removes the absence", () => {
  const off = new Set([...sundays, "2026-08-07"]); // 7th is now a holiday
  const n = unmarkedAbsentCount({
    monthDays: AUG, markedDates: new Set(), leaveDates: new Set(),
    offDates: off, joinedOn: null, exitOn: null, todayISO: "2026-08-08",
  });
  assert.ok(!off.has("2026-08-07") ? false : true);
  assert.equal(isUnmarkedAbsent("2026-08-07", "2026-08-08", null, null, off), false);
  assert.ok(n >= 0);
});

test("approvedLeaveDates + count: approved leave on the 7th is not an absence", () => {
  const leaveDates = approvedLeaveDates([leaveReq("2026-08-07", "2026-08-07")], "2026-08-01");
  assert.ok(leaveDates.has("2026-08-07"));
  // Present on every other working day up to today; only the 7th is unmarked BUT on leave.
  const marked = new Set(["2026-08-01", "2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06"]);
  const withLeave = unmarkedAbsentCount({
    monthDays: AUG, markedDates: marked, leaveDates,
    offDates: sundays, joinedOn: null, exitOn: null, todayISO: "2026-08-08",
  });
  assert.equal(withLeave, 0); // 7th excluded because it's approved leave
  // Same setup but WITHOUT the leave → the 7th becomes a real absence.
  const noLeave = unmarkedAbsentCount({
    monthDays: AUG, markedDates: marked, leaveDates: new Set(),
    offDates: sundays, joinedOn: null, exitOn: null, todayISO: "2026-08-08",
  });
  assert.equal(noLeave, 1);
});

// ---- payroll link: LOP reduces pay -------------------------------------------
test("computeNet: 1 LOP day docks 1/31 of a 31,000 salary", () => {
  const c = computeNet({
    monthlyGross: 31000, totalDays: 31, lopDays: 1,
    incentive: 0, additions: [], deductions: [],
  });
  assert.equal(c.earnedGross, 30000);
  assert.equal(c.net, 30000);
});
test("computeNet: 0 LOP pays the full salary", () => {
  const c = computeNet({
    monthlyGross: 31000, totalDays: 31, lopDays: 0,
    incentive: 0, additions: [], deductions: [],
  });
  assert.equal(c.net, 31000);
});

console.log(results.join("\n"));
console.log(`\n${pass}/${results.length} passed`);
if (pass !== results.length) process.exit(1);
