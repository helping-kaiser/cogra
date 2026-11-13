import { describe, expect, it } from "vitest";

import { previewTagName, TAG_BATCH_CAP, TAG_NAME_MAX } from "./normalize";

describe("previewTagName", () => {
  it("strips one leading '#'", () => {
    expect(previewTagName("#rust")).toEqual({ canonical: "rust", valid: true });
  });

  it("strips only one leading '#', leaving the rest untouched", () => {
    expect(previewTagName("##rust").canonical).toBe("#rust");
    expect(previewTagName("##rust").valid).toBe(false);
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
    expect(previewTagName("a-b_c.d9")).toEqual({
      canonical: "a-b_c.d9",
      valid: true,
    });
  });

  it("does NOT trim whitespace — a leading space is refused, not cleaned", () => {
    expect(previewTagName(" rust").canonical).toBe(" rust");
    expect(previewTagName(" rust").valid).toBe(false);
  });

  it("refuses an internal space", () => {
    expect(previewTagName("bot defense").valid).toBe(false);
  });

  it("refuses a colon", () => {
    expect(previewTagName("a:b").valid).toBe(false);
  });

  it("refuses non-ASCII rather than encoding it", () => {
    expect(previewTagName("münchen").valid).toBe(false);
  });

  it("refuses an empty name", () => {
    expect(previewTagName("").valid).toBe(false);
    expect(previewTagName("#").valid).toBe(false);
  });

  it("refuses over-length names (over 128 bytes)", () => {
    expect(previewTagName("a".repeat(TAG_NAME_MAX + 1)).valid).toBe(false);
  });

  it("accepts exactly 128 bytes", () => {
    expect(previewTagName("a".repeat(TAG_NAME_MAX)).valid).toBe(true);
  });
});

describe("TAG_BATCH_CAP", () => {
  it("is 10, per D18", () => {
    expect(TAG_BATCH_CAP).toBe(10);
  });
});
