import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { emptyWizard, type WizardState } from "@/lib/compose/wizard";
import { newReferenceDraft } from "@/lib/references/draft";
import { PUBLIC_DOMAIN } from "@/lib/license";
import { SealStep } from "./seal-step";

function baseState(overrides: Partial<WizardState> = {}): WizardState {
  return { ...emptyWizard(), title: "Salt maps of the coast road", ...overrides };
}

function renderStep(overrides: Partial<WizardState> = {}, sheet: "none" | "license" | "stance" | "sensitive" = "none") {
  const props = {
    state: baseState(overrides),
    sheet,
    blocked: null,
    busy: false,
    keyOnDevice: true,
    refusal: null,
    onSheet: vi.fn(),
    onLicense: vi.fn(),
    onPDirected: vi.fn(),
    onSensitive: vi.fn(),
    onSensitiveReason: vi.fn(),
    onHelp: vi.fn(),
    onLicenseHelp: vi.fn(),
    onSign: vi.fn(),
    onBack: vi.fn(),
    onRestoreKey: vi.fn(),
  };
  render(<SealStep {...props} />);
  return props;
}

describe("SealStep", () => {
  // CW-22: the label is "Tags", and each one reads back as a readout chip —
  // never a joined string.
  it("reads tags back as chips under the label 'Tags'", () => {
    renderStep({ tags: [{ name: "fieldnotes" }, { name: "coastroad" }] });
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
    expect(screen.getByText("The long way home — @ada")).toBeInTheDocument();
    expect(screen.queryByText("1 cited")).not.toBeInTheDocument();
    expect(screen.getAllByText("+0.10 / +0.10").length).toBeGreaterThan(0);
  });

  // CW-23: the "Where you stand on it" row reads back the two-axis pair —
  // pInterest is census-fixed at 1 for a Publish record — not a bare
  // signed decimal.
  it("reads where the author stands as a pair, not a lone signed number", () => {
    renderStep({ pDirected: 0.1 });
    expect(screen.getByText("+0.10 / +1.00")).toBeInTheDocument();
  });

  // CW-24/CW-25: the acts card's total row is its own column (label +
  // all-or-nothing note stacked), and the per-act rows both read at
  // text-label-small.
  it("stacks the signed-actions total over its all-or-nothing note", () => {
    renderStep({ tags: [{ name: "fieldnotes" }] });
    const total = screen.getByTestId("wizard-signed-actions");
    const row = total.parentElement;
    expect(row?.className).toContain("flex-col");
    expect(row?.className).toContain("min-h-12");
    expect(screen.getByText("they land together, or none does")).toBeInTheDocument();
  });

  it("reads act-card labels and counts at the same small type role", () => {
    renderStep({ tags: [{ name: "fieldnotes" }] });
    const label = screen.getByText("Tags");
    const row = label.parentElement as HTMLElement;
    const count = row.lastElementChild as HTMLElement;
    expect(label.className).toContain("text-label-small");
    expect(count.textContent).toBe("1 action");
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
});
