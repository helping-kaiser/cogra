import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TopicsLine, chipsThatFit, countsText } from "./topics-line";

const topic = (name: string) => ({ name, pending: false });

describe("countsText", () => {
  it("says nothing where nothing is left over", () => {
    expect(countsText(0, 0)).toBeNull();
  });

  it("states hidden topics and references in words, singular and plural", () => {
    expect(countsText(1, 0)).toBe("· 1 topic");
    expect(countsText(23, 3)).toBe("· 23 topics · 3 references");
    expect(countsText(0, 1)).toBe("· 1 reference");
  });
});

describe("chipsThatFit", () => {
  // 120px of line, two 50px chips, and counts that grow as chips are dropped.
  const chips = [50, 50];
  const counts = [70, 45, 0];

  it("shows every chip that fits beside the counts it leaves", () => {
    // Two chips: 50 + 50 + 0 counts + one 8px gap = 108.
    expect(chipsThatFit(120, chips, counts)).toBe(2);
  });

  it("drops the chip that would be cut and lets the counts state it", () => {
    // Two would need 108; one needs 50 + 45 + 8 = 103.
    expect(chipsThatFit(105, chips, counts)).toBe(1);
  });

  it("falls back to the counts alone where no chip fits whole", () => {
    expect(chipsThatFit(80, chips, counts)).toBe(0);
  });

  // A line laid out at zero width has not been measured; it has not said no.
  it("keeps every chip while the line has no width to measure against", () => {
    expect(chipsThatFit(0, chips, counts)).toBe(2);
  });
});

describe("TopicsLine", () => {
  it("draws nothing on a node carrying neither", () => {
    const { container } = render(
      <TopicsLine topics={[]} references={0} testIdPrefix="feed-post-p1" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows two chips whole and counts the rest", () => {
    render(
      <TopicsLine
        topics={[topic("rust"), topic("wasm"), topic("axum"), topic("sqlx")]}
        references={3}
        testIdPrefix="post"
      />,
    );
    expect(screen.getByTestId("post-topic-rust")).toBeInTheDocument();
    expect(screen.getByTestId("post-topic-wasm")).toBeInTheDocument();
    expect(screen.queryByTestId("post-topic-axum")).not.toBeInTheDocument();
    expect(screen.getByTestId("post-topics-counts")).toHaveTextContent(
      "· 2 topics · 3 references",
    );
  });

  // A card never lists its references inline: the count is the whole showing.
  it("states references as a count and never as chips", () => {
    render(<TopicsLine topics={[]} references={2} testIdPrefix="post" />);
    expect(screen.getByTestId("post-topics-counts")).toHaveTextContent("· 2 references");
    expect(screen.queryByTestId("post-references")).not.toBeInTheDocument();
  });

  it("keeps the line to one row, never wrapping", () => {
    render(<TopicsLine topics={[topic("rust")]} references={0} testIdPrefix="post" />);
    expect(screen.getByTestId("post-topics").className).toContain("flex-nowrap");
    expect(screen.getByTestId("post-topics").className).toContain("overflow-hidden");
  });

  // Jakob's ruling, 2026-09-09: a chip is drawn whole or not at all. The
  // master's 96px ellipsis cap is the thing being corrected, so no chip may
  // carry a width ceiling or an overflow rule that could cut its label.
  it("never gives a chip a width ceiling to be cut against", () => {
    render(<TopicsLine topics={[topic("rust")]} references={0} testIdPrefix="post" />);
    const chip = screen.getByTestId("post-topic-rust").className;
    expect(chip).not.toContain("max-w-");
    expect(chip).not.toContain("text-ellipsis");
    expect(chip).not.toContain("overflow-hidden");
  });

  // The `…` the pending marker used to append is indistinguishable from a
  // truncated label, which is exactly what the ruling forbids.
  it("ends a pending topic's chip in its own name, never an ellipsis", () => {
    render(
      <TopicsLine topics={[{ name: "rust", pending: true }]} references={0} testIdPrefix="post" />,
    );
    expect(screen.getByTestId("post-topic-rust")).toHaveTextContent(/^#rust$/);
    expect(screen.queryByTestId("post-topic-rust-pending")).not.toBeInTheDocument();
  });

  it("lets a summary card's chips navigate to their topics", () => {
    render(<TopicsLine topics={[topic("rust")]} references={0} testIdPrefix="feed-post-p1" />);
    expect(screen.getByTestId("feed-post-p1-topic-rust-link")).toHaveAttribute(
      "href",
      "/topics/rust",
    );
  });

  it("makes the counts the sheet's opener where a card has one", () => {
    const onOpenReferences = vi.fn();
    render(
      <TopicsLine
        topics={[topic("rust")]}
        references={1}
        testIdPrefix="post"
        onOpenReferences={onOpenReferences}
      />,
    );
    fireEvent.click(screen.getByTestId("post-topics-counts"));
    expect(onOpenReferences).toHaveBeenCalledTimes(1);
  });

  // Two tap models, never mixed.
  it("makes the whole line one control on a detail surface, the chips inert", () => {
    const onOpen = vi.fn();
    render(
      <TopicsLine topics={[topic("rust")]} references={1} testIdPrefix="post" onOpen={onOpen} />,
    );
    const line = screen.getByLabelText("Topics and references");
    expect(line.tagName).toBe("BUTTON");
    expect(screen.queryByTestId("post-topic-rust-link")).not.toBeInTheDocument();
    fireEvent.click(line);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
