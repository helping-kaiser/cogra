import type { NextConfig } from "next";

// The dev server is reached from other devices on the LAN or the phone's
// hotspot (development.md "Reaching the web dev server from the phone"), so
// its dev-only assets — `/_next/*` and the HMR socket — are requested from a
// private-range origin Next blocks by default. The allowlist is exactly the
// RFC 1918 private ranges; a segment glob matches one dot-segment, so 172's
// sixteen assigned blocks are listed rather than widened to `172.*.*.*`.
const privateNetworkOrigins = [
  "10.*.*.*",
  "192.168.*.*",
  ...Array.from({ length: 16 }, (_, i) => `172.${16 + i}.*.*`),
];

const nextConfig: NextConfig = {
  allowedDevOrigins: privateNetworkOrigins,
  // Pin Turbopack's workspace root to this package: root inference has
  // repeatedly crashed the dev server mid-run in the monorepo layout
  // (2026-08-07, "couldn't find next/package.json from src/app").
  turbopack: {
    root: __dirname,
  },
  // The browser talks GraphQL same-origin; the rewrite proxies to the API
  // so no CORS and no public endpoint env var are needed — and the http hop
  // to the API is server-side, so an https page never mixes content.
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
