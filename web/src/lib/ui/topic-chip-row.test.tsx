import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TopicChipRow, type TopicChipEntry } from "./topic-chip-row";

function entry(name: string, relevance = 0.4, confidence = 0.9): TopicChipEntry {
  return { name, pending: false, relevance, confidence };
}

describe("TopicChipRow", () => {
  it("renders nothing without topics", () => {
    const { container } = render(<TopicChipRow topics={[]} testIdPrefix="post" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("chips navigate to their topic route", () => {
    render(<TopicChipRow topics={[entry("rust")]} testIdPrefix="post" />);
    expect(screen.getByTestId("post-topic-rust-link")).toHaveAttribute("href", "/topics/rust");
  });

  // F8: the reveal belongs to detail surfaces. A card gets no toggle at
  // all, and no values with it.
  it("offers no reveal unless asked for one", () => {
    render(<TopicChipRow topics={[entry("rust")]} testIdPrefix="feed-post-p1" />);
    expect(screen.queryByTestId("feed-post-p1-topics-reveal")).not.toBeInTheDocument();
    expect(screen.queryByTestId("feed-post-p1-topic-rust-values")).not.toBeInTheDocument();
  });

  it("keeps the values off screen until a reader asks", () => {
    render(<TopicChipRow topics={[entry("rust")]} testIdPrefix="post" revealable />);
    const toggle = screen.getByTestId("post-topics-reveal");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("post-topic-rust-values")).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("post-topic-rust-values")).toHaveTextContent("+0.40 · 0.90");
  });

  it("reveals every chip on the row from the one control", () => {
    render(
      <TopicChipRow
        topics={[entry("rust", 0.4, 0.9), entry("wasm", -0.25, 0.5)]}
        testIdPrefix="post"
        revealable
      />,
    );
    fireEvent.click(screen.getByTestId("post-topics-reveal"));
    expect(screen.getByTestId("post-topic-rust-values")).toHaveTextContent("+0.40 · 0.90");
    // Relevance is bipolar, so the sign rides along.
    expect(screen.getByTestId("post-topic-wasm-values")).toHaveTextContent("-0.25 · 0.50");
  });

  it("hides them again on a second press", () => {
    render(<TopicChipRow topics={[entry("rust")]} testIdPrefix="post" revealable />);
    fireEvent.click(screen.getByTestId("post-topics-reveal"));
    fireEvent.click(screen.getByTestId("post-topics-reveal"));
    expect(screen.queryByTestId("post-topic-rust-values")).not.toBeInTheDocument();
    expect(screen.getByTestId("post-topics-reveal")).toHaveAttribute("aria-expanded", "false");
  });

  // The compact pair is a glance; a screen reader gets the axes named.
  it("names the axes for a screen reader when revealed", () => {
    render(<TopicChipRow topics={[entry("rust")]} testIdPrefix="post" revealable />);
    fireEvent.click(screen.getByTestId("post-topics-reveal"));
    expect(screen.getByTestId("post-topic-rust-values")).toHaveTextContent(
      "relevance +0.40, confidence 0.90",
    );
  });

  it("points the toggle at the list it expands", () => {
    render(<TopicChipRow topics={[entry("rust")]} testIdPrefix="post" revealable />);
    const controls = screen.getByTestId("post-topics-reveal").getAttribute("aria-controls");
    expect(controls).not.toBeNull();
    expect(screen.getByTestId("post-topics")).toHaveAttribute("id", controls as string);
  });

  it("keeps the chip navigating while the values show", () => {
    render(<TopicChipRow topics={[entry("rust")]} testIdPrefix="post" revealable />);
    fireEvent.click(screen.getByTestId("post-topics-reveal"));
    expect(screen.getByTestId("post-topic-rust-link")).toHaveAttribute("href", "/topics/rust");
  });
});
