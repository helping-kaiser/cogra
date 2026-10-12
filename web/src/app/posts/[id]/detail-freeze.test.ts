// HOW A FRESH READ LANDS ON A DETAIL THAT HOLDS WHAT WAS OPENED
// (PostDetail.md:5-15; seam 120; FC-G1). One case per way an answer can land.

import { describe, expect, it } from "vitest";

import { freezeReducer, isNewerVersion, landingOf, newlyRedacted, type Freeze } from "./detail-freeze";

type Fixture = {
  id: string;
  updatedAt: string;
  title: { value: string; status: string };
  attachments: { id: string; status: string; coverMedia: { id: string; status: string } | null }[];
  attachmentsStatus: string;
  topics: { hashtag: { id: string; name: { value: string; status: string } }; relevance: number }[];
  references: { targetId: string; relevance: number }[];
  comments: {
    totalCount: number;
    edges: { node: { id: string; content: { status: string } } }[];
  };
};

function post(over: Partial<Fixture> = {}): Fixture {
  return {
    id: "p1",
    updatedAt: "2026-10-12T10:00:00Z",
    title: { value: "The title", status: "NORMAL" },
    attachments: [
      { id: "m1", status: "NORMAL", coverMedia: null },
      { id: "m2", status: "NORMAL", coverMedia: { id: "c2", status: "NORMAL" } },
    ],
    attachmentsStatus: "NORMAL",
    topics: [tag("cats")],
    references: [{ targetId: "l1-a", relevance: 0.1 }],
    comments: { totalCount: 1, edges: [{ node: { id: "c1", content: { status: "NORMAL" } } }] },
    ...over,
  };
}

function tag(name: string, status = "NORMAL", relevance = 0.4) {
  return { hashtag: { id: `ht-${name}`, name: { value: name, status } }, relevance };
}

const EDITED = "2026-10-12T11:00:00Z";
const opened = (p: Fixture | null): Freeze<Fixture> => ({ post: p, newer: null });

describe("landingOf", () => {
  it("paints an answer when nothing is painted — a cache miss has no opened version to hold", () => {
    expect(landingOf(null, post({ updatedAt: EDITED }), false)).toBe("paint");
  });

  it("lands the reader's own pull over the opened version", () => {
    expect(landingOf(post(), post({ updatedAt: EDITED }), true)).toBe("asked");
  });

  it("holds another version — a new edit stamp", () => {
    expect(landingOf(post(), post({ updatedAt: EDITED }), false)).toBe("hold");
  });

  it("holds a changed tag set or citation set the same way, with no new edit", () => {
    expect(landingOf(post(), post({ topics: [tag("cats"), tag("dogs")] }), false)).toBe("hold");
    expect(landingOf(post(), post({ topics: [] }), false)).toBe("hold");
    expect(landingOf(post(), post({ references: [{ targetId: "l1-b", relevance: 0.1 }] }), false)).toBe(
      "hold",
    );
  });

  it("takes the same version silently — counts and weights are not another version", () => {
    const again = post({
      comments: { totalCount: 4, edges: [] },
      topics: [tag("cats", "NORMAL", 0.9)],
      references: [{ targetId: "l1-a", relevance: 0.7 }],
    });
    expect(landingOf(post(), again, false)).toBe("same");
  });

  it("patches a redaction through, whatever else the read changed", () => {
    const removed = post({ updatedAt: EDITED, title: { value: "", status: "REDACTED" } });
    expect(landingOf(post(), removed, false)).toBe("redaction");
  });
});

describe("newlyRedacted", () => {
  it("finds a removed field", () => {
    expect(newlyRedacted(post(), post({ title: { value: "", status: "REDACTED" } }))).toBe(true);
  });

  it("finds a removed gallery, one removed attachment, and one removed cover", () => {
    expect(newlyRedacted(post(), post({ attachmentsStatus: "REDACTED" }))).toBe(true);
    const one = post();
    one.attachments[1] = { ...one.attachments[1], status: "REDACTED" };
    expect(newlyRedacted(post(), one)).toBe(true);
    const cover = post();
    cover.attachments[1] = { ...cover.attachments[1], coverMedia: { id: "c2", status: "REDACTED" } };
    expect(newlyRedacted(post(), cover)).toBe(true);
  });

  it("finds a removed tag name — a part of the post the reader reads", () => {
    expect(newlyRedacted(post(), post({ topics: [tag("cats", "REDACTED")] }))).toBe(true);
  });

  it("passes over a redaction already on screen, so the hold still holds the rest", () => {
    const shown = post({ attachmentsStatus: "REDACTED" });
    const thenEdited = post({ attachmentsStatus: "REDACTED", updatedAt: EDITED });
    expect(newlyRedacted(shown, thenEdited)).toBe(false);
    expect(landingOf(shown, thenEdited, false)).toBe("hold");
  });

  it("follows an attachment by its own id, so a reordered gallery is not a redaction", () => {
    const redactedFirst = post();
    redactedFirst.attachments[0] = { ...redactedFirst.attachments[0], status: "REDACTED" };
    const reordered = post();
    reordered.attachments = [
      redactedFirst.attachments[1],
      { ...redactedFirst.attachments[0] },
    ];
    expect(newlyRedacted(redactedFirst, reordered)).toBe(false);
  });

  it("never reads the thread: a removed comment is the comments sheet's to show", () => {
    const thread = post({
      comments: { totalCount: 1, edges: [{ node: { id: "c1", content: { status: "REDACTED" } } }] },
    });
    expect(newlyRedacted(post(), thread)).toBe(false);
  });
});

describe("isNewerVersion", () => {
  it("compares the claim sets by which claims stand, not by their order", () => {
    const two = post({ topics: [tag("cats"), tag("dogs")] });
    const swapped = post({ topics: [tag("dogs"), tag("cats")] });
    expect(isNewerVersion(two, swapped)).toBe(false);
  });
});

describe("freezeReducer", () => {
  it("holds another version behind the line and keeps the opened one on screen", () => {
    const edited = post({ updatedAt: EDITED });
    expect(freezeReducer(opened(post()), { kind: "read", fresh: edited, asked: false })).toEqual({
      post: post(),
      newer: edited,
    });
  });

  it("swaps the held version in on the tap, and the line goes", () => {
    const edited = post({ updatedAt: EDITED });
    const held = freezeReducer(opened(post()), { kind: "read", fresh: edited, asked: false });
    expect(freezeReducer(held, { kind: "swap" })).toEqual({ post: edited, newer: null });
  });

  it("ignores a swap with nothing held", () => {
    const state = opened(post());
    expect(freezeReducer(state, { kind: "swap" })).toBe(state);
  });

  it("offers the newest of several versions found while one already waits", () => {
    const first = post({ updatedAt: EDITED });
    const second = post({ updatedAt: "2026-10-12T12:00:00Z" });
    let state = freezeReducer(opened(post()), { kind: "read", fresh: first, asked: false });
    state = freezeReducer(state, { kind: "read", fresh: second, asked: false });
    expect(state).toEqual({ post: post(), newer: second });
  });

  it("lands the pull's answer over a held version and takes the line down", () => {
    const first = post({ updatedAt: EDITED });
    const pulled = post({ updatedAt: "2026-10-12T12:00:00Z" });
    let state = freezeReducer(opened(post()), { kind: "read", fresh: first, asked: false });
    state = freezeReducer(state, { kind: "read", fresh: pulled, asked: true });
    expect(state).toEqual({ post: pulled, newer: null });
  });

  it("patches a redaction through over a held version, never behind the line", () => {
    const first = post({ updatedAt: EDITED });
    const removed = post({ updatedAt: EDITED, attachmentsStatus: "REDACTED" });
    let state = freezeReducer(opened(post()), { kind: "read", fresh: first, asked: false });
    state = freezeReducer(state, { kind: "read", fresh: removed, asked: false });
    expect(state).toEqual({ post: removed, newer: null });
  });

  it("takes the same version silently, with no line", () => {
    const again = post({ comments: { totalCount: 3, edges: [] } });
    expect(freezeReducer(opened(post()), { kind: "read", fresh: again, asked: false })).toEqual({
      post: again,
      newer: null,
    });
  });

  it("paints the first answer over nothing", () => {
    const fresh = post({ updatedAt: EDITED });
    expect(freezeReducer(opened(null), { kind: "read", fresh, asked: false })).toEqual({
      post: fresh,
      newer: null,
    });
  });
});
