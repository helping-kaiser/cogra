// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  cssRatio,
  fitFor,
  PORTRAIT_CAP,
  POST_SHAPES,
  POST_SHAPE_ORDER,
  tileRatio,
} from "./aspect";

describe("post shapes", () => {
  it("offers exactly the three ruled shapes, in the order the crop screen draws them", () => {
    expect(POST_SHAPE_ORDER).toEqual(["tall", "square", "wide"]);
    expect(Object.keys(POST_SHAPES).sort()).toEqual(["square", "tall", "wide"]);
  });

  it("labels them as the canvas does", () => {
    expect(POST_SHAPES.tall.label).toBe("Tall 4:5");
    expect(POST_SHAPES.square.label).toBe("Square 1:1");
    expect(POST_SHAPES.wide.label).toBe("Wide 1.91:1");
  });

  it("makes 4:5 the tallest shape, which is what bounds the card's height", () => {
    const ratios = POST_SHAPE_ORDER.map((shape) => POST_SHAPES[shape].ratio);
    expect(Math.min(...ratios)).toBe(PORTRAIT_CAP);
  });
});

describe("tileRatio", () => {
  it("reserves the source's own ratio when it is inside the cap", () => {
    expect(tileRatio(16 / 9)).toBeCloseTo(16 / 9);
    expect(tileRatio(1)).toBe(1);
    expect(tileRatio(4 / 5)).toBeCloseTo(4 / 5);
  });

  it("caps a taller frame at 4:5 rather than letting it eat the screen", () => {
    // 9:16, 2:3, 3:4 — all taller than the cap.
    expect(tileRatio(9 / 16)).toBe(PORTRAIT_CAP);
    expect(tileRatio(2 / 3)).toBe(PORTRAIT_CAP);
    expect(tileRatio(3 / 4)).toBe(PORTRAIT_CAP);
  });

  it("falls back to a square when the server has not probed the asset yet", () => {
    expect(tileRatio(null)).toBe(1);
    expect(tileRatio(undefined)).toBe(1);
    expect(tileRatio(0)).toBe(1);
    expect(tileRatio(-2)).toBe(1);
    expect(tileRatio(Number.NaN)).toBe(1);
    expect(tileRatio(Number.POSITIVE_INFINITY)).toBe(1);
  });
});

describe("fitFor", () => {
  it("fits a too-tall frame whole inside the tile, so the layout never crops it", () => {
    expect(fitFor(9 / 16)).toBe("contain");
    expect(fitFor(3 / 4)).toBe("contain");
  });

  it("fills the tile when the frame already matches or is wider than the cap", () => {
    expect(fitFor(4 / 5)).toBe("cover");
    expect(fitFor(1)).toBe("cover");
    expect(fitFor(16 / 9)).toBe("cover");
  });

  it("fills when nothing is known, rather than letterboxing on a guess", () => {
    expect(fitFor(null)).toBe("cover");
    expect(fitFor(Number.NaN)).toBe("cover");
  });
});

describe("cssRatio", () => {
  it("renders a ratio the way CSS reserves space with it", () => {
    expect(cssRatio(1)).toBe("1 / 1");
    expect(cssRatio(1.91)).toBe("1.91 / 1");
  });
});
