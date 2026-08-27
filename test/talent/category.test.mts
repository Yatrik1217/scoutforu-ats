// Tests for the Talent Bank auto-categorizer.
//   node --import ./test/finance/register.mjs test/talent/category.test.mts
import assert from "node:assert/strict";
import { categorizeResume } from "@/lib/talent-category";

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

const cat = (skills: string[], designation = "", functionalArea = "") =>
  categorizeResume({ skills, designation, functionalArea });

test(".NET / C# → .NET", () => assert.equal(cat(["C#", "ASP.NET", "SQL Server"]), ".NET"));
test("PL/SQL + Oracle APEX → PL-SQL / Oracle", () =>
  assert.equal(cat(["PL/SQL", "Oracle APEX", "Oracle Forms"], "PLSQL Developer"), "PL-SQL / Oracle"));
test("Java Spring → Java", () => assert.equal(cat(["Java", "Spring Boot", "Hibernate"]), "Java"));
test("React/Angular → Frontend / UI", () => assert.equal(cat(["React", "TypeScript", "CSS"]), "Frontend / UI"));
test("AWS + Kubernetes → DevOps / Cloud", () => assert.equal(cat(["AWS", "Kubernetes", "Terraform"]), "DevOps / Cloud"));
test("Selenium → QA / Testing", () => assert.equal(cat(["Selenium", "Test Automation"]), "QA / Testing"));
test("Machine learning → Data Science / AI", () => assert.equal(cat(["Machine Learning", "TensorFlow"]), "Data Science / AI"));
test("Android/Flutter → Mobile", () => assert.equal(cat(["Android", "Flutter", "Kotlin"]), "Mobile"));
test("BDE by designation → Sales / BDE", () => assert.equal(cat([], "Business Development Executive", ""), "Sales / BDE"));
test("Sales via functional-area fallback → Sales / BDE", () =>
  assert.equal(cat(["Negotiation"], "", "Sales / Business Development"), "Sales / BDE"));
test("unknown skills → Other", () => assert.equal(cat(["Blacksmithing"], "Artisan", ""), "Other"));
test("specific wins over generic: .NET before generic dev", () =>
  assert.equal(cat(["C#", "JavaScript"]), ".NET"));

console.log("\nTalent Bank categorizer tests");
console.log(results.join("\n"));
console.log(`\n  ${pass} passed, ${results.length - pass} failed\n`);
if (pass !== results.length) process.exit(1);
