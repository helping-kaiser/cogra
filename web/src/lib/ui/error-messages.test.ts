import { describe, expect, it } from "vitest";

import { fallbackMessage } from "./error-messages";

describe("fallbackMessage", () => {
  it("names the rate limit and falls back generically", () => {
    expect(fallbackMessage("RATE_LIMITED")).toContain("Too many attempts");
    expect(fallbackMessage("INTERNAL")).toBe("Something went wrong. Try again.");
  });
});
