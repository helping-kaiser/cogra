import { describe, expect, it } from "vitest";

import {
  readTagName,
  signsAs,
  TAG_NAME_CHARSET_REFUSAL,
  TAG_NAME_LENGTH_REFUSAL,
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
