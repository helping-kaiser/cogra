import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CitedBySheet } from "./cited-by-sheet";
import type { CitingRecordView } from "@/lib/api/references-api";

function citingPost(id: string, title: string, pDirected: number, pInterest: number): CitingRecordView {
  return {
    id,
    pDirected,
    pInterest,
    target: { __typename: "Post", id: `p-${id}`, title: { value: title } },
  };
}

function citingComment(
  id: string,
  body: string,
  root: { __typename: "Post"; id: string } | null,
): CitingRecordView {
  return {
    id,
    pDirected: 0.4,
    pInterest: 0.65,
    target: {
      __typename: "Comment",
      id: `c-${id}`,
      content: { value: body },
      target: root,
    },
  };
}

/** The board's own rows (`screens/CitedBy.jsx`, `_shared.jsx:2285`). */
const RECORDS: readonly CitingRecordView[] = [
  citingPost("r1", "Where the salt goes in winter", 0.7, 0.5),
  citingComment("r2", "Answering the tide-market piece", { __typename: "Post", id: "p-root" }),
  citingPost("r3", "Three mornings on the wall", 0.15, 0.9),
];

describe("CitedBySheet", () => {
  it("names every citing artifact, in the order it was handed", () => {
    render(<CitedBySheet open onClose={() => {}} records={RECORDS} />);
    const rows = screen.getAllByTestId(/^cited-by-sheet-record-r\d$/);
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Where the salt goes in winter"),
      expect.stringContaining("Answering the tide-market piece"),
      expect.stringContaining("Three mornings on the wall"),
    ]);
  });

  it("carries the pair its author signed, both axes", () => {
    render(<CitedBySheet open onClose={() => {}} records={RECORDS} />);
    // The digits are the geek reading; the spoken twin is what a reader on a
    // screen reader gets, and it never depends on that mode.
    expect(screen.getByTestId("cited-by-sheet-record-r1-pair")).toHaveTextContent("+0.70");
    expect(screen.getByTestId("cited-by-sheet-record-r1-pair")).toHaveTextContent("+0.50");
  });

  it("sends a citing comment to the thread it answers, and a citing post to itself", () => {
    render(<CitedBySheet open onClose={() => {}} records={RECORDS} />);
    expect(screen.getByTestId("cited-by-sheet-record-r1").querySelector("a")).toHaveAttribute(
      "href",
      "/posts/p-r1",
    );
    expect(screen.getByTestId("cited-by-sheet-record-r2").querySelector("a")).toHaveAttribute(
      "href",
      "/posts/p-root",
    );
  });

  it("keeps a row it cannot address, without a destination", () => {
    render(
      <CitedBySheet open onClose={() => {}} records={[citingComment("r9", "A deeper reply", null)]} />,
    );
    const row = screen.getByTestId("cited-by-sheet-record-r9");
    expect(row).toHaveTextContent("A deeper reply");
    expect(row.querySelector("a")).toBeNull();
  });

  it("says the empty line rather than nothing — the comment's door is the only way here", () => {
    render(<CitedBySheet open onClose={() => {}} records={[]} />);
    expect(screen.getByTestId("cited-by-sheet-empty")).toHaveTextContent(
      "Nothing cites this yet — yours would be the first.",
    );
  });

  it("offers the next page only while there is one", () => {
    const onLoadMore = vi.fn();
    const { rerender } = render(
      <CitedBySheet open onClose={() => {}} records={RECORDS} hasMore onLoadMore={onLoadMore} />,
    );
    fireEvent.click(screen.getByTestId("cited-by-sheet-more"));
    expect(onLoadMore).toHaveBeenCalledOnce();

    rerender(<CitedBySheet open onClose={() => {}} records={RECORDS} />);
    expect(screen.queryByTestId("cited-by-sheet-more")).toBeNull();
  });

  it("takes the next tonal rung when it opens over another sheet", () => {
    const { rerender } = render(
      <CitedBySheet open onClose={() => {}} records={RECORDS} testId="flat" />,
    );
    expect(screen.getByTestId("flat").className).toContain("bg-surface-container-high");
    expect(screen.getByTestId("flat").className).not.toContain("bg-surface-container-highest");

    rerender(<CitedBySheet open onClose={() => {}} records={RECORDS} stacked testId="flat" />);
    expect(screen.getByTestId("flat").className).toContain("bg-surface-container-highest");
  });
});
