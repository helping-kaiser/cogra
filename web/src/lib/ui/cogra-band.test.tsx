import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CograBand } from "./cogra-band";

describe("CograBand", () => {
  // A tab root wears the mark, not a page title — the band's left half is
  // identity and its right half works.
  it("draws the mark and the wordmark on a 48px band", () => {
    const { container } = render(<CograBand />);
    const band = screen.getByTestId("cogra-band").firstElementChild as HTMLElement;
    expect(band.className).toContain("h-12");
    expect(band.className).toContain("px-4");
    expect(container.querySelector("svg")).not.toBeNull();
    expect(screen.getByText("cogra")).toBeInTheDocument();
  });

  it("carries the screen's own trailing control on the right edge", () => {
    render(<CograBand trailing={<button type="button">Newest</button>} />);
    expect(screen.getByRole("button", { name: "Newest" })).toBeInTheDocument();
  });

  it("rides its children below the band in the same block", () => {
    render(
      <CograBand>
        <p>a notice</p>
      </CograBand>,
    );
    expect(screen.getByText("a notice")).toBeInTheDocument();
  });

  // A tab that passes no `onChats` draws no control to nowhere — but it is
  // the band's affordance the moment it leads somewhere, and it is named,
  // since it is a glyph.
  it("draws the chats affordance only where it leads somewhere", () => {
    const { rerender } = render(<CograBand />);
    expect(screen.queryByTestId("band-chats")).not.toBeInTheDocument();

    const onChats = vi.fn();
    rerender(<CograBand onChats={onChats} />);
    const chats = screen.getByTestId("band-chats");
    expect(chats).toHaveAttribute("aria-label", "Chats");
    expect(chats.className).toContain("size-12");
    fireEvent.click(chats);
    expect(onChats).toHaveBeenCalledOnce();
  });

  // The cluster reads the screen's own control, then chats, then the bell
  // (Profile.md:3; ChatsComingSoon.md:3): the bell keeps the corner.
  it("reads the screen's control, then chats, then the bell", () => {
    render(
      <CograBand
        onChats={() => {}}
        trailing={<button type="button">Newest</button>}
        bell={{ lit: false, onOpen: () => {} }}
      />,
    );
    const trailing = screen.getByRole("button", { name: "Newest" });
    const chats = screen.getByTestId("band-chats");
    const bell = screen.getByTestId("band-bell");
    expect(trailing.compareDocumentPosition(chats) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(chats.compareDocumentPosition(bell) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // FeedUnread.md:11, :13, :15 — a dot, never a count, and the name says so.
  it("the_bell_is_a_dot_never_a_count_and_says_so", () => {
    const onOpen = vi.fn();
    const { rerender } = render(<CograBand bell={{ lit: false, onOpen }} node={{ path: "feed.band" }} />);
    const bell = screen.getByRole("button", { name: "Notifications" });
    expect(screen.queryByTestId("feed.band.bell.dot")).not.toBeInTheDocument();
    rerender(<CograBand bell={{ lit: true, onOpen }} node={{ path: "feed.band" }} />);
    expect(screen.getByRole("button", { name: "Notifications — something new" })).toBe(bell);
    const dot = screen.getByTestId("feed.band.bell.dot");
    expect(dot).toHaveAttribute("aria-hidden");
    expect(dot).toBeEmptyDOMElement();
    expect(bell.textContent).not.toMatch(/\d/);
    fireEvent.click(bell);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  // Main.md:9, FeedBare.md:9 — a guest has no list, so no bell.
  it("a_guest_band_has_no_bell", () => {
    render(<CograBand onChats={() => {}} />);
    expect(screen.queryByTestId("band-bell")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Notifications/ })).not.toBeInTheDocument();
  });
});
