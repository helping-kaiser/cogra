import { readFileSync } from "node:fs";
import { join } from "node:path";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { UNREACHABLE_BODY } from "@/lib/ui2/compose/unreachable-confirm";

import { emptyWizard, type WizardState } from "@/lib/compose/wizard";
import { newReferenceDraft } from "@/lib/references/draft";
import { DEFAULT_CONFIDENCE, DEFAULT_RELEVANCE, type TagDraft } from "@/lib/topics/draft";
import { PUBLIC_DOMAIN } from "@/lib/license";
import { SealStep, type SealSheet } from "./seal-step";

function citation(id: string, label: string, relevance = 0.1, support = 0.1) {
  return {
    ...newReferenceDraft(id, { kind: "Post" as const, label, href: `/p/${id}` }),
    relevance,
    support,
  };
}

function tag(name: string): TagDraft {
  return { name, relevance: DEFAULT_RELEVANCE, confidence: DEFAULT_CONFIDENCE };
}

function baseState(overrides: Partial<WizardState> = {}): WizardState {
  return { ...emptyWizard(), title: "Salt maps of the coast road", ...overrides };
}

function renderStep(
  overrides: Partial<WizardState> = {},
  sheet: SealSheet = "none",
  keyOnDevice: boolean | null = true,
  staged = 0.1,
  confirmingUnreachable = false,
) {
  const props = {
    state: baseState(overrides),
    sheet,
    blocked: null,
    busy: false,
    keyOnDevice,
    refusal: null,
    stagedPDirected: staged,
    confirmingUnreachable,
    onSheet: vi.fn(),
    onLicense: vi.fn(),
    onReferences: vi.fn(),
    onStagedPDirected: vi.fn(),
    onSetStance: vi.fn(),
    onKeepAdjusting: vi.fn(),
    onSetAnyway: vi.fn(),
    onStanceHelp: vi.fn(),
    onSensitive: vi.fn(),
    onSensitiveReason: vi.fn(),
    onHelp: vi.fn(),
    onLicenseHelp: vi.fn(),
    onKeyHelp: vi.fn(),
    onSign: vi.fn(),
    onBack: vi.fn(),
    onRestoreKey: vi.fn(),
    onKeepDraft: vi.fn(),
  };
  render(<SealStep {...props} />);
  return props;
}

describe("SealStep", () => {
  // CW-22: the label is "Tags", and each one reads back as a readout chip —
  // never a joined string.
  it("reads tags back as chips under the label 'Tags'", () => {
    renderStep({ tags: [tag("fieldnotes"), tag("coastroad")] });
    expect(screen.getByText("Tags")).toBeInTheDocument();
    expect(screen.queryByText("Topics")).not.toBeInTheDocument();
    expect(screen.getByText("#fieldnotes")).toBeInTheDocument();
    expect(screen.getByText("#coastroad")).toBeInTheDocument();
    // Never the old joined string.
    expect(screen.queryByText("#fieldnotes  #coastroad")).not.toBeInTheDocument();
  });

  // CW-21: the References row names what's cited and reads back the stance
  // that rides with it — never a bare count.
  it("names the citation and reads its stance back, not just a count", () => {
    const reference = {
      ...newReferenceDraft("u-ada", {
        kind: "User" as const,
        label: "The long way home — @ada",
        href: "/u/ada",
      }),
      relevance: 0.1,
      support: 0.1,
    };
    renderStep({ references: [reference] });
    // Scoped to the acts card: the cited sheet renders behind the seal as a
    // closed `<dialog>`, so the citation it lists is in the document too.
    const acts = within(screen.getByTestId("wizard-seal-acts"));
    expect(acts.getByText("The long way home — @ada")).toBeInTheDocument();
    expect(acts.queryByText("1 cited")).not.toBeInTheDocument();
    expect(acts.getAllByText("+0.10 / +0.10").length).toBeGreaterThan(0);
  });

  // The N-cited round (jakob's rulings 2026-09-14, design backlog item 70):
  // one citation reads back as itself, two or more read back as their count
  // and the whole row becomes the door to the sheet that lists them.
  describe("the References row's three readings", () => {
    it("draws no row at all with nothing staged", () => {
      renderStep();
      expect(screen.queryByText("References")).not.toBeInTheDocument();
      expect(screen.queryByTestId("wizard-open-cited")).not.toBeInTheDocument();
    });

    it("counts instead of naming from two, with the count bare", () => {
      renderStep({
        references: [citation("p-1", "The long way home — @ada"), citation("p-2", "Mira Voss")],
      });
      const door = screen.getByTestId("wizard-open-cited");
      expect(door).toHaveTextContent("2 cited");
      // The trailing count is the citations, BARE — the list's length and
      // nothing else, never the signature's own act total.
      expect(door.lastElementChild?.firstElementChild?.textContent).toBe("2");
      expect(door).not.toHaveTextContent("2 actions");
      // Two or more is where the name stops being the shortest true answer,
      // so no citation is named on the card any more.
      expect(
        within(screen.getByTestId("wizard-seal-acts")).queryByText("The long way home — @ada"),
      ).not.toBeInTheDocument();
    });

    it("makes the whole counting row the control, named for what it opens", () => {
      const { onSheet } = renderStep({
        references: [citation("p-1", "One"), citation("p-2", "Two"), citation("p-3", "Three")],
      });
      // The door's name folds the count in — "Manage the N citations", and at
      // one "Manage the 1 citation" (copy-voice.md:409-419).
      const door = screen.getByRole("button", { name: "Manage the 3 citations" });
      expect(door).toBe(screen.getByTestId("wizard-open-cited"));
      // No chevron, no trailing word: the accessible name is the only thing
      // that says the line is a door (copy-voice, `PickedRow`'s rule).
      expect(door).not.toHaveTextContent("Manage");
      door.click();
      expect(onSheet).toHaveBeenCalledWith("cited");
    });
  });

  describe("the cited sheet", () => {
    const two = [
      citation("p-1", "The long way home — @ada"),
      citation("p-2", "Tide tables and the third headland", -0.2, 0.1),
    ];

    it("titles itself by what it holds and how many", () => {
      renderStep({ references: two }, "cited");
      expect(screen.getByText("Cited · 2")).toBeInTheDocument();
      expect(screen.getByTestId("wizard-cited-sheet-row-0")).toHaveTextContent(
        "The long way home — @ada",
      );
      expect(screen.getByTestId("wizard-cited-sheet-row-1")).toHaveTextContent(
        "Tide tables and the third headland",
      );
    });

    it("names every control for its own citation", () => {
      renderStep({ references: two }, "cited");
      expect(
        screen.getByRole("button", { name: "Remove The long way home — @ada" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", {
          name: "The long way home — @ada — set how it relates",
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Remove Tide tables and the third headland" }),
      ).toBeInTheDocument();
    });

    it("adds nothing — citations are staged where they are staged", () => {
      renderStep({ references: two }, "cited");
      const sheet = screen.getByTestId("wizard-cited-sheet");
      expect(within(sheet).queryByText(/Cite something/)).not.toBeInTheDocument();
      expect(within(sheet).queryByText(/Add a reference/)).not.toBeInTheDocument();
    });

    it("removes into the staged set the details stage owns", () => {
      const { onReferences } = renderStep({ references: two }, "cited");
      screen.getByTestId("wizard-cited-sheet-remove-0").click();
      expect(onReferences).toHaveBeenCalledWith([two[1]]);
    });

    it("re-pairs one citation without touching the others", () => {
      const { onReferences } = renderStep({ references: two }, "cited");
      fireEvent.click(screen.getByTestId("wizard-cited-sheet-repair-1"));
      const relevance = screen.getByTestId("wizard-cited-sheet-1-relevance");
      fireEvent.change(relevance, { target: { value: "0.5" } });
      expect(onReferences).toHaveBeenCalledWith([
        two[0],
        { ...two[1], relevance: 0.5, support: 0.1 },
      ]);
    });

    it("closes on Done", () => {
      const { onSheet } = renderStep({ references: two }, "cited");
      screen.getByTestId("wizard-cited-sheet-done").click();
      expect(onSheet).toHaveBeenCalledWith("none");
    });
  });

  // The BACKING an author signs with their own post is ONE number (jakob
  // 2026-10-16, PR-101): Publish's second parameter is census-pinned, so a
  // pair would show a figure nobody chose. The row reads `Your backing`
  // (ComposeSeal.md), its face from the one-axis table.
  it("reads the author's backing as one number, not a pair, under Your backing", () => {
    renderStep({ pDirected: 0.1 });
    const readout = screen.getByTestId("wizard-stance-value");
    expect(readout.textContent).toContain("+0.10");
    expect(screen.queryByText("+0.10 / +1.00")).not.toBeInTheDocument();
    expect(within(readout).getByText("Nice, For or against +0.10")).toBeInTheDocument();
    expect(screen.getByText("Your backing")).toBeInTheDocument();
    // "opinion" is the face record's word only; the authoring row never wears it.
    expect(screen.queryByText("Where you stand on it")).not.toBeInTheDocument();
    expect(screen.queryByText(/your opinion/i)).not.toBeInTheDocument();
  });

  it("reads a backing of exactly 0.00 as 🤔, spoken No side taken", () => {
    renderStep({ pDirected: 0 });
    const readout = screen.getByTestId("wizard-stance-value");
    expect(readout.textContent).toContain("🤔");
    expect(within(readout).getByText("No side taken, For or against +0.00")).toBeInTheDocument();
  });

  it("reads the row's face off the one-axis table, both signs", () => {
    renderStep({ pDirected: -0.9 });
    const readout = screen.getByTestId("wizard-stance-value");
    expect(readout.textContent).toContain("😠");
    expect(
      within(readout).getByText("Really against this, For or against −0.90"),
    ).toBeInTheDocument();
  });

  // The references row is NOT touched by that ruling: a citation carries a
  // stance toward somebody else's thing, where both parameters are picked.
  it("keeps the citation row's pair", () => {
    const reference = {
      ...newReferenceDraft("u-ada", {
        kind: "User" as const,
        label: "The long way home — @ada",
        href: "/u/ada",
      }),
      relevance: 0.1,
      support: 0.1,
    };
    renderStep({ references: [reference], pDirected: 0.1 });
    expect(
      within(screen.getByTestId("wizard-seal-acts")).getByText("+0.10 / +0.10"),
    ).toBeInTheDocument();
  });

  // ComposePad (round 15): a parked card carrying its own "?", the `Your
  // pick` readout alone above the master `AttachmentPad` strip, and
  // Cancel · Set.
  describe("the backing pad", () => {
    it("parks as its own panel rather than riding a bottom sheet", () => {
      renderStep({ pDirected: 0.1 }, "stance");
      const pad = screen.getByTestId("wizard-stance-pad");
      expect(pad.tagName).toBe("DIALOG");
      // The drawer's own chrome — the drag handle and the title row a
      // sheet draws — is what a pad must not be wrapped in.
      expect(pad.className).toContain("mt-auto");
      expect(pad.className).not.toContain("rounded-t-extra-large");
      expect(screen.queryByTestId("wizard-stance-sheet")).not.toBeInTheDocument();
    });

    it("is named the backing pad, its dot Your backing on your post", () => {
      const { onStanceHelp } = renderStep({}, "stance");
      expect(screen.getByTestId("wizard-stance-pad")).toHaveAttribute(
        "aria-label",
        "Backing pad for your own post",
      );
      const help = screen.getByTestId("wizard-stance-help");
      expect(help).toHaveAttribute("aria-label", "Your backing on your post");
      help.click();
      expect(onStanceHelp).toHaveBeenCalledOnce();
    });

    it("reads Your pick alone — nothing stands yet, so the pick is the result", () => {
      renderStep({ pDirected: 0.1 }, "stance", true, 0.6);
      expect(screen.getByText("Your pick")).toBeInTheDocument();
      const pick = screen.getByTestId("wizard-stance-pick");
      expect(pick.textContent).toContain("😊");
      expect(pick.textContent).toContain("+0.60");
      expect(screen.queryByText("Current backing")).not.toBeInTheDocument();
      expect(screen.queryByText("Backing after")).not.toBeInTheDocument();
    });

    it("reads the pick at exactly 0.00 as 🤔", () => {
      renderStep({}, "stance", true, 0);
      expect(screen.getByTestId("wizard-stance-pick-face").textContent).toBe("🤔");
    });

    it("draws the master's one-axis strip: its ends outside, one zero line, no second axis", () => {
      renderStep({}, "stance");
      const strip = screen.getByTestId("wizard-stance-field-strip");
      expect(strip).toHaveAttribute("aria-label", "For or against");
      expect(strip).toHaveStyle({ height: "56px" });
      expect(strip).not.toHaveAttribute("type", "range");
      // The pole words stand in the gutters, never inside the value space.
      expect(strip).not.toContainElement(screen.getByText("Against"));
      expect(strip).not.toContainElement(screen.getByText("For"));
      expect(screen.getByTestId("wizard-stance-field-zero-down")).toBeInTheDocument();
      expect(screen.queryByText("Less")).not.toBeInTheDocument();
      expect(screen.queryByText("More")).not.toBeInTheDocument();
      // The retired control's caption is not drawn on the round-15 board.
      expect(screen.queryByText("Your own post always reaches you in full.")).not.toBeInTheDocument();
    });

    it("parks the knob where +0.10 puts it", () => {
      renderStep({}, "stance", true, 0.1);
      expect(screen.getByTestId("wizard-stance-field-knob")).toHaveStyle({ left: "55%" });
    });

    it("stands Start it unreachable? over the parked pad when the host asks", () => {
      const { onKeepAdjusting, onSetAnyway } = renderStep({}, "stance", true, 0, true);
      const confirm = screen.getByTestId("wizard-unreachable");
      expect(confirm).toHaveAttribute("open");
      expect(screen.getByTestId("wizard-stance-pad")).toHaveAttribute("open");
      expect(within(confirm).getByText("Start it unreachable?")).toBeInTheDocument();
      // The blessed body (jakob 2026-10-20), verbatim from the master's
      // behavior file (ComposePad.md) — read, not transcribed.
      const master = readFileSync(
        join(process.cwd(), "..", "design", "designs", "canonical", "behavior", "ComposePad.md"),
        "utf-8",
      );
      const body = master.match(/the dialog Start it unreachable\? reads (.+?) with Keep adjusting/);
      expect(body, "ComposePad.md no longer states the dialog's body").not.toBeNull();
      expect(UNREACHABLE_BODY).toBe(body![1]);
      expect(within(confirm).getByText(UNREACHABLE_BODY)).toBeInTheDocument();
      // Keep adjusting is filled; Set it anyway is quiet.
      expect(screen.getByTestId("wizard-unreachable-keep").className).not.toBe(
        screen.getByTestId("wizard-unreachable-anyway").className,
      );
      screen.getByTestId("wizard-unreachable-keep").click();
      expect(onKeepAdjusting).toHaveBeenCalledOnce();
      screen.getByTestId("wizard-unreachable-anyway").click();
      expect(onSetAnyway).toHaveBeenCalledOnce();
    });

    it("stages a drag and commits only on Set", () => {
      const { onStagedPDirected, onSetStance, onSheet } = renderStep({}, "stance");
      const field = screen.getByTestId("wizard-stance-field-strip");
      fireEvent.keyDown(field, { key: "ArrowRight" });
      // One arrow press is a twentieth of the axis, landing on a hundredth.
      expect(onStagedPDirected).toHaveBeenCalledWith(0.15);
      expect(onSetStance).not.toHaveBeenCalled();

      screen.getByTestId("wizard-stance-set").click();
      expect(onSetStance).toHaveBeenCalledOnce();

      screen.getByTestId("wizard-stance-cancel").click();
      expect(onSheet).toHaveBeenCalledWith("none");
      // Cancel stages nothing of its own: it closes, and the staged value
      // it leaves behind was never committed.
      expect(onSetStance).toHaveBeenCalledOnce();
    });
  });

  // CW-24/CW-25: the acts card's total row is its own column (label +
  // all-or-nothing note stacked), and the per-act rows both read at
  // text-label-small.
  it("stacks the signed-actions total over its all-or-nothing note", () => {
    renderStep({ tags: [tag("fieldnotes")] });
    const total = screen.getByTestId("wizard-signed-actions");
    const row = total.parentElement;
    expect(row?.className).toContain("flex-col");
    expect(row?.className).toContain("min-h-12");
    expect(screen.getByText("they land together, or none does")).toBeInTheDocument();
  });

  // Item 73 (jakob's ruling 2026-09-14): the digit is what the eye gets, and
  // an ear given "3" alone gets nothing — so the digit leaves the
  // accessibility tree and the count is spoken whole, in the ROW's own noun.
  it("shows the count bare and speaks it whole, in the row's own noun", () => {
    renderStep({
      tags: [tag("fieldnotes"), tag("coastroad")],
      references: [citation("p-1", "One"), citation("p-2", "Two")],
    });
    const acts = within(screen.getByTestId("wizard-seal-acts"));
    expect(acts.getByText("1 post")).toHaveClass("sr-only");
    expect(acts.getByText("2 tags")).toHaveClass("sr-only");
    // The References row counts CITATIONS — the noun is the row's, not the
    // label's, and no rule derives it from "References".
    expect(acts.getByText("2 citations")).toHaveClass("sr-only");
    const bare = screen.getByTestId("wizard-open-cited").lastElementChild
      ?.firstElementChild as HTMLElement;
    expect(bare.textContent).toBe("2");
    expect(bare).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps the singular at one", () => {
    renderStep({ references: [citation("p-1", "One")] });
    expect(
      within(screen.getByTestId("wizard-seal-acts")).getByText("1 citation"),
    ).toHaveClass("sr-only");
  });

  it("reads act-card labels and counts at the same small type role", () => {
    renderStep({ tags: [tag("fieldnotes")] });
    const label = screen.getByText("Tags");
    const row = label.parentElement as HTMLElement;
    const count = row.lastElementChild as HTMLElement;
    expect(label.className).toContain("text-label-small");
    // The trailing count is the BARE NUMBER the board draws: the word
    // form spent the row's width on a noun the label column already says,
    // and what it spent came out of the value slot. What is DRAWN is the
    // digit; the reading beside it is `sr-only` (item 73).
    expect((count.firstElementChild as HTMLElement).textContent).toBe("1");
    expect(count.className).toContain("text-label-small");
  });

  // CW-27/CW-28: the license sheet carries its own help dot and the
  // boarded row anatomy, not a second LicenseChooser legend and note.
  it("opens the license sheet with its own help dot and the boarded rows", () => {
    const { onLicenseHelp } = renderStep({ license: PUBLIC_DOMAIN }, "license");
    const help = screen.getByRole("button", { name: "License" });
    help.click();
    expect(onLicenseHelp).toHaveBeenCalledOnce();

    expect(screen.getByRole("radiogroup", { name: "Credit" })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Public record of use" })).toBeInTheDocument();
    // LicenseChooser's own legend and note would be a second, duplicate
    // one — the sheet already carries its title and its own note.
    expect(screen.queryByRole("group", { name: "License" })).not.toBeInTheDocument();
    expect(
      screen.queryByText("Terms for anyone who reuses this — not a statement about how you made it."),
    ).not.toBeInTheDocument();
  });

  // CW-36: key absent reads back only the License term — the stance and
  // sensitive rows a live seal still lets a reader adjust are gone.
  it("shows only the License row when the key is absent", () => {
    renderStep({}, "none", false);
    expect(screen.getByTestId("wizard-open-license")).toBeInTheDocument();
    expect(screen.queryByTestId("wizard-open-stance")).not.toBeInTheDocument();
    expect(screen.queryByTestId("wizard-open-sensitive")).not.toBeInTheDocument();
  });

  // FC-8b (copy-voice "The license block"; seam 106.5): the seal's License row
  // reads the author's reading of the pair — its name, then the two hints by
  // the one joining rule — and never `your default`, wherever the terms came
  // from. The sheet's foot reads the same sentence.
  it("the_seal_license_summary_reads_license_name_and_reading", () => {
    renderStep({}, "none", true);
    const row = screen.getByTestId("wizard-open-license").parentElement!;
    expect(row).toHaveTextContent("Public domain — nobody owes you a name, and uses go unlogged.");
    expect(row).not.toHaveTextContent("your default");
  });

  it("names a non-zero pair by its tier names before the reading", () => {
    renderStep({ license: { attribution: 1, provenance: 0 } }, "none", true);
    const row = screen.getByTestId("wizard-open-license").parentElement!;
    expect(row).toHaveTextContent(
      "Credit always · Not logged — every use credits you, and uses go unlogged.",
    );
  });

  it("shows all three terms on a live seal", () => {
    renderStep({}, "none", true);
    expect(screen.getByTestId("wizard-open-license")).toBeInTheDocument();
    expect(screen.getByTestId("wizard-open-stance")).toBeInTheDocument();
    expect(screen.getByTestId("wizard-open-sensitive")).toBeInTheDocument();
  });

  // CW-37/CW-38/CW-41: the key-absent panel carries its own inverse "?" and
  // an inverse restore action, title-medium, no body paragraph.
  it("draws the key-absent panel per the board: inverse help, inverse restore, title-medium, no paragraph", () => {
    const { onKeyHelp, onRestoreKey } = renderStep({}, "none", false);

    const heading = screen.getByText("Your key isn't on this browser");
    expect(heading.className).toContain("text-title-medium");
    expect(
      screen.queryByText("Nothing is spent until you sign. The draft stays on this device."),
    ).not.toBeInTheDocument();

    const help = screen.getByRole("button", { name: "Your key" });
    help.click();
    expect(onKeyHelp).toHaveBeenCalledOnce();

    const restore = screen.getByTestId("wizard-restore-key");
    expect(restore.className).toContain("bg-on-tertiary-container");
    restore.click();
    expect(onRestoreKey).toHaveBeenCalledOnce();
  });

  // CW-39/CW-40: keep-draft is a sibling below the panel, wired to leave
  // the wizard rather than to the seal's ordinary back.
  it("keeps the draft as a sibling below the panel, distinct from Back", () => {
    const { onKeepDraft, onBack } = renderStep({}, "none", false);

    const panel = screen.getByTestId("wizard-key-absent");
    const keepDraft = screen.getByTestId("wizard-keep-draft");
    expect(panel.contains(keepDraft)).toBe(false);

    keepDraft.click();
    expect(onKeepDraft).toHaveBeenCalledOnce();
    expect(onBack).not.toHaveBeenCalled();
  });

  // THE UPLOAD LINE IS STRICTLY THE IN-FLIGHT GATE (design/components/
  // compose/UploadNotice.prompt.md lines 1, 11) — it never draws for an
  // empty batch, and sign stays disabled on `blocked` alone, independent of
  // whether the line itself ever rendered. `renderStep` fixes `blocked` to
  // null, so this exercises `SealStep` directly with the props the wizard
  // passes once `sealGate` refuses an empty media draft.
  it("draws no upload line and still disables sign at an empty media batch", () => {
    const props = {
      state: baseState({ mode: "media", assets: [] }),
      sheet: "none" as SealSheet,
      blocked: "Pick at least one picture.",
      busy: false,
      keyOnDevice: true,
      refusal: null,
      stagedPDirected: 0.1,
      confirmingUnreachable: false,
      onSheet: vi.fn(),
      onLicense: vi.fn(),
      onReferences: vi.fn(),
      onStagedPDirected: vi.fn(),
      onSetStance: vi.fn(),
      onKeepAdjusting: vi.fn(),
      onSetAnyway: vi.fn(),
      onStanceHelp: vi.fn(),
      onSensitive: vi.fn(),
      onSensitiveReason: vi.fn(),
      onHelp: vi.fn(),
      onLicenseHelp: vi.fn(),
      onKeyHelp: vi.fn(),
      onSign: vi.fn(),
      onBack: vi.fn(),
      onRestoreKey: vi.fn(),
      onKeepDraft: vi.fn(),
    };
    render(<SealStep {...props} />);

    expect(screen.queryByText(/^Uploading \d+ of \d+/)).not.toBeInTheDocument();
    expect(screen.getByTestId("wizard-seal-blocked")).toHaveTextContent(
      "Pick at least one picture.",
    );
    expect(screen.getByTestId("wizard-sign")).toBeDisabled();
  });
});
