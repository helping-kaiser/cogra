// AvatarSeal.md:3-11 — what the picture's seal reads back. The commit's
// states are the profile seals' shared drawing (`ChangeSeal`), pinned in
// profile-edit-seal.test.tsx; this file pins what is the picture's own.

import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ProfileChangeOutcome } from "@/lib/profile/profile-change";
import { PUBLIC_RECORD_LINE } from "../change-seal";
import { AvatarSeal } from "./avatar-seal";

function draw(sign: () => Promise<ProfileChangeOutcome> = async () => ({ kind: "taken" })) {
  const handlers = { onTaken: vi.fn(), onBack: vi.fn(), onLeave: vi.fn(), onClosed: vi.fn() };
  render(<AvatarSeal avatar={<span data-testid="disc" />} hasKey={async () => true} sign={sign} {...handlers} />);
  return handlers;
}

describe("what the picture's seal reads back", () => {
  it("reads the new picture as one Picture row, 1 picture, 1 thing, signed, with no all-or-nothing line", () => {
    draw();
    expect(screen.getByRole("heading", { name: "What you sign" })).toHaveFocus();
    expect(screen.getByText("Your profile picture")).toBeInTheDocument();
    expect(screen.getByTestId("disc")).toBeInTheDocument();
    const row = screen.getByTestId("avatar-seal-row");
    expect(row).toHaveTextContent("Picture");
    expect(row).toHaveTextContent("A new profile picture");
    const acts = screen.getByTestId("avatar-seal-acts");
    expect(acts).toHaveTextContent("1 thing, signed");
    expect(acts).not.toHaveTextContent(/together|none does/);
  });

  it("stands the public-record line under the acts card", () => {
    draw();
    expect(screen.getByTestId("avatar-seal-record")).toHaveTextContent(PUBLIC_RECORD_LINE);
  });

  it("opens Changing your picture from its ?", () => {
    draw();
    fireEvent.click(screen.getByTestId("avatar-seal-help"));
    expect(screen.getByTestId("avatar-seal-help-dialog")).toHaveAttribute("aria-label", "Changing your picture");
  });

  it("reads Close from the press, and closing never cancels (AvatarSeal.md:47-49)", async () => {
    let answer!: (outcome: ProfileChangeOutcome) => void;
    const handlers = draw(() => new Promise((resolve) => (answer = resolve)));
    await act(async () => {
      fireEvent.click(screen.getByTestId("avatar-seal-sign"));
    });
    expect(screen.getByTestId("avatar-seal-back")).toHaveTextContent("Close");
    fireEvent.click(screen.getByTestId("avatar-seal-back"));
    expect(handlers.onClosed).toHaveBeenCalledTimes(1);
    expect(handlers.onBack).not.toHaveBeenCalled();
    await act(async () => answer({ kind: "taken" }));
  });
});
