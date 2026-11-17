import { describe, expect, it } from "vitest";

import { fallbackMessage, NOT_THROUGH_LINE, writeRefusalMessage } from "./error-messages";

describe("fallbackMessage", () => {
  it("names the rate limit and falls back generically", () => {
    expect(fallbackMessage("RATE_LIMITED")).toContain("Too many attempts");
    expect(fallbackMessage("INTERNAL")).toBe("Something went wrong. Try again.");
  });

  // NetworkError.md:13 — a FORBIDDEN answer reads the not-through line.
  it("reads FORBIDDEN as the not-through line", () => {
    expect(NOT_THROUGH_LINE).toBe("That didn't go through. Try again.");
    expect(fallbackMessage("FORBIDDEN")).toBe(NOT_THROUGH_LINE);
  });
});

describe("writeRefusalMessage", () => {
  it("reads FORBIDDEN as the not-through line, never as a connection fault", () => {
    expect(writeRefusalMessage("FORBIDDEN")).toBe(NOT_THROUGH_LINE);
    expect(writeRefusalMessage("FORBIDDEN")).not.toMatch(/reach the server/);
  });
});
