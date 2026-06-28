// ScoutforU ATS — domain constants & helpers.
// Mirrors the design reference (README §5.1 / §9). Single source of truth for
// the 9-stage pipeline, stage colors, and presentational helpers.

export type StageKey =
  | "Sourced"
  | "Screening"
  | "Interview"
  | "Practical Interview"
  | "Selected"
  | "Offered"
  | "Offer Accepted"
  | "Joined"
  | "Not Joined";

export type Stage = { key: StageKey; slug: string; color: string };

// Fixed order — index drives "move to next stage".
export const STAGES: Stage[] = [
  { key: "Sourced", slug: "sourced", color: "#64748b" },
  { key: "Screening", slug: "screening", color: "#2a6fdb" },
  { key: "Interview", slug: "interview", color: "#6366f1" },
  { key: "Practical Interview", slug: "practical_interview", color: "#8b5cf6" },
  { key: "Selected", slug: "selected", color: "#06b6d4" },
  { key: "Offered", slug: "offered", color: "#f59e0b" },
  { key: "Offer Accepted", slug: "offer_accepted", color: "#10b981" },
  { key: "Joined", slug: "joined", color: "#16a34a" },
  { key: "Not Joined", slug: "not_joined", color: "#ef4444" },
];

export const TERMINAL_STAGES: StageKey[] = ["Joined", "Not Joined"];

// Stages shown in the funnel / timeline (1..8, excludes "Not Joined").
export const PIPELINE_STAGES = STAGES.slice(0, 8);

const SLUG_TO_KEY = new Map(STAGES.map((s) => [s.slug, s.key]));
const KEY_TO_STAGE = new Map(STAGES.map((s) => [s.key, s]));

export function stageFromSlug(slug: string): StageKey {
  return SLUG_TO_KEY.get(slug) ?? "Sourced";
}
export function stageToSlug(key: StageKey): string {
  return KEY_TO_STAGE.get(key)?.slug ?? "sourced";
}
export function stageColor(key: StageKey): string {
  return KEY_TO_STAGE.get(key)?.color ?? "#64748b";
}
export function stageIndex(key: StageKey): number {
  return STAGES.findIndex((s) => s.key === key);
}
export function isTerminal(key: StageKey): boolean {
  return TERMINAL_STAGES.includes(key);
}
export function nextStage(key: StageKey): StageKey | null {
  const i = stageIndex(key);
  if (isTerminal(key) || i >= 7) return null;
  return STAGES[i + 1].key;
}

// --- type pills (README §9) ---
export type InterviewType = "Video" | "Phone" | "Onsite" | "Practical";
export const TYPE_COLOR: Record<InterviewType, string> = {
  Video: "#2a6fdb",
  Onsite: "#8b5cf6",
  Phone: "#06b6d4",
  Practical: "#f59e0b",
};

export const DEPT_COLOR: Record<string, string> = {
  Engineering: "#2a6fdb",
  Design: "#ec4899",
  Product: "#8b5cf6",
  Data: "#06b6d4",
  Infrastructure: "#f59e0b",
};

const AVATARS = [
  "#2a6fdb",
  "#8b5cf6",
  "#06b6d4",
  "#f59e0b",
  "#ec4899",
  "#10b981",
  "#6366f1",
  "#14b8a6",
  "#f97316",
  "#ef4444",
];

// --- presentational helpers ---
export function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATARS[h % AVATARS.length];
}

// rgba() from a hex + alpha — for badge/lane tints (12% / 8% etc.)
export function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function fmtSalary(lpa: number): string {
  return `₹${lpa} LPA`;
}

export function daysInStage(enteredStageAt: string | Date): number {
  const entered = new Date(enteredStageAt).getTime();
  const ms = Date.now() - entered;
  return Math.max(0, Math.floor(ms / 86_400_000));
}

// --- roles ---
export type Role = "master_admin" | "recruiter" | "client";
export const ROLE_LABEL: Record<Role, string> = {
  master_admin: "Master Admin",
  recruiter: "Recruiter",
  client: "Client",
};
export const ROLE_COLOR: Record<Role, string> = {
  master_admin: "#2a6fdb",
  recruiter: "#8b5cf6",
  client: "#f59e0b",
};

export const SOURCES = [
  "LinkedIn",
  "Referral",
  "Naukri",
  "Career Site",
  "Agency",
] as const;
export const SOURCE_COLOR: Record<string, string> = {
  LinkedIn: "#2a6fdb",
  Referral: "#16a34a",
  Naukri: "#f59e0b",
  "Career Site": "#8b5cf6",
  Agency: "#06b6d4",
};
