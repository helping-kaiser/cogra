// @vitest-environment node
// The parked pad of design.md §8.3: one fixed spot, the lower centre of
// the viewport, the same place every time.

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { PAD_PARK_INSET_PX, parkedPadStyle } from "./pad-parking";

const DESIGN = readFileSync(
  new URL("../../../../docs/implementation/design.md", import.meta.url),
  "utf-8",
);

describe("the parked pad", () => {
  it("is the spot design.md §8.3 names", () => {
    // The rule is the doc's, not this module's: a pad that moved to the
    // upper centre would still pass every geometric assertion below.
    expect(DESIGN).toMatch(/pad lives at one fixed spot: the lower centre of the\s+viewport/);
  });

  it("pins itself to the viewport rather than to anything on the page", () => {
    const style = parkedPadStyle();

    expect(style.position).toBe("fixed");
  });

  it("sits at the lower centre", () => {
    const style = parkedPadStyle();

    // Centred by half its own width, whatever that width turns out to be.
    expect(style.left).toBe("50%");
    expect(style.transform).toBe("translateX(-50%)");
    // Measured from the bottom, which is what makes it the LOWER centre
    // on any viewport height without arithmetic.
    expect(style.bottom).toBe(`${PAD_PARK_INSET_PX}px`);
    expect(style.top).toBeUndefined();
  });

  it("is the same style every call, so the pad cannot drift", () => {
    expect(parkedPadStyle()).toEqual(parkedPadStyle());
  });

  it("moves the whole spot with the inset, and takes nothing else", () => {
    // The inset is the only input there is: no viewport, no anchor box,
    // no scroll offset, so no viewport change can invalidate the result.
    const style = parkedPadStyle(40);

    expect(style.bottom).toBe("40px");
    expect(style.left).toBe("50%");
  });

  it("caps its height to the viewport rather than running off the top", () => {
    expect(parkedPadStyle().maxHeight).toBe(`calc(100dvh - ${PAD_PARK_INSET_PX * 2}px)`);
    expect(parkedPadStyle(40).maxHeight).toBe("calc(100dvh - 80px)");
  });
});
