// Auto-file a resume into a technology / domain folder.
//
// Priority: (1) an industry match like Solar, (2) the person's JOB TITLE — the
// most reliable signal, so a "Business Analyst" who lists Figma or a "React
// Developer" who lists AWS is filed by their role, not an incidental tool,
// (3) skill keywords as a fallback for generic titles ("Software Engineer"),
// (4) a folder named from the title itself, (5) "Other" only as a last resort.

// The well-known buckets. Folders can also be minted on the fly from a resume's
// designation, so this list is not exhaustive.
export const TALENT_CATEGORIES = [
  ".NET",
  "Java",
  "Python / Data",
  "Node.js / Backend JS",
  "Frontend / UI",
  "Mobile",
  "PHP",
  "Salesforce",
  "Database / SQL",
  "PL-SQL / Oracle",
  "Data Engineering",
  "Data Science / AI",
  "DevOps / Cloud",
  "QA / Testing",
  "Business Analyst",
  "Solar / Renewable Energy",
  "Networking",
  "Security",
  "IT Support",
  "Design / UX",
  "Sales / BDE",
  "Marketing",
  "HR",
  "Finance / Accounting",
  "Customer Success",
  "Support / Ops",
  "Other",
] as const;

export type TalentCategory = (typeof TALENT_CATEGORIES)[number];

// Industry keywords checked FIRST — a solar CV stays grouped by industry even
// when the title is "Marketing Executive" or "Project Manager".
const SOLAR_KEYS = [
  "solar",
  "photovoltaic",
  "pvsyst",
  "pv system",
  "pv plant",
  "renewable energy",
  "solargraph",
  "helioscope",
];

// [category, title phrases] — matched against the DESIGNATION only. Ordered
// most-specific first; the first hit wins. Only high-confidence, unambiguous
// title phrases live here — ambiguous ones ("System Engineer", "Consultant",
// "Web Developer") are intentionally left out so they fall through to skills.
const TITLE_ROLES: [string, string[]][] = [
  [
    "Data Science / AI",
    ["data scientist", "ai engineer", "a.i. engineer", "ml engineer", "ai/ml", "ai ml", "aiml",
      "machine learning engineer", "artificial intelligence", "generative ai", "gen ai", "genai",
      "computer vision engineer", "nlp engineer", "deep learning", "ai developer", "ai architect", "llm engineer"],
  ],
  ["Data Engineering", ["data engineer", "big data engineer", "etl developer", "bigdata"]],
  [
    "Database / SQL",
    ["database administrator", "database engineer", "database developer", " dba", "dba ", "sql developer",
      "sql database", "sql server developer", "t-sql developer", "sql dba", "database analyst"],
  ],
  [
    "Business Analyst",
    ["business analyst", "business system analyst", "business systems analyst", "business technical analyst",
      "ba / scrum", "business analysis"],
  ],
  [
    "DevOps / Cloud",
    ["devops", "dev ops", "site reliability", "sre engineer", "cloud engineer", "cloud developer",
      "cloud architect", "infrastructure engineer", "platform engineer", "linux administrator", "cloud administrator"],
  ],
  [
    "QA / Testing",
    ["qa engineer", "qa analyst", "quality assurance", "test engineer", "sdet", "software tester",
      "automation test", "test analyst", "qa lead", "test lead"],
  ],
  [
    "Mobile",
    ["android developer", "ios developer", "flutter developer", "react native developer", "mobile app developer",
      "mobile application developer", "mobile developer"],
  ],
  ["Salesforce", ["salesforce"]],
  [".NET", [".net developer", "dot net developer", "dotnet developer", "asp.net developer", ".net engineer"]],
  ["Java", ["java developer", "java engineer", "java full stack", "java backend"]],
  ["Python / Data", ["python developer", "python engineer"]],
  ["PHP", ["php developer", "laravel developer", "wordpress developer", "codeigniter developer"]],
  [
    "Frontend / UI",
    ["frontend developer", "front end developer", "front-end developer", "react developer", "reactjs developer",
      "react.js developer", "angular developer", "ui developer", "mern stack", "mern developer", "vue developer"],
  ],
  ["Node.js / Backend JS", ["node developer", "node.js developer", "nodejs developer"]],
  ["Networking", ["network engineer", "network administrator", "noc engineer"]],
  ["Security", ["security engineer", "cyber security", "cybersecurity", "information security", "soc analyst"]],
  [
    "IT Support",
    ["it support", "desktop support", "service desk", "help desk", "helpdesk", "system administrator",
      "systems administrator", "it administrator", "it support specialist"],
  ],
  [
    "Finance / Accounting",
    ["accountant", "accounts executive", "accounts assistant", "accounts manager", "chartered accountant",
      "tax accountant", "smsf", "bookkeeper", "book keeper", "billing", "company secretary", "auditor",
      "finance executive", "finance manager", "financial analyst", "accounts payable", "accounts receivable"],
  ],
  ["HR", ["hr executive", "hr manager", "human resource", "recruiter", "talent acquisition", "hr business partner"]],
  [
    "Sales / BDE",
    ["sales executive", "sales manager", "business development manager", "business development executive",
      "business development", " bde", "inside sales", "pre-sales", "presales"],
  ],
  ["Marketing", ["marketing executive", "digital marketing", "marketing manager", "seo executive", "content writer"]],
  ["Customer Success", ["customer success", "customer support executive", "client success"]],
];

function roleFromDesignation(designationLower: string): string | null {
  if (!designationLower) return null;
  for (const [cat, phrases] of TITLE_ROLES)
    if (phrases.some((p) => designationLower.includes(p))) return cat;
  return null;
}

// [category, keywords] — SKILL fallback, matched against the combined
// skills + designation + functional-area text when no title role matched.
// Ordered most-specific first. Note: bare ambiguous substrings are avoided —
// e.g. Java uses "core java"/"spring boot", never "java" (which is inside
// "javascript"), so JS/React devs don't get mis-filed as Java.
const RULES: [string, string[]][] = [
  // Role-defining AI/ML signals first.
  [
    "Data Science / AI",
    ["machine learning", "deep learning", "data scien", "generative ai", "langchain", "langgraph",
      "tensorflow", "pytorch", "computer vision", "hugging face", "llm ", "rag pipeline"],
  ],
  // Programming languages / stacks — a developer's language beats an incidental
  // infra tool (AWS/Kubernetes), so these come before the infra/data rules.
  [".NET", [".net", "dotnet", "c#", "asp.net", "asp net", "vb.net", "blazor", "wpf", "wcf"]],
  ["PL-SQL / Oracle", ["pl/sql", "plsql", "pl sql", "oracle apex", "oracle forms", "oracle developer", "d2k"]],
  ["Salesforce", ["salesforce", "apex trigger", "visualforce", "lightning web component"]],
  ["Mobile", ["android", "flutter", "react native", "kotlin", "swift", "objective-c"]],
  ["Java", ["core java", "advance java", "spring boot", "spring framework", "spring mvc", "hibernate", "j2ee", "jsp ", "servlet", "struts"]],
  // Data-engineering stack (Databricks/PySpark/ADF) beats a plain "python"
  // mention — data engineers always list Python.
  [
    "Data Engineering",
    ["pyspark", "apache spark", "databricks", "airflow", "kafka", "informatica", "snowflake",
      "azure data factory", "hadoop", "data warehouse"],
  ],
  ["Python / Data", ["python", "django", "flask", "fastapi", "pandas", "numpy"]],
  ["PHP", ["php", "laravel", "codeigniter", "wordpress", "drupal"]],
  ["Node.js / Backend JS", ["node.js", "nodejs", "node js", "express.js", "nestjs", "mern", "mongodb"]],
  ["Frontend / UI", ["react", "angular", "vue", "javascript", "typescript", "next.js", "redux", "html", "css", "tailwind"]],
  // Domain (Finance/BA/Design) before the broad data/infra buckets.
  ["Finance / Accounting", ["accountant", "accounts payable", "accounts receivable", "xero", "quickbooks", "myob", "tally", "bookkeeping", "gst compliance", "taxation", "chartered accountant", "vat return", "financial statement", "bank reconciliation", "ca final"]],
  ["Design / UX", ["figma", "adobe xd", "ui/ux", "user experience", "wireframing", "graphic design", "coreldraw", "illustrator", "product design"]],
  ["Business Analyst", ["business analysis", "requirement gathering", "requirements gathering", "brd", "frd", "srs documentation", "user stories", "requirement elicitation", "gap analysis"]],
  // Data / infra buckets last — weakest role signal.
  ["Data Engineering", ["etl", "ssis", "data warehouse"]],
  ["Database / SQL", ["t-sql", "pl/pgsql", "ssrs", "database administration", "sql server", "mysql", "postgresql", "stored procedures", "query optimization"]],
  [
    "DevOps / Cloud",
    ["devops", "kubernetes", "terraform", "ansible", "ci/cd", "cicd", "azure devops", "site reliability",
      " sre", "cloudformation", "helm", "argocd", "openshift", "jenkins", "gitlab ci"],
  ],
  ["QA / Testing", ["selenium", "test automation", "automation testing", "manual testing", "sdet", "cypress", "appium", "quality assurance"]],
  ["HR", ["recruiter", "talent acquisition", "human resources"]],
  ["Sales / BDE", ["business development", "inside sales", "field sales", "lead generation", "b2b sales"]],
  ["Marketing", ["digital marketing", "content marketing", "social media marketing"]],
  ["Support / Ops", ["customer support", "technical support", "help desk", "bpo", "customer service"]],
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
  let s = designation.split(/[/(,]|—|–| - | & | cum | and /i)[0] || "";
  s = s.replace(TITLE_NOISE, " ");
  s = s.replace(/[^A-Za-z0-9 +.#-]/g, " ").replace(/\s+/g, " ").trim();
  if (s.replace(/[^A-Za-z]/g, "").length < 3) return null;
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
  const skills = input.skills ?? [];
  const desig = input.designation ?? "";
  const fn = input.functionalArea ?? "";
  const hay = [...skills, desig, fn].join(" • ").toLowerCase();
  const dlow = desig.toLowerCase();

  // 1. Industry (Solar) — keep these grouped regardless of role.
  if (SOLAR_KEYS.some((k) => hay.includes(k))) return "Solar / Renewable Energy";

  // 2. A clear job title outranks incidental tool/skill keywords.
  const byTitle = roleFromDesignation(dlow);
  if (byTitle) return byTitle;

  // 3. Skill keywords, for generic titles like "Software Engineer".
  for (const [cat, keywords] of RULES) if (keywords.some((k) => hay.includes(k))) return cat;

  // 4. Broad functional area from the parser.
  if (fn && FUNCTION_FALLBACK[fn]) return FUNCTION_FALLBACK[fn];

  // 5. Name a folder from the title rather than dumping into "Other".
  return folderFromDesignation(desig) ?? "Other";
}
