import { describe, expect, it } from "vitest";

import { MISMATCH_LINE, mismatchAfterEdit, mismatchOnPress } from "./repeat-password";

describe("the repeat password", () => {
  it("a press finds the two apart, exactly as typed", () => {
    expect(mismatchOnPress("a long password!", "a long password!")).toBeNull();
    expect(mismatchOnPress("a long password!", "a long password")).toBe(MISMATCH_LINE);
    expect(mismatchOnPress("a long password!", "a long password! ")).toBe(MISMATCH_LINE);
    expect(mismatchOnPress("Case", "case")).toBe(MISMATCH_LINE);
  });

  it("a standing line goes once the two match and otherwise stands", () => {
    expect(mismatchAfterEdit(MISMATCH_LINE, "abc", "ab")).toBe(MISMATCH_LINE);
    expect(mismatchAfterEdit(MISMATCH_LINE, "abc", "abc")).toBeNull();
  });

  it("typing never raises the line", () => {
    expect(mismatchAfterEdit(null, "abc", "ab")).toBeNull();
  });
});
