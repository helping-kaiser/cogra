import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Button, buttonClassName } from "./button";

describe("Button", () => {
  it("renders under its test id and fires onClick", () => {
    const onClick = vi.fn();
    render(
      <Button testId="the_button" onClick={onClick}>
        Go
      </Button>,
    );
    fireEvent.click(screen.getByTestId("the_button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("a disabled button swallows the click", () => {
    const onClick = vi.fn();
    render(
      <Button testId="the_button" disabled onClick={onClick}>
        Go
      </Button>,
    );
    fireEvent.click(screen.getByTestId("the_button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("variant and size pick the shared class strings", () => {
    expect(buttonClassName({ variant: "primary", size: "sm" })).toContain("px-4 py-[5px]");
    expect(buttonClassName({ variant: "outline", size: "lg" })).toContain("border");
    expect(buttonClassName({})).toContain("px-6 py-[9px]");
    expect(buttonClassName({ selfStart: true })).toContain("self-start");
    expect(buttonClassName({})).not.toContain("self-start");
  });

  // The canvas's own measurements: a true 40px/32px pill that never falls below
  // 64px wide, so Next, Set and Done keep their weight. Before this, `lg` drew
  // 36px with 16px of side padding and nothing held the minimum at all.
  it("keeps the pill's stated geometry at both rungs", () => {
    expect(buttonClassName({ size: "lg" })).toContain("min-h-10");
    expect(buttonClassName({ size: "sm" })).toContain("min-h-8");
    for (const size of ["sm", "lg"] as const) {
      expect(buttonClassName({ size })).toContain("min-w-16");
      expect(buttonClassName({ size })).toContain("box-border");
    }
  });

  // THE BORDER IS INSIDE THE HEIGHT (Button.jsx, seam 245 ask 1): every
  // variant wears a 1px border, transparent where it is not drawn, and the
  // label's 20px line + the vertical padding + that border IS the height. The
  // outline drew 42 / 34 when its border rode on a 10px / 6px padding.
  it.each([
    ["lg", 40],
    ["sm", 32],
  ] as const)("every variant draws a true %s height of %ipx", (size, height) => {
    for (const variant of ["primary", "outline", "text"] as const) {
      const classes = buttonClassName({ variant, size }).split(" ");
      const padding = classes
        .map((name) => /^py-\[(\d+)px\]$/.exec(name) ?? /^py-(\d+(?:\.\d+)?)$/.exec(name))
        .find((match) => match !== null);
      expect(padding, `${variant} ${size} padding`).toBeDefined();
      const pad = padding![0].includes("[") ? Number(padding![1]) : Number(padding![1]) * 4;
      // Every variant wears the 1px border, so the arithmetic is one sum.
      expect(classes, `${variant} ${size} border`).toContain("border");
      expect(1 + pad + 20 + pad + 1).toBe(height);
    }
  });

  // Every pressable control wears the state layer, the focus ring and the 48px
  // hit expansion — the 32px rung is legal ONLY because the target is expanded.
  it("wears the state layer, the focus ring and the 48px target", () => {
    for (const size of ["sm", "lg"] as const) {
      const className = buttonClassName({ size });
      expect(className).toContain("cg-state");
      expect(className).toContain("cg-focus");
      expect(className).toContain("cg-hit");
    }
  });

  // design.md §4: the pill is Material's button shape at every size, and it is
  // the one place a full radius belongs — a button that picks up a rung of the
  // shape scale is the drift this asserts against.
  it.each(["sm", "lg"] as const)("is a pill at %s", (size) => {
    expect(buttonClassName({ size })).toContain("rounded-full");
  });

  // The label carries the emphasis on the two unfilled variants, so both take
  // `primary` — an outline button whose label is body colour reads as disabled.
  it.each(["outline", "text"] as const)("%s puts primary on the label", (variant) => {
    expect(buttonClassName({ variant })).toContain("text-primary");
  });

  it("only the filled variant paints a surface", () => {
    expect(buttonClassName({ variant: "primary" })).toContain("bg-primary");
    expect(buttonClassName({ variant: "outline" })).not.toContain("bg-");
    expect(buttonClassName({ variant: "text" })).not.toContain("bg-");
    // `border-outline`, not `border`: every rung now carries `box-border`, and
    // what this asserts is that the text button draws no outline.
    expect(buttonClassName({ variant: "text" })).not.toContain("border-outline");
  });
});
