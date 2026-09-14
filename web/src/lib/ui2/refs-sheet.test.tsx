import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RefsSheet, type TopicClaimNode } from "./refs-sheet";
import type { ReferenceClaimNode } from "@/lib/references/claims";

function topic(
  name: string,
  relevance: number,
  confidence: number,
  pending = false,
): TopicClaimNode {
  return { hashtag: { name: { value: name } }, relevance, confidence, pending };
}

function reference(
  targetId: string,
  relevance: number,
  support: number,
  target: ReferenceClaimNode["target"],
  pending = false,
): ReferenceClaimNode {
  return { targetId, relevance, support, withdrawalCost: 1, pending, target };
}

/** The board's own two tag rows (`RefsSheet.jsx:44-45`). */
const TAGS = [topic("photography", 0.4, 0.9), topic("coastroad", 0.1, 1, true)];

/** The three reference kinds the contract's union can type today. */
const REFERENCES = [
  reference("l1-mira", 0.1, 0.1, {
    __typename: "User",
    id: "u1",
    handle: "mira",
    displayName: { value: "Mira Voss" },
  }),
  reference("l1-salt", 0.55, 0.2, {
    __typename: "Post",
    id: "p1",
    title: { value: "Salt maps of the coast road" },
    author: { handle: "sol" },
  }),
  reference(
    "l1-bend",
    0.1,
    0.1,
    {
      __typename: "Comment",
      id: "c1",
      content: { value: "That stretch after the second bend…" },
      author: { handle: "ada" },
      target: { __typename: "Post", id: "p1" },
    },
    true,
  ),
];

function open(props: Partial<Parameters<typeof RefsSheet>[0]> = {}) {
  return render(
    <RefsSheet
      open
      onClose={vi.fn()}
      topics={TAGS}
      references={REFERENCES}
      {...props}
    />,
  );
}

describe("RefsSheet", () => {
  it("is the sheet the board titles, with both groups named", () => {
    open();
    expect(screen.getByTestId("refs-sheet")).toHaveAttribute(
      "aria-label",
      "Tags & references",
    );
    expect(screen.getByText("Tags")).toBeInTheDocument();
    expect(screen.getByText("References")).toBeInTheDocument();
  });

  it("writes a tag's pair unsigned on its second axis", () => {
    open();
    // Confidence is census-bounded to [0, 1], so a `+` on it would advertise
    // a pole that does not exist (`StanceReadout.jsx:329-340`).
    expect(screen.getByTestId("refs-sheet-topic-photography-pair")).toHaveTextContent(
      "🔗+0.40 / 0.90",
    );
  });

  it("writes a citation's pair signed on both axes", () => {
    open();
    // The two shapes differ so a reader can tell the families apart at a glance.
    expect(screen.getByTestId("refs-sheet-reference-l1-salt-pair")).toHaveTextContent(
      "😊+0.55 / +0.20",
    );
    expect(screen.getByTestId("refs-sheet-reference-l1-mira-pair")).toHaveTextContent(
      "🙂+0.10 / +0.10",
    );
  });

  it("speaks every hidden number, since a glyph cannot", () => {
    open();
    expect(
      screen.getByText("definitely linked, relevance +0.40, confidence 0.90"),
    ).toBeInTheDocument();
    expect(screen.getByText("relevance +0.55, support +0.20")).toBeInTheDocument();
  });

  it("marks a settling act in both families, on the pair and not the name", () => {
    open();
    // A settling tag and a settling citation are the same fact about two
    // families (`RefsSheet.jsx:17-23`).
    expect(screen.getByTestId("refs-sheet-topic-coastroad-pair-pending")).toHaveTextContent(
      "Still settling",
    );
    expect(screen.getByTestId("refs-sheet-reference-l1-bend-pair-pending")).toHaveTextContent(
      "Still settling",
    );
    expect(
      screen.queryByTestId("refs-sheet-topic-photography-pair-pending"),
    ).toBeNull();
  });

  it("sends a tag row to the tag's page", () => {
    open();
    expect(screen.getByRole("link", { name: /photography/ })).toHaveAttribute(
      "href",
      "/topics/photography",
    );
  });

  it("sends a reference row to the node it points at", () => {
    open();
    // A mention reads as the handle, which is what the chip already calls it.
    expect(screen.getByRole("link", { name: /@mira/ })).toHaveAttribute("href", "/u/mira");
    // A comment has no permalink, so it opens the post carrying it.
    expect(
      screen.getByRole("link", { name: /second bend/ }),
    ).toHaveAttribute("href", "/posts/p1");
  });

  it("counts a citation it cannot type, and leaves it pointing nowhere", () => {
    // THE COUNT IS THE LIST'S LENGTH: a claim whose far end this instance
    // carries no display row for still stands as a substrate fact, so it
    // still gets a row — named by its L1 identifier.
    open({ topics: [], references: [reference("l1-unknown", 0.1, 0.1, null)] });
    expect(screen.getByTestId("refs-sheet-reference-l1-unknown")).toHaveTextContent(
      "l1-unknown",
    );
    expect(screen.queryByRole("link", { name: /l1-unknown/ })).toBeNull();
  });

  it("draws no caption over a group with nothing in it", () => {
    open({ references: [] });
    expect(screen.getByText("Tags")).toBeInTheDocument();
    expect(screen.queryByText("References")).toBeNull();
  });
});
