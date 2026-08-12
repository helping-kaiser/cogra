import { describe, expect, it } from "vitest";

import { fallbackMessage, rearmMessage } from "./error-messages";

describe("fallbackMessage", () => {
  it("names the rate limit and falls back generically", () => {
    expect(fallbackMessage("RATE_LIMITED")).toContain("Too many attempts");
    expect(fallbackMessage("INTERNAL")).toBe("Something went wrong. Try again.");
  });
});

describe("rearmMessage", () => {
  it("keeps its specific arms and delegates the tail", () => {
    expect(rearmMessage("INVITE_UNUSABLE")).toContain("can't be used");
    expect(rearmMessage("BAD_INPUT")).toContain("still live");
    expect(rearmMessage("RATE_LIMITED")).toContain("Too many attempts");
    expect(rearmMessage("NOT_FOUND")).toBe("Something went wrong. Try again.");
  });
});
