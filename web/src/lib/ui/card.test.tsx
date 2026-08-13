import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Card } from "./card";

describe("Card", () => {
  // design.md §2.4: a card is a step up off the page's `surface`, and Android
  // renders the same filled card. An outlined card on the page colour is a
  // different Material component, and it is what web drew before.
  it("steps up off the page ground rather than outlining", () => {
    render(<Card testId="the_card">content</Card>);
    const card = screen.getByTestId("the_card");
    expect(card.className).toContain("bg-surface-container-highest");
    expect(card.className).not.toContain("border");
  });

  it("takes the medium rung of the shape scale", () => {
    render(<Card testId="the_card">content</Card>);
    expect(screen.getByTestId("the_card").className).toContain("rounded-medium");
  });
});
