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
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
