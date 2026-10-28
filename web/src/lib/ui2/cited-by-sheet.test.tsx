import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CitingArtifactView, CitingTarget } from "@/lib/api/references-api";
import { byNode } from "@/test/data-node";
import { CitedBySheet } from "./cited-by-sheet";

function post(id: string, title: string, extra: Partial<Extract<CitingTarget, { __typename: "Post" }>> = {}): CitingTarget {
  return {
    __typename: "Post",
    id,
    title: { value: title, status: "NORMAL" },
    content: { value: null, status: "NORMAL" },
    attachments: [],
    author: { id: "u-sol", handle: "sol" },
    removal: null,
    ...extra,
  } as CitingTarget;
}

function comment(id: string, body: string, root: string | null): CitingTarget {
  return {
    __typename: "Comment",
    id,
    content: { value: body, status: "NORMAL" },
    removal: null,
    target: root === null ? null : { __typename: "Post", id: root },
  } as CitingTarget;
}

function row(key: string, target: CitingTarget | null, pDirected: number, pInterest: number): CitingArtifactView {
  return { key, target, pair: { pDirected, pInterest } };
}

/** The board's own rows (`screens/CitedBy.jsx`, `_shared.jsx` `CITING_ARTIFACTS`). */
const ARTIFACTS: readonly CitingArtifactView[] = [
  row("a", post("p-salt", "Where the salt goes in winter"), 0.7, 0.5),
  row("b", comment("c-tide", "Answering the tide-market piece", "p-root"), 0.4, 0.65),
  row("c", post("p-wall", "Three mornings on the wall"), 0.15, 0.9),
];

const NODE = { path: "postDetail.citedBySheet" };

describe("CitedBySheet", () => {
  it("is titled Cited by, and names every citing artifact in the order handed", () => {
    render(<CitedBySheet open onClose={() => {}} artifacts={ARTIFACTS} node={NODE} />);
    expect(screen.getByRole("dialog", { name: "Cited by" })).toBeInTheDocument();
    const rows = screen.getAllByTestId(byNode("postDetail.citedBySheet.row"));
    expect(rows.map((r) => r.querySelector('[data-testid$=".name"]')?.textContent)).toEqual([
      "Where the salt goes in winter",
      "Answering the tide-market piece",
      "Three mornings on the wall",
    ]);
  });

  it("names no kind in words — the leading mark says it (ReferenceRow)", () => {
    render(<CitedBySheet open onClose={() => {}} artifacts={ARTIFACTS} node={NODE} />);
    const first = screen.getAllByTestId(byNode("postDetail.citedBySheet.row"))[0]!;
    expect(first).not.toHaveTextContent("Post");
    expect(first.querySelector('[data-testid="postDetail.citedBySheet.row.mark"]')).toHaveTextContent("T");
  });

  it("carries the pair its author signed, face through the choke point and the digits as the geek reading", () => {
    render(<CitedBySheet open onClose={() => {}} artifacts={ARTIFACTS} node={NODE} />);
    const value = screen.getAllByTestId(byNode("postDetail.citedBySheet.row.value"))[0]!;
    const exact = value.querySelector('[data-testid="postDetail.citedBySheet.row.value.exact"]')!;
    expect(exact).toHaveTextContent("+0.70 / +0.50");
    expect(exact.className).toContain("cg-exact");
    expect(value.querySelector('[data-testid="postDetail.citedBySheet.row.value.face"]')).toHaveTextContent("🤩");
    // The spoken twin is the pair itself: a citation's anchor word is withheld.
    expect(value.querySelector(".sr-only")).toHaveTextContent("+0.70 / +0.50");
  });

  it("sends a citing comment to the thread it answers, and a citing post to itself", () => {
    render(<CitedBySheet open onClose={() => {}} artifacts={ARTIFACTS} node={NODE} />);
    const [salt, tide] = screen.getAllByTestId(byNode("postDetail.citedBySheet.row"));
    expect(salt).toHaveAttribute("href", "/posts/p-salt");
    expect(tide).toHaveAttribute("href", "/posts/p-root");
  });

  it("drops itself as a row is followed, so Back lands on the detail", () => {
    const onClose = vi.fn();
    render(<CitedBySheet open onClose={onClose} artifacts={ARTIFACTS} node={NODE} />);
    fireEvent.click(screen.getAllByTestId(byNode("postDetail.citedBySheet.row"))[0]!);
    expect(onClose).toHaveBeenCalled();
  });

  it("keeps a row it cannot address, without a destination", () => {
    render(
      <CitedBySheet open onClose={() => {}} artifacts={[row("z", comment("c-deep", "A deeper reply", null), 0.2, 0.2)]} />,
    );
    const only = screen.getByTestId("cited-by-sheet-row-1");
    expect(only).toHaveTextContent("A deeper reply");
    expect(only.tagName).not.toBe("A");
  });

  it("keeps a removed citing post's row, its tile emptied and its name the removal's mark", () => {
    render(
      <CitedBySheet
        open
        onClose={() => {}}
        artifacts={[row("r", post("p-gone", "Gone", { removal: { at: "2026-10-01T00:00:00Z", by: "AUTHOR" } } as never), 0.2, 0.2)]}
        node={NODE}
      />,
    );
    const only = screen.getByTestId(byNode("postDetail.citedBySheet.row"));
    expect(only).toHaveTextContent("Removed by its author");
    expect(only.querySelector('[data-testid="postDetail.citedBySheet.row.mark"]')).toBeEmptyDOMElement();
  });

  it("says the empty line rather than nothing — the comment's door is the only way here", () => {
    render(<CitedBySheet open onClose={() => {}} artifacts={[]} />);
    expect(screen.getByTestId("cited-by-sheet-empty")).toHaveTextContent(
      "Nothing cites this yet — yours would be the first.",
    );
  });

  it("says nothing at all while the read is out — never the empty line before the answer", () => {
    render(<CitedBySheet open onClose={() => {}} artifacts={null} />);
    expect(screen.queryByTestId("cited-by-sheet-empty")).toBeNull();
  });

  it("is a sheet of rows: the body carries no gutter of its own, each row its 24px", () => {
    render(<CitedBySheet open onClose={() => {}} artifacts={ARTIFACTS} />);
    expect(screen.getByTestId("cited-by-sheet-body").className).not.toMatch(/\bpx-6\b/);
    expect(screen.getByTestId("cited-by-sheet-row-1").className).toMatch(/\bpx-6\b/);
  });

  it("takes the next tonal rung when it opens over another sheet", () => {
    const { rerender } = render(<CitedBySheet open onClose={() => {}} artifacts={ARTIFACTS} testId="flat" />);
    expect(screen.getByTestId("flat").className).toContain("bg-surface-container-high");
    expect(screen.getByTestId("flat").className).not.toContain("bg-surface-container-highest");

    rerender(<CitedBySheet open onClose={() => {}} artifacts={ARTIFACTS} stacked testId="flat" />);
    expect(screen.getByTestId("flat").className).toContain("bg-surface-container-highest");
  });
});
