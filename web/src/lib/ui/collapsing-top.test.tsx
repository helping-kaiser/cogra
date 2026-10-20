import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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

  // A caller restoring a scrolled place (`feed-view.tsx`) knows the landing
  // offset synchronously, before this ever mounts — so it must be able to
  // start hidden on the very first render, with no scroll event needed to
  // get there. Asserted with no `scrollTo`/`await`: a real fix has this true
  // from the first synchronous check, matching the restore's own pre-paint
  // landing (`scroll-pin.ts`).
  it("starts hidden when the caller already knows the reader lands scrolled", () => {
    render(
      <CollapsingTop initiallyHidden>
        <p>header</p>
      </CollapsingTop>,
    );
    expectShown(false);
  });

  it("starts shown by default, and when the caller says the landing is the top", () => {
    render(
      <CollapsingTop initiallyHidden={false}>
        <p>header</p>
      </CollapsingTop>,
    );
    expectShown(true);
  });

  // The travel is only honest about reduced motion if the duration is the
  // token: `tokens-2.css` zeroes `--duration-collapsing-top` under
  // `prefers-reduced-motion`, and a literal `duration-200` cannot be zeroed.
  it("takes its duration from the token, so stillness can be asked for", () => {
    render(
      <CollapsingTop>
        <p>header</p>
      </CollapsingTop>,
    );
    const region = screen.getByTestId("collapsing-top");
    expect(region.className).toContain("duration-[var(--duration-collapsing-top)]");
    expect(region.className).not.toMatch(/duration-\d/);
  });
});

// THE BACK TO TOP PILL (FeedScrolled.md:3-15). The window is 900px tall, so
// three viewport-heights is 2700px, and the band returns after 300px of
// upward run.
describe("CollapsingTop's Back to top pill", () => {
  function renderWithPill(onBackToTop = vi.fn()) {
    render(
      <CollapsingTop onBackToTop={onBackToTop}>
        <p>header</p>
      </CollapsingTop>,
    );
    stubLayout(0);
    return onBackToTop;
  }

  function pill() {
    return screen.getByTestId("back-to-top");
  }

  // FeedScrolled.md:3
  it("the_back_to_top_pill_rides_in_with_the_band_three_screens_deep", async () => {
    renderWithPill();
    await scrollTo(3500);
    expectShown(false);
    expect(pill()).toHaveAttribute("data-shown", "false");
    await scrollTo(3100);
    expectShown(true);
    expect(pill()).toHaveAttribute("data-shown", "true");
    expect(pill()).not.toHaveAttribute("inert");
    expect(screen.getByTestId("back-to-top-pill")).toHaveTextContent("Back to top");
  });

  // FeedScrolled.md:5
  it("never_the_pill_appears_shallower_than_three_viewport_heights", async () => {
    renderWithPill();
    await scrollTo(2000);
    await scrollTo(1600);
    expectShown(true);
    expect(pill()).toHaveAttribute("data-shown", "false");
    expect(pill()).toHaveAttribute("inert");
  });

  // FeedScrolled.md:7
  it("the_pill_leaves_under_the_band_and_never_passes_over_it", async () => {
    renderWithPill();
    await scrollTo(3500);
    await scrollTo(3100);
    expect(pill()).toHaveAttribute("data-shown", "true");
    await scrollTo(3300);
    expectShown(false);
    expect(pill()).toHaveAttribute("data-shown", "false");
    // One rung under the band, on the band's own duration.
    expect(pill().className).toContain("z-[19]");
    expect(screen.getByTestId("collapsing-top").className).toContain("z-20");
    expect(pill().className).toContain("duration-[var(--duration-collapsing-top)]");
  });

  // FeedScrolled.md:9
  it("the_pill_takes_no_layout_space_and_leaves_the_collapse_point_alone", () => {
    renderWithPill();
    expect(pill().className).toContain("fixed");
    expect(screen.getByTestId("collapsing-top")).not.toContainElement(pill());
  });

  // FeedScrolled.md:11 — what the tap does is the host's; the pill hands it on.
  it("tapping_the_pill_hands_the_way_up_to_its_host", async () => {
    const onBackToTop = renderWithPill();
    await scrollTo(3500);
    await scrollTo(3100);
    fireEvent.click(screen.getByTestId("back-to-top-pill"));
    expect(onBackToTop).toHaveBeenCalledTimes(1);
  });

  // FeedScrolled.md:15 — the band stands at the hard top, and the pill, with
  // nothing left to go up to, leaves.
  it("at_the_hard_top_the_band_stands_and_the_pill_is_gone", async () => {
    renderWithPill();
    await scrollTo(3500);
    await scrollTo(3100);
    await scrollTo(0);
    expectShown(true);
    expect(pill()).toHaveAttribute("data-shown", "false");
  });

  it("draws no pill on a surface that has none", () => {
    render(
      <CollapsingTop>
        <p>header</p>
      </CollapsingTop>,
    );
    expect(screen.queryByTestId("back-to-top")).not.toBeInTheDocument();
  });
});
