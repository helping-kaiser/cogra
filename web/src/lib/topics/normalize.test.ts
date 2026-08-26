import { describe, expect, it } from "vitest";

import { previewTagName, TAG_BATCH_CAP, TAG_NAME_MAX } from "./normalize";

describe("previewTagName", () => {
  it("strips one leading '#'", () => {
    expect(previewTagName("#rust")).toEqual({ canonical: "rust", valid: true, reason: null });
  });

  it("strips only one leading '#', leaving the rest untouched", () => {
    expect(previewTagName("##rust").canonical).toBe("#rust");
    expect(previewTagName("##rust").valid).toBe(false);
  });

  it("ASCII-lowercases", () => {
    expect(previewTagName("Rust")).toEqual({ canonical: "rust", valid: true, reason: null });
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
      reason: null,
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

// F1: the gate has to say WHY, at input time, in the reader's words.
describe("previewTagName reasons", () => {
  it("carries no reason for a legal name", () => {
    expect(previewTagName("rust").reason).toBeNull();
  });

  it("names the space as the problem, leading or internal", () => {
    expect(previewTagName("bot defense").reason).toMatch(/space/i);
    expect(previewTagName(" rust").reason).toMatch(/space/i);
  });

  it("names the charset for non-ASCII and for illegal punctuation", () => {
    expect(previewTagName("münchen").reason).toMatch(/ASCII/);
    expect(previewTagName("a:b").reason).toMatch(/ASCII/);
    expect(previewTagName("emoji🎉").reason).toMatch(/ASCII/);
  });

  it("names the length bound for an over-long name", () => {
    const reason = previewTagName("a".repeat(TAG_NAME_MAX + 1)).reason;
    expect(reason).toMatch(/too long/i);
    expect(reason).toContain(String(TAG_NAME_MAX));
  });

  it("asks for a name when there is none", () => {
    expect(previewTagName("").reason).toMatch(/topic name/i);
    expect(previewTagName("#").reason).toMatch(/topic name/i);
  });
});

describe("TAG_BATCH_CAP", () => {
  it("is 10, per D18", () => {
    expect(TAG_BATCH_CAP).toBe(10);
  });
});
