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

// The API's own origin, taken from the GraphQL url the same way every other
// consumer does. Upload traffic goes here rather than to the media origin: the
// bytes are being GIVEN to the API, and only the finished asset is served from
// the bucket.
const apiOrigin = new URL(process.env.GRAPHQL_URL ?? "http://localhost:8080/graphql").origin;

/**
 * How long a rewrite may spend proxying one request.
 *
 * NEXT'S DEFAULT IS 30 SECONDS and it is not written down anywhere in the
 * config — `experimental.proxyTimeout` is `undefined` out of the box and the
 * router applies `proxyTimeout || 30000`
 * (`node_modules/next/dist/server/lib/router-utils/proxy-request.js`). A
 * request that is still UPLOADING at 30 seconds is killed, and the client sees
 * a 500 from the proxy rather than anything the API said. That is what failed a
 * 92 MiB upload: the body was still going up long after the timer ran out.
 *
 * THE NUMBER IS THE LARGEST BODY OVER THE WORST LINK. The contract admits a
 * 100 MiB video through a single `uploadMedia` POST; at roughly 1 Mbit/s of
 * real throughput — a poor hotspot — that is about fourteen minutes of sending.
 * Fifteen is the smallest round number above it.
 *
 * It stays a BOUND rather than `null` (no timeout): a connection that dies
 * mid-body should still be reaped, and the chunked path — 8 MiB parts — never
 * comes close to this, so the long ceiling is only ever reached by the
 * single-shot path it exists for.
 */
export const UPLOAD_PROXY_TIMEOUT_MS = 900_000;

const nextConfig: NextConfig = {
  allowedDevOrigins: privateNetworkOrigins,
  experimental: {
    proxyTimeout: UPLOAD_PROXY_TIMEOUT_MS,
  },
  // THE OPTIMIZER IS OFF, FOR THE WHOLE APP. Served media is display-ready by
  // construction: the client re-encodes every still to WebP within 1080x1440
  // before upload (D11), so a second pass would re-encode bytes that need no
  // work — and video posters are frames of an already-encoded clip. The
  // decision was previously made one `<Image unoptimized>` at a time, which
  // left a `remotePatterns`/`formats`/`qualities` block that nothing read:
  // `unoptimized` short-circuits in `generateImgAttrs` before any of it is
  // consulted, and the hostname allowlist lives in the `/_next/image` route an
  // unoptimized image never requests. `images.unoptimized` is Next's own
  // app-wide form of the decision — it is a first-class image config key,
  // defaulting to false (`node_modules/next/dist/shared/lib/image-config.js`)
  // — so it is stated once, here. The `formats` and `qualities` entries that
  // stood beside it were the framework's own defaults restated.
  //
  // Turning it back on means restoring `remotePatterns` for MEDIA_BASE_URL's
  // host — the contract mints absolute media urls, and an empty pattern list
  // rejects every one of them.
  images: {
    unoptimized: true,
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
      // UPLOADS GO TO THE API, AND THIS MUST COME FIRST. The resumable upload
      // endpoints live under `/media/uploads/...` on the API, while everything
      // else under `/media` is a stored object on the bucket — so the two
      // rewrites overlap and only the order tells them apart. Returning an
      // array puts both in the same group, where "rewrites are applied after
      // checking the filesystem and before dynamic routes"
      // (node_modules/next/dist/docs/01-app/03-api-reference/05-config/
      // 01-next-config-js/rewrites.md) and the FIRST match wins.
      //
      // Behind the narrower rule, a part PUT reached MinIO instead of the API
      // and came back as the bucket's own `AccessDenied` XML — a 403 the client
      // could only report as "the upload could not reach the server", because
      // as far as it could tell, it had not.
      //
      // The client derives this path from its GraphQL origin on purpose: the
      // phone trusts one certificate, for one origin, and every hop it makes
      // has to go through it.
      {
        source: "/media/uploads/:path*",
        destination: `${apiOrigin}/media/uploads/:path*`,
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
