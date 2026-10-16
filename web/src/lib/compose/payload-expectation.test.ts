// The payload expectation: built from the request a form sent, through the
// API layer's own shaping and the server's normalization, every asset named
// by the ledger of what this device can state.

import { describe, expect, it } from "vitest";

import type { KnownMedia } from "@/lib/api/media-api";
import {
  contentExpectation,
  galleryMediaIds,
  ledgerEntry,
  profileExpectation,
  type MediaLedger,
} from "./payload-expectation";

const NODE = "1c0a0000-0000-4000-8000-000000000001";
const STILL: KnownMedia = { digest: "11".repeat(32), uploadDigest: "11".repeat(32), mime: "image/webp" };
const CLIP: KnownMedia = { digest: "31".repeat(32), uploadDigest: "33".repeat(32), mime: "video/mp4" };
const POSTER: KnownMedia = { digest: "32".repeat(32), uploadDigest: "32".repeat(32), mime: "image/webp" };
const LEDGER: MediaLedger = new Map([
  ["still", STILL],
  ["clip", CLIP],
  ["poster", POSTER],
]);

describe("a content payload's expectation", () => {
  it("carries the server's trim, not JavaScript's, on the title and the description", () => {
    const content = contentExpectation(
      NODE,
      // U+FEFF is not White_Space: the server keeps it, so the expectation does.
      { title: " \u{FEFF}A title\u{0085}", description: "\u{3000}Beside\u{3000}", content: null },
      "post",
      LEDGER,
    );
    expect(content.title).toBe("\u{FEFF}A title");
    expect(content.description).toBe("Beside");
    expect(content.body).toBe("");
  });

  it("folds a blank post body to the empty body and keeps words untouched", () => {
    expect(contentExpectation(NODE, { content: " \u{00A0}" }, "post", LEDGER).body).toBe("");
    expect(contentExpectation(NODE, { content: "  words  " }, "post", LEDGER).body).toBe(
      "  words  ",
    );
  });

  it("carries a comment's words exactly as typed, and no title or description", () => {
    const content = contentExpectation(NODE, { title: "dropped", content: " reply " }, "comment", LEDGER);
    expect(content).toMatchObject({ title: null, description: null, body: " reply " });
  });

  it("states both digests of every placement, the poster's rendition, and the taken mark", () => {
    const content = contentExpectation(
      NODE,
      {
        content: null,
        attachments: [{ mediaId: "clip", altText: " The river ", coverMediaId: "poster", coverTaken: true }],
      },
      "post",
      LEDGER,
    );
    expect(content.media).toEqual([
      {
        kind: "asset",
        digest: CLIP.digest,
        mime: "video/mp4",
        altText: "The river",
        cover: POSTER.digest,
        coverTaken: true,
        uploadDigest: CLIP.uploadDigest,
      },
    ]);
  });

  it("a_new_placement_this_device_never_uploaded_is_refused", () => {
    const content = contentExpectation(
      NODE,
      { content: null, attachments: [{ mediaId: "elsewhere", altText: null }] },
      "post",
      LEDGER,
    );
    expect(content.media).toEqual([{ kind: "unknown", mediaId: "elsewhere" }]);
    const faceless = contentExpectation(
      NODE,
      { content: null, attachments: [{ mediaId: "clip", altText: null, coverMediaId: "nowhere" }] },
      "post",
      LEDGER,
    );
    expect(faceless.media).toEqual([{ kind: "unknown", mediaId: "nowhere" }]);
  });

  it("states the self-mark with its reason blank-folded, and none without the switch", () => {
    expect(
      contentExpectation(NODE, { content: "w", sensitive: true, sensitiveReason: " why " }, "post", LEDGER)
        .sensitive,
    ).toEqual({ reason: "why" });
    expect(
      contentExpectation(NODE, { content: "w", sensitive: true, sensitiveReason: "  " }, "post", LEDGER)
        .sensitive,
    ).toEqual({ reason: null });
    expect(
      contentExpectation(NODE, { content: "w", sensitive: false, sensitiveReason: "why" }, "post", LEDGER)
        .sensitive,
    ).toBeNull();
  });
});

describe("a profile payload's expectation", () => {
  it("carries the fields untouched and the avatar three-valued", () => {
    const base = { displayName: "Ada", bio: "Curious.", websiteUrl: null };
    expect(profileExpectation(NODE, { ...base, avatar: "unchanged" }, LEDGER).avatar).toEqual({
      state: "untouched",
    });
    expect(profileExpectation(NODE, { ...base, avatar: { clear: true } }, LEDGER).avatar).toEqual({
      state: "cleared",
    });
    const set = profileExpectation(NODE, { ...base, avatar: { mediaId: "still" } }, LEDGER);
    // The form sends every field present, so the null website is the clear,
    // which the server stages as the empty string rather than leaving out.
    expect(set).toMatchObject({ node: NODE, displayName: "Ada", bio: "Curious.", websiteUrl: "" });
    expect(set.avatar).toEqual({
      state: "set",
      asset: {
        kind: "asset",
        digest: STILL.digest,
        mime: "image/webp",
        altText: null,
        cover: null,
        coverTaken: false,
        uploadDigest: STILL.uploadDigest,
      },
    });
  });
});

describe("the ledger", () => {
  it("names only finished uploads that carry their digests", () => {
    expect(ledgerEntry({ kind: "done", mediaId: "m", media: STILL })).toEqual([["m", STILL]]);
    expect(ledgerEntry({ kind: "done", mediaId: "m" })).toEqual([]);
    expect(ledgerEntry({ kind: "processing", mediaId: "m" })).toEqual([]);
  });

  it("reads every asset a gallery names, posters included", () => {
    expect(
      galleryMediaIds([
        { mediaId: "a", altText: null },
        { mediaId: "b", altText: null, coverMediaId: "c" },
      ]),
    ).toEqual(["a", "b", "c"]);
  });
});
