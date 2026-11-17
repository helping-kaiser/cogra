import { describe, expect, it } from "vitest";

import {
  readTagName,
  refusesTagName,
  signsAs,
  TAG_NAME_CHARSET_REFUSAL,
  TAG_NAME_LENGTH_REFUSAL,
  tagNameRefusal,
} from "./picker";

describe("readTagName", () => {
  // TagPickerTyping.md: the first row is the typed name canonicalized, one
  // leading # stripped and lowercased.
  it("canonicalizes a legal name: one # stripped, lowercased", () => {
    expect(readTagName("#SaltMaps")).toEqual({ kind: "legal", canonical: "saltmaps" });
    expect(readTagName("salt")).toEqual({ kind: "legal", canonical: "salt" });
    expect(readTagName("a.b-c_d")).toEqual({ kind: "legal", canonical: "a.b-c_d" });
  });

  it("reads an empty field, or a lone #, as nothing typed yet", () => {
    expect(readTagName("")).toEqual({ kind: "empty" });
    expect(readTagName("#")).toEqual({ kind: "empty" });
  });

  // TagPickerRefused.md: the charset refusal, and the length refusal.
  it("refuses a character no name may carry", () => {
    expect(readTagName("#salt maps")).toEqual({ kind: "refused", refusal: TAG_NAME_CHARSET_REFUSAL });
    expect(readTagName("salz·karte")).toEqual({ kind: "refused", refusal: TAG_NAME_CHARSET_REFUSAL });
    // Only ONE leading # is stripped; a second is a character no name carries.
    expect(readTagName("##salt")).toEqual({ kind: "refused", refusal: TAG_NAME_CHARSET_REFUSAL });
  });

  it("refuses a name longer than 128 characters", () => {
    expect(readTagName("a".repeat(128))).toEqual({ kind: "legal", canonical: "a".repeat(128) });
    expect(readTagName("a".repeat(129))).toEqual({ kind: "refused", refusal: TAG_NAME_LENGTH_REFUSAL });
  });

  it("says the charset refusal first when both apply", () => {
    expect(readTagName(`${"a".repeat(130)} b`)).toEqual({
      kind: "refused",
      refusal: TAG_NAME_CHARSET_REFUSAL,
    });
  });
});

describe("signsAs", () => {
  it("reads the record the tap will sign", () => {
    expect(signsAs("saltmaps")).toBe("Signs as #saltmaps");
  });
});

// jakob 2026-11-13 (seam 327): the picker's two refusal lines are the law, and
// a server refusal of a staged tag's name reads as them — never the server's
// own `a topic name …` text (TagPickerRefused.md).
describe("tagNameRefusal", () => {
  it("states the two lines exactly as TagPickerRefused draws them", () => {
    expect(TAG_NAME_CHARSET_REFUSAL).toBe("A tag name is letters, digits, dot, dash and underscore.");
    expect(TAG_NAME_LENGTH_REFUSAL).toBe("A tag name is at most 128 characters.");
  });

  it("reads a refused name with the picker's line for it, whitespace as the charset case", () => {
    expect(tagNameRefusal("salt maps")).toBe(TAG_NAME_CHARSET_REFUSAL);
    expect(tagNameRefusal(" salt")).toBe(TAG_NAME_CHARSET_REFUSAL);
    expect(tagNameRefusal("münchen")).toBe(TAG_NAME_CHARSET_REFUSAL);
    expect(tagNameRefusal("a".repeat(129))).toBe(TAG_NAME_LENGTH_REFUSAL);
  });

  it("falls back to the charset line when the client reads the name as legal", () => {
    expect(tagNameRefusal("salt")).toBe(TAG_NAME_CHARSET_REFUSAL);
  });
});

describe("refusesTagName", () => {
  it("names a BAD_INPUT on a tag's name, alone or in a batch", () => {
    expect(refusesTagName({ code: "BAD_INPUT", field: ["name"] })).toBe(true);
    expect(refusesTagName({ code: "BAD_INPUT", field: ["tags", "0", "name"] })).toBe(true);
  });

  it("leaves every other refusal to the code's own sentence", () => {
    expect(refusesTagName({ code: "BAD_INPUT", field: ["tags", "0", "pInterest"] })).toBe(false);
    expect(refusesTagName({ code: "NOT_FOUND", field: ["name"] })).toBe(false);
    expect(refusesTagName({ code: "BAD_INPUT", field: null })).toBe(false);
  });
});
