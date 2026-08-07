import { describe, expect, it } from "vitest";

import { extractInviteId } from "./invite-input";

const ID = "0198c9a2-1f6b-7c31-9d70-3a4f5b6c7d8e";

describe("extractInviteId", () => {
  it("takes a bare id", () => {
    expect(extractInviteId(ID)).toBe(ID);
  });

  it("takes the id out of a pasted join URL", () => {
    expect(extractInviteId(`https://cogra.example/join/${ID}`)).toBe(ID);
  });

  it("lowercases and trims", () => {
    expect(extractInviteId(`  ${ID.toUpperCase()}  `)).toBe(ID);
  });

  it("the last UUID wins", () => {
    const other = "11111111-2222-3333-4444-555555555555";
    expect(extractInviteId(`${other} then ${ID}`)).toBe(ID);
  });

  it("returns null when no UUID is present", () => {
    expect(extractInviteId("not an invite")).toBeNull();
    expect(extractInviteId("")).toBeNull();
  });
});
