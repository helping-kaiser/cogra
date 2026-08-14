import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin Turbopack's workspace root to this package: root inference has
  // repeatedly crashed the dev server mid-run in the monorepo layout
  // (2026-08-07, "couldn't find next/package.json from src/app").
  turbopack: {
    root: __dirname,
  },
  // Hand testing runs in the phone's browser against this dev server
  // over the LAN (CLAUDE.md "Hand test and session hand-off"), and dev
  // blocks cross-origin requests for `/_next/*` by default — the page
  // loads but every chunk and stylesheet is refused, which renders as a
  // blank screen. The LAN address changes, so it comes from the
  // environment; unset keeps the localhost-only default.
  allowedDevOrigins: (process.env.WEB_DEV_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin !== ""),
  // The browser talks GraphQL same-origin; the rewrite proxies to the API
  // so no CORS and no public endpoint env var are needed.
  async rewrites() {
    return [
      {
        source: "/graphql",
        destination: process.env.GRAPHQL_URL ?? "http://localhost:8080/graphql",
      },
    ];
  },
};

export default nextConfig;
