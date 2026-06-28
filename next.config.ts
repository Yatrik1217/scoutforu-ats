import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root so Turbopack ignores lockfiles higher up the tree.
  turbopack: {
    root: dirname(fileURLToPath(import.meta.url)),
  },
};

export default nextConfig;
