import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { emptyReply, type ReplyState, type ReplyTarget } from "@/lib/compose/reply-wizard";
import { newReferenceDraft } from "@/lib/references/draft";
import { ReplySealStep, type ReplySheet } from "./reply-seal-step";

const TARGET: ReplyTarget = {
  id: "p-1",
  kind: "post",
  label: "The long way home",
  authorHandle: "ada",
  authorName: "Ada",
  avatarUrl: null,
  snippet: "Salt maps of the coast road.",
};

function citation(id: string, label: string, relevance = 0.1, support = 0.1) {
  return {
    ...newReferenceDraft(id, { kind: "Post" as const, label, href: `/p/${id}` }),
    relevance,
    support,
  };
}

function renderSeal(overrides: Partial<ReplyState> = {}, sheet: ReplySheet = "none") {
  const props = {
    state: { ...emptyReply(TARGET), step: "seal" as const, words: "Still here.", ...overrides },
    sheet,
    stagedStance: { pDirected: 0.1, pInterest: 0.1 },
    blocked: null,
    busy: false,
    keyOnDevice: true,
    refusal: null,
    onSheet: vi.fn(),
    onLicense: vi.fn(),
    onStagedStance: vi.fn(),
    onSetStance: vi.fn(),
    onTags: vi.fn(),
    onReferences: vi.fn(),
    onSensitive: vi.fn(),
    onSensitiveReason: vi.fn(),
    onSensitiveHelp: vi.fn(),
    onSign: vi.fn(),
    onBack: vi.fn(),
    onRestoreKey: vi.fn(),
  };
  render(<ReplySealStep {...props} />);
  return props;
}

// The N-cited round (jakob's rulings 2026-09-14, design backlog item 70). The
// rule is about citations, not about which composer staged them — so the
// reply's seal counts at two exactly as the post's does, and both doors open
// the one sheet. What is the reply's own is the add-row, which rides along in
// every state because a comment's seal IS its details stage.
describe("ReplySealStep — the citations' three readings", () => {
  it("speaks the comment row's count in its own noun", () => {
    renderSeal();
    expect(within(screen.getByTestId("reply-seal-acts")).getByText("1 comment")).toHaveClass(
      "sr-only",
    );
  });

  it("offers only the add-row with nothing staged", () => {
    renderSeal();
    const acts = within(screen.getByTestId("reply-seal-acts"));
    expect(acts.getByTestId("reply-open-references")).toHaveTextContent("+ Cite something");
    expect(acts.queryByTestId("reply-cited-repair")).not.toBeInTheDocument();
    expect(acts.queryByTestId("reply-open-cited")).not.toBeInTheDocument();
  });

  it("reads one staged citation back as itself, the add-row still under it", () => {
    renderSeal({ references: [citation("p-2", "Tide tables and the third headland")] });
    const acts = within(screen.getByTestId("reply-seal-acts"));
    // Singular: the label names the edge staged, and one edge is a reference.
    expect(acts.getByText("Reference")).toBeInTheDocument();
    expect(acts.getByTestId("reply-cited-repair")).toHaveTextContent(
      "Tide tables and the third headland",
    );
    expect(acts.queryByText("1 cited")).not.toBeInTheDocument();
    // Counting the citations takes away no way to add another.
    expect(acts.getByTestId("reply-open-references")).toBeInTheDocument();
  });

  it("names the one citation's two controls for it", () => {
    const { onReferences } = renderSeal({
      references: [citation("p-2", "Tide tables and the third headland")],
    });
    expect(
      screen.getByRole("button", {
        name: "Tide tables and the third headland — set how it relates",
      }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Remove Tide tables and the third headland" }),
    );
    expect(onReferences).toHaveBeenCalledWith([]);
  });

  it("counts from two, bare, with the whole row the door", () => {
    const { onSheet } = renderSeal({
      references: [citation("p-2", "Tide tables"), citation("u-1", "Mira Voss")],
    });
    const door = screen.getByTestId("reply-open-cited");
    expect(door).toHaveTextContent("2 cited");
    // Seen bare, heard whole (item 73): the digit is drawn, the reading spoken.
    expect(door.lastElementChild?.firstElementChild?.textContent).toBe("2");
    expect(within(door).getByText("2 citations")).toHaveClass("sr-only");
    expect(screen.getByRole("button", { name: "Manage the citations" })).toBe(door);
    // The add-row survives the count.
    expect(screen.getByTestId("reply-open-references")).toBeInTheDocument();
    fireEvent.click(door);
    expect(onSheet).toHaveBeenCalledWith("cited");
  });

  it("opens the post seal's own sheet, which adds nothing", () => {
    const two = [citation("p-2", "Tide tables"), citation("u-1", "Mira Voss")];
    const { onReferences, onSheet } = renderSeal({ references: two }, "cited");
    const sheet = screen.getByTestId("reply-cited-sheet");
    expect(within(sheet).getByText("Cited · 2")).toBeInTheDocument();
    expect(within(sheet).queryByText(/Cite something/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("reply-cited-sheet-remove-0"));
    expect(onReferences).toHaveBeenCalledWith([two[1]]);

    fireEvent.click(screen.getByTestId("reply-cited-sheet-repair-1"));
    fireEvent.change(screen.getByTestId("reply-cited-sheet-1-relevance"), {
      target: { value: "0.5" },
    });
    expect(onReferences).toHaveBeenCalledWith([two[0], { ...two[1], relevance: 0.5, support: 0.1 }]);

    fireEvent.click(screen.getByTestId("reply-cited-sheet-done"));
    expect(onSheet).toHaveBeenCalledWith("none");
  });
});
