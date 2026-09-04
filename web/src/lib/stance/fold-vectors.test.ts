// The fold contract: this module's clip and its local landing, pinned to
// the repo-root `stance-fold-vectors.json` exported from the Rust
// reference (`crates/common/src/l1/fold.rs`). Never transcribe a vector
// value — the file is read here exactly as the crypto golden vectors and
// the design tokens are.
//
// THE VECTORS SPEAK IN BITS, AND SO DOES THIS TEST. `0` and `-0` compare
// equal under `===` and under `toBe`, so a clip that let a negative zero
// through would pass a value comparison while serialising differently
// into a record. Every assertion below therefore compares the IEEE-754
// bit pattern, which is the only comparison that can see the difference.
//
// SEVERANCE IS NOT ASSERTED HERE. The vectors carry a `severance` group —
// the counter-record batch and its cost — and web has no implementation
// to pin it to: severance is staged by `prepareSeverance` and the batch
// length arrives on the wire as `severanceCost`, so nothing in this app
// computes one. The group is asserted by the reference's own tests and
// by whichever client grows a local batch first.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { localLanding } from "./landing";
import { clampDimension, type StancePair } from "./model";

type BitPair = { pDirectedBits: string; pInterestBits: string };

type FoldVectors = {
  version: number;
  clip: { case: string; inputBits: string; outputBits: string }[];
  landings: {
    case: string;
    rawSum: BitPair;
    pick: BitPair;
    landing: BitPair;
    inert: boolean;
    severed: boolean;
  }[];
};

const vectors = JSON.parse(
  readFileSync(new URL("../../../../stance-fold-vectors.json", import.meta.url), "utf-8"),
) as FoldVectors;

const view = new DataView(new ArrayBuffer(8));

/** The f64 those 16 hex digits are the big-endian bit pattern of. */
function f64(bits: string): number {
  view.setBigUint64(0, BigInt(`0x${bits}`), false);
  return view.getFloat64(0, false);
}

/** The 16 hex digits of this f64's bit pattern, big-endian. */
function bitsOf(value: number): string {
  view.setFloat64(0, value, false);
  return view.getBigUint64(0, false).toString(16).padStart(16, "0");
}

const pairOf = (bits: BitPair): StancePair => ({
  pDirected: f64(bits.pDirectedBits),
  pInterest: f64(bits.pInterestBits),
});

describe("clip", () => {
  it.each(vectors.clip)("$case", ({ inputBits, outputBits }) => {
    expect(bitsOf(clampDimension(f64(inputBits)))).toBe(outputBits);
  });
});

describe("the local landing", () => {
  it.each(vectors.landings)("$case", (vector) => {
    const landed = localLanding(pairOf(vector.rawSum), pairOf(vector.pick));
    expect(bitsOf(landed.landing.pDirected)).toBe(vector.landing.pDirectedBits);
    expect(bitsOf(landed.landing.pInterest)).toBe(vector.landing.pInterestBits);
    expect(landed.inert).toBe(vector.inert);
    expect(landed.severed).toBe(vector.severed);
  });
});
