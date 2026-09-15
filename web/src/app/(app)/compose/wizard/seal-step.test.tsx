import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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
) {
  const props = {
    state: baseState(overrides),
    sheet,
    blocked: null,
    busy: false,
    keyOnDevice,
    refusal: null,
    stagedPDirected: staged,
    onSheet: vi.fn(),
    onLicense: vi.fn(),
    onReferences: vi.fn(),
    onStagedPDirected: vi.fn(),
    onSetStance: vi.fn(),
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

  // An opinion on one's own post is ONE number (jakob, 2026-09-14): the
  // second is census-fixed rather than picked, so the row that read back a
  // pair was showing a figure nobody chose. The face comes from the
  // one-axis table, and the spoken twin names the one axis there is.
  it("reads where the author stands as one number, not a pair", () => {
    renderStep({ pDirected: 0.1 });
    const readout = screen.getByTestId("wizard-stance-value");
    expect(readout.textContent).toContain("+0.10");
    expect(screen.queryByText("+0.10 / +1.00")).not.toBeInTheDocument();
    expect(within(readout).getByText("Nice, For or against +0.10")).toBeInTheDocument();
  });

  it("reads the row's face off the one-axis table, both signs", () => {
    renderStep({ pDirected: -0.9 });
    const readout = screen.getByTestId("wizard-stance-value");
    expect(readout.textContent).toContain("😠");
    expect(
      within(readout).getByText("Really against this, For or against -0.90"),
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

  // CW-31/CW-32/CW-33/CW-34/CW-35 + backlog item 30: the pad is a parked
  // card carrying its own "?", a labelled "Your pick" readout above a drawn
  // one-axis field with its ends named, and Cancel · Set.
  describe("the opinion pad", () => {
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

    it("carries the blessed help topic on its own dot", () => {
      const { onStanceHelp } = renderStep({}, "stance");
      screen.getByTestId("wizard-stance-help").click();
      expect(onStanceHelp).toHaveBeenCalledOnce();
    });

    it("labels the pick and reads the staged value, not the standing one", () => {
      renderStep({ pDirected: 0.1 }, "stance", true, 0.6);
      expect(screen.getByText("Your pick")).toBeInTheDocument();
      const pick = screen.getByTestId("wizard-stance-pick");
      expect(pick.textContent).toContain("😊");
      expect(pick.textContent).toContain("+0.60");
    });

    it("draws the one-axis field with its ends named, never a slider", () => {
      renderStep({}, "stance");
      const field = screen.getByTestId("wizard-stance-field");
      expect(field).toHaveAttribute("aria-label", "For or against");
      expect(field).not.toHaveAttribute("type", "range");
      expect(screen.getByText("Against")).toBeInTheDocument();
      expect(screen.getByText("For")).toBeInTheDocument();
      // The pre-rename wording is not on this surface.
      expect(screen.queryByText("How you stand")).not.toBeInTheDocument();
    });

    it("stages a drag and commits only on Set", () => {
      const { onStagedPDirected, onSetStance, onSheet } = renderStep({}, "stance");
      const field = screen.getByTestId("wizard-stance-field");
      fireEvent.keyDown(field, { key: "ArrowRight" });
      // One arrow press is a twentieth of the axis, carried by ordinary
      // float addition — the same arithmetic the two-axis pad's arrows do.
      expect(onStagedPDirected).toHaveBeenCalledWith(expect.closeTo(0.15, 10));
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
});
