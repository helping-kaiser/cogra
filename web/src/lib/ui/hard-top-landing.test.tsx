// Landing at the hard top (`hard-top-landing.ts`): the settle detector the
// stage's re-election hangs on (Feed.md:19/21, ReplyEntry.md:3/5,
// TagPage.md:25/27, ProfilePosts.md:7/9), driven through the events a
// scroller actually fires (`src/test/media-env.ts`). These are the settle
// halves of the stage-law packet's `stage-host.test.tsx` rows; the election
// halves land with the stage host.

import { render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BottomSheet } from "@/lib/ui2/bottom-sheet";
import { pullsAtTop, scrollsTo, settlesScroll, touchEvent } from "@/test/media-env";

import { useHardTopLanding } from "./hard-top-landing";
import { scrollElementOf, useScrollHost } from "./scroll-host";

const scrollers: HTMLElement[] = [];

function scroller(at = 0): HTMLDivElement {
  const element = document.createElement("div");
  element.scrollTop = at;
  document.body.append(element);
  scrollers.push(element);
  return element;
}

afterEach(() => {
  for (const element of scrollers.splice(0)) element.remove();
});

function Listener({
  element,
  onLand,
  enabled,
}: {
  element: HTMLElement | null;
  onLand: () => void;
  enabled?: boolean;
}) {
  useHardTopLanding({ host: element === null ? null : { current: element }, onLand, enabled });
  return null;
}

function listen(element: HTMLElement | null, enabled?: boolean) {
  const onLand = vi.fn();
  const view = render(<Listener element={element} onLand={onLand} enabled={enabled} />);
  return { onLand, ...view };
}

describe("a scroll settling", () => {
  it("lands when the scroll comes to rest at the top", () => {
    const list = scroller(600);
    const { onLand } = listen(list);

    scrollsTo(list, 200);
    scrollsTo(list, 0);
    settlesScroll(list);

    expect(onLand).toHaveBeenCalledOnce();
  });

  it("does not land on a settle one pixel below the top (L08)", () => {
    const list = scroller(600);
    const { onLand } = listen(list);

    scrollsTo(list, 1);
    settlesScroll(list);

    expect(onLand).not.toHaveBeenCalled();
  });

  it("does not land while resting there — only on arriving", () => {
    const list = scroller(0);
    const { onLand } = listen(list);

    settlesScroll(list);
    settlesScroll(list);

    expect(onLand).not.toHaveBeenCalled();
  });

  it("lands again each time the surface comes back to the top", () => {
    const list = scroller(0);
    const { onLand } = listen(list);

    for (let round = 0; round < 2; round += 1) {
      scrollsTo(list, 400);
      settlesScroll(list);
      scrollsTo(list, 0);
      settlesScroll(list);
    }

    expect(onLand).toHaveBeenCalledTimes(2);
  });

  it("does not land for a gesture that moves nothing at the top (GAP-12)", () => {
    const list = scroller(0);
    const { onLand } = listen(list);

    // A wheel tick or Home at the top moves nothing, so the browser fires no
    // scroll and no scrollend — only the input event itself.
    list.dispatchEvent(new Event("wheel"));
    list.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));

    expect(onLand).not.toHaveBeenCalled();
  });
});

describe("the pull at the top", () => {
  it("lands when a pull at the top is let go — an overscroll settling back", () => {
    const list = scroller(0);
    const { onLand } = listen(list);

    pullsAtTop(list, 30);

    expect(onLand).toHaveBeenCalledOnce();
  });

  it("does not land for a touch that never travelled", () => {
    const list = scroller(0);
    const { onLand } = listen(list);

    pullsAtTop(list, 0);

    expect(onLand).not.toHaveBeenCalled();
  });

  it("does not land for a touch that starts below the top", () => {
    const list = scroller(300);
    const { onLand } = listen(list);

    pullsAtTop(list, 80);

    expect(onLand).not.toHaveBeenCalled();
  });

  it("lands once for a rubber band that is both a pull and a settling scroll", () => {
    const list = scroller(0);
    const { onLand } = listen(list);

    pullsAtTop(list, 40);
    scrollsTo(list, -12);
    scrollsTo(list, 0);
    settlesScroll(list);

    expect(onLand).toHaveBeenCalledOnce();
  });

  it("reads the window where there is no scroller", () => {
    const { onLand } = listen(null);

    window.dispatchEvent(touchEvent("touchstart", 100));
    window.dispatchEvent(touchEvent("touchmove", 150));
    window.dispatchEvent(touchEvent("touchend", 150));

    expect(onLand).toHaveBeenCalledOnce();
  });
});

describe("the listener", () => {
  it("calls the latest callback without re-subscribing", () => {
    const list = scroller(0);
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<Listener element={list} onLand={first} />);
    rerender(<Listener element={list} onLand={second} />);

    pullsAtTop(list, 30);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });

  it("hears nothing while disabled", () => {
    const list = scroller(0);
    const { onLand } = listen(list, false);

    pullsAtTop(list, 30);

    expect(onLand).not.toHaveBeenCalled();
  });

  // TEARDOWN HYGIENE (the stage-law packet's §6 row).
  it("removes every listener it added when it unmounts", () => {
    const list = scroller(0);
    const added = vi.spyOn(list, "addEventListener");
    const removed = vi.spyOn(list, "removeEventListener");
    const { unmount } = listen(list);
    const types = added.mock.calls.map(([type]) => type);
    expect(types).toEqual(
      expect.arrayContaining(["scroll", "scrollend", "touchstart", "touchmove", "touchend", "touchcancel"]),
    );

    unmount();

    expect(removed.mock.calls.map(([type]) => type).sort()).toEqual([...types].sort());
  });
});

describe("a sheet is its own scroll surface", () => {
  it("hands what it holds its own body as the scroller", () => {
    const seen: (HTMLElement | null)[] = [];
    function Inside() {
      const host = useScrollHost();
      // Read in an effect, when the ref is attached — the way every consumer
      // of the host reads it.
      useEffect(() => {
        seen.push(scrollElementOf(host));
      }, [host]);
      return null;
    }

    render(
      <BottomSheet open onClose={() => {}} title="Comments" testId="sheet">
        <Inside />
      </BottomSheet>,
    );

    expect(seen).toEqual([screen.getByTestId("sheet-body")]);
  });
});
