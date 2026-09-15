import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PUBLIC_DOMAIN } from "@/lib/license";
import { LicenseSheet } from "./license-sheet";

describe("LicenseSheet", () => {
  // Raised from a comment's menu this comes up over the comments thread — a
  // sheet over a sheet — and takes the next tonal rung (`CommentLicense.jsx`,
  // design/readme.md:2364).
  it("takes the stacked tone when raised from inside another sheet", () => {
    render(
      <LicenseSheet open onClose={() => {}} license={PUBLIC_DOMAIN} testId="license-sheet" stacked />,
    );
    expect(screen.getByTestId("license-sheet").className).toContain(
      "bg-surface-container-highest",
    );
  });

  it("stays at its own rung when raised over the page", () => {
    render(<LicenseSheet open onClose={() => {}} license={PUBLIC_DOMAIN} testId="license-sheet" />);
    expect(screen.getByTestId("license-sheet").className).not.toContain(
      "bg-surface-container-highest",
    );
  });
});
