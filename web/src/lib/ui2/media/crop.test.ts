// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  CENTERED,
  canPan,
  clampCrop,
  cropStyle,
  dragBy,
  MAX_ZOOM,
  MIN_ZOOM,
  NUDGE_STEP,
  ZOOM_STEP,
  nudge,
  zoomBy,
} from "./crop";

describe("clampCrop", () => {
  it("holds the zoom inside its range", () => {
    expect(clampCrop({ zoom: 0.2, x: 0.5, y: 0.5 }).zoom).toBe(MIN_ZOOM);
    expect(clampCrop({ zoom: 99, x: 0.5, y: 0.5 }).zoom).toBe(MAX_ZOOM);
  });

  it("holds the focal point inside the frame", () => {
    const crop = clampCrop({ zoom: 2, x: -3, y: 4 });
    expect(crop.x).toBe(0);
    expect(crop.y).toBe(1);
  });

  it("collapses the focal point to centre at zoom 1, where panning is meaningless", () => {
    expect(clampCrop({ zoom: 1, x: 0.1, y: 0.9 })).toEqual({ zoom: 1, x: 0.5, y: 0.5 });
  });

  it("survives a non-finite value rather than propagating NaN into a transform", () => {
    const crop = clampCrop({ zoom: Number.NaN, x: Number.NaN, y: Number.NaN });
    expect(Number.isFinite(crop.zoom)).toBe(true);
    expect(Number.isFinite(crop.x)).toBe(true);
    expect(Number.isFinite(crop.y)).toBe(true);
  });
});

describe("zoomBy", () => {
  it("steps up and down and stops at the ends", () => {
    expect(zoomBy(CENTERED, ZOOM_STEP).zoom).toBeCloseTo(1 + ZOOM_STEP);
    expect(zoomBy(CENTERED, -ZOOM_STEP).zoom).toBe(MIN_ZOOM);
    expect(zoomBy({ zoom: MAX_ZOOM, x: 0.5, y: 0.5 }, ZOOM_STEP).zoom).toBe(MAX_ZOOM);
  });
});

describe("nudge", () => {
  it("moves the focal point by the step", () => {
    const crop = nudge({ zoom: 2, x: 0.5, y: 0.5 }, NUDGE_STEP, -NUDGE_STEP);
    expect(crop.x).toBeCloseTo(0.5 + NUDGE_STEP);
    expect(crop.y).toBeCloseTo(0.5 - NUDGE_STEP);
  });

  it("stops at the edge instead of running off the picture", () => {
    const crop = nudge({ zoom: 2, x: 0.98, y: 0.02 }, NUDGE_STEP, -NUDGE_STEP);
    expect(crop.x).toBe(1);
    expect(crop.y).toBe(0);
  });
});

describe("dragBy", () => {
  it("moves the focal point opposite the drag, so the picture follows the finger", () => {
    // Dragging right reveals the picture's left side: the focal point moves left.
    const crop = dragBy({ zoom: 2, x: 0.5, y: 0.5 }, 100, 0, 400, 400);
    expect(crop.x).toBeLessThan(0.5);
    // slack = zoom - 1 = 1, so 100px over a 400px frame is a quarter of the range.
    expect(crop.x).toBeCloseTo(0.25);
  });

  it("scales the movement by the zoom's slack", () => {
    const gentle = dragBy({ zoom: 3, x: 0.5, y: 0.5 }, 100, 0, 400, 400);
    const sharp = dragBy({ zoom: 1.5, x: 0.5, y: 0.5 }, 100, 0, 400, 400);
    // More zoom means more picture to travel across, so the same drag moves the
    // focal point less.
    expect(0.5 - gentle.x).toBeLessThan(0.5 - sharp.x);
  });

  it("does nothing at zoom 1, where there is no slack to take up", () => {
    const crop = dragBy(CENTERED, 200, 200, 400, 400);
    expect(crop).toEqual(CENTERED);
  });

  it("does nothing when the frame has not been measured", () => {
    const start = { zoom: 2, x: 0.5, y: 0.5 };
    expect(dragBy(start, 50, 50, 0, 0)).toEqual(start);
  });
});

describe("cropStyle", () => {
  it("renders the model as a scale about the focal point", () => {
    expect(cropStyle({ zoom: 1.5, x: 0.25, y: 0.75 })).toEqual({
      transform: "scale(1.5)",
      transformOrigin: "25% 75%",
      objectFit: "cover",
    });
  });

  it("clamps before rendering, so an out-of-range model cannot uncover the frame", () => {
    expect(cropStyle({ zoom: 9, x: 5, y: -5 })).toEqual({
      transform: `scale(${MAX_ZOOM})`,
      transformOrigin: "100% 0%",
      objectFit: "cover",
    });
  });
});

describe("canPan", () => {
  it("is false exactly at the resting zoom", () => {
    expect(canPan(CENTERED)).toBe(false);
    expect(canPan({ zoom: 1.2, x: 0.5, y: 0.5 })).toBe(true);
  });
});
