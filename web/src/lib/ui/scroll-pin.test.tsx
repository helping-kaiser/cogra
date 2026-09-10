import { fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  anchorIn,
  driftOf,
  measureAnchors,
  placeOf,
  topOfAnchor,
  usePinnedPlace,
  type ScrollPlace,
} from "./scroll-pin";

describe("the anchor", () => {
  const items = [
    { id: "a", top: -400, bottom: -120 },
    { id: "b", top: -120, bottom: 260 },
    { id: "c", top: 260, bottom: 600 },
  ];

  it("is the first item the reader has not read past", () => {
    expect(anchorIn(items)?.id).toBe("b");
  });

  it("is the top item for a reader who has not moved", () => {
    expect(anchorIn([{ id: "a", top: 0, bottom: 280 }])?.id).toBe("a");
  });

  it("is nothing at all once every item is above the reader", () => {
    expect(anchorIn([{ id: "a", top: -800, bottom: -20 }])).toBeNull();
  });

  it("carries the offset with it, so a place survives losing its anchor", () => {
    expect(placeOf(1240, items)).toEqual({ offset: 1240, anchorId: "b", anchorTop: -120 });
    expect(placeOf(1240, [])).toEqual({ offset: 1240, anchorId: null, anchorTop: 0 });
  });
});

describe("the drift", () => {
  const place: ScrollPlace = { offset: 1000, anchorId: "b", anchorTop: 120 };

  it("follows an anchor that something above it pushed down", () => {
    expect(driftOf(place, 320)).toBe(200);
  });

  it("follows an anchor that something above it pulled up", () => {
    expect(driftOf(place, 40)).toBe(-80);
  });

  it("is nothing when the anchor sits where it sat", () => {
    expect(driftOf(place, 120)).toBe(0);
  });

  it("leaves the restored offset alone when the anchor is gone", () => {
    expect(driftOf(place, null)).toBe(0);
    expect(driftOf({ offset: 1000, anchorId: null, anchorTop: 0 }, 400)).toBe(0);
  });
});

// jsdom runs no layout, so the scroller is modelled: an item's client rect is
// where it sits in the column minus how far the column has been scrolled, which
// is the one thing a real scroller does that this file depends on.
describe("holding the reader's place", () => {
  let scroller: HTMLElement;
  let host: { current: HTMLElement };
  let layout: Record<string, number>;
  let resized: Set<() => void>;
  const NativeResizeObserver = globalThis.ResizeObserver;

  function item(id: string) {
    const element = document.createElement("div");
    element.setAttribute("data-scroll-anchor", id);
    element.getBoundingClientRect = () =>
      new DOMRect(0, (layout[id] ?? 0) - scroller.scrollTop, 400, 200);
    return element;
  }

  beforeEach(() => {
    resized = new Set();
    globalThis.ResizeObserver = class {
      constructor(readonly callback: () => void) {
        resized.add(callback);
      }
      observe() {}
      unobserve() {}
      disconnect() {
        resized.delete(this.callback);
      }
    } as unknown as typeof ResizeObserver;

    layout = { a: 200, b: 1120, c: 2000 };
    scroller = document.createElement("div");
    scroller.getBoundingClientRect = () => new DOMRect(0, 0, 400, 800);
    scroller.append(item("a"), item("b"), item("c"));
    document.body.append(scroller);
    host = { current: scroller };
  });

  afterEach(() => {
    scroller.remove();
    globalThis.ResizeObserver = NativeResizeObserver;
  });

  /** Everything the surface renders is already in the DOM; this is the hook. */
  function Pinned({
    place,
    record = () => {},
  }: {
    place: ScrollPlace | null;
    record?: (place: ScrollPlace) => void;
  }) {
    usePinnedPlace({ host, place, record });
    return null;
  }

  /** A banner or a picture landing above the reader moves everything under it. */
  function growAbove(by: number) {
    layout = { a: layout.a, b: layout.b + by, c: layout.c + by };
    for (const callback of [...resized]) callback();
  }

  const place: ScrollPlace = { offset: 1000, anchorId: "b", anchorTop: 120 };

  it("lands on the anchor, not on the number", () => {
    // The reader left with `b` 120px down the screen; since then something
    // above it has grown by 200, so the number alone would land 200 too far up.
    layout = { a: 200, b: 1320, c: 2200 };
    render(<Pinned place={place} />);
    expect(scroller.scrollTop).toBe(1200);
    expect(topOfAnchor(scroller, "b")).toBe(120);
  });

  it("follows the anchor through what lands after the restore", () => {
    render(<Pinned place={place} />);
    expect(scroller.scrollTop).toBe(1000);
    growAbove(180);
    expect(topOfAnchor(scroller, "b")).toBe(120);
    expect(scroller.scrollTop).toBe(1180);
  });

  it("stops holding the moment the reader moves it themselves", () => {
    render(<Pinned place={place} />);
    scroller.scrollTop = 400;
    fireEvent.scroll(scroller);

    growAbove(180);
    expect(scroller.scrollTop).toBe(400);
  });

  it("records where the reader stopped, anchor and all", async () => {
    const places: ScrollPlace[] = [];
    render(<Pinned place={place} record={(next) => places.push(next)} />);
    scroller.scrollTop = 1240;
    fireEvent.scroll(scroller);
    // `b` runs 1120..1320 in the column, so at 1240 its last 80px are still on
    // screen — it is what the reader is reading, 120px above the top edge.
    await waitFor(() =>
      expect(places.at(-1)).toEqual({ offset: 1240, anchorId: "b", anchorTop: -120 }),
    );
  });

  // The scroller belongs to the shell, not to the surface, so it arrives
  // carrying wherever the last surface left it — and the surface's own links
  // have turned Next's scroll handling off. A first arrival starts at the top
  // because this puts it there.
  it("starts a first arrival at the top, and then leaves it alone", () => {
    scroller.scrollTop = 900;
    render(<Pinned place={null} />);
    expect(scroller.scrollTop).toBe(0);
    growAbove(180);
    expect(scroller.scrollTop).toBe(0);
  });

  // "If S is not scrolled away from the origin of its scrolling area in its
  // block flow direction, then do not select an anchor node for S" (CSS Scroll
  // Anchoring §2.1). A reader at the top is there to see what is at the top.
  it("anchors nothing at the origin, so what lands above can be seen", () => {
    // `b` sits at 1120 with the column unscrolled; holding it would follow the
    // 180 that lands above it and take the top off the screen.
    render(<Pinned place={{ offset: 0, anchorId: "b", anchorTop: 1120 }} />);
    expect(scroller.scrollTop).toBe(0);
    growAbove(180);
    expect(scroller.scrollTop).toBe(0);
  });

  it("stands on the offset alone when the anchor is no longer in the list", () => {
    render(<Pinned place={{ offset: 1000, anchorId: "gone", anchorTop: 120 }} />);
    expect(scroller.scrollTop).toBe(1000);
  });
});

describe("measuring the page", () => {
  it("reads every anchored item from the top of the scrollport", () => {
    const scroller = document.createElement("div");
    scroller.getBoundingClientRect = () => new DOMRect(0, 56, 400, 800);
    for (const [id, top] of Object.entries({ a: -244, b: 156 })) {
      const element = document.createElement("div");
      element.setAttribute("data-scroll-anchor", id);
      element.getBoundingClientRect = () => new DOMRect(0, top, 400, 200);
      scroller.append(element);
    }
    document.body.append(scroller);

    // The port's own top is subtracted: a shell that starts 56px down the
    // window must not read as 56px of scroll.
    expect(measureAnchors(scroller)).toEqual([
      { id: "a", top: -300, bottom: -100 },
      { id: "b", top: 100, bottom: 300 },
    ]);
    expect(topOfAnchor(scroller, "b")).toBe(100);
    expect(topOfAnchor(scroller, "gone")).toBeNull();
    scroller.remove();
  });
});
