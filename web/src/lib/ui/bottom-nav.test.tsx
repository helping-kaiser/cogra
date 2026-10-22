import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ALL_SLOTS, BottomNav, SHIPPED_SLOTS } from "./bottom-nav";

describe("BottomNav", () => {
  // Every canonical board draws five slots. The bar ships the ones whose
  // surfaces exist — a slot arrives WITH its surface — so the target is
  // declared here and the shipped set is what renders.
  it("names the five slots the boards are drawn against", () => {
    expect(ALL_SLOTS).toEqual(["feed", "search", "compose", "wallet", "profile"]);
  });

  it("renders only the slots whose surfaces exist", () => {
    expect(SHIPPED_SLOTS).toEqual(["feed", "compose", "profile"]);
    render(<BottomNav active="feed" signedIn slots={ALL_SLOTS} />);
    expect(screen.getByTestId("nav-feed")).toBeInTheDocument();
    expect(screen.getByTestId("nav-compose")).toBeInTheDocument();
    expect(screen.getByTestId("nav-profile")).toBeInTheDocument();
    // Explore waits for slice 2.7's search backend, the wallet for its screens.
    expect(screen.queryByTestId("nav-search")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nav-wallet")).not.toBeInTheDocument();
  });

  // A label is never shortened to an ellipsis: above 1.3× it wraps and the bar
  // grows (`BottomNav.jsx`, K13.4).
  it("wraps a label rather than ellipsizing it", () => {
    render(<BottomNav active="feed" signedIn />);
    const slot = screen.getByTestId("nav-feed");
    expect(slot.className).not.toContain("truncate");
    expect(slot.className).toContain("whitespace-normal");
    expect(slot.className).toContain("break-words");
  });

  // 64px band, hairline top border, safe-area padding — and the height read as
  // the token, not respelled.
  it("keeps the 64px band and its hairline", () => {
    render(<BottomNav active="feed" signedIn />);
    const bar = screen.getByTestId("bottom-nav");
    expect(bar.className).toContain("min-h-[var(--bottom-bar-height)]");
    expect(bar.className).toContain("border-t");
    expect(bar.className).toContain("border-outline-variant");
    expect(bar.className).toContain("bg-surface-container");
    expect(bar.className).toContain("pb-[env(safe-area-inset-bottom)]");
  });

  // The shell pins the bar by being a viewport-tall column with a scrolling
  // middle; a `fixed` band is laid out against a mobile browser's layout
  // viewport and slides under the fold on a long page. It must never come back.
  it("stays in flow and gives no height to the scroller beside it", () => {
    render(<BottomNav active="feed" signedIn />);
    const bar = screen.getByTestId("bottom-nav");
    expect(bar.className).toContain("flex-none");
    expect(bar.className).not.toContain("fixed");
  });

  // Selection shows in colour and in the filled icon cut — never an indicator
  // pill, and never colour alone: `aria-current` carries it for a reader who
  // sees none of it.
  it("marks the active slot in colour and in the record", () => {
    const { rerender } = render(<BottomNav active="profile" signedIn />);
    expect(screen.getByTestId("nav-profile")).toHaveAttribute("aria-current", "page");
    expect(screen.getByTestId("nav-profile").className).toContain("text-on-surface");
    expect(screen.getByTestId("nav-feed")).not.toHaveAttribute("aria-current");
    expect(screen.getByTestId("nav-feed").className).toContain("text-on-surface-variant");

    rerender(<BottomNav active={null} signedIn />);
    expect(screen.getByTestId("nav-profile")).not.toHaveAttribute("aria-current");
  });

  it("wears the state layer and the focus ring on every slot", () => {
    render(<BottomNav active="feed" signedIn />);
    for (const slot of SHIPPED_SLOTS) {
      const item = screen.getByTestId(`nav-${slot}`);
      expect(item.className, slot).toContain("cg-state");
      expect(item.className, slot).toContain("cg-focus");
    }
  });

  // Ask, never bounce: the feed reads without an account, and the two slots
  // that need one prompt instead of navigating.
  it("asks the anonymous reader rather than yanking the read away", () => {
    render(<BottomNav active="feed" signedIn={false} />);
    expect(screen.getByTestId("nav-feed")).toHaveAttribute("href", "/feed");
    expect(screen.getByTestId("nav-compose")).not.toHaveAttribute("href");
    expect(screen.getByTestId("nav-profile")).not.toHaveAttribute("href");
  });

  it("gives the compose action a name, since it is a glyph", () => {
    render(<BottomNav active="feed" signedIn />);
    expect(screen.getByTestId("nav-compose")).toHaveAttribute("aria-label", "New post");
  });

  // Feed.md:81-91 — over the feed's own root the Feed slot is a re-tap the
  // feed answers, not a navigation to where the reader already is.
  it("the_feed_slot_over_the_feeds_root_is_a_re_tap_the_feed_answers", () => {
    const onReselectFeed = vi.fn();
    render(<BottomNav active="feed" signedIn onReselectFeed={onReselectFeed} />);
    const tap = new MouseEvent("click", { bubbles: true, cancelable: true });
    fireEvent(screen.getByTestId("nav-feed"), tap);
    expect(onReselectFeed).toHaveBeenCalledTimes(1);
    expect(tap.defaultPrevented).toBe(true);
  });

  // Feed.md:85 — from anywhere else the slot stays the way to the feed.
  it("the_feed_slot_elsewhere_is_the_plain_way_to_the_feed", () => {
    render(<BottomNav active={null} signedIn />);
    expect(screen.getByTestId("nav-feed")).toHaveAttribute("href", "/feed");
  });
});
