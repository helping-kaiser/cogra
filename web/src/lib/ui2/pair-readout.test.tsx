// The reading-side pair edge (ReferenceRow.jsx: "THE PAIRS ARE THE GEEK
// READING"): the face in both modes, the digits in a `cg-exact` span that
// paints only in geek mode, and a spoken twin that never depends on the mode.

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PairReadout } from "./pair-readout";

describe("PairReadout", () => {
  it("draws the digits as the geek reading, the face in both modes", () => {
    render(<PairReadout emoji="😊" exact="+0.60 / +0.35" spoken="Like this, +0.60 / +0.35" pending={false} testId="pr" />);
    expect(screen.getByTestId("pr-exact")).toHaveClass("cg-exact");
    expect(screen.getByTestId("pr-exact")).toHaveTextContent("+0.60 / +0.35");
    expect(screen.getByTestId("pr")).toHaveTextContent("😊");
    expect(screen.getByTestId("pr")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("Like this, +0.60 / +0.35")).toHaveClass("sr-only");
  });

  it("stacks the settling mark under the pair only while the act settles", () => {
    const { rerender } = render(
      <PairReadout emoji="🙂" exact="+0.30 / +0.15" spoken="Nice, +0.30 / +0.15" pending testId="pr" />,
    );
    expect(screen.getByTestId("pr-pending")).toHaveTextContent("Still settling");
    rerender(<PairReadout emoji="🙂" exact="+0.30 / +0.15" spoken="Nice, +0.30 / +0.15" pending={false} testId="pr" />);
    expect(screen.queryByTestId("pr-pending")).toBeNull();
  });
});
