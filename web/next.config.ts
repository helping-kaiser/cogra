import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin Turbopack's workspace root to this package: root inference has
  // repeatedly crashed the dev server mid-run in the monorepo layout
  // (2026-08-07, "couldn't find next/package.json from src/app").
  turbopack: {
    root: __dirname,
  },
  // No `allowedDevOrigins`: the phone reaches this server through
  // `adb reverse` as localhost, never as a LAN address. A plain-http LAN
  // origin is not a secure context, so WebCrypto is absent and the app
  // cannot hydrate — allowing the origin would only turn a blank page
  // into a differently blank page (development.md).
  //
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
