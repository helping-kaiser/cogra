import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CollapsingTop } from "./collapsing-top";

// jsdom has no layout, so the sentinel position and region height are
// stubbed: the region is 100px tall, and the sentinel sits at
// (its flow position − scrollY).
function stubLayout(sentinelFlowTop: number) {
  const region = screen.getByTestId("collapsing-top");
  Object.defineProperty(region, "offsetHeight", { value: 100, configurable: true });
  const sentinel = region.previousElementSibling as HTMLElement;
  sentinel.getBoundingClientRect = () =>
    ({ top: sentinelFlowTop - window.scrollY }) as DOMRect;
}

function scrollTo(y: number) {
  Object.defineProperty(window, "scrollY", { value: y, configurable: true });
  window.dispatchEvent(new Event("scroll"));
}

describe("CollapsingTop", () => {
  it("stays put near the top, hides past itself, reveals on scroll up", async () => {
    render(
      <CollapsingTop>
        <p>header</p>
      </CollapsingTop>,
    );
    const region = screen.getByTestId("collapsing-top");
    stubLayout(0);
    expect(region.className).toContain("translate-y-0");

    // A slight downward scroll with most of the slot still visible:
    // no hide, no gap.
    scrollTo(40);
    await waitFor(() => expect(region.className).toContain("translate-y-0"));

    // Half the slot gone, scrolling down hides it — the reader never
    // waits for the whole slot.
    scrollTo(60);
    await waitFor(() => expect(region.className).toContain("-translate-y-"));

    // Any upward scroll brings it back.
    scrollTo(45);
    await waitFor(() => expect(region.className).toContain("translate-y-0"));

    // Deep in the page the same pair holds: down hides, up reveals.
    // Each step expects a state change, so the waits stay honest —
    // asserting an already-true state would race the coalescing rAF.
    scrollTo(400);
    await waitFor(() => expect(region.className).toContain("-translate-y-"));
    scrollTo(320);
    await waitFor(() => expect(region.className).toContain("translate-y-0"));
  });
});
