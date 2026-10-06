// Freelance recruiters: a login whose linked employee record is of type
// "contract". They work their assigned roles and mark attendance, nothing else
// (no talent bank, leave, payslips, own mailbox or admin areas).
export const FREELANCER_EMPLOYMENT_TYPE = "contract";

// The only areas a freelancer may open — the Workspace menu + My Attendance.
const FREELANCER_PATHS = [
  "/overview",
  "/pipeline",
  "/jobs",
  "/candidates",
  "/search",
  "/bulk",
  "/interviews",
  "/offers",
  "/analytics",
  "/my/attendance",
  "/change-password",
];

export function isFreelancerPath(path: string): boolean {
  return path === "/" || FREELANCER_PATHS.some((p) => path === p || path.startsWith(p + "/"));
}
