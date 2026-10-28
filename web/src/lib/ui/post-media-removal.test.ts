// The mark's reading off the node: which wording (`removal.by`), when
// (`removal.at` in the one age ladder), and that a marked node is a removed one.
// Removed.md:3-9; CommentRemoved.md:5-7; api-spec.md `RemovalAgent`.

import { describe, expect, it } from "vitest";

import { payloadIsRedacted, removalReason, removalWhen } from "./post-media";

const NOW = Date.parse("2026-10-28T12:00:00Z");
const standing = { attachments: [], attachmentsStatus: "NORMAL", moderationStatus: "NORMAL" };
const marked = (by: string, at = "2026-10-28T10:00:00Z") => ({ ...standing, removal: { at, by } });

describe("the node's mark", () => {
  // Removed.md:3 and :5 — an author's removal and their account sweep read
  // alike: "AUTHOR and ACCOUNT both read `Removed by its author`".
  it("reads both AUTHOR and ACCOUNT as the author's own", () => {
    expect(removalReason(marked("AUTHOR"))).toBe("author");
    expect(removalReason(marked("ACCOUNT"))).toBe("author");
  });

  // Removed.md:9 — the author's mark never reads like the platform's rules,
  // and the platform's verdict never hides behind the author.
  it("reads a moderation verdict as the platform's rules", () => {
    expect(removalReason(marked("MODERATION"))).toBe("platform");
  });

  // The mark is the source, not `moderationStatus` (the packet's item 11): a
  // marked node whose status still says NORMAL reads its mark.
  it("takes the wording from the mark, not from the moderation status", () => {
    expect(removalReason({ moderationStatus: "ILLEGAL", removal: { at: "x", by: "AUTHOR" } })).toBe("author");
  });

  it("falls back to the verdict on a node that carries no mark", () => {
    expect(removalReason({ moderationStatus: "ILLEGAL" })).toBe("platform");
    expect(removalReason({ moderationStatus: "NORMAL" })).toBe("author");
  });

  // backlog item 45: `when` is the removal's own moment, in the one ladder.
  it("dates the mark by the removal's own moment, in the age ladder", () => {
    expect(removalWhen(marked("AUTHOR", "2026-10-28T10:00:00Z"), NOW)).toBe("2h");
    expect(removalWhen(marked("AUTHOR", "2026-10-28T11:59:40Z"), NOW)).toBe("now");
    expect(removalWhen(marked("AUTHOR", "2026-09-06T10:00:00Z"), NOW)).toBe("06.09.2026");
    expect(removalWhen(standing, NOW)).toBeUndefined();
  });

  // RemoveConfirm.md:11 — the moment the mark is patched in, the card is the
  // mark, before any field is re-read.
  it("counts a marked node as removed whatever its fields still say", () => {
    expect(payloadIsRedacted({ ...marked("AUTHOR"), content: { status: "NORMAL" } })).toBe(true);
    expect(payloadIsRedacted({ ...standing, content: { status: "NORMAL" } })).toBe(false);
    expect(payloadIsRedacted({ ...standing, removal: null })).toBe(false);
  });
});
