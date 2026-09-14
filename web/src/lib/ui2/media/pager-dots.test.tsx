import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DOT_EDGE, DOT_FULL, dotWindow, PagerDots } from "./pager-dots";

/** The dots the row actually drew, in order, as `[index, pixel size]`. */
function drawn(): Array<[number, number]> {
  return screen
    .getAllByTestId(/^dots-dot-\d+$/)
    .map((dot) => [
      Number(dot.getAttribute("data-testid")!.replace("dots-dot-", "")),
      Number.parseInt(dot.style.width, 10),
    ]);
}

describe("dotWindow", () => {
  it("draws every slot while the set fits the window", () => {
    const { start, window, moreBefore, moreAfter } = dotWindow(4, 1);
    expect({ start, window, moreBefore, moreAfter }).toEqual({
      start: 0,
      window: 4,
      moreBefore: false,
      moreAfter: false,
    });
  });

  it("parks at the set's start until the active dot reaches the middle", () => {
    // `current - (window >> 1)` is negative for 0..2, so the clamp holds the
    // window at the head and the active dot walks along it.
    expect([0, 1, 2].map((at) => dotWindow(10, at).start)).toEqual([0, 0, 0]);
  });

  it("slides the window centred on the reader, one step at a time", () => {
    expect([3, 4, 5, 6].map((at) => dotWindow(10, at).start)).toEqual([0, 1, 2, 3]);
  });

  it("parks at the set's end so the last dot can be reached", () => {
    expect([7, 8, 9].map((at) => dotWindow(10, at).start)).toEqual([3, 3, 3]);
  });
});

describe("PagerDots", () => {
  it("marks no position for a lone picture", () => {
    const { container } = render(<PagerDots count={1} current={0} testId="dots" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("speaks the count it never draws", () => {
    render(<PagerDots count={10} current={4} testId="dots" />);
    const row = screen.getByTestId("dots");
    expect(row).toHaveAttribute("aria-label", "Picture 5 of 10");
    expect(row.textContent).toBe("");
  });

  it("draws a four-set whole, every dot full size", () => {
    render(<PagerDots count={4} current={1} testId="dots" />);
    expect(drawn()).toEqual([
      [0, DOT_FULL],
      [1, DOT_FULL],
      [2, DOT_FULL],
      [3, DOT_FULL],
    ]);
  });

  it("draws a seven-set whole — the window is the ceiling, not a cut", () => {
    render(<PagerDots count={7} current={3} testId="dots" />);
    expect(drawn().map(([, size]) => size)).toEqual(Array(7).fill(DOT_FULL));
  });

  it("caps a ten-set at seven slots and shrinks only the edge with more beyond it", () => {
    render(<PagerDots count={10} current={0} testId="dots" />);
    expect(drawn()).toEqual([
      [0, DOT_FULL],
      [1, DOT_FULL],
      [2, DOT_FULL],
      [3, DOT_FULL],
      [4, DOT_FULL],
      [5, DOT_FULL],
      [6, DOT_EDGE],
    ]);
  });

  it("shrinks both edges once the window has the set on either side of it", () => {
    render(<PagerDots count={10} current={5} testId="dots" />);
    expect(drawn()).toEqual([
      [2, DOT_EDGE],
      [3, DOT_FULL],
      [4, DOT_FULL],
      [5, DOT_FULL],
      [6, DOT_FULL],
      [7, DOT_FULL],
      [8, DOT_EDGE],
    ]);
  });

  it("never shrinks the active dot, wherever the reader is in a long set", () => {
    for (let at = 0; at < 10; at += 1) {
      const view = render(<PagerDots count={10} current={at} testId="dots" />);
      const active = screen.getByTestId(`dots-dot-${at}`);
      expect(active).toHaveAttribute("data-active", "true");
      expect(Number.parseInt(active.style.width, 10)).toBe(DOT_FULL);
      view.unmount();
    }
  });

  it("keeps every slot at the full dot's pitch, shrunk or not", () => {
    render(<PagerDots count={10} current={5} testId="dots" />);
    for (const slot of screen.getAllByTestId(/^dots-slot-\d+$/)) {
      expect(slot.style.width).toBe(`${DOT_FULL}px`);
      expect(slot.style.height).toBe(`${DOT_FULL}px`);
    }
  });

  it("takes the page's own ink on a card and white over the viewer", () => {
    const card = render(<PagerDots count={3} current={0} testId="dots" />);
    expect(screen.getByTestId("dots-dot-0").style.background).toBe("var(--primary)");
    expect(screen.getByTestId("dots-dot-1").style.background).toBe("var(--border-hairline)");
    expect(screen.getByTestId("dots").style.filter).toBe("none");
    card.unmount();

    render(<PagerDots count={3} current={0} tone="viewer" testId="dots" />);
    expect(screen.getByTestId("dots-dot-0").style.background).toBe("rgb(255, 255, 255)");
    // A 6px dot on an unknown photograph needs the shadow to stay visible.
    expect(screen.getByTestId("dots").style.filter).toContain("drop-shadow");
  });
});
