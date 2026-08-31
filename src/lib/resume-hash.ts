import { createHash } from "crypto";

// The content-hash storage path for a resume file. Identical files always land
// on the same path, which lets callers detect an exact re-upload *before* they
// spend an API call parsing it. Plain (non-server) module so it can be imported
// by both the parser and the Talent Bank action.
export function resumeStoragePath(buf: Buffer, filename: string): string {
  const ext = (filename.split(".").pop() || "pdf").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "pdf";
  return `${createHash("sha256").update(buf).digest("hex")}.${ext.toLowerCase()}`;
}
