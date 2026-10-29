import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { emptyReply, type ReplyState, type ReplyTarget, type SealUploads } from "@/lib/compose/reply-wizard";
import { newReferenceDraft } from "@/lib/references/draft";
import type { SealFault } from "@/lib/compose/seal-fault";
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

const SETTLED: SealUploads = { pending: 0, failed: 0, done: 0, total: 0, video: false };

function renderSeal(
  overrides: Partial<ReplyState> = {},
  sheet: ReplySheet = "none",
  extra: {
    keyOnDevice?: boolean;
    signing?: boolean;
    swapped?: boolean;
    slow?: boolean;
    blocked?: string | null;
    uploads?: SealUploads;
    fault?: SealFault | null;
    tagErrors?: Record<number, string>;
  } = {},
) {
  const props = {
    state: { ...emptyReply(TARGET), step: "seal" as const, words: "Still here.", ...overrides },
    sheet,
    stagedStance: { pDirected: 0.1, pInterest: 0.1 },
    blocked: extra.blocked ?? null,
    uploads: extra.uploads ?? SETTLED,
    signing: extra.signing ?? false,
    swapped: extra.swapped ?? false,
    slow: extra.slow ?? false,
    keyOnDevice: extra.keyOnDevice ?? true,
    fault: extra.fault ?? null,
    tagErrors: extra.tagErrors,
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
    onRetry: vi.fn(),
    onRetryUploads: vi.fn(),
    onWriteRuleHelp: vi.fn(),
    onNotNow: vi.fn(),
    onReport: vi.fn(),
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

  it("ReplySeal.md:11-13 Sign comment refuses a second press while signing, never dimmed, its participle past 200ms", () => {
    const { onSign } = renderSeal({}, "none", { signing: true });
    const sign = screen.getByTestId("reply-sign");
    expect(sign).not.toBeDisabled();
    expect(sign).toHaveTextContent("Sign comment");
    fireEvent.click(sign);
    expect(onSign).not.toHaveBeenCalled();
  });

  it("ReplySeal.md:13 past 200ms Sign comment reads Signing comment…, no spinner", () => {
    renderSeal({}, "none", { signing: true, swapped: true });
    const sign = screen.getByTestId("reply-sign");
    expect(sign).toHaveTextContent("Signing comment…");
    expect(sign).not.toBeDisabled();
    expect(screen.queryByRole("progressbar")).toBeNull();
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

// THE GATE AND THE HELD PRESS, line by line (ReplySealUploading.md,
// ReplySealUploadFailed.md; `_shared.jsx` `ReplySealBody` at `uploading`).
describe("ReplySealStep — the gate on the reply's media", () => {
  const twoPictures: SealUploads = { pending: 1, failed: 0, done: 1, total: 2, video: false };
  const theClip: SealUploads = { pending: 1, failed: 0, done: 0, total: 1, video: true };

  it("ReplySealUploading.md:3 the line Uploading N of M — signing waits for the pictures. stands above Sign comment", () => {
    renderSeal({}, "none", { uploads: twoPictures });
    const line = screen.getByTestId("reply-seal-blocked");
    expect(line).toHaveTextContent("Uploading 1 of 2 — signing waits for the pictures.");
    // Above the commit, in the foot's own column.
    expect(line.compareDocumentPosition(screen.getByTestId("reply-sign")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("ReplySealUploading.md:5 the clip's line says signing waits for the video.", () => {
    renderSeal({}, "none", { uploads: theClip });
    expect(screen.getByTestId("reply-seal-blocked")).toHaveTextContent(
      "Uploading 0 of 1 — signing waits for the video.",
    );
  });

  it("ReplySealUploading.md:7 Sign comment is enabled while an upload runs, and a press reaches the wizard", () => {
    const { onSign } = renderSeal({}, "none", { uploads: twoPictures });
    const sign = screen.getByTestId("reply-sign");
    expect(sign).not.toBeDisabled();
    fireEvent.click(sign);
    expect(onSign).toHaveBeenCalledTimes(1);
  });

  it("ReplySealUploading.md:11 past 200ms of a held press the header's ways out lock with Back, every door, every fact", () => {
    const { onBack, onSheet, onOpenTagPicker, onOpenReferencePicker } = renderSeal({}, "none", {
      uploads: twoPictures,
      signing: true,
      swapped: true,
    });
    expect(screen.getByTestId("reply-sign")).toHaveTextContent("Signing comment…");
    fireEvent.click(screen.getByTestId("reply-back"));
    fireEvent.click(screen.getByTestId("reply-open-stance"));
    fireEvent.click(screen.getByTestId("reply-open-license"));
    fireEvent.click(screen.getByTestId("reply-open-sensitive"));
    fireEvent.click(screen.getByTestId("reply-open-tags"));
    fireEvent.click(screen.getByTestId("reply-open-references"));
    expect(onBack).not.toHaveBeenCalled();
    expect(onSheet).not.toHaveBeenCalled();
    expect(onOpenTagPicker).not.toHaveBeenCalled();
    expect(onOpenReferencePicker).not.toHaveBeenCalled();
    // Never dimmed: inert, with the resting face.
    expect(screen.getByTestId("reply-back")).not.toBeDisabled();
  });

  it("ReplySealUploading.md:13 past 5s the subline under the total reads the slow line, no progress indicator", () => {
    renderSeal({}, "none", { uploads: twoPictures, signing: true, swapped: true, slow: true });
    const note = screen.getByTestId("reply-seal-acts-note");
    expect(note).toHaveTextContent("Still signing — the network is slow right now.");
    expect(note).toHaveAttribute("role", "status");
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("SealSigningSlow.md: the slow line takes the all-or-nothing subline's place on a seal signing two things", () => {
    renderSeal({ references: [citation("p-2", "Tide tables")] }, "none", { signing: true, swapped: true, slow: true });
    expect(screen.getByTestId("reply-seal-acts-note")).toHaveTextContent("Still signing — the network is slow right now.");
    expect(screen.getByTestId("reply-seal")).not.toHaveTextContent("They land together, or none does.");
  });

  it("ReplySealUploadFailed.md:3,7,9 a failed picture: the fact in error ink, Signing waits for it. quiet, Retry, Sign comment disabled", () => {
    renderSeal({}, "none", {
      uploads: { pending: 0, failed: 1, done: 1, total: 2, video: false },
      blocked: "One picture didn't upload.",
    });
    const line = screen.getByTestId("reply-seal-blocked");
    expect(line).toHaveTextContent("One picture didn't upload. Signing waits for it. Retry");
    expect(within(line).getByText("One picture didn't upload.")).toHaveClass("text-error");
    expect(within(line).getByText("Signing waits for it.")).toHaveClass("text-on-surface-variant");
    expect(screen.getByTestId("reply-sign")).toBeDisabled();
  });

  it("ReplySealUploadFailed.md:5 a failed clip: The video didn't upload. Signing waits for it.", () => {
    renderSeal({}, "none", {
      uploads: { pending: 0, failed: 1, done: 0, total: 1, video: true },
      blocked: "The video didn't upload.",
    });
    expect(screen.getByTestId("reply-seal-blocked")).toHaveTextContent(
      "The video didn't upload. Signing waits for it.",
    );
    expect(screen.getByTestId("reply-sign")).toBeDisabled();
  });

  it("ReplySealUploadFailed.md:11,13 every row reads back as it did, and no Remove it stands on the seal", () => {
    renderSeal({}, "none", {
      uploads: { pending: 0, failed: 1, done: 1, total: 2, video: false },
      blocked: "One picture didn't upload.",
    });
    expect(screen.queryByRole("button", { name: /^Remove/ })).toBeNull();
    expect(screen.getByTestId("reply-open-tags")).toBeInTheDocument();
    expect(screen.getByTestId("reply-open-stance")).toBeInTheDocument();
  });

  it("ReplySealUploadFailed.md:17 Retry runs the gate again and signs nothing", () => {
    const { onRetryUploads, onSign } = renderSeal({}, "none", {
      uploads: { pending: 0, failed: 1, done: 1, total: 2, video: false },
      blocked: "One picture didn't upload.",
    });
    fireEvent.click(screen.getByTestId("reply-seal-blocked-retry"));
    expect(onRetryUploads).toHaveBeenCalledTimes(1);
    expect(onSign).not.toHaveBeenCalled();
  });

  it("ReplySealUploadFailed.md:19 a press on the disabled commit signs nothing", () => {
    const { onSign } = renderSeal({}, "none", {
      uploads: { pending: 0, failed: 1, done: 1, total: 2, video: false },
      blocked: "One picture didn't upload.",
    });
    fireEvent.click(screen.getByTestId("reply-sign"));
    expect(onSign).not.toHaveBeenCalled();
  });
});

// WHAT BECAME OF THE PRESS, IN THE FOOT (ReplySeal.md:19-21,
// WriteRuleFailed.md:25-29; the post seal's failure pack at comment scale).
describe("ReplySealStep — the fault foot", () => {
  it("ReplySeal.md:19 no answer: the fault line and Retry take Sign comment's place, everything above stays", () => {
    const { onRetry, onBack } = renderSeal({ references: [citation("p-2", "Tide tables")] }, "none", {
      fault: { kind: "offline" },
    });
    expect(screen.queryByTestId("reply-sign")).toBeNull();
    const line = screen.getByTestId("reply-transport-error");
    expect(line).toHaveTextContent("That didn't send. Try again.");
    expect(line).toHaveAttribute("role", "alert");
    // In the foot: under the note that closes the read-back, over Retry and Back.
    const note = screen.getByTestId("reply-seal-note");
    expect(note.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(line.compareDocumentPosition(screen.getByTestId("reply-retry")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Everything above the foot as it was.
    expect(screen.getByTestId("reply-cited-repair")).toHaveTextContent("Tide tables");
    expect(screen.getByTestId("reply-open-tags")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("reply-retry"));
    expect(onRetry).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId("reply-back"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("ReplySeal.md:21 the write rule: the notice says the reply is still here, Not now under it, and never Retry", () => {
    const { onNotNow, onWriteRuleHelp } = renderSeal({}, "none", { fault: { kind: "writeRule" } });
    const notice = screen.getByTestId("reply-write-rule");
    expect(notice).toHaveTextContent("You can't sign right now");
    expect(notice).toHaveTextContent(
      "Each signing is paid for, and there's only so much to go around at a time. Nothing was signed or spent — your reply is still here.",
    );
    // WriteRuleFailed.md:25 — never a kept draft, never Retry, no commit.
    expect(screen.getByTestId("reply-seal")).not.toHaveTextContent(/draft/i);
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    expect(screen.queryByTestId("reply-sign")).toBeNull();
    fireEvent.click(screen.getByTestId("reply-write-rule-help"));
    expect(onWriteRuleHelp).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("reply-not-now")).toHaveTextContent("Not now");
    fireEvent.click(screen.getByTestId("reply-not-now"));
    expect(onNotNow).toHaveBeenCalledTimes(1);
  });

  it("WriteRuleFailed.md:3 every act is still read back while the notice stands", () => {
    renderSeal({ references: [citation("p-2", "Tide tables")] }, "none", { fault: { kind: "writeRule" } });
    expect(screen.getByTestId("reply-seal-acts-total")).toHaveTextContent("2 things, signed together");
    expect(screen.getByTestId("reply-open-stance")).toBeInTheDocument();
  });

  it("the key notice still outranks a fault: no commit is possible without the key", () => {
    renderSeal({}, "none", { fault: { kind: "offline" }, keyOnDevice: false });
    expect(screen.getByTestId("reply-key-absent")).toBeInTheDocument();
    expect(screen.queryByTestId("reply-retry")).toBeNull();
  });
});

// THE REFUSED ACT (ReplySealComment.md:9-13; SealFaultRow.md, SealFaultBug.md
// at comment scale).
describe("ReplySealStep — a refused act", () => {
  const unlanded = citation("p-2", "Tide tables and the third headland");

  it("ReplySealComment.md:9 the cited post that never landed: its row reads the line, then Remove it; Sign comment stays; no Retry", () => {
    const { onReferences } = renderSeal({ references: [unlanded] }, "none", {
      fault: { kind: "row", targetId: "p-2" },
    });
    const line = screen.getByTestId("reply-seal-reference-fault");
    expect(line).toHaveTextContent("This post didn't land, so it can't be cited.");
    expect(screen.getByTestId("reply-cited-repair")).toHaveTextContent("Tide tables and the third headland");
    expect(screen.getByTestId("reply-sign")).toHaveTextContent("Sign comment");
    expect(screen.getByTestId("reply-sign")).not.toBeDisabled();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    expect(screen.queryByTestId("reply-transport-error")).toBeNull();
    fireEvent.click(within(line).getByRole("button", { name: /Remove/ }));
    expect(onReferences).toHaveBeenCalledWith([]);
  });

  it("SealFaultRow.md:5 under a count the line stands under the References row, the citation named by Remove it's name", () => {
    const { onReferences } = renderSeal({ references: [unlanded, citation("u-1", "Mira Voss")] }, "none", {
      fault: { kind: "row", targetId: "p-2" },
    });
    expect(screen.getByTestId("reply-open-cited-fault")).toHaveTextContent(
      "This post didn't land, so it can't be cited.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove Tide tables and the third headland" }));
    expect(onReferences).toHaveBeenCalledWith([expect.objectContaining({ targetId: "u-1" })]);
  });

  it("SealFaultRow.md:3 a cited comment that never landed says so in its own noun", () => {
    const comment = { ...newReferenceDraft("c-9", { kind: "Comment" as const, label: "@mira's comment", href: "/c/c-9" }) };
    renderSeal({ references: [comment] }, "none", { fault: { kind: "row", targetId: "c-9" } });
    expect(screen.getByTestId("reply-seal-reference-fault")).toHaveTextContent(
      "This comment didn't land, so it can't be cited.",
    );
  });

  it("ReplySealComment.md:11 any other refused act: the notice This shouldn't have happened takes Sign comment's place with Try again, Report a problem and Discard the reply", () => {
    const { onRetry, onReport, onDiscard } = renderSeal({ references: [unlanded] }, "none", {
      fault: { kind: "bug" },
    });
    const notice = screen.getByTestId("reply-seal-bug");
    expect(notice).toHaveTextContent("This shouldn't have happened");
    expect(notice).toHaveTextContent(
      "That's a fault on our side, not yours. Nothing was signed or spent, and telling us helps us fix it.",
    );
    expect(screen.queryByTestId("reply-sign")).toBeNull();
    // SealFaultBug.md:5 — Try again is the notice's filled button; the other two text buttons under it.
    expect(within(notice).getByTestId("reply-try-again")).toHaveTextContent("Try again");
    expect(within(notice).queryByTestId("reply-report")).toBeNull();
    expect(screen.getByTestId("reply-report")).toHaveTextContent("Report a problem");
    expect(screen.getByTestId("reply-discard")).toHaveTextContent("Discard the reply");
    // Everything above the foot stays as it was, and no row is marked.
    expect(screen.getByTestId("reply-cited-repair")).toHaveTextContent("Tide tables and the third headland");
    expect(screen.queryByTestId("reply-seal-reference-fault")).toBeNull();
    // SealFaultBug.md:15 — the header's ? is the only ? on the seal.
    expect(within(notice).queryByRole("button", { name: /\?|Why|Your key/ })).toBeNull();
    fireEvent.click(screen.getByTestId("reply-try-again"));
    expect(onRetry).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId("reply-report"));
    expect(onReport).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId("reply-discard"));
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });
});
