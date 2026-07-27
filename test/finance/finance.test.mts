// Unit tests for the pure finance logic. Run with Node's native TS support:
//   node --import ./register.mjs finance.test.mts
import assert from "node:assert/strict";
import {
  nextDueOnOrAfter,
  computeNextDue,
  advanceAfterPayment,
  monthsInRange,
  duePaymentDates,
  computeProfitAndLoss,
  categoryTotals,
  portfolioSummary,
  investmentGain,
  commitmentsDueBetween,
  buildDueItems,
  scheduledForMonth,
  monthPeriod,
  monthlySipOutflow,
  emiOutstanding,
  emiRemainingCount,
  financialYearPeriod,
  inPeriod,
} from "@/lib/finance";

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
const cat = (id: string, addback: boolean, name = id) => ({ id, ebitda_addback: addback, name, color: "#000" });

// ---- due-date logic ----------------------------------------------------------
test("nextDueOnOrAfter: day already passed → next month", () => {
  assert.equal(nextDueOnOrAfter("2026-07-26", 10), "2026-08-10");
});
test("nextDueOnOrAfter: day still ahead → this month", () => {
  assert.equal(nextDueOnOrAfter("2026-07-05", 10), "2026-07-10");
});
test("nextDueOnOrAfter: exactly on the day → same day", () => {
  assert.equal(nextDueOnOrAfter("2026-07-10", 10), "2026-07-10");
});
test("nextDueOnOrAfter: clamps day 31 to Feb month-end", () => {
  assert.equal(nextDueOnOrAfter("2026-02-15", 31), "2026-02-28");
});

test("computeNextDue: active loan → next upcoming, never in the past", () => {
  const due = computeNextDue(
    { start_date: "2025-01-01", due_day: 5, paid_installments: 3, total_installments: 60, status: "active" },
    new Date("2026-07-26T00:00:00"),
  );
  assert.equal(due, "2026-08-05");
});
test("computeNextDue: fully-paid loan → null", () => {
  const due = computeNextDue(
    { start_date: "2025-01-01", due_day: 5, paid_installments: 60, total_installments: 60, status: "active" },
    new Date("2026-07-26T00:00:00"),
  );
  assert.equal(due, null);
});
test("computeNextDue: future start date anchors to the start", () => {
  const due = computeNextDue(
    { start_date: "2026-09-01", due_day: 10, paid_installments: 0, total_installments: 0, status: "active" },
    new Date("2026-07-26T00:00:00"),
  );
  assert.equal(due, "2026-09-10");
});

test("advanceAfterPayment: future due advances one month", () => {
  assert.equal(advanceAfterPayment("2026-08-05", 5, new Date("2026-07-26T00:00:00")), "2026-09-05");
});
test("advanceAfterPayment: overdue catches up to the future", () => {
  assert.equal(advanceAfterPayment("2026-06-10", 10, new Date("2026-07-26T00:00:00")), "2026-08-10");
});

// ---- month enumeration & back-fill dates -------------------------------------
test("monthsInRange: April→July gives 4 months", () => {
  const m = monthsInRange("2026-04-01", "2026-07-31").map((x) => x.key);
  assert.deepEqual(m, ["2026-04", "2026-05", "2026-06", "2026-07"]);
});
test("duePaymentDates: one per month from FY start", () => {
  const d = duePaymentDates({ start_date: "2025-01-01", due_day: 5 }, "2026-04-01", "2026-07-31");
  assert.deepEqual(d, ["2026-04-05", "2026-05-05", "2026-06-05", "2026-07-05"]);
});
test("duePaymentDates: never before the commitment's start date", () => {
  const d = duePaymentDates({ start_date: "2026-05-15", due_day: 5 }, "2026-04-01", "2026-07-31");
  assert.deepEqual(d, ["2026-06-05", "2026-07-05"]); // May-05 skipped (before the 15th start)
});

// ---- P&L / EBITDA ------------------------------------------------------------
test("computeProfitAndLoss: EBITDA excludes add-backs, income lifts revenue", () => {
  const cats = [cat("c1", false, "Rent"), cat("c2", true, "Interest")];
  const rows = [
    { amount: 100, is_income: false, category_id: "c1" },
    { amount: 20, is_income: false, category_id: "c2" }, // interest → add-back
    { amount: 50, is_income: true, category_id: null }, // other income
  ];
  const pl = computeProfitAndLoss(rows as never, cats as never, 200);
  assert.equal(pl.revenue, 250, "revenue = collected + income");
  assert.equal(pl.operatingExpenses, 100, "opex excludes interest");
  assert.equal(pl.addBacks, 20, "interest is an add-back");
  assert.equal(pl.ebitda, 150, "EBITDA = revenue − opex");
  assert.equal(pl.netProfit, 130, "net = EBITDA − add-backs");
  assert.equal(Number(pl.ebitdaMargin.toFixed(2)), 0.6);
});
test("categoryTotals: splits income vs expense", () => {
  const cats = [cat("c1", false, "Home")];
  const rows = [
    { amount: 300, is_income: false, category_id: "c1" },
    { amount: 100, is_income: true, category_id: null },
  ];
  const t = categoryTotals(rows as never, cats as never);
  assert.equal(t.totalExpense, 300);
  assert.equal(t.totalIncome, 100);
});

// ---- investments -------------------------------------------------------------
test("portfolioSummary: invested = lump + contributions, gain vs value", () => {
  const sips = [
    { type: "sip", status: "active", principal: 1000, paid_installments: 10, emi_amount: 500, current_value: 7000 },
  ];
  const p = portfolioSummary(sips as never);
  assert.equal(p.invested, 6000);
  assert.equal(p.value, 7000);
  assert.equal(p.gain, 1000);
  assert.equal(p.monthly, 500);
});
test("investmentGain: negative when value < invested", () => {
  const g = investmentGain({ principal: 0, paid_installments: 4, emi_amount: 1000, current_value: 3500 } as never);
  assert.equal(g.invested, 4000);
  assert.equal(g.gain, -500);
});

// ---- dues / cash-out ---------------------------------------------------------
test("commitmentsDueBetween: includes all active types in range, excludes paused/out-of-range", () => {
  const emis = [
    { id: "a", type: "loan", status: "active", next_due_date: "2026-08-05", emi_amount: 1 },
    { id: "b", type: "sip", status: "active", next_due_date: "2026-08-10", emi_amount: 1 },
    { id: "c", type: "bill", status: "active", next_due_date: "2026-08-01", emi_amount: 1 },
    { id: "d", type: "loan", status: "paused", next_due_date: "2026-08-03", emi_amount: 1 },
    { id: "e", type: "loan", status: "active", next_due_date: "2026-12-01", emi_amount: 1 },
  ];
  const due = commitmentsDueBetween(emis as never, "2026-07-26", "2026-09-24").map((x) => x.id);
  assert.deepEqual(due, ["c", "a", "b"]); // sorted by date, paused + far-future excluded
});
test("buildDueItems: merges commitments + future one-off bills, sorted by date", () => {
  const cats = [{ id: "c1", name: "Software", color: "#111", ebitda_addback: false }];
  const emis = [
    { id: "l1", type: "loan", status: "active", next_due_date: "2026-08-05", emi_amount: 8046, scope: "personal", name: "Car Loan" },
    { id: "s1", type: "sip", status: "active", next_due_date: "2026-08-07", emi_amount: 2500, scope: "personal", name: "SIP" },
  ];
  const expenses = [
    { id: "e1", is_income: false, emi_id: null, txn_date: "2026-08-01", amount: 1500, category_id: "c1", title: "Claude", scope: "company" },
    { id: "e2", is_income: true, emi_id: null, txn_date: "2026-08-02", amount: 999, category_id: null, title: "income", scope: "company" }, // income excluded
    { id: "e3", is_income: false, emi_id: "l1", txn_date: "2026-08-03", amount: 8046, category_id: null, title: "mirror", scope: "personal" }, // emi mirror excluded
  ];
  const items = buildDueItems(emis as never, expenses as never, cats as never, "2026-07-26", "2026-08-25");
  // sorted by date: Claude bill (1 Aug), Car Loan (5 Aug), SIP (7 Aug)
  assert.deepEqual(items.map((i) => i.id), ["exp-e1", "emi-l1", "emi-s1"]);
  assert.equal(items[0].tag, "Software"); // one-off bill uses its category name
  assert.equal(items[1].tag, "EMI");
  assert.equal(items[2].tag, "SIP");
});
test("buildDueItems: suppresses a one-off that duplicates a commitment", () => {
  const emis = [
    { id: "l1", type: "loan", status: "active", next_due_date: "2026-08-07", emi_amount: 21428, scope: "personal", name: "Vananta Home Loan" },
  ];
  const expenses = [
    // duplicate of the home loan (same scope+amount, 3 days apart) → suppressed
    { id: "d1", is_income: false, emi_id: null, txn_date: "2026-08-10", amount: 21428, category_id: null, title: "EMI - Vananta", scope: "personal" },
    // a genuine, different bill → kept
    { id: "k1", is_income: false, emi_id: null, txn_date: "2026-08-02", amount: 13000, category_id: null, title: "Salary", scope: "company" },
  ];
  const items = buildDueItems(emis as never, expenses as never, [] as never, "2026-07-26", "2026-08-25");
  const ids = items.map((i) => i.id);
  assert.ok(!ids.includes("exp-d1"), "duplicate one-off should be suppressed");
  assert.ok(ids.includes("emi-l1") && ids.includes("exp-k1"), "commitment + genuine bill kept");
  assert.equal(items.length, 2);
});
test("buildDueItems: excludes income + EMI-mirror expense lines", () => {
  const emis: unknown[] = [];
  const expenses = [
    { id: "e1", is_income: false, emi_id: null, txn_date: "2026-08-01", amount: 100, category_id: null, title: "Bill", scope: "company" },
    { id: "e2", is_income: true, emi_id: null, txn_date: "2026-08-02", amount: 999, category_id: null, title: "income", scope: "company" },
    { id: "e3", is_income: false, emi_id: "x", txn_date: "2026-08-03", amount: 999, category_id: null, title: "mirror", scope: "company" },
  ];
  const items = buildDueItems(emis as never, expenses as never, [] as never, "2026-07-26", "2026-08-25");
  assert.deepEqual(items.map((i) => i.id), ["exp-e1"]);
  assert.equal(items[0].tag, "Bill");
});
test("scheduledForMonth: projects unpaid recurring dues, excludes posted/pre-start/finished", () => {
  const aug = monthPeriod(new Date("2026-08-15T00:00:00"));
  const emis = [
    { id: "l1", type: "loan", status: "active", scope: "personal", name: "Car Loan", emi_amount: 8046, due_day: 5, start_date: "2024-01-01", total_installments: 36, paid_installments: 10 },
    { id: "h1", type: "loan", status: "active", scope: "personal", name: "Home Loan", emi_amount: 21428, due_day: 7, start_date: "2021-01-01", total_installments: 300, paid_installments: 57 },
    { id: "p1", type: "insurance", status: "active", scope: "personal", name: "Kotak", emi_amount: 614, due_day: 5, start_date: "2025-01-01", total_installments: 0, paid_installments: 0 },
    { id: "future", type: "bill", status: "active", scope: "personal", name: "New rent", emi_amount: 5000, due_day: 1, start_date: "2026-10-01", total_installments: 0, paid_installments: 0 }, // starts after Aug
    { id: "done", type: "loan", status: "active", scope: "personal", name: "Old loan", emi_amount: 1000, due_day: 1, start_date: "2020-01-01", total_installments: 12, paid_installments: 12 }, // finished long ago
  ];
  // Car Loan already posted in Aug → should be excluded
  const augExpenses = [{ emi_id: "l1", txn_date: "2026-08-05", amount: 8046, is_income: false }];
  const items = scheduledForMonth(emis as never, augExpenses as never, aug);
  const ids = items.map((i) => i.id);
  assert.deepEqual(ids, ["sched-p1", "sched-h1"], "Kotak (5th) then Home Loan (7th); Car posted, rent not started, old loan finished");
  assert.equal(items[1].date, "2026-08-07");
  assert.equal(items[1].amount, 21428);
});
test("scheduledForMonth: SIP judged by next_due, not by expense rows", () => {
  const sip = { id: "s1", type: "sip", status: "active", scope: "personal", name: "HDFC SIP", emi_amount: 3000, due_day: 7, start_date: "2025-01-01", total_installments: 0, paid_installments: 6, next_due_date: "2026-08-07" };
  // July: SIP already scheduled for Aug (next_due 7 Aug) → NOT due in July
  const julyItems = scheduledForMonth([sip] as never, [] as never, monthPeriod(new Date("2026-07-20T00:00:00")));
  assert.deepEqual(julyItems.map((i) => i.id), [], "SIP with next_due in Aug is not due in July");
  // August: next_due 7 Aug falls in the month → scheduled
  const augItems = scheduledForMonth([sip] as never, [] as never, monthPeriod(new Date("2026-08-20T00:00:00")));
  assert.deepEqual(augItems.map((i) => i.id), ["sched-s1"]);
  assert.equal(augItems[0].amount, 3000);
});
test("monthlySipOutflow: sums only active SIPs", () => {
  const emis = [
    { type: "sip", status: "active", emi_amount: 500 },
    { type: "sip", status: "paused", emi_amount: 999 },
    { type: "loan", status: "active", emi_amount: 999 },
  ];
  assert.equal(monthlySipOutflow(emis as never), 500);
});

// ---- loan maths --------------------------------------------------------------
test("emiOutstanding & remaining", () => {
  const loan = { total_installments: 60, paid_installments: 12, emi_amount: 15000 };
  assert.equal(emiRemainingCount(loan as never), 48);
  assert.equal(emiOutstanding(loan as never), 720000);
});

// ---- financial year ----------------------------------------------------------
test("financialYearPeriod: Apr–Mar window for a July date", () => {
  const fy = financialYearPeriod(new Date("2026-07-26T00:00:00"));
  assert.equal(fy.from, "2026-04-01");
  assert.equal(fy.to, "2027-03-31");
  assert.ok(inPeriod("2026-08-01", fy));
  assert.ok(!inPeriod("2027-04-01", fy));
});

console.log(results.join("\n"));
const total = results.length;
console.log(`\n${pass}/${total} passed`);
process.exit(pass === total ? 0 : 1);
