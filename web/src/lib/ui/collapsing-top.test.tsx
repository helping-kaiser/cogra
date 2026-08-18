import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CollapsingTop } from "./collapsing-top";

// jsdom has no layout, so the geometry is stubbed: the region is
// 100px tall, the sentinel sits at (its flow position − scrollY), and
// the window is 900px tall — so the reveal gate is 300px of
// accumulated upward scroll.
function stubLayout(sentinelFlowTop: number) {
  Object.defineProperty(window, "innerHeight", { value: 900, configurable: true });
  const region = screen.getByTestId("collapsing-top");
  Object.defineProperty(region, "offsetHeight", { value: 100, configurable: true });
  const sentinel = region.previousElementSibling as HTMLElement;
  sentinel.getBoundingClientRect = () =>
    ({ top: sentinelFlowTop - window.scrollY }) as DOMRect;
}

// The handler coalesces scroll events into animation frames; two
// frames flush the pending one deterministically, so the test can
// assert states that did not change without racing it.
async function scrollTo(y: number) {
  Object.defineProperty(window, "scrollY", { value: y, configurable: true });
  window.dispatchEvent(new Event("scroll"));
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await new Promise((r) => requestAnimationFrame(() => r(null)));
}

function expectShown(shown: boolean) {
  const region = screen.getByTestId("collapsing-top");
  expect(region.className).toContain(shown ? "translate-y-0" : "-translate-y-");
}

describe("CollapsingTop", () => {
  it("hides past half its slot, reveals after a third of a screen or at its slot", async () => {
    render(
      <CollapsingTop>
        <p>header</p>
      </CollapsingTop>,
    );
    stubLayout(0);
    expectShown(true);

    // A slight downward scroll with most of the slot still visible:
    // no hide, no gap.
    await scrollTo(40);
    expectShown(true);

    // Half the slot gone, scrolling down hides it — the reader never
    // waits for the whole slot.
    await scrollTo(60);
    expectShown(false);

    // Near the top the slot returns to view: pin back regardless of
    // the tally — a hidden region over its own slot would be a hole.
    await scrollTo(30);
    expectShown(true);

    // Deep in the page: down hides…
    await scrollTo(600);
    expectShown(false);

    // …and a short correction upward (100px < 300px) summons nothing:
    // the reader can reach the top of a post without the header.
    await scrollTo(500);
    expectShown(false);

    // A downward move resets the tally…
    await scrollTo(520);
    expectShown(false);

    // …so 220px of fresh upward scroll still stays below the gate…
    await scrollTo(300);
    expectShown(false);

    // …until the accumulated run crosses it.
    await scrollTo(80);
    expectShown(true);
  });
});
