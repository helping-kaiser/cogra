import { describe, expect, it } from "vitest";

import {
  DEFAULT_RELEVANCE,
  DEFAULT_SUPPORT,
  newReferenceDraft,
  referenceActs,
  referenceChanges,
  withdrawalActs,
  type ReferenceDraft,
} from "./draft";

const postTarget = { kind: "Post" as const, label: "@ada: a post", href: "/posts/p1" };
const userTarget = { kind: "User" as const, label: "@ada", href: "/u/ada" };

function draft(targetId: string, relevance = DEFAULT_RELEVANCE, support = DEFAULT_SUPPORT) {
  return { ...newReferenceDraft(targetId, postTarget), relevance, support };
}

describe("newReferenceDraft", () => {
  it("opens on the server's own defaults, so an untouched pair commits the omission", () => {
    const reference = newReferenceDraft("t1", userTarget);
    expect(reference.relevance).toBe(0.1);
    expect(reference.support).toBe(0.1);
    expect(reference.targetId).toBe("t1");
    expect(reference.target).toEqual(userTarget);
  });

  it("defaults strictly positive on both axes, so a default mention vouches", () => {
    const mention = newReferenceDraft("t1", userTarget);
    expect(mention.relevance).toBeGreaterThan(0);
    expect(mention.support).toBeGreaterThan(0);
  });
});

describe("referenceChanges", () => {
  it("stages nothing for an untouched section", () => {
    const loaded: readonly ReferenceDraft[] = [draft("a"), draft("b")];
    expect(referenceChanges(loaded, loaded)).toEqual([]);
  });

  it("stages a declaration for a reference the author added", () => {
    const changes = referenceChanges([], [draft("a")]);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ kind: "reference" });
  });

  it("re-declares a reference whose parameters moved", () => {
    const changes = referenceChanges([draft("a")], [draft("a", 0.9, -0.4)]);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ kind: "reference" });
    expect(
      changes[0].kind === "reference" ? changes[0].reference.relevance : null,
    ).toBe(0.9);
  });

  it("stages a withdrawal for a reference the author took off", () => {
    const changes = referenceChanges([draft("a")], []);
    expect(changes).toEqual([
      { kind: "withdraw", reference: draft("a") },
    ]);
  });

  it("keys on the target id, not on position", () => {
    const changes = referenceChanges([draft("a"), draft("b")], [draft("b"), draft("a")]);
    expect(changes).toEqual([]);
  });
});

describe("withdrawalActs", () => {
  it("quotes one act for a single default record — the common case", () => {
    expect(withdrawalActs(draft("a"))).toBe(1);
  });

  it("walks the further leg back, so a heavier bundle costs more", () => {
    expect(withdrawalActs(draft("a", 1, 0.2))).toBe(1);
    expect(withdrawalActs(draft("a", 0.2, -1))).toBe(1);
  });

  it("never quotes zero, even for a bundle folded to nothing on both axes", () => {
    expect(withdrawalActs(draft("a", 0, 0))).toBe(1);
  });
});

describe("referenceActs", () => {
  it("counts one act per declaration", () => {
    expect(referenceActs(referenceChanges([], [draft("a"), draft("b")]))).toBe(2);
  });

  it("counts a withdrawal's own batch estimate beside the declarations", () => {
    const changes = referenceChanges([draft("a")], [draft("b")]);
    expect(referenceActs(changes)).toBe(2);
  });

  it("counts nothing for an untouched section", () => {
    expect(referenceActs([])).toBe(0);
  });
});
