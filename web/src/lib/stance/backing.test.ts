// @vitest-environment node
// The one-axis pad's arithmetic against its master (`StanceReadout.jsx`'s
// `attachmentLanding`) and round 15's walk-back law (EditPad.md).

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  attachmentLanding,
  BACKING_AFTER_LABEL,
  backingNet,
  CURRENT_BACKING_LABEL,
  walkBackPick,
  WALK_IT_ALL_BACK,
} from "./backing";

const MASTER = readFileSync(
  new URL("../../../../design/components/stance/StanceReadout.jsx", import.meta.url),
  "utf-8",
);
const EDIT_PAD = readFileSync(
  new URL("../../../../design/designs/canonical/screens/EditPad.jsx", import.meta.url),
  "utf-8",
);

describe("the backing's words", () => {
  it("spells the readouts' labels as the master does", () => {
    expect(MASTER).toContain(`export const CURRENT_BACKING_LABEL = "${CURRENT_BACKING_LABEL}";`);
    expect(MASTER).toContain(`export const BACKING_AFTER_LABEL = "${BACKING_AFTER_LABEL}";`);
    expect(EDIT_PAD).toContain(`>${WALK_IT_ALL_BACK}</Button>`);
  });
});

describe("Backing after — clip of the raw sum plus the pick", () => {
  it("adds the pick to the RAW sum, never to the clipped net", () => {
    // A bundle summed to +1.30 nets +1.00; a −0.40 pick lands at +0.90 —
    // the raw sum's answer, not the clipped net's +0.60.
    const after = attachmentLanding(1.3, -0.4);
    expect(after.landing).toBeCloseTo(0.9, 10);
    expect(after.capped).toBe(false);
  });

  it("states the cap past ±1, both ways", () => {
    expect(attachmentLanding(1.1, 0.3)).toEqual({ raw: 1.4000000000000001, landing: 1, capped: true });
    const low = attachmentLanding(-0.9, -0.5);
    expect(low.landing).toBe(-1);
    expect(low.capped).toBe(true);
  });

  it("reads the pick unmoved as the backing as it stands", () => {
    expect(attachmentLanding(0.1, 0)).toEqual({ raw: 0.1, landing: 0.1, capped: false });
    expect(backingNet(0.1)).toBe(0.1);
    expect(backingNet(1.7)).toBe(1);
  });
});

describe("Walk it all back", () => {
  it("parks the pick at the raw sum's opposite, so Set lands the backing at 0.00", () => {
    expect(walkBackPick(0.1)).toBe(-0.1);
    expect(attachmentLanding(0.1, walkBackPick(0.1)!).landing).toBe(0);
    expect(walkBackPick(-0.35)).toBe(0.35);
  });

  it("past ±1 parks as far as one record reaches, the rest another edit's", () => {
    expect(walkBackPick(1.4)).toBe(-1);
    expect(attachmentLanding(1.4, walkBackPick(1.4)!).landing).toBeCloseTo(0.4, 10);
  });

  it("parks on the hundredths grid, a float-summed raw sum included", () => {
    // 0.1 + 0.2 is 0.30000000000000004 in binary; the pick a reader can sign
    // is a hundredth (the value domain, jakob 2026-10-20).
    expect(walkBackPick(0.1 + 0.2)).toBe(-0.3);
    expect(Object.is(walkBackPick(-0.003), 0)).toBe(true);
  });

  it("stands greyed while the backing already nets 0.00", () => {
    expect(walkBackPick(0)).toBeNull();
    expect(walkBackPick(-0)).toBeNull();
  });
});
