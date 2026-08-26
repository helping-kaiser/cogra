import { describe, expect, it } from "vitest";

import { previewTagName, TAG_BATCH_CAP } from "./normalize";

describe("previewTagName", () => {
  it("strips one leading '#'", () => {
    expect(previewTagName("#rust")).toEqual({ canonical: "rust", valid: true });
  });

  it("strips only one leading '#', leaving the rest untouched", () => {
    expect(previewTagName("##rust")).toEqual({ canonical: "#rust", valid: false });
  });

  it("ASCII-lowercases", () => {
    expect(previewTagName("Rust")).toEqual({ canonical: "rust", valid: true });
  });

  it("is idempotent", () => {
    const once = previewTagName("#Rust");
    const twice = previewTagName(once.canonical);
    expect(twice.canonical).toBe(once.canonical);
  });

  it("accepts the full L1 atom charset", () => {
    expect(previewTagName("a-b_c.d9")).toEqual({ canonical: "a-b_c.d9", valid: true });
  });

  it("does NOT trim whitespace — a leading space is refused, not cleaned", () => {
    expect(previewTagName(" rust")).toEqual({ canonical: " rust", valid: false });
  });

  it("refuses an internal space", () => {
    expect(previewTagName("bot defense")).toEqual({ canonical: "bot defense", valid: false });
  });

  it("refuses a colon", () => {
    expect(previewTagName("a:b")).toEqual({ canonical: "a:b", valid: false });
  });

  it("refuses non-ASCII rather than encoding it", () => {
    const result = previewTagName("münchen");
    expect(result.valid).toBe(false);
  });

  it("refuses an empty name", () => {
    expect(previewTagName("")).toEqual({ canonical: "", valid: false });
    expect(previewTagName("#")).toEqual({ canonical: "", valid: false });
  });

  it("refuses over-length names (over 128 bytes)", () => {
    const tooLong = "a".repeat(129);
    expect(previewTagName(tooLong).valid).toBe(false);
  });

  it("accepts exactly 128 bytes", () => {
    const exact = "a".repeat(128);
    expect(previewTagName(exact).valid).toBe(true);
  });
});

describe("TAG_BATCH_CAP", () => {
  it("is 10, per D18", () => {
    expect(TAG_BATCH_CAP).toBe(10);
  });
});
