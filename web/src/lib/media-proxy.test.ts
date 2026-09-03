// @vitest-environment node
//
// The proxy layer's rules, pinned — because all three were broken in ways no
// unit test could have seen and only a phone or a direct probe reported: a
// part PUT that reached the storage bucket instead of the API, a long upload
// cut by a timeout nobody had set, and — measured 2026-09-03 — a large body
// that hung inside `next start`'s own rewrite proxy no matter how patient the
// timeouts were.
//
// These are cheap guards over an expensive failure. They cannot prove the
// routing works end to end — that took a real 90 MiB upload through the real
// origin — but they fail the moment someone reorders the rewrites, raises one
// timeout without the other, or routes an upload back through `next start`,
// which is how each of these came back.

import { describe, expect, it } from "vitest";

import nextConfig, { UPLOAD_PROXY_TIMEOUT_MS } from "../../next.config";
import {
  HEADERS_TIMEOUT_MS,
  isDirectApiPath,
  REQUEST_TIMEOUT_MS,
} from "../../scripts/prod.mjs";

async function rewrites() {
  const made = await nextConfig.rewrites!();
  // The array form; an object form would mean the groups changed and the
  // ordering argument below would need rereading rather than adjusting.
  expect(Array.isArray(made)).toBe(true);
  return made as { source: string; destination: string }[];
}

describe("the media rewrites", () => {
  it("sends uploads to the API and stored objects to the bucket", async () => {
    const rules = await rewrites();
    const uploads = rules.find((rule) => rule.source === "/media/uploads/:path*");
    const media = rules.find((rule) => rule.source === "/media/:path*");

    expect(uploads).toBeDefined();
    expect(media).toBeDefined();
    // The upload endpoints belong to the API; only finished objects are served
    // from storage.
    expect(uploads!.destination).toContain("/media/uploads/:path*");
    expect(uploads!.destination).not.toContain("cogra-media");
    expect(media!.destination).toContain("cogra-media");
  });

  it("puts the narrower rule FIRST, which is the whole fix", async () => {
    // Both patterns match `/media/uploads/...`, they sit in one group, and the
    // first match wins — so order is not style here, it is the behaviour. With
    // these reversed a part PUT reaches MinIO and comes back as AccessDenied.
    const rules = await rewrites();
    const uploads = rules.findIndex((rule) => rule.source === "/media/uploads/:path*");
    const media = rules.findIndex((rule) => rule.source === "/media/:path*");
    expect(uploads).toBeLessThan(media);
  });

  it("keeps GraphQL on the API too", async () => {
    const rules = await rewrites();
    expect(rules.find((rule) => rule.source === "/graphql")?.destination).toContain("/graphql");
  });
});

describe("the upload timeouts", () => {
  it("is set at all, rather than left to Next's silent 30 seconds", () => {
    // `experimental.proxyTimeout` unset means `proxyTimeout || 30000` in the
    // router — a 30 s ceiling on a request that may still be uploading.
    expect(nextConfig.experimental?.proxyTimeout).toBe(UPLOAD_PROXY_TIMEOUT_MS);
    expect(UPLOAD_PROXY_TIMEOUT_MS).toBeGreaterThan(30_000);
  });

  it("carries the largest allowed body over a poor link", () => {
    // 100 MiB at ~1 Mbit/s is about 839 s; the ceiling has to clear it.
    const hundredMiBAtOneMbit = (100 * 1024 * 1024) / (1_000_000 / 8);
    expect(UPLOAD_PROXY_TIMEOUT_MS / 1000).toBeGreaterThan(hundredMiBAtOneMbit);
  });

  it("keeps the TLS front at least as patient as the router behind it", () => {
    // The LOWER of the two decides, so raising one alone changes nothing.
    expect(REQUEST_TIMEOUT_MS).toBeGreaterThanOrEqual(UPLOAD_PROXY_TIMEOUT_MS);
    // And past Node's own 5-minute default, which was the third ceiling.
    expect(REQUEST_TIMEOUT_MS).toBeGreaterThan(300_000);
  });

  it("leaves the headers window short, since a slow BODY is the problem", () => {
    expect(HEADERS_TIMEOUT_MS).toBeLessThan(REQUEST_TIMEOUT_MS);
  });
});

describe("the API bypass in scripts/prod.mjs", () => {
  it.each([
    ["/graphql", true],
    ["/media/uploads/x/parts/1", true],
    ["/media/uploads", true],
    ["/media/anything-else", false],
    ["/posts/1", false],
  ])("routes %s to the API directly: %s", (pathname, expected) => {
    // No timeout, however generous, saves a body proxied through `next
    // start`: the rewrites above describe where the router WOULD send these
    // paths, but a large one never gets there — it goes around the router
    // entirely, straight from this TLS front to the API.
    expect(isDirectApiPath(pathname)).toBe(expected);
  });
});
