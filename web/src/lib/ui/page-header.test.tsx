import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageHeader } from "./page-header";

describe("PageHeader", () => {
  it("renders the back link with its accessible name and target", () => {
    render(
      <PageHeader title="Feed" backHref="/" backLabel="Back to home" backTestId="feed-back" />,
    );
    const back = screen.getByRole("link", { name: "Back to home" });
    expect(back).toHaveAttribute("href", "/");
    expect(back).toBe(screen.getByTestId("feed-back"));
    expect(screen.getByRole("heading", { name: "Feed" })).toBeInTheDocument();
  });

  it("renders without a title and with a trailing action", () => {
    render(
      <PageHeader
        backHref="/feed"
        backLabel="Back to feed"
        backTestId="post-back"
        action={<button type="button">Edit</button>}
      />,
    );
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  // The band is the header's own, not the caller's: 48px tall with 12px of side
  // padding and a 48px SQUARE target. The negative-margin target it replaced was
  // under the minimum and bled off any surface with no gutter of its own.
  it("owns a 48px band and a 48px square back target", () => {
    render(<PageHeader title="Settings" backHref="/" backLabel="Back" backTestId="back" />);
    const band = screen.getByRole("banner");
    expect(band.className).toContain("min-h-12");
    expect(band.className).toContain("px-3");
    const back = screen.getByTestId("back");
    expect(back.className).toContain("size-12");
    expect(back.className).not.toContain("-m-");
    expect(back.className).toContain("cg-state");
    expect(back.className).toContain("cg-focus");
  });

  // The arrow is Material's `arrow_back`, not the interim `←` character.
  it("draws the arrow as the glyph", () => {
    const { container } = render(<PageHeader backHref="/" backLabel="Back" />);
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.textContent).not.toContain("←");
  });

  // Page titles are `title-large` — every board's band title, and M3's
  // top-app-bar spec (readme §13, the audit answers).
  it("sets the title at title-large", () => {
    render(<PageHeader title="Settings" />);
    expect(screen.getByRole("heading", { name: "Settings" }).className).toContain(
      "text-title-large",
    );
  });

  // NamesLong.md:5, :7 and :9 at the longest legal handle (NamesLong.jsx).
  describe("a long handle in the title", () => {
    const H = "@maximiliana_featherstone_haugh";

    it("clips a title the handle ends at its end, on one line", () => {
      render(<PageHeader title={H} backHref="/feed" backLabel="Back to feed" />);
      const title = screen.getByRole("heading", { name: H });
      expect(title.className.split(" ")).toEqual(
        expect.arrayContaining(["min-w-0", "truncate", "whitespace-nowrap"]),
      );
      expect(title.querySelector("[data-name-line]")).toBeNull();
    });

    it("cuts the handle and keeps the words that follow it", () => {
      render(<PageHeader title={`${H} · Opinions`} backHref="/feed" backLabel="Back to feed" />);
      // By role alone: dom-accessibility-api trims each part's text, so jsdom
      // would read `…haugh· Opinions`; the text itself is whole.
      const heading = screen.getByRole("heading");
      expect(heading).toHaveTextContent(`${H} · Opinions`);
      const line = heading.querySelector("[data-name-line]");
      expect(line?.lastElementChild?.textContent).toBe(" · Opinions");
      expect(line?.lastElementChild?.className).toContain("flex-none");
    });
  });
});
