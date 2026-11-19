import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { JoinPrompt } from "./join-prompt";

// GuestGate.md:21 — "WHEN tap the scrim or press system Back or Escape -> the
// ask closes AND the read stands where it was". The scrim is the dialog's own
// `::backdrop`, so a tap on it targets the dialog, outside its box.
describe("JoinPrompt", () => {
  it("closes on a tap on its scrim", () => {
    const onClose = vi.fn();
    render(<JoinPrompt open onClose={onClose} />);
    const dialog = screen.getByTestId("join-prompt") as HTMLDialogElement;
    dialog.getBoundingClientRect = () => new DOMRect(40, 300, 320, 180);
    fireEvent.click(dialog, { clientX: 200, clientY: 120 });
    expect(dialog.open).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("stays up on a tap on its own surface's padding", () => {
    const onClose = vi.fn();
    render(<JoinPrompt open onClose={onClose} />);
    const dialog = screen.getByTestId("join-prompt") as HTMLDialogElement;
    dialog.getBoundingClientRect = () => new DOMRect(40, 300, 320, 180);
    fireEvent.click(dialog, { clientX: 200, clientY: 310 });
    expect(dialog.open).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
  });
});
