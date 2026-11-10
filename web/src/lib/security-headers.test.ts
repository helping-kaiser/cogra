// @vitest-environment node
//
// The response headers every page carries, pinned — a missing header does not
// fail anything a user sees, so only a test notices when one goes.
//
// There is deliberately NO `script-src`, `style-src` or `default-src` here: the
// App Router streams its payload in inline scripts, so a script policy needs a
// per-request nonce and is a separate decision. The test pins that absence too,
// so a half-working script policy cannot slip in beside these.

import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

async function everyRouteHeaders(): Promise<Map<string, string>> {
  const rules = await nextConfig.headers!();
  const everywhere = rules.filter((rule) => rule.source === "/:path*");
  // One rule for every route; a path-specific rule beside it would override a
  // header key for that path ("the last header key will override the first").
  expect(everywhere).toHaveLength(1);
  expect(rules).toHaveLength(1);
  return new Map(everywhere[0].headers.map(({ key, value }) => [key, value]));
}

describe("security headers", () => {
  it("sets the framing, sniffing and referrer headers on every route", async () => {
    const headers = await everyRouteHeaders();
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("pins the non-script Content-Security-Policy directives", async () => {
    const csp = (await everyRouteHeaders()).get("Content-Security-Policy");
    expect(csp).toBe("frame-ancestors 'none'; object-src 'none'; base-uri 'self'");
  });

  it("states no script, style or default policy", async () => {
    const csp = (await everyRouteHeaders()).get("Content-Security-Policy") ?? "";
    for (const directive of ["script-src", "style-src", "default-src"]) {
      expect(csp).not.toContain(directive);
    }
  });

  it("denies the browser features the app never uses", async () => {
    const policy = (await everyRouteHeaders()).get("Permissions-Policy") ?? "";
    const denied = new Set(
      policy
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part.endsWith("=()"))
        .map((part) => part.slice(0, -3)),
    );
    for (const feature of ["camera", "microphone", "geolocation", "payment", "usb"]) {
      expect(denied.has(feature)).toBe(true);
    }
  });

  it("leaves alone the features the app does use", async () => {
    const policy = (await everyRouteHeaders()).get("Permissions-Policy") ?? "";
    // Copy-to-clipboard (recovery code, key export, share link), the share
    // sheet and autoplay of clips are all first-party; denying any of them
    // would break a drawn control.
    for (const feature of ["clipboard-write", "web-share", "autoplay", "fullscreen"]) {
      expect(policy).not.toContain(feature);
    }
  });

  it("does not advertise the framework", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});
