import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HelpDialog, HELP_TOPICS } from "./help-dialog";

describe("HelpDialog", () => {
  // The seal's "?" (copy-voice, *How signing works*), the post's and the reply's.
  it("is named by its topic, so a reader knows what opened", () => {
    render(<HelpDialog open onClose={vi.fn()} topic={HELP_TOPICS.howSigningWorks} />);
    expect(screen.getByTestId("help-dialog")).toHaveAttribute("aria-label", "How signing works");
    expect(screen.getByText(/every tag, every citation — is signed on its own/)).toBeInTheDocument();
    // Payer-neutral by the v1.0.0 scope cut: no copy names who pays.
    expect(screen.getByText("Each signing is paid for — the cost is real, so each one still counts.")).toBeInTheDocument();
  });

  it("carries the copy-voice text verbatim", () => {
    render(<HelpDialog open onClose={vi.fn()} topic={HELP_TOPICS.describingPictures} />);
    expect(
      screen.getByText(/a picture without a description is skipped by screen readers/),
    ).toBeInTheDocument();
    expect(screen.getByText(/A video takes one description for the whole clip/)).toBeInTheDocument();
  });

  it("names the license terms, not the picture you made it with", () => {
    render(<HelpDialog open onClose={vi.fn()} topic={HELP_TOPICS.license} />);
    expect(screen.getByTestId("help-dialog")).toHaveAttribute("aria-label", "License");
    expect(screen.getByText(/can never change, not even by an edit/)).toBeInTheDocument();
  });

  it("says the mark veils the pictures and the words", () => {
    render(<HelpDialog open onClose={vi.fn()} topic={HELP_TOPICS.markingAsSensitive} />);
    expect(screen.getByText(/veils the pictures and the words until a reader/)).toBeInTheDocument();
  });

  // The key-loss round's one text for all four key-absent surfaces.
  it("names the key story and carries copy-voice's browser wording verbatim", () => {
    render(<HelpDialog open onClose={vi.fn()} topic={HELP_TOPICS.yourKey} />);
    expect(screen.getByTestId("help-dialog")).toHaveAttribute("aria-label", "Your key");
    expect(
      screen.getByText("Signing needs your key, and it isn't on this browser — nothing is signed without it."),
    ).toBeInTheDocument();
    expect(screen.getByText(/A recovery code brings the key to any device/)).toBeInTheDocument();
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

  // The italic `(+0.10)` is a `cg-exact` tail (readme §13): the face is drawn
  // either way, the digits only in exact mode, the spoken twin says both.
  it("draws the default backing's digits as an exact-mode tail with a spoken twin", () => {
    render(<HelpDialog open onClose={vi.fn()} topic={HELP_TOPICS.yourBackingOnYourPost} />);
    const tail = screen.getByText("(+0.10)", { exact: false });
    expect(tail).toHaveClass("cg-exact");
    expect(tail).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("Nice, For or against +0.10")).toHaveClass("sr-only");
  });

  it("says at most two things, per the copy rule", () => {
    for (const topic of Object.values(HELP_TOPICS)) {
      expect(topic.paragraphs.length).toBeLessThanOrEqual(2);
    }
  });

  it("closes, and carries no other choice", () => {
    const onClose = vi.fn();
    render(<HelpDialog open onClose={onClose} topic={HELP_TOPICS.howSigningWorks} />);
    // It explains rather than asks: Close is the only control.
    expect(screen.getAllByRole("button")).toHaveLength(1);
    fireEvent.click(screen.getByTestId("help-dialog-close"));
    expect(onClose).toHaveBeenCalled();
  });
});
