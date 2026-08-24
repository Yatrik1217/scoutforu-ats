import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root so Turbopack ignores lockfiles higher up the tree.
  turbopack: {
    root: dirname(fileURLToPath(import.meta.url)),
  },
  // Resume uploads (PDF/DOCX) flow through a Server Action; raise the body cap.
  experimental: {
    serverActions: { bodySizeLimit: "16mb" },
  },
  // pdf.js (used to read password-protected CAS statements) must run as a real
  // Node module, not be bundled by the compiler.
  serverExternalPackages: ["pdfjs-dist"],
};

export default nextConfig;
