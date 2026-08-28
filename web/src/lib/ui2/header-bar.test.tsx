import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HeaderBar, HelpButton } from "./header-bar";
import { PillButton } from "./pill-button";

describe("HeaderBar", () => {
  it("names the stage as the page's heading", () => {
    render(<HeaderBar title="Crop" />);
    expect(screen.getByRole("heading", { level: 1, name: "Crop" })).toBeInTheDocument();
  });

  it("owns its band and gives the back arrow a 48px square target", () => {
    render(<HeaderBar title="Crop" onBack={() => {}} testId="header" />);
    // The band is 48px tall and carries its own side padding, so the target
    // cannot bleed off the edge of a surface with no gutter.
    expect(screen.getByTestId("header").className).toContain("min-h-12");
    expect(screen.getByTestId("header").className).toContain("px-3");
    expect(screen.getByTestId("header-back").className).toContain("size-12");
  });

  it("goes back on press, and labels the glyph", () => {
    const onBack = vi.fn();
    render(<HeaderBar title="Details" onBack={onBack} />);
    const back = screen.getByRole("button", { name: "Back" });
    back.click();
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("renders no back control on a screen that has no way back", () => {
    // The recovery-code screen is a trap by design.
    render(<HeaderBar title="Recovery code" />);
    expect(screen.queryByTestId("header-back")).toBeNull();
  });

  it("takes the screen's forward action in its trailing slot", () => {
    render(
      <HeaderBar
        title="Crop"
        onBack={() => {}}
        action={
          <PillButton testId="next" size="sm">
            Next
          </PillButton>
        }
      />,
    );
    expect(screen.getByTestId("next")).toBeInTheDocument();
  });

  it("carries at most one help opener, named for assistive technology", () => {
    const onOpen = vi.fn();
    render(<HeaderBar title="Crop" help={<HelpButton onOpen={onOpen} label="About the crop" />} />);
    const help = screen.getByRole("button", { name: "About the crop" });
    help.click();
    expect(onOpen).toHaveBeenCalledOnce();
  });
});
