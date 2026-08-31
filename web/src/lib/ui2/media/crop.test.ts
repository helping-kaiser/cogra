import { describe, expect, it } from "vitest";

import { CENTERED, clampZoom, MAX_ZOOM, MIN_ZOOM, usableArea } from "./crop";

describe("the crop the wizard carries", () => {
  it("starts centred, unzoomed, and unmeasured", () => {
    expect(CENTERED).toEqual({ x: 0, y: 0, zoom: MIN_ZOOM, area: null });
  });

  it("holds the zoom inside the range the cropper is given", () => {
    expect(clampZoom(0.2)).toBe(MIN_ZOOM);
    expect(clampZoom(99)).toBe(MAX_ZOOM);
    expect(clampZoom(1.5)).toBe(1.5);
    expect(clampZoom(Number.NaN)).toBe(MIN_ZOOM);
  });
});

describe("usableArea", () => {
  it("rejects the states the encoder cannot draw from", () => {
    expect(usableArea(null)).toBe(false);
    expect(usableArea(undefined)).toBe(false);
    expect(usableArea({ x: 0, y: 0, width: 0, height: 100 })).toBe(false);
    expect(usableArea({ x: 0, y: 0, width: 100, height: -1 })).toBe(false);
    expect(usableArea({ x: Number.NaN, y: 0, width: 100, height: 100 })).toBe(false);
  });

  it("accepts a measured rectangle", () => {
    expect(usableArea({ x: 10, y: 20, width: 100, height: 125 })).toBe(true);
  });
});
