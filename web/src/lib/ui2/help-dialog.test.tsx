import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HelpDialog, HELP_TOPICS } from "./help-dialog";

describe("HelpDialog", () => {
  it("is named by its topic, so a reader knows what opened", () => {
    render(<HelpDialog open onClose={vi.fn()} topic={HELP_TOPICS.signedActions} />);
    expect(screen.getByTestId("help-dialog")).toHaveAttribute("aria-label", "Signed actions");
  });

  it("carries the copy-voice text verbatim", () => {
    render(<HelpDialog open onClose={vi.fn()} topic={HELP_TOPICS.describingPictures} />);
    expect(
      screen.getByText(/a picture without a description is skipped by screen readers/),
    ).toBeInTheDocument();
  });

  it("says at most two things, per the copy rule", () => {
    for (const topic of Object.values(HELP_TOPICS)) {
      expect(topic.paragraphs.length).toBeLessThanOrEqual(2);
    }
  });

  it("closes, and carries no other choice", () => {
    const onClose = vi.fn();
    render(<HelpDialog open onClose={onClose} topic={HELP_TOPICS.signedActions} />);
    // It explains rather than asks: Close is the only control.
    expect(screen.getAllByRole("button")).toHaveLength(1);
    fireEvent.click(screen.getByTestId("help-dialog-close"));
    expect(onClose).toHaveBeenCalled();
  });
});
