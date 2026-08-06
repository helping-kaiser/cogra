// @vitest-environment node
// Mirrors android/core/crypto CborTest.kt over the deterministic subset.

import { expect, it } from "vitest";
import { equalBytes, toHex } from "./bytes";
import { CborDecodeError, CborDecoder, CborEncoder } from "./cbor";

it("values round-trip", () => {
  const encoded = new CborEncoder()
    .array(6n)
    .uint(4294967296n)
    .bytes(Uint8Array.of(1, 2, 3))
    .text("héllo → ✓")
    .float(-0.25)
    .nul()
    .array(0n)
    .finish();
  const d = new CborDecoder(encoded);
  expect(d.array()).toBe(6n);
  expect(d.uint()).toBe(4294967296n);
  expect(equalBytes(d.bytes(), Uint8Array.of(1, 2, 3))).toBe(true);
  expect(d.text()).toBe("héllo → ✓");
  expect(d.float()).toBe(-0.25);
  expect(d.textOrNull()).toBeNull();
  expect(d.array()).toBe(0n);
  d.finish();
});

it("textOrNull reads a text item", () => {
  const encoded = new CborEncoder().text("cogra").finish();
  expect(new CborDecoder(encoded).textOrNull()).toBe("cogra");
});

it("the decoder is lenient about head widths", () => {
  expect(new CborDecoder(Uint8Array.of(0x18, 0x01)).uint()).toBe(1n);
});

it("truncated input is refused", () => {
  expect(() => new CborDecoder(new Uint8Array(0)).uint()).toThrow(CborDecodeError);
  expect(() => new CborDecoder(Uint8Array.of(0x42, 0x01)).bytes()).toThrow(CborDecodeError);
  expect(() => new CborDecoder(Uint8Array.of(0xfb, 0x3f)).float()).toThrow(CborDecodeError);
});

it("a wrong major type is refused", () => {
  const text = new CborEncoder().text("cogra").finish();
  expect(() => new CborDecoder(text).uint()).toThrow(CborDecodeError);
  expect(() => new CborDecoder(text).bytes()).toThrow(CborDecodeError);
  expect(() => new CborDecoder(text).array()).toThrow(CborDecodeError);
  expect(() => new CborDecoder(text).float()).toThrow(CborDecodeError);
});

it("an unsupported head is refused", () => {
  expect(() => new CborDecoder(Uint8Array.of(0x1f)).uint()).toThrow(CborDecodeError);
});

it("invalid UTF-8 is refused", () => {
  expect(() => new CborDecoder(Uint8Array.of(0x62, 0xc3, 0x28)).text()).toThrow(
    new CborDecodeError("invalid UTF-8 in text item"),
  );
});

it("trailing input is refused", () => {
  const d = new CborDecoder(Uint8Array.of(0x01, 0x02));
  expect(d.uint()).toBe(1n);
  expect(() => d.finish()).toThrow(new CborDecodeError("1 bytes of trailing input"));
});

it("encoding is deterministic", () => {
  const encode = () => new CborEncoder().array(2n).text("cogra").float(0.5).finish();
  expect(toHex(encode())).toBe(toHex(encode()));
});

it("negative zero keeps its sign bit", () => {
  expect(toHex(new CborEncoder().float(-0.0).finish())).toBe("fb8000000000000000");
});
