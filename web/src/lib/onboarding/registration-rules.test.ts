// The browser-native email check (ruling 94). The vectors are Android's own
// (`EmailValidTest.kt`, the ported WHATWG regular expression): the same list
// answering the same way on both sides is the parity the ruling asks for.

import { describe, expect, it } from "vitest";

import { emailValid } from "./registration-rules";

const VALID = [
  "sol@ferreira.studio",
  // No dot is needed: a single-label domain is valid by the standard.
  "sol@ferreira",
  "a.b+tag@sub-domain.example.org",
  "o'neil@example.com",
  "x!#$%&'*+/=?^_`{|}~-@x.io",
  " sol@ferreira.studio ",
  "sol@ferreira.studio\n",
  "sol@ferr\neira.studio",
  `sol@${"a".repeat(63)}.studio`,
];

const INVALID = [
  "",
  "   ",
  "sol.ferreira",
  "sol@",
  "@ferreira.studio",
  "sol@ferreira.",
  "sol@-ferreira.studio",
  "sol@ferreira-.studio",
  "sol @ferreira.studio",
  "sol@ferr eira.studio",
  "sol@@ferreira.studio",
  "sol@ferreira..studio",
  "sol@ferreira_studio.com",
  "jöse@example.com",
  `sol@${"a".repeat(64)}.studio`,
];

describe("emailValid", () => {
  it.each(VALID)("passes the standard's valid address %j", (address) => {
    expect(emailValid(address)).toBe(true);
  });

  it.each(INVALID)("refuses the standard's invalid address %j", (address) => {
    expect(emailValid(address)).toBe(false);
  });
});
