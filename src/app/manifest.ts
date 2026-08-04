import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SFU - ATS",
    short_name: "SFU - ATS",
    description: "Applicant Tracking System for ScoutforU Consultants",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f6fb",
    theme_color: "#2a6fdb",
    orientation: "portrait",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
