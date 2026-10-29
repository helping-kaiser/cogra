import { act, fireEvent, render, screen, within } from "@testing-library/react";
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

function renderSeal(
  overrides: Partial<ReplyState> = {},
  sheet: ReplySheet = "none",
  extra: { keyOnDevice?: boolean; busy?: boolean; tagErrors?: Record<number, string> } = {},
) {
  const props = {
    state: { ...emptyReply(TARGET), step: "seal" as const, words: "Still here.", ...overrides },
    sheet,
    stagedStance: { pDirected: 0.1, pInterest: 0.1 },
    blocked: null,
    busy: extra.busy ?? false,
    keyOnDevice: extra.keyOnDevice ?? true,
    tagErrors: extra.tagErrors,
    refusal: null,
    onSheet: vi.fn(),
    onLicense: vi.fn(),
    onStagedStance: vi.fn(),
    onSetStance: vi.fn(),
    onTags: vi.fn(),
    onReferences: vi.fn(),
    onOpenTagPicker: vi.fn(),
    onOpenReferencePicker: vi.fn(),
    onSensitive: vi.fn(),
    onSensitiveReason: vi.fn(),
    onSensitiveHelp: vi.fn(),
    onKeyHelp: vi.fn(),
    onSign: vi.fn(),
    onBack: vi.fn(),
    onDiscard: vi.fn(),
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
    // The door's name folds the count in — "Manage the N citations", and at
    // one "Manage the 1 citation" (copy-voice.md:409-419).
    expect(screen.getByRole("button", { name: "Manage the 2 citations" })).toBe(door);
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

    fireEvent.click(screen.getByTestId("reply-cited-sheet-0-remove"));
    expect(onReferences).toHaveBeenCalledWith([two[1]]);

    fireEvent.click(screen.getByTestId("reply-cited-sheet-1-select"));
    fireEvent.click(screen.getByTestId("reply-cited-sheet-pair-exact-route"));
    fireEvent.change(screen.getByTestId("reply-cited-sheet-pair-tracks-directed"), {
      target: { value: "0.5" },
    });
    fireEvent.click(screen.getByTestId("reply-cited-sheet-pair-done"));
    expect(onReferences).toHaveBeenCalledWith([two[0], { ...two[1], relevance: 0.5, support: 0.1 }]);

    fireEvent.click(screen.getByTestId("reply-cited-sheet-done"));
    expect(onSheet).toHaveBeenCalledWith("none");
  });
});

// THE SEAL'S ANATOMY, line by line (ReplySeal.md, ReplyCited.md,
// ReplyCitedMany.md, ReplySealKeyAbsent.md; `_shared.jsx` `ReplySealBody`).
describe("ReplySealStep — the board's rows and lines", () => {
  it("ReplySeal.md:5 carries + Add a tag and + Cite something as rows of its acts card, each 1 more", () => {
    renderSeal();
    const acts = within(screen.getByTestId("reply-seal-acts"));
    expect(acts.getByTestId("reply-open-tags")).toHaveTextContent("+ Add a tag");
    expect(acts.getByTestId("reply-open-tags")).toHaveTextContent("1 more");
    expect(acts.getByTestId("reply-open-references")).toHaveTextContent("+ Cite something");
    expect(screen.queryByText(/Add a topic/)).toBeNull();
  });

  it("round 27: + Add a tag opens the tag picker, + Cite something the citation picker", () => {
    const { onOpenTagPicker, onOpenReferencePicker, onSheet } = renderSeal();
    fireEvent.click(screen.getByTestId("reply-open-tags"));
    expect(onOpenTagPicker).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId("reply-open-references"));
    expect(onOpenReferencePicker).toHaveBeenCalledTimes(1);
    expect(onSheet).not.toHaveBeenCalled();
  });

  it("ReplySeal.md:7 the note under the fact rows reads Replying also signs an opinion on what it answers.", () => {
    renderSeal();
    expect(screen.getByTestId("reply-seal-note")).toHaveTextContent(
      "Replying also signs an opinion on what it answers.",
    );
    expect(screen.getByText("Toward what you answer")).toBeInTheDocument();
  });

  it("ReplyCitedMany.md:5 the total says in words how many things are signed together", () => {
    renderSeal();
    expect(screen.getByTestId("reply-seal-acts-total")).toHaveTextContent("1 thing, signed");
    expect(screen.queryByTestId("reply-seal-acts-note")).toBeNull();
  });

  it("ReplyCited.md:5 carries the all-or-nothing subline once the signature carries more than one thing", () => {
    renderSeal({ references: [citation("p-2", "Tide tables")] });
    expect(screen.getByTestId("reply-seal-acts-total")).toHaveTextContent("2 things, signed together");
    expect(screen.getByTestId("reply-seal-acts-note")).toHaveTextContent("They land together, or none does.");
  });

  it("ReplyCited.md:9 tapping the staged citation's name opens its pair sheet", () => {
    const { onSheet } = renderSeal({ references: [citation("p-2", "Tide tables")] });
    fireEvent.click(screen.getByTestId("reply-cited-repair"));
    expect(onSheet).toHaveBeenCalledWith("pair");
  });

  it("ReplyCited.md:9 the pair sheet sets the one citation's pair", () => {
    const only = citation("p-2", "Tide tables");
    const { onReferences } = renderSeal({ references: [only] }, "pair");
    fireEvent.click(screen.getByTestId("reply-cited-pair-exact-route"));
    fireEvent.change(screen.getByTestId("reply-cited-pair-tracks-directed"), { target: { value: "0.5" } });
    fireEvent.click(screen.getByTestId("reply-cited-pair-done"));
    expect(onReferences).toHaveBeenCalledWith([{ ...only, relevance: 0.5, support: 0.1 }]);
  });

  it("ReplyCitedMany.md:7 + Add a tag and + Cite something stay with two citations staged", () => {
    renderSeal({ references: [citation("p-2", "Tide tables"), citation("u-1", "Mira Voss")] });
    expect(screen.getByTestId("reply-open-tags")).toBeInTheDocument();
    expect(screen.getByTestId("reply-open-references")).toBeInTheDocument();
  });

  it("reads staged tags back as their chips, and + Add a tag stays under them", () => {
    renderSeal({ tags: [{ name: "saltmaps", relevance: 0.5, confidence: 0.5 }] as never });
    expect(screen.getByTestId("reply-seal-tags")).toHaveTextContent("#saltmaps");
    expect(screen.getByTestId("reply-open-tags")).toBeInTheDocument();
  });

  it("says a refused tag on its own row, with Remove it as the way out", () => {
    const tags = [{ name: "reserved", relevance: 0.5, confidence: 0.5 }] as never;
    const { onTags } = renderSeal({ tags }, "none", { tagErrors: { 0: "That tag can't be used." } });
    expect(screen.getByTestId("reply-seal-tags-fault")).toHaveTextContent("That tag can't be used.");
    fireEvent.click(screen.getByRole("button", { name: "Remove #reserved" }));
    expect(onTags).toHaveBeenCalledWith([]);
  });

  it("ReplySeal.md:9-13 Sign comment refuses a second press while signing, never dimmed, its participle past 200ms", () => {
    vi.useFakeTimers();
    try {
      const { onSign } = renderSeal({}, "none", { busy: true });
      const sign = screen.getByTestId("reply-sign");
      expect(sign).not.toBeDisabled();
      expect(sign).toHaveTextContent("Sign comment");
      fireEvent.click(sign);
      expect(onSign).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(sign).toHaveTextContent("Signing comment…");
    } finally {
      vi.useRealTimers();
    }
  });

  it("ReplySealKeyAbsent.md:3 the reply-scale notice stands where the foot stood, Discard the reply under it", () => {
    const { onDiscard, onKeyHelp } = renderSeal({}, "none", { keyOnDevice: false });
    const notice = screen.getByTestId("reply-key-absent");
    expect(notice).toHaveTextContent("A reply can't wait as pending — restore the key to sign this one.");
    expect(screen.queryByTestId("reply-sign")).toBeNull();
    // Every row stays.
    expect(screen.getByTestId("reply-open-tags")).toBeInTheDocument();
    // ReplySealKeyAbsent.md:5 — the notice's own ?.
    fireEvent.click(screen.getByTestId("reply-key-help"));
    expect(onKeyHelp).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("reply-discard"));
    expect(onDiscard).toHaveBeenCalled();
    // ReplySealKeyAbsent.md:9 — no way to keep a draft.
    expect(screen.queryByText(/draft/i)).toBeNull();
  });
});
