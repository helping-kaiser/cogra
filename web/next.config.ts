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

// Where served media lives. The contract mints ABSOLUTE urls from
// MEDIA_BASE_URL, so `next/image` sees an external src and needs the host
// allowlisted — `images.domains` was removed in Next 16, and `remotePatterns`
// is the documented replacement. A same-origin deployment (media proxied
// through the web origin, which is what dev does) matches no pattern and needs
// none, so the list is empty unless the env var says otherwise.
//
// `protocol`, `port`, and `search` are pinned rather than left to the implied
// `**` wildcard: the docs warn that omitting them "may allow malicious actors
// to optimize urls you did not intend", and an image optimizer pointed at an
// attacker-chosen host is an open proxy.
const mediaOrigin = process.env.MEDIA_BASE_URL;
const mediaPatterns = mediaOrigin
  ? (() => {
      const url = new URL(mediaOrigin);
      return [
        {
          protocol: url.protocol.replace(":", "") as "http" | "https",
          hostname: url.hostname,
          port: url.port,
          // D6 puts every asset under `/media/{id}`; nothing else on that host
          // is ours to optimize.
          pathname: "/media/**",
          search: "",
        },
      ];
    })()
  : [];

const nextConfig: NextConfig = {
  allowedDevOrigins: privateNetworkOrigins,
  images: {
    remotePatterns: mediaPatterns,
    // Stored assets are already WebP — the client re-encodes before upload
    // (D11) — so the optimizer's only remaining job is resizing, and it should
    // not spend a second lossy pass converting between modern formats.
    formats: ["image/webp"],
    // Next 16 defaults `qualities` to [75]; a `quality` prop outside the list
    // is coerced to the nearest member, so the value the tiles ask for has to
    // be declared here to be honoured.
    qualities: [75],
  },
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
      // Media bytes come from the standalone media origin, not the API. In
      // development that origin is plain http on another port, which an
      // https page may not load and a phone on the LAN cannot trust — so
      // the same-origin proxy that solves it for GraphQL solves it here.
      // `MEDIA_BASE_URL` points the API at this path; in production it
      // points at the media origin directly and this rewrite is unused.
      {
        source: "/media/:path*",
        destination: `${process.env.MEDIA_ORIGIN ?? "http://localhost:9000/cogra-media"}/:path*`,
      },
    ];
  },
};

export default nextConfig;
