// @vitest-environment node
// Mirrors android/core/crypto IdentifiersTest.kt over the identifier algebra.

import { expect, it } from "vitest";
import { ActId, AddrId, FAMILIES, IdentifierError, NameId, NodeId, parseFamily } from "./identifiers";

it("act ids round-trip", () => {
  const id = new ActId("alice-addr", 7n, "opinion");
  expect(id.toString()).toBe("act:alice-addr:7:opinion");
  const parsed = ActId.parse(id.toString());
  expect(parsed.author).toBe("alice-addr");
  expect(parsed.seq).toBe(7n);
  expect(parsed.family).toBe("opinion");
});

it("node ids round-trip", () => {
  for (const s of ["addr:alice", "prof:alice", "name:bot-defense", "mint:act:alice:0:publish"]) {
    expect(NodeId.parse(s).toString()).toBe(s);
  }
});

it("every family name round-trips", () => {
  for (const family of FAMILIES) {
    expect(parseFamily(family)).toBe(family);
  }
  expect(() => parseFamily("nope")).toThrow(new IdentifierError("unknown family `nope`"));
});

it("invalid atoms are refused", () => {
  expect(() => new AddrId("has space")).toThrow(IdentifierError);
  expect(() => new NameId("colon:inside")).toThrow(IdentifierError);
  expect(() => new AddrId("")).toThrow(IdentifierError);
  expect(() => new AddrId("x".repeat(129))).toThrow(IdentifierError);
  expect(() => new ActId("bad atom", 1n, "opinion")).toThrow(IdentifierError);
});

it("unparseable forms are refused", () => {
  for (const s of ["", "addr", "mint:notanact"]) {
    expect(() => NodeId.parse(s)).toThrow(IdentifierError);
  }
  expect(() => ActId.parse("act:a:x:opinion")).toThrow(
    new IdentifierError("invalid sequence value `x`"),
  );
  expect(() => ActId.parse("act:a:1:nope")).toThrow(new IdentifierError("unknown family `nope`"));
  expect(() => ActId.parse("act:a:1")).toThrow(
    new IdentifierError("unparseable identifier `act:a:1`"),
  );
});
