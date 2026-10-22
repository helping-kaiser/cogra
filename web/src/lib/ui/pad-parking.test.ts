// @vitest-environment node
// The parked pad of design.md §8.3: one fixed spot, the lower centre of
// the viewport, the same place every time — 16px above the bottom bar where
// the surface has one (PadStanding.md).

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { PAD_ABOVE_BAR_INSET_PX, PAD_PARK_INSET_PX, parkedPadStyle } from "./pad-parking";

const DESIGN = readFileSync(
  new URL("../../../../docs/implementation/design.md", import.meta.url),
  "utf-8",
);

const PAD_STANDING = readFileSync(
  new URL(
    "../../../../design/designs/canonical/behavior/PadStanding.md",
    import.meta.url,
  ),
  "utf-8",
);

describe("the parked pad", () => {
  it("is the spot design.md §8.3 names", () => {
    // The rule is the doc's, not this module's: a pad that moved to the
    // upper centre would still pass every geometric assertion below.
    expect(DESIGN).toMatch(/pad lives at one fixed spot: the lower centre of the\s+viewport/);
    expect(PAD_STANDING).toContain(
      "16px above the bottom bar where the surface has one and 16px off the bottom edge where it does not",
    );
  });

  it("pins itself to the viewport rather than to anything on the page", () => {
    expect(parkedPadStyle().position).toBe("fixed");
  });

  it("sits at the lower centre, centred without a transform", () => {
    const style = parkedPadStyle();

    // Centred around whatever width the caller gives it — and with no
    // transform, so the bloom's rise owns `transform` alone.
    expect(style.left).toBe(0);
    expect(style.right).toBe(0);
    expect(style.marginInline).toBe("auto");
    expect(style.transform).toBeUndefined();
    // Measured from the bottom, which is what makes it the LOWER centre
    // on any viewport height without arithmetic.
    expect(style.bottom).toBe(`${PAD_PARK_INSET_PX}px`);
    expect(style.top).toBeUndefined();
  });

  it("is the same style every call, so the pad cannot drift", () => {
    expect(parkedPadStyle()).toEqual(parkedPadStyle());
  });

  it("moves the whole spot with the inset, and takes nothing else", () => {
    const style = parkedPadStyle(40);

    expect(style.bottom).toBe("40px");
    expect(style.left).toBe(0);
  });

  it("clears the bar and its safe area where a bar stands", () => {
    expect(PAD_ABOVE_BAR_INSET_PX).toBe(64 + PAD_PARK_INSET_PX);
    expect(parkedPadStyle(PAD_ABOVE_BAR_INSET_PX, true).bottom).toBe(
      "calc(80px + env(safe-area-inset-bottom, 0px))",
    );
  });

  it("caps its height to the viewport rather than running off the top", () => {
    expect(parkedPadStyle().maxHeight).toBe(`calc(100dvh - ${PAD_PARK_INSET_PX * 2}px)`);
    expect(parkedPadStyle(40).maxHeight).toBe("calc(100dvh - 80px)");
  });
});
