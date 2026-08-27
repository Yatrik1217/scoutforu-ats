// Auto-file a resume into a technology / domain bucket from its skills, job
// title, and functional area — the same idea as sorting a Downloads folder by
// skill. First matching bucket wins (ordered most-specific first), else the
// broad functional area, else "Other".

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
// combined skills + designation + functional-area text.
const RULES: [TalentCategory, string[]][] = [
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
  ["Design / UX", ["ux", "ui/ux", "figma", "product design", "graphic design", "adobe xd", "user experience"]],
  ["Sales / BDE", ["business development", "bde", "inside sales", "field sales", "account executive", "sales executive", "sales manager", "lead generation", "b2b sales"]],
  ["Marketing", ["digital marketing", "seo", "sem", "social media", "content marketing", "performance marketing", "brand manager"]],
  ["HR", ["recruiter", "talent acquisition", "human resources", "hr executive", "hr manager", "payroll"]],
  ["Finance / Accounting", ["accountant", "accounts payable", "accounts receivable", "financial analyst", "chartered accountant", "taxation", "audit", "gst"]],
  ["Support / Ops", ["customer support", "technical support", "operations executive", "bpo", "customer service", "help desk"]],
];

// Map a broad functional area (from the resume parser) to a bucket as a fallback.
const FUNCTION_FALLBACK: Record<string, TalentCategory> = {
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

export function categorizeResume(input: {
  skills?: string[];
  designation?: string;
  functionalArea?: string;
}): TalentCategory {
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
  return "Other";
}
