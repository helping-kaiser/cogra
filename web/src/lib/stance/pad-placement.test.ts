// @vitest-environment node
// Where the pad lands, tested as arithmetic: jsdom measures every box as
// zero, so a component test can only assert that the component asks this
// module — the placement itself is pinned here.
//
// The two properties §8.3 asks for are asserted as properties, over a
// sweep of anchors including all four viewport edges and a phone-sized
// viewport, rather than at a handful of hand-picked positions.

import { describe, expect, it } from "vitest";

import {
  PAD_ANCHOR_GAP_PX,
  PAD_VIEWPORT_MARGIN_PX,
  placePad,
  type PadPlacement,
  type PlacementRect,
  type PlacementSize,
  type PlacementViewport,
} from "./pad-placement";

/** The pad as the control draws it: `w-64` and about as tall again. */
const PAD: PlacementSize = { width: 256, height: 340 };
const DESKTOP: PlacementViewport = { width: 1280, height: 800 };
/** The narrowest phone the app is built for (design.md §4). */
const PHONE: PlacementViewport = { width: 360, height: 640 };
/** A 48px target, the minimum the resting control is drawn at. */
const TARGET = { width: 120, height: 48 };

function anchorAt(left: number, top: number): PlacementRect {
  return { left, top, ...TARGET };
}

function padBox(placed: PadPlacement, pad: PlacementSize = PAD) {
  return {
    left: placed.left,
    top: placed.top,
    right: placed.left + pad.width,
    bottom: placed.top + pad.height,
  };
}

function insideViewport(placed: PadPlacement, viewport: PlacementViewport, pad = PAD): boolean {
  const box = padBox(placed, pad);
  return (
    box.left >= PAD_VIEWPORT_MARGIN_PX - 1e-9 &&
    box.top >= PAD_VIEWPORT_MARGIN_PX - 1e-9 &&
    box.right <= viewport.width - PAD_VIEWPORT_MARGIN_PX + 1e-9 &&
    box.bottom <= viewport.height - PAD_VIEWPORT_MARGIN_PX + 1e-9
  );
}

function overlaps(placed: PadPlacement, anchor: PlacementRect, pad = PAD): boolean {
  const box = padBox(placed, pad);
  return (
    box.left < anchor.left + anchor.width &&
    box.right > anchor.left &&
    box.top < anchor.top + anchor.height &&
    box.bottom > anchor.top
  );
}

/** Anchors at and around every edge and corner of a viewport. */
function edgeAnchors(viewport: PlacementViewport): PlacementRect[] {
  const xs = [0, 1, viewport.width / 2 - TARGET.width / 2, viewport.width - TARGET.width - 1, viewport.width - TARGET.width];
  const ys = [0, 1, viewport.height / 2 - TARGET.height / 2, viewport.height - TARGET.height - 1, viewport.height - TARGET.height];
  return xs.flatMap((x) => ys.map((y) => anchorAt(x, y)));
}

describe("clamping into the viewport", () => {
  it("keeps the whole pad on screen from every edge and corner of a desktop viewport", () => {
    for (const anchor of edgeAnchors(DESKTOP)) {
      const placed = placePad(anchor, PAD, DESKTOP);
      expect(insideViewport(placed, DESKTOP), `anchor ${anchor.left},${anchor.top}`).toBe(true);
    }
  });

  it("keeps the whole pad on screen from every edge and corner of a phone viewport", () => {
    for (const anchor of edgeAnchors(PHONE)) {
      const placed = placePad(anchor, PAD, PHONE);
      expect(insideViewport(placed, PHONE), `anchor ${anchor.left},${anchor.top}`).toBe(true);
    }
  });

  it("pins to the near edge rather than off the far one when the pad cannot fit", () => {
    // Narrower than the pad: clamping into an inverted range would put
    // the pad off the left edge instead of the right.
    const cramped: PlacementViewport = { width: 200, height: 300 };
    const placed = placePad(anchorAt(40, 120), PAD, cramped);
    expect(placed.left).toBe(PAD_VIEWPORT_MARGIN_PX);
    expect(placed.top).toBe(PAD_VIEWPORT_MARGIN_PX);
  });
});

describe("staying clear of the finger", () => {
  it("never overlaps the target it blooms from, anywhere it fits", () => {
    for (const viewport of [DESKTOP, PHONE]) {
      for (const anchor of edgeAnchors(viewport)) {
        const placed = placePad(anchor, PAD, viewport);
        // The pad only has to fit on one side of the target for the
        // guarantee to hold; a viewport too short for that is the
        // cramped case above.
        const fits =
          anchor.top - PAD_ANCHOR_GAP_PX - PAD_VIEWPORT_MARGIN_PX >= PAD.height ||
          viewport.height - (anchor.top + anchor.height + PAD_ANCHOR_GAP_PX) - PAD_VIEWPORT_MARGIN_PX >=
            PAD.height;
        if (!fits) continue;
        expect(overlaps(placed, anchor), `anchor ${anchor.left},${anchor.top}`).toBe(false);
      }
    }
  });

  it("leaves the gap between the target and the pad", () => {
    const anchor = anchorAt(500, 600);
    const placed = placePad(anchor, PAD, DESKTOP);
    expect(placed.side).toBe("above");
    expect(anchor.top - padBox(placed).bottom).toBe(PAD_ANCHOR_GAP_PX);
  });
});

describe("choosing a side", () => {
  it("prefers above, where the hand does not occlude", () => {
    expect(placePad(anchorAt(500, 600), PAD, DESKTOP).side).toBe("above");
  });

  it("drops below a target too near the top to bloom above", () => {
    const placed = placePad(anchorAt(500, 10), PAD, DESKTOP);
    expect(placed.side).toBe("below");
    expect(placed.top).toBe(10 + TARGET.height + PAD_ANCHOR_GAP_PX);
  });

  it("takes the roomier side when the pad fits on neither", () => {
    // A short viewport with the target low: above is the larger gap.
    const short: PlacementViewport = { width: 400, height: 400 };
    expect(placePad(anchorAt(100, 330), PAD, short).side).toBe("above");
    expect(placePad(anchorAt(100, 20), PAD, short).side).toBe("below");
  });
});

describe("horizontal anchoring", () => {
  it("centres the pad on the target where there is room", () => {
    const anchor = anchorAt(600, 500);
    const placed = placePad(anchor, PAD, DESKTOP);
    expect(placed.left).toBe(600 + TARGET.width / 2 - PAD.width / 2);
  });

  it("slides a pad anchored at the right edge back inside", () => {
    const anchor = anchorAt(PHONE.width - TARGET.width, 400);
    const placed = placePad(anchor, PAD, PHONE);
    expect(padBox(placed).right).toBe(PHONE.width - PAD_VIEWPORT_MARGIN_PX);
  });

  it("slides a pad anchored at the left edge back inside", () => {
    const placed = placePad(anchorAt(0, 400), PAD, PHONE);
    expect(placed.left).toBe(PAD_VIEWPORT_MARGIN_PX);
  });
});
