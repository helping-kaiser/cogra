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
});
