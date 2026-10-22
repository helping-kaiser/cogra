import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HelpDot } from "./help-dot";

const ring = (button: HTMLElement) => button.querySelector("span[aria-hidden='true']") as HTMLElement;

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

  // `HelpDot.jsx`: the button is `--touch-target-min` square and the ring is
  // a 32px span centred inside it — the layout takes 48, not 32.
  it("is a 48px target with the ring drawn 32px inside it", () => {
    render(<HelpDot ariaLabel="License" onOpen={vi.fn()} testId="license-help" />);
    const button = screen.getByTestId("license-help");
    expect(button.className).toContain("size-12");
    expect(ring(button).className).toContain("size-8");
  });

  // CW-37: on a tonal panel the ring takes the panel's own currentColor
  // rather than the page's border/primary pair — a second colour family
  // arguing with the panel's own (HelpDot.jsx:10-16).
  it("rings in currentColor on a tonal panel, not the page's border/primary pair", () => {
    render(<HelpDot ariaLabel="Your key" onOpen={vi.fn()} testId="key-help" variant="inverse" />);
    const button = screen.getByTestId("key-help");
    expect(ring(button).className).toContain("border-current");
    expect(ring(button).className).not.toContain("border-outline-variant");
    expect(ring(button).className).not.toContain("text-primary");
  });

  it("rings in the page pair by default", () => {
    render(<HelpDot ariaLabel="License" onOpen={vi.fn()} testId="license-help" />);
    const button = screen.getByTestId("license-help");
    expect(ring(button).className).toContain("border-outline-variant");
    expect(ring(button).className).toContain("text-primary");
  });
});
