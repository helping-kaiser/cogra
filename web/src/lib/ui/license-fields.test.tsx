import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PUBLIC_DOMAIN } from "@/lib/license";
import { LicenseTerms } from "./license-fields";

describe("LicenseTerms — the reader's block", () => {
  it("states both axes by their chooser legends, whatever the pair", () => {
    render(<LicenseTerms license={{ attribution: 1, provenance: 0 }} testId="terms" />);
    expect(screen.getByText("Credit")).toBeInTheDocument();
    expect(screen.getByText("Required for every use")).toBeInTheDocument();
    // The zero axis still stands: a dropped row would read as a shorter
    // license rather than a term that obliges nothing.
    expect(screen.getByText("Public record of use")).toBeInTheDocument();
    expect(screen.getByText("Not logged")).toBeInTheDocument();
  });

  it("speaks to the reuser, never in the author's voice", () => {
    render(<LicenseTerms license={{ attribution: 1, provenance: 1 }} testId="terms" />);
    expect(screen.queryByText("Every use credits you.")).not.toBeInTheDocument();
    expect(screen.getByText("Required for every use")).toBeInTheDocument();
    expect(screen.getByText("Every use logged publicly")).toBeInTheDocument();
  });

  it("names the both-axes-zero pair on the caption line, keeping the rows", () => {
    render(<LicenseTerms license={PUBLIC_DOMAIN} testId="terms" />);
    expect(screen.getByTestId("terms-public-domain")).toHaveTextContent("Public domain");
    expect(screen.getByText("Not required")).toBeInTheDocument();
    expect(screen.getByText("Not logged")).toBeInTheDocument();
  });

  it("reads a degree between the published tiers as the degree itself", () => {
    render(<LicenseTerms license={{ attribution: 0.25, provenance: 0 }} testId="terms" />);
    expect(screen.getByText("Owed to degree 0.25")).toBeInTheDocument();
  });
});
