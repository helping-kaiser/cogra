// `cutsLine`: whether a one-line box draws its text cut. The browser draws "…"
// the moment the text is wider than the box by any fraction of a pixel, while
// `scrollWidth` / `clientWidth` round to whole pixels (MDN) — so an equal
// whole-pixel pair is settled on the fractional widths. The widths here are
// the ones measured in headless Chromium at 412 px (this lane's sweep).

import { afterEach, describe, expect, it, vi } from "vitest";

import { cutsLine } from "./line-cut";

function box({ scroll, client, rect, text }: { scroll: number; client: number; rect: number; text: number }) {
  const element = document.createElement("h1");
  document.body.append(element);
  Object.defineProperty(element, "scrollWidth", { value: scroll });
  Object.defineProperty(element, "clientWidth", { value: client });
  element.getBoundingClientRect = () => ({ width: rect }) as DOMRect;
  // jsdom lays nothing out and may lack the method on ranges altogether
  if (typeof Range.prototype.getBoundingClientRect !== "function") {
    Range.prototype.getBoundingClientRect = () => ({ width: 0 }) as DOMRect;
  }
  vi.spyOn(Range.prototype, "getBoundingClientRect").mockReturnValue({ width: text } as DOMRect);
  return element;
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("cutsLine", () => {
  it("a_text_a_fraction_of_a_pixel_too_wide_is_cut_though_both_whole_pixel_widths_agree", () => {
    expect(cutsLine(box({ scroll: 332, client: 332, rect: 332, text: 332.125 }))).toBe(true);
  });

  it("a_text_exactly_as_wide_as_its_box_fits", () => {
    expect(cutsLine(box({ scroll: 313, client: 313, rect: 313.40625, text: 313.40625 }))).toBe(false);
  });

  it("a_text_whole_pixels_too_wide_is_cut", () => {
    expect(cutsLine(box({ scroll: 313, client: 310, rect: 310, text: 313.40625 }))).toBe(true);
  });
});
