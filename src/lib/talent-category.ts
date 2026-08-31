// Auto-file a resume into a technology / domain folder from its skills, job
// title, and functional area — the same idea as sorting a Downloads folder by
// skill. First matching bucket wins (ordered most-specific first). If nothing
// matches, we DON'T dump into "Other": we name a folder from the resume's own
// designation (e.g. "Business Analyst", "Solar Design Engineer"), so every CV
// lands somewhere meaningful. "Other" is a last resort only when a resume has
// no usable job title at all.

// The well-known buckets we actively consolidate into. Folders can also be
// created on the fly from a resume's designation, so this is not exhaustive.
export const TALENT_CATEGORIES = [
  ".NET",
  "Java",
  "Python / Data",
  "PL-SQL / Oracle",
  "Frontend / UI",
  "Node.js / Backend JS",
  "PHP",
  "Mobile",
  "DevOps / Cloud",
  "Data Engineering",
  "QA / Testing",
  "Data Science / AI",
  "Business Analyst",
  "Solar / Renewable Energy",
  "Sales / BDE",
  "Marketing",
  "HR",
  "Finance / Accounting",
  "Design / UX",
  "Support / Ops",
  "Other",
] as const;

export type TalentCategory = (typeof TALENT_CATEGORIES)[number];

// [category, keywords] — matched (case-insensitive, substring) against the
// combined skills + designation + functional-area text. Specific TECH tokens
// come first so a real developer is never mis-filed as a Business Analyst just
// because their resume mentions "user stories".
const RULES: [string, string[]][] = [
  [".NET", [".net", "dotnet", "c#", "asp.net", "asp net", "vb.net", "blazor", "wpf", "wcf"]],
  ["PL-SQL / Oracle", ["pl/sql", "plsql", "pl sql", "oracle apex", "oracle forms", "oracle db", "oracle developer", "d2k"]],
  ["Data Science / AI", ["machine learning", "deep learning", "data scien", "nlp", "tensorflow", "pytorch", "generative ai", "llm", "computer vision"]],
  ["Data Engineering", ["etl", "spark", "hadoop", "data engineer", "informatica", "snowflake", "databricks", "airflow", "kafka"]],
  ["DevOps / Cloud", ["devops", "kubernetes", "docker", "terraform", "jenkins", "ci/cd", "cicd", "aws", "azure devops", "gcp", "ansible", "site reliability", "sre"]],
  ["Mobile", ["android", "ios", "flutter", "react native", "kotlin", "swift", "objective-c"]],
  ["QA / Testing", ["qa", "quality assurance", "selenium", "test automation", "automation testing", "manual testing", "sdet", "cypress", "appium"]],
  ["Java", ["java", "spring boot", "spring", "j2ee", "hibernate", "microservices java", "struts"]],
  ["Python / Data", ["python", "django", "flask", "fastapi", "pandas", "numpy"]],
  ["Node.js / Backend JS", ["node.js", "nodejs", "node js", "express.js", "nestjs", "backend developer"]],
  ["PHP", ["php", "laravel", "codeigniter", "wordpress", "drupal"]],
  ["Frontend / UI", ["react", "angular", "vue", "javascript", "typescript", "frontend", "front-end", "front end", "html", "css", "next.js", "ui developer"]],
  // Solar / renewable-energy field — solar tools + PV vocabulary.
  ["Solar / Renewable Energy", ["solar", "photovoltaic", "pv system", "pvsyst", "solar pv", "renewable energy", "bess", "solar design", "solargraph", "helioscope"]],
  ["Design / UX", ["ux", "ui/ux", "figma", "product design", "graphic design", "adobe xd", "user experience"]],
  // Business Analysis — its own strong vocabulary (kept AFTER the tech rules).
  ["Business Analyst", ["business analyst", "business analysis", "requirement gathering", "requirements gathering", "requirement elicitation", "requirements elicitation", "brd", "frd", "srs documentation", "user stories", "gap analysis", "uat"]],
  ["Sales / BDE", ["business development", "bde", "inside sales", "field sales", "account executive", "sales executive", "sales manager", "lead generation", "b2b sales"]],
  ["Marketing", ["digital marketing", "seo", "sem", "social media", "content marketing", "performance marketing", "brand manager"]],
  ["HR", ["recruiter", "talent acquisition", "human resources", "hr executive", "hr manager", "payroll"]],
  ["Finance / Accounting", ["accountant", "accounts payable", "accounts receivable", "financial analyst", "chartered accountant", "taxation", "audit", "gst"]],
  ["Support / Ops", ["customer support", "technical support", "operations executive", "bpo", "customer service", "help desk"]],
];

// Map a broad functional area (from the resume parser) to a bucket as a fallback.
const FUNCTION_FALLBACK: Record<string, string> = {
  "Sales / Business Development": "Sales / BDE",
  "Marketing / Digital Marketing": "Marketing",
  "Human Resources": "HR",
  "Finance / Accounting": "Finance / Accounting",
  "Design / UX": "Design / UX",
  "Data Science / Analytics": "Data Science / AI",
  "DevOps / Infrastructure": "DevOps / Cloud",
  "Quality Assurance": "QA / Testing",
  "Customer Support": "Support / Ops",
};

// Seniority / qualifier words we strip when turning a raw job title into a
// folder name, so "Sr. Business Analyst" and "Business Analyst" share a folder.
const TITLE_NOISE =
  /\b(sr|senior|jr|junior|lead|principal|chief|head|deputy|trainee|intern|internship|associate|assistant|asst|manager|mgr|executive|exec|consultant|specialist|officer|of|the|i{1,3}|l\d)\b\.?/gi;

// Derive a tidy, shareable folder name from a resume's designation. Returns null
// when there isn't enough of a title to name a folder.
export function folderFromDesignation(designation?: string): string | null {
  if (!designation) return null;
  // Keep only the primary role — drop anything after a separator like /, (, –,
  // "cum", "&", or a comma ("Sr. BA / Data Analyst" -> "BA").
  let s = designation.split(/[/(,]|—|–| - | & | cum | and /i)[0] || "";
  s = s.replace(TITLE_NOISE, " ");
  s = s.replace(/[^A-Za-z0-9 +.#-]/g, " ").replace(/\s+/g, " ").trim();
  if (s.replace(/[^A-Za-z]/g, "").length < 3) return null; // too thin to be a folder
  return s
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

export function categorizeResume(input: {
  skills?: string[];
  designation?: string;
  functionalArea?: string;
}): string {
  const hay = [
    ...(input.skills ?? []),
    input.designation ?? "",
    input.functionalArea ?? "",
  ]
    .join(" • ")
    .toLowerCase();

  for (const [cat, keywords] of RULES) {
    if (keywords.some((k) => hay.includes(k))) return cat;
  }
  if (input.functionalArea && FUNCTION_FALLBACK[input.functionalArea])
    return FUNCTION_FALLBACK[input.functionalArea];
  // No known bucket — name a folder from the resume's own job title instead of
  // dumping into "Other".
  return folderFromDesignation(input.designation) ?? "Other";
}
