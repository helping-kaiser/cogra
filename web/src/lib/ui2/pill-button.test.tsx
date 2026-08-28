import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PillButton, TextAction, pillClassName } from "./pill-button";

describe("pillClassName", () => {
  it("gives a body button the true 40px, 24px padding, and 64px floor the canvas draws", () => {
    const classes = pillClassName({});
    expect(classes).toContain("min-h-10");
    expect(classes).toContain("px-6");
    expect(classes).toContain("min-w-16");
  });

  it("gives a header pill the compact 32px", () => {
    const classes = pillClassName({ size: "sm" });
    expect(classes).toContain("min-h-8");
    expect(classes).toContain("px-4");
  });

  it("puts primary on the label of both unfilled variants, not on a border", () => {
    expect(pillClassName({ variant: "outlined" })).toContain("text-primary");
    expect(pillClassName({ variant: "text" })).toContain("text-primary");
    expect(pillClassName({ variant: "text" })).not.toContain("border");
  });

  it("fills with primary rather than the loudest surface", () => {
    // primaryContainer is spent once per screen, on the compose action and a
    // committed stance — never on an ordinary button.
    expect(pillClassName({ variant: "filled" })).toContain("bg-primary");
    expect(pillClassName({ variant: "filled" })).not.toContain("primary-container");
  });

  it("carries the state and focus behaviour every pressable surface gets", () => {
    expect(pillClassName({})).toContain("cg-state");
    expect(pillClassName({})).toContain("cg-focus");
  });

  it("is a pill at every size", () => {
    expect(pillClassName({ size: "sm" })).toContain("rounded-full");
    expect(pillClassName({ size: "md" })).toContain("rounded-full");
  });
});

describe("PillButton", () => {
  it("performs its action", () => {
    const onClick = vi.fn();
    render(
      <PillButton testId="next" onClick={onClick}>
        Next
      </PillButton>,
    );
    screen.getByTestId("next").click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does nothing while disabled", () => {
    const onClick = vi.fn();
    render(
      <PillButton testId="next" disabled onClick={onClick}>
        Next
      </PillButton>,
    );
    screen.getByTestId("next").click();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("takes a name when its content is a glyph rather than words", () => {
    render(
      <PillButton testId="mute" label="Turn sound on">
        <span aria-hidden="true">x</span>
      </PillButton>,
    );
    expect(screen.getByRole("button", { name: "Turn sound on" })).toBeInTheDocument();
  });
});

describe("TextAction", () => {
  it("is a button, because it acts rather than navigates", () => {
    render(<TextAction testId="show-all">Show all</TextAction>);
    expect(screen.getByRole("button", { name: "Show all" })).toBeInTheDocument();
  });

  it("keeps a 48px target under its 16px of ink", () => {
    render(<TextAction testId="show-all">Show all</TextAction>);
    expect(screen.getByTestId("show-all").className).toContain("cg-hit");
  });
});
