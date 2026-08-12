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
});
