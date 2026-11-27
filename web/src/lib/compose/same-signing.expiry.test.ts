// K-ASKED-AGAIN-MIXED-EXPIRY: when a batch that did not go through has
// EXPIRED (same-signing.ts `expiredWhole`), and what its surfaces read it as
// while a write beside the expiry is still undecided.

import { describe, expect, it } from "vitest";

import type { WriteResult } from "@/lib/signing/write-signer";
import { sealFaultOfResults } from "./seal-fault";
import { expiredWhole, faultReading, firstIncomplete } from "./same-signing";

const expired = (id: string): WriteResult => ({
  kind: "refused",
  id,
  errors: [{ code: "STAGED_WRITE_EXPIRED", message: "garbage-collected unlanded", field: null }],
});
const lost = (id: string): WriteResult => ({ kind: "failed", id, cause: new TypeError("Failed to fetch") });
const sealing = (id: string): WriteResult => ({ kind: "awaitingSeal", id });
const carried = (id: string): WriteResult => ({ kind: "carried", id });
const relaying = (id: string): WriteResult => ({ kind: "done", id, state: "RELAYING" });
const deviceRefused = (id: string): WriteResult => ({ kind: "rejectedByDevice", id, reason: "verification failed" });
const gone = (id: string): WriteResult => ({
  kind: "refused",
  id,
  errors: [{ code: "NOT_FOUND", message: "staged write is gone", field: null }],
});
const rateLimited = (id: string): WriteResult => ({
  kind: "refused",
  id,
  errors: [{ code: "RATE_LIMITED", message: "slow down", field: null }],
});

describe("a batch has expired only when no write beside the expiry is undecided", () => {
  it.each([
    ["every write expired", [expired("a"), expired("b")]],
    ["the rest refused by the device", [expired("a"), deviceRefused("b")]],
    ["the rest refused for good", [expired("a"), gone("b")]],
  ])("expired whole: %s", (_name, results) => {
    expect(expiredWhole(results)).toBe(true);
  });

  it.each([
    ["one unanswered", [expired("a"), lost("b")]],
    ["one awaiting its seal", [expired("a"), sealing("b")]],
    ["one held for the landing", [expired("a"), carried("b")]],
    ["one refused on a kept code", [expired("a"), rateLimited("b")]],
    ["one already approved", [expired("a"), relaying("b")]],
  ])("not expired whole: %s", (_name, results) => {
    expect(expiredWhole(results)).toBe(false);
  });

  it("no expiry is no expiry", () => {
    expect(expiredWhole([deviceRefused("a")])).toBe(false);
  });
});

describe("what a batch with an undecided write beside an expiry reads as", () => {
  it("the undecided write's answer, the expiry dropped", () => {
    expect(faultReading([expired("a"), lost("b")])).toEqual([lost("b")]);
    expect(firstIncomplete([expired("a"), lost("b")])).toEqual(lost("b"));
  });

  it("a whole expiry is read whole", () => {
    expect(faultReading([expired("a"), expired("b")])).toEqual([expired("a"), expired("b")]);
    expect(firstIncomplete([expired("a"), deviceRefused("b")])).toEqual(expired("a"));
  });

  it("an expiry beside an approved write is still the incomplete one, never a success", () => {
    expect(firstIncomplete([expired("a"), relaying("b")])).toEqual(expired("a"));
  });

  it("the seal reads it as no answer: the fault line with Retry, never the bug notice", () => {
    expect(sealFaultOfResults([expired("a"), lost("b")], [])).toEqual({ kind: "offline" });
    expect(sealFaultOfResults([expired("a"), sealing("b")], [])).toEqual({ kind: "offline" });
    expect(sealFaultOfResults([expired("a"), relaying("b")], [])).toEqual({ kind: "offline" });
  });

  it("a whole expiry still reads as its refusal", () => {
    expect(sealFaultOfResults([expired("a"), expired("b")], [])).toEqual({ kind: "bug" });
  });
});
