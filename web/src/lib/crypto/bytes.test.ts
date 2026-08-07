import { describe, expect, it } from "vitest";

import { fromBase64, toBase64 } from "./bytes";

describe("base64", () => {
  it("round-trips every byte value", () => {
    const all = new Uint8Array(256);
    for (let i = 0; i < 256; i++) all[i] = i;
    expect(fromBase64(toBase64(all))).toEqual(all);
  });

  it("encodes the standard alphabet with padding", () => {
    expect(toBase64(new TextEncoder().encode("hi"))).toBe("aGk=");
    expect(toBase64(new Uint8Array())).toBe("");
  });

  it("decodes what the platform's encoder produced", () => {
    expect(new TextDecoder().decode(fromBase64("aGVsbG8="))).toBe("hello");
  });

  it("refuses malformed input", () => {
    expect(() => fromBase64("not base64!")).toThrow(RangeError);
  });
});
