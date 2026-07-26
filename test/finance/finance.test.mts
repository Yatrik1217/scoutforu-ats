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
