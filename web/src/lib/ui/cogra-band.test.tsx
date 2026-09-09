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

  // The chat surface is an undesigned gap on the canvas, so the band draws no
  // control to nowhere — but it is the band's affordance the moment it leads
  // somewhere, and it is named, since it is a glyph.
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

  // Left of the screen's own trailing control, so the ruled corner occupants
  // keep their edge.
  it("puts chats left of the trailing control", () => {
    render(<CograBand onChats={() => {}} trailing={<button type="button">Newest</button>} />);
    const chats = screen.getByTestId("band-chats");
    const trailing = screen.getByRole("button", { name: "Newest" });
    expect(chats.compareDocumentPosition(trailing) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
