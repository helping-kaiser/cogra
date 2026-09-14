import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PUBLIC_DOMAIN } from "@/lib/license";
import { LicenseRows } from "./license-rows";

describe("LicenseRows", () => {
  it("draws a row per tier, each carrying its own hint", () => {
    render(<LicenseRows value={PUBLIC_DOMAIN} onChange={vi.fn()} testIdPrefix="wizard" />);
    expect(screen.getByText("No credit")).toBeInTheDocument();
    expect(screen.getByText("Nobody owes you a name.")).toBeInTheDocument();
    // The provenance tiers are VERBS — what the author chooses is whether the
    // platform logs (copy-voice.md "The author's own tier names").
    expect(screen.getByText("Not logged")).toBeInTheDocument();
    expect(screen.getByText("Uses go unlogged.")).toBeInTheDocument();
  });

  it("groups each axis under its own legend, not a shared fieldset legend", () => {
    render(<LicenseRows value={PUBLIC_DOMAIN} onChange={vi.fn()} testIdPrefix="wizard" />);
    expect(screen.getByRole("radiogroup", { name: "Credit" })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Public record of use" })).toBeInTheDocument();
    // Neither of `LicenseChooser`'s own words appears: this sheet already
    // carries its own title and its own "Terms for anyone..." note above.
    expect(screen.queryByText("License")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Terms for anyone who reuses this — not a statement about how you made it."),
    ).not.toBeInTheDocument();
  });

  it("reports the chosen tier on each axis independently", () => {
    render(
      <LicenseRows value={{ attribution: 1, provenance: 0.5 }} onChange={vi.fn()} testIdPrefix="wizard" />,
    );
    expect(screen.getByTestId("wizard-license-attribution-1")).toBeChecked();
    expect(screen.getByTestId("wizard-license-provenance-0.5")).toBeChecked();
  });

  it("picks a tier on the row, merging only that axis into the license", () => {
    const onChange = vi.fn();
    render(<LicenseRows value={PUBLIC_DOMAIN} onChange={onChange} testIdPrefix="wizard" />);
    screen.getByTestId("wizard-license-attribution-1").click();
    expect(onChange).toHaveBeenCalledWith({ attribution: 1, provenance: 0 });
  });
});
