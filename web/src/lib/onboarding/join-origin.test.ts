import { describe, expect, it } from "vitest";

import { joinLayerOf, signInOverJoinHref } from "./join-origin";

const ID = "0198c9a2-1f6b-7c31-9d70-3a4f5b6c7d8e";

describe("the join layer SignIn opens over (SignIn.md:7-9)", () => {
  it("round-trips the form's address, the door included", () => {
    const read = (href: string) => {
      const params = new URL(href, "https://cogra.test").searchParams;
      return joinLayerOf({ from: params.get("from"), invite: params.get("invite"), door: params.get("door") });
    };
    expect(read(signInOverJoinHref(ID, "arrival"))).toBe(`/join/${ID}`);
    expect(read(signInOverJoinHref(ID, "door"))).toBe(`/join/${ID}?from=door`);
  });

  it("names no layer for any other way in or a value that is not an invite id", () => {
    expect(joinLayerOf({ from: null, invite: ID, door: null })).toBeNull();
    expect(joinLayerOf({ from: "join", invite: "../settings", door: null })).toBeNull();
    expect(joinLayerOf({ from: "join", invite: null, door: null })).toBeNull();
  });
});
