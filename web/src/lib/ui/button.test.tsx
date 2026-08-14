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
    expect(buttonClassName({ variant: "primary", size: "sm" })).toContain("px-3 py-1.5");
    expect(buttonClassName({ variant: "outline", size: "lg" })).toContain("border");
    expect(buttonClassName({})).toContain("px-4 py-2");
    expect(buttonClassName({ selfStart: true })).toContain("self-start");
    expect(buttonClassName({})).not.toContain("self-start");
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
    expect(buttonClassName({ variant: "text" })).not.toContain("border");
  });
});
