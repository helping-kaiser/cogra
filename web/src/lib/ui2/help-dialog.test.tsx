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

  it("names the license terms, not the picture you made it with", () => {
    render(<HelpDialog open onClose={vi.fn()} topic={HELP_TOPICS.license} />);
    expect(screen.getByTestId("help-dialog")).toHaveAttribute("aria-label", "License");
    expect(screen.getByText(/can never change, not even by an edit/)).toBeInTheDocument();
  });

  // CW-37: the key-absent seal's own topic, copy-voice.md's browser wording.
  it("names the key story and carries copy-voice's browser wording verbatim", () => {
    render(<HelpDialog open onClose={vi.fn()} topic={HELP_TOPICS.yourKey} />);
    expect(screen.getByTestId("help-dialog")).toHaveAttribute("aria-label", "Your key");
    expect(
      screen.getByText(/Signing needs your key, and it isn't on this browser/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Restore the key with your recovery code to finish/),
    ).toBeInTheDocument();
  });

  // Round 15 (copy-voice, *Your backing on your post*, blessed 2026-10-16):
  // the authoring number is BACKING, title included; "opinion" is the face's.
  it("names the one-axis pad's help Your backing on your post, in backing's words", () => {
    render(<HelpDialog open onClose={vi.fn()} topic={HELP_TOPICS.yourBackingOnYourPost} />);
    expect(screen.getByTestId("help-dialog")).toHaveAttribute("aria-label", "Your backing on your post");
    expect(
      screen.getByText(/^Publishing also signs your backing of your own post — for or against/),
    ).toBeInTheDocument();
    expect(screen.getByText(/An edit adds to it, starting at nothing/)).toBeInTheDocument();
    expect(screen.getByText(/give it an opinion on its face, like anyone's/)).toBeInTheDocument();
    expect(screen.queryByText(/signs your opinion on your own post/)).not.toBeInTheDocument();
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
