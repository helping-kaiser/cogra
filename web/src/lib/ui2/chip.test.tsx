import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Chip } from "./chip";

describe("Chip", () => {
  it("shows selection in colour, and reports it rather than relying on the colour", () => {
    render(
      <Chip testId="tall" selected onClick={() => {}}>
        Tall 4:5
      </Chip>,
    );
    const chip = screen.getByTestId("tall");
    expect(chip.className).toContain("bg-secondary-container");
    // Colour never carries meaning alone.
    expect(chip).toHaveAttribute("aria-pressed", "true");
  });

  it("draws an unselected chip as a hairline outline", () => {
    render(
      <Chip testId="square" onClick={() => {}}>
        Square 1:1
      </Chip>,
    );
    const chip = screen.getByTestId("square");
    expect(chip.className).toContain("border-outline");
    expect(chip).toHaveAttribute("aria-pressed", "false");
  });

  it("carries no check glyph, which would reflow the row as the reader picks", () => {
    render(
      <Chip testId="tall" selected onClick={() => {}}>
        Tall 4:5
      </Chip>,
    );
    expect(screen.getByTestId("tall").querySelector("svg")).toBeNull();
  });

  it("is drawn at 32px and tapped at 48", () => {
    render(<Chip testId="c">Topic</Chip>);
    const chip = screen.getByTestId("c");
    expect(chip.className).toContain("min-h-8");
    expect(chip.className).toContain("cg-hit");
  });

  it("selects on press", () => {
    const onClick = vi.fn();
    render(
      <Chip testId="c" onClick={onClick}>
        Topic
      </Chip>,
    );
    screen.getByTestId("c").click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("removes itself through a control of its own, not a click target inside the chip", () => {
    const onDismiss = vi.fn();
    render(
      <Chip testId="topic" selected onDismiss={onDismiss} dismissLabel="Remove #coastroad">
        #coastroad
      </Chip>,
    );
    const dismiss = screen.getByRole("button", { name: "Remove #coastroad" });
    dismiss.click();
    expect(onDismiss).toHaveBeenCalledOnce();
    // The dismiss is a sibling, so no button is nested inside another.
    expect(screen.getByTestId("topic").contains(dismiss)).toBe(false);
  });

  it("reports no pressed state when it is not a toggle", () => {
    render(<Chip testId="c">Add a topic</Chip>);
    expect(screen.getByTestId("c")).not.toHaveAttribute("aria-pressed");
  });
});
