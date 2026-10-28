// The identity row's stance face (ContentRow.jsx `face` → `StanceValue`
// with `showPair={false}`): the face on screen, its word and the exact pair
// spoken — and the word for (0, 0) the row's DATA picks (seam 243).

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ContentRow } from "./content-row";

function face(pDirected: number, pInterest: number, severed?: boolean) {
  render(
    <ContentRow
      title="@sol gave an opinion on you"
      disc={{ kind: "face", pDirected, pInterest, severed }}
      testId="row"
    />,
  );
  return screen.getByRole("img");
}

describe("the identity row's stance face", () => {
  // ContentRow.jsx `face.severed` (seam 245, ask 19): absent or false, a
  // (0, 0) says nothing — the default is no longer the walk-back's word.
  it("speaks a (0, 0) face with no severed flag as Says nothing", () => {
    const img = face(0, 0);
    expect(img).toHaveTextContent("🤷");
    expect(img).toHaveAccessibleName("Says nothing, +0.00 / +0.00");
  });

  it("speaks a severed (0, 0) as Walked back", () => {
    expect(face(0, 0, true)).toHaveAccessibleName("Walked back, +0.00 / +0.00");
  });

  it("thinks at one zero and names the state, never a table face (ProfileStances.md:11)", () => {
    const img = face(0, 0.35);
    expect(img).toHaveTextContent("🤔");
    expect(img).toHaveAccessibleName("Interested, no side taken, +0.00 / +0.35");
  });

  it("reads the table off both zero lines", () => {
    const img = face(0.6, 0.65);
    expect(img).toHaveTextContent("🤩");
    expect(img).toHaveAccessibleName("Really into this, +0.60 / +0.65");
  });
});

describe("the identity row's trailing age", () => {
  it("sets the label-small tracking with its leading (ContentRow.jsx TYPE)", () => {
    render(<ContentRow title="@ada commented on your post" trailing="35m" disc={{ kind: "monogram", name: "Ada" }} testId="row" />);
    const age = screen.getByTestId("row-trailing");
    expect(age.style.letterSpacing).toBe("var(--text-label-small--letter-spacing)");
    expect(age.style.lineHeight).toBe("var(--text-label-small--line-height)");
  });
});
