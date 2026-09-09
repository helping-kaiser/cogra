import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TopicsLine, countsText } from "./topics-line";

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

  it("keeps the line to one row, capped, never wrapping", () => {
    render(<TopicsLine topics={[topic("rust")]} references={0} testIdPrefix="post" />);
    expect(screen.getByTestId("post-topics").className).toContain("flex-nowrap");
    expect(screen.getByTestId("post-topics").className).toContain("overflow-hidden");
    expect(screen.getByTestId("post-topic-rust").className).toContain("max-w-24");
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
