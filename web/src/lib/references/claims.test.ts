import { describe, expect, it } from "vitest";

import {
  referenceChipEntries,
  referenceDrafts,
  unaddressableClaims,
  type ReferenceClaimNode,
} from "./claims";

const typedClaim: ReferenceClaimNode = {
  targetId: "l1-record-1",
  relevance: 0.4,
  support: -0.2,
  withdrawalCost: 2,
  pending: false,
  target: { __typename: "User", id: "u-uuid", handle: "ada" },
};

const untypedClaim: ReferenceClaimNode = {
  targetId: "l1-record-2",
  relevance: 0.1,
  support: 0.1,
  withdrawalCost: 1,
  pending: true,
  target: null,
};

describe("referenceChipEntries", () => {
  it("renders a typed claim as its target's chip, keyed by the L1 identifier", () => {
    const [entry] = referenceChipEntries([typedClaim]);
    expect(entry.targetId).toBe("l1-record-1");
    expect(entry.target).toEqual({
      kind: "User",
      label: "@ada",
      href: "/u/ada",
      handle: "ada",
      displayName: null,
    });
    expect(entry.relevance).toBe(0.4);
    expect(entry.support).toBe(-0.2);
  });

  it("renders an untyped claim off its raw identifier, navigating nowhere", () => {
    const [entry] = referenceChipEntries([untypedClaim]);
    expect(entry.target).toEqual({ kind: null, label: "l1-record-2", href: null });
    expect(entry.pending).toBe(true);
  });

  it("renders every claim, typed or not", () => {
    expect(referenceChipEntries([typedClaim, untypedClaim])).toHaveLength(2);
  });
});

describe("referenceDrafts", () => {
  it("keys a draft by the L2 id the prepare mutations consume, not the L1 identifier", () => {
    const [draft] = referenceDrafts([typedClaim]);
    expect(draft.targetId).toBe("u-uuid");
    expect(draft.targetId).not.toBe(typedClaim.targetId);
  });

  it("carries the claim's own folded values, not the defaults", () => {
    const [draft] = referenceDrafts([typedClaim]);
    expect(draft.relevance).toBe(0.4);
    expect(draft.support).toBe(-0.2);
  });

  it("carries the served withdrawal cost, which the clipped pair cannot imply", () => {
    const [draft] = referenceDrafts([typedClaim]);
    expect(draft.withdrawalCost).toBe(2);
  });

  it("drops a claim it cannot name back to the server", () => {
    expect(referenceDrafts([untypedClaim])).toEqual([]);
  });

  it("drops a typed claim whose target carries no id", () => {
    const idless: ReferenceClaimNode = {
      ...typedClaim,
      target: { __typename: "User", handle: "ada" },
    };
    expect(referenceDrafts([idless])).toEqual([]);
  });
});

describe("unaddressableClaims", () => {
  it("counts the claims the editable section cannot stage", () => {
    expect(unaddressableClaims([typedClaim, untypedClaim])).toBe(1);
    expect(unaddressableClaims([typedClaim])).toBe(0);
  });
});
