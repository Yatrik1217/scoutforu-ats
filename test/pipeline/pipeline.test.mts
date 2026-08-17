// Automated tests for the editable per-client pipeline logic.
//   node --import ./test/finance/register.mjs test/pipeline/pipeline.test.mts
import assert from "node:assert/strict";
import {
  buildResolver,
  nextStageSlug,
  isTerminalStage,
  stageName,
  stageColorOf,
  DEFAULT_PIPELINE,
  type PipelineStageRow,
} from "@/lib/pipeline-core";

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

// Helper to fabricate rows quickly.
const row = (
  o: Partial<PipelineStageRow> & { name: string; slug: string; position: number },
): PipelineStageRow => ({
  id: o.slug,
  client_id: o.client_id ?? null,
  color: o.color ?? "#000000",
  outcome: o.outcome ?? "in_progress",
  ...o,
});

// A Default set + one client override.
const CLIENT = "client-acme";
const rows: PipelineStageRow[] = [
  row({ name: "Sourced", slug: "sourced", position: 0 }),
  row({ name: "Screening", slug: "screening", position: 1 }),
  row({ name: "Selected", slug: "selected", position: 2 }),
  row({ name: "Rejected", slug: "rejected", position: 3, outcome: "lost" }),
  row({ name: "Joined", slug: "joined", position: 4, outcome: "won" }),
  // Acme override (unordered on purpose — resolver must sort by position)
  row({ name: "HR Round", slug: "hr_round", position: 1, client_id: CLIENT }),
  row({ name: "Sourced", slug: "sourced", position: 0, client_id: CLIENT }),
  row({ name: "CEO Round", slug: "ceo_round", position: 2, client_id: CLIENT }),
  row({ name: "Rejected", slug: "rejected", position: 3, client_id: CLIENT, outcome: "lost" }),
  row({ name: "Joined", slug: "joined", position: 4, client_id: CLIENT, outcome: "won" }),
];

test("resolver — default list is client_id null, sorted by position", () => {
  const r = buildResolver(rows);
  assert.deepEqual(
    r.default.map((s) => s.slug),
    ["sourced", "screening", "selected", "rejected", "joined"],
  );
});

test("resolver — a client with an override gets its own stages (sorted)", () => {
  const r = buildResolver(rows);
  assert.deepEqual(
    r.forClient(CLIENT).map((s) => s.slug),
    ["sourced", "hr_round", "ceo_round", "rejected", "joined"],
  );
});

test("resolver — a client with no override falls back to Default", () => {
  const r = buildResolver(rows);
  assert.deepEqual(r.forClient("someone-else").map((s) => s.slug), r.default.map((s) => s.slug));
  assert.deepEqual(r.forClient(null).map((s) => s.slug), r.default.map((s) => s.slug));
});

test("resolver — clientIds lists only clients that have an override", () => {
  const r = buildResolver(rows);
  assert.deepEqual(r.clientIds, [CLIENT]);
});

test("resolver — empty rows fall back to the built-in DEFAULT_PIPELINE", () => {
  const r = buildResolver([]);
  assert.equal(r.default.length, DEFAULT_PIPELINE.length);
  assert.deepEqual(r.default.map((s) => s.slug), DEFAULT_PIPELINE.map((s) => s.slug));
  assert.deepEqual(r.clientIds, []);
});

test("nextStageSlug — advances by position", () => {
  const def = buildResolver(rows).default;
  assert.equal(nextStageSlug(def, "sourced"), "screening");
  assert.equal(nextStageSlug(def, "screening"), "selected");
});

test("nextStageSlug — skips 'lost' outcomes (Rejected) on the forward path", () => {
  const def = buildResolver(rows).default;
  // selected -> (rejected is lost, skipped) -> joined
  assert.equal(nextStageSlug(def, "selected"), "joined");
});

test("nextStageSlug — terminal/last stage returns null", () => {
  const def = buildResolver(rows).default;
  assert.equal(nextStageSlug(def, "joined"), null);
});

test("isTerminalStage — won/lost are terminal, in_progress is not", () => {
  const def = buildResolver(rows).default;
  assert.equal(isTerminalStage(def, "joined"), true); // won
  assert.equal(isTerminalStage(def, "rejected"), true); // lost
  assert.equal(isTerminalStage(def, "sourced"), false); // in_progress
});

test("stageName / stageColorOf — resolve by slug, fall back to the slug/grey", () => {
  const acme = buildResolver(rows).forClient(CLIENT);
  assert.equal(stageName(acme, "ceo_round"), "CEO Round");
  assert.equal(stageColorOf(acme, "ceo_round"), "#000000");
  assert.equal(stageName(acme, "nonexistent"), "nonexistent"); // graceful fallback
  assert.equal(stageColorOf(acme, "nonexistent"), "#64748b");
});

test("DEFAULT_PIPELINE — Joined is 'won', Not Joined is 'lost'", () => {
  const joined = DEFAULT_PIPELINE.find((s) => s.slug === "joined");
  const notJoined = DEFAULT_PIPELINE.find((s) => s.slug === "not_joined");
  assert.equal(joined?.outcome, "won");
  assert.equal(notJoined?.outcome, "lost");
});

console.log("\nPipeline logic tests");
console.log(results.join("\n"));
console.log(`\n  ${pass} passed, ${results.length - pass} failed\n`);
if (pass !== results.length) process.exit(1);
