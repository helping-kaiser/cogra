// DiscardConfirm — the one question asked before a written comment is lost.
//
// What is worth asserting is not that a dialog renders: it is that the
// DESTRUCTIVE answer is never the easy one to reach by accident. Escape keeps
// writing, the safe button carries the emphasis, and the board's two lines both
// appear — the question, and the answer to "does this come back".

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DiscardConfirm } from "./discard-confirm";

function show(open = true) {
  const onKeepWriting = vi.fn();
  const onDiscard = vi.fn();
  render(
    <DiscardConfirm open={open} onKeepWriting={onKeepWriting} onDiscard={onDiscard} />,
  );
  return { onKeepWriting, onDiscard };
}

describe("DiscardConfirm", () => {
  it("asks the board's question and answers what an author actually wonders", () => {
    show();
    const dialog = screen.getByTestId("discard-confirm");
    expect(dialog).toHaveTextContent("Discard this reply?");
    // The second line is not decoration: comments have no drafts, and this is
    // where that is said.
    expect(dialog).toHaveTextContent("Nothing is kept.");
  });

  it("opens as a modal, so the platform supplies the focus trap", () => {
    show();
    expect(screen.getByTestId("discard-confirm")).toHaveAttribute("open");
  });

  it("stays shut until it is opened", () => {
    show(false);
    expect(screen.getByTestId("discard-confirm")).not.toHaveAttribute("open");
  });

  it("keeps writing on Escape — the destructive answer is not a stray keypress", () => {
    const { onKeepWriting, onDiscard } = show();
    fireEvent(screen.getByTestId("discard-confirm"), new Event("cancel", { cancelable: true }));
    expect(onKeepWriting).toHaveBeenCalled();
    expect(onDiscard).not.toHaveBeenCalled();
  });

  it("reports each answer once, and only its own", () => {
    const { onKeepWriting, onDiscard } = show();
    fireEvent.click(screen.getByTestId("discard-confirm-keep"));
    expect(onKeepWriting).toHaveBeenCalledTimes(1);
    expect(onDiscard).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("discard-confirm-discard"));
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });
});
