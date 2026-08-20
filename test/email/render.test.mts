// Automated tests for email/SMS template rendering — the fix for candidate
// emails that went out with raw {{candidate_name}} / {{job_title}} placeholders.
//   node --import ./test/finance/register.mjs test/email/render.test.mts
import assert from "node:assert/strict";
import { renderTemplate } from "@/lib/template-render";

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

const vars = {
  name: "Hitesh Dhandhla",
  candidate_name: "Hitesh Dhandhla",
  first_name: "Hitesh",
  job_title: "Finance Manager",
  client_name: "Acme Corp",
  sender_name: "Yashashvi Shah",
};

test("substitutes the exact placeholders that leaked in the reported bug", () => {
  const out = renderTemplate(
    "Dear {{candidate_name}}, Your interview for {{job_title}} has been scheduled.\nRegards,\n{{sender_name}}",
    vars,
  );
  assert.equal(
    out,
    "Dear Hitesh Dhandhla, Your interview for Finance Manager has been scheduled.\nRegards,\nYashashvi Shah",
  );
});

test("subject line placeholders are filled too", () => {
  assert.equal(renderTemplate("Interview scheduled — {{job_title}}", vars), "Interview scheduled — Finance Manager");
});

test("is case-insensitive and tolerates inner whitespace", () => {
  assert.equal(renderTemplate("Hi {{ Candidate_Name }}", vars), "Hi Hitesh Dhandhla");
});

test("supports the legacy {{name}} / {{first_name}} tokens", () => {
  assert.equal(renderTemplate("{{name}} / {{first_name}}", vars), "Hitesh Dhandhla / Hitesh");
});

test("CRITICAL: an unknown token is cleared, never delivered raw", () => {
  const out = renderTemplate("Hi {{candidate_name}} {{unknown_token}}!", vars);
  assert.equal(out, "Hi Hitesh Dhandhla !");
  assert.ok(!out.includes("{{"), "no raw placeholder may survive");
});

test("empty / missing text is safe", () => {
  assert.equal(renderTemplate("", vars), "");
});

console.log("\nEmail template rendering tests");
console.log(results.join("\n"));
console.log(`\n  ${pass} passed, ${results.length - pass} failed\n`);
if (pass !== results.length) process.exit(1);
