import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HelpDot } from "./help-dot";

describe("HelpDot", () => {
  it("is named by what it explains", () => {
    render(<HelpDot ariaLabel="License" onOpen={vi.fn()} testId="license-help" />);
    expect(screen.getByRole("button", { name: "License" })).toBeInTheDocument();
  });

  it("opens on press", () => {
    const onOpen = vi.fn();
    render(<HelpDot ariaLabel="License" onOpen={onOpen} testId="license-help" />);
    screen.getByTestId("license-help").click();
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("is drawn at 32px and tapped at 48", () => {
    render(<HelpDot ariaLabel="License" onOpen={vi.fn()} testId="license-help" />);
    const button = screen.getByTestId("license-help");
    expect(button.className).toContain("size-8");
    expect(button.className).toContain("cg-hit");
  });

  // CW-37: on a tonal panel the ring takes the panel's own currentColor
  // rather than the page's border/primary pair — a second colour family
  // arguing with the panel's own (HelpDot.jsx:10-16).
  it("rings in currentColor on a tonal panel, not the page's border/primary pair", () => {
    render(<HelpDot ariaLabel="Your key" onOpen={vi.fn()} testId="key-help" variant="inverse" />);
    const button = screen.getByTestId("key-help");
    expect(button.className).toContain("border-current");
    expect(button.className).not.toContain("border-outline-variant");
    expect(button.className).not.toContain("text-primary");
  });

  it("rings in the page pair by default", () => {
    render(<HelpDot ariaLabel="License" onOpen={vi.fn()} testId="license-help" />);
    const button = screen.getByTestId("license-help");
    expect(button.className).toContain("border-outline-variant");
    expect(button.className).toContain("text-primary");
  });
});
