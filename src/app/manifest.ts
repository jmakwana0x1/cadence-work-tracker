import type { MetadataRoute } from "next";

// Web app manifest (Next App Router file convention) — makes Cadence installable
// to the home screen. Served at /manifest.webmanifest and auto-linked by Next.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cadence — Consistency & Discipline Tracker",
    short_name: "Cadence",
    description: "Measure your discipline. Build your identity.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0a0f",
    theme_color: "#7c3aed",
    categories: ["productivity", "lifestyle", "health"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
