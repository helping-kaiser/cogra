import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RemovedPlaceholder } from "./removed-placeholder";

describe("RemovedPlaceholder", () => {
  it("says an author's own removal in the author's terms", () => {
    render(<RemovedPlaceholder reason="author" />);
    expect(screen.getByText("Removed by its author")).toBeInTheDocument();
    expect(
      screen.getByText("The post's place in the thread, and every response, remain."),
    ).toBeInTheDocument();
  });

  it("says a platform removal as the public verdict it is", () => {
    render(<RemovedPlaceholder reason="platform" />);
    expect(screen.getByText("Removed under the platform's rules")).toBeInTheDocument();
    expect(screen.getByText("A passed proposal removed it. The decision is public.")).toBeInTheDocument();
  });

  it("never lets the two wordings read alike", () => {
    const { container: author } = render(<RemovedPlaceholder reason="author" />);
    const authorText = author.textContent;
    const { container: platform } = render(<RemovedPlaceholder reason="platform" />);
    expect(platform.textContent).not.toBe(authorText);
    // The distinction is the requirement, so it is asserted on the words
    // themselves rather than on a class or a colour.
    expect(authorText).toContain("author");
    expect(platform.textContent).toContain("platform's rules");
  });

  it("shows the timestamp when it is given, and nothing when it is not", () => {
    const { rerender } = render(<RemovedPlaceholder reason="author" when="12 March" />);
    expect(screen.getByText("12 March")).toBeInTheDocument();
    rerender(<RemovedPlaceholder reason="author" />);
    expect(screen.queryByText("12 March")).toBeNull();
  });

  it("lets a caller replace the detail line without touching the mark itself", () => {
    render(<RemovedPlaceholder reason="author" note="Withdrawn while the thread was settling." />);
    expect(screen.getByText("Removed by its author")).toBeInTheDocument();
    expect(screen.getByText("Withdrawn while the thread was settling.")).toBeInTheDocument();
  });

  it("keeps the space rather than leaving a gap, and takes no failure colouring", () => {
    render(<RemovedPlaceholder reason="platform" testId="removed" />);
    const mark = screen.getByTestId("removed");
    expect(mark.className).toContain("bg-surface-container-high");
    expect(mark.className).not.toContain("error");
  });
});
