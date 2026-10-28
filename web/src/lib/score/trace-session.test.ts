// Where a trace was opened from, and how deep the reader is (graph.json's
// origin table; readme.md:8446-8450; copy-voice.md:856-858).

import { describe, expect, it } from "vitest";

import { beginTrace, forgetTrace, levelOf, openTrace, originOf, originParam, traceBack, traceHref } from "./trace-session";

describe("the_trace_back_arrow_names_its_origin", () => {
  it.each([
    [{ kind: "feed" } as const, "/feed", "Back to feed"],
    [{ kind: "post", postId: "p1", via: null } as const, "/posts/p1", "Back to the post"],
    [{ kind: "post", postId: "p1", via: "saved" } as const, "/posts/p1?from=saved", "Back to the post"],
    [{ kind: "tag", name: "saltmaps" } as const, "/topics/saltmaps", "Back to #saltmaps"],
    [{ kind: "history" } as const, "/history", "Back to History"],
    [{ kind: "saved" } as const, "/saved", "Back to Saved"],
    [{ kind: "profile" } as const, "/profile", "Back to your profile"],
    [{ kind: "person", handle: "ada" } as const, "/u/ada", "Back to the profile"],
  ])("%o", (origin, href, label) => {
    expect(traceBack(origin)).toEqual({ href, label });
    // The origin survives the URL.
    expect(originOf(originParam(origin))).toEqual(origin);
  });

  it("a detail opened from someone's profile keeps that origin through the trace", () => {
    expect(originOf(originParam({ kind: "post", postId: "p1", via: "u:ada" }))).toEqual({
      kind: "post",
      postId: "p1",
      via: "u:ada",
    });
  });

  it("an unknown origin is the feed", () => {
    expect(originOf(null)).toEqual({ kind: "feed" });
    expect(originOf("elsewhere")).toEqual({ kind: "feed" });
  });
});

describe("the levels' addresses", () => {
  const address = { targetId: "p1", kind: "post" as const, origin: { kind: "feed" as const }, settling: false };

  it("each level reads back as itself", () => {
    for (const level of [
      { kind: "entry" as const },
      { kind: "path" as const, path: 2 },
      { kind: "step" as const, path: 2, step: 1 },
      { kind: "records" as const, path: 2, step: 1 },
    ]) {
      const href = traceHref(address, level);
      expect(levelOf(new URL(href, "http://x").searchParams)).toEqual(level);
    }
  });

  it("the_trace_read_carries_no_pin — and its address carries none either", () => {
    expect(traceHref(address)).toBe("/trace/p1?from=feed&kind=post");
  });

  it("a malformed level reads as level one", () => {
    expect(levelOf(new URLSearchParams("path=0"))).toEqual({ kind: "entry" });
    expect(levelOf(new URLSearchParams("path=x&step=1"))).toEqual({ kind: "entry" });
  });
});

describe("one open", () => {
  it("the tap begins an open; the levels read it; a cold arrival begins its own", () => {
    forgetTrace();
    beginTrace("p1", null, "u-mira");
    expect(openTrace("p1").viewer).toBe("u-mira");
    expect(openTrace("p2").viewer).toBeNull();
    forgetTrace();
  });
});
