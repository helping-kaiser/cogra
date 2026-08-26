import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { StanceBundle } from "@/lib/stance/stance-data";
import { SeveranceConfirm } from "./severance-confirm";

const STANDING: StanceBundle = {
  current: { pDirected: 0.6, pInterest: 0.4 },
  // Deliberately past the clip: the fold shows (+0.60, +0.40) but the
  // walk back is longer, which is the case §8.5 is about.
  rawSum: { pDirected: 1.6, pInterest: 0.4 },
  records: 2,
  inert: false,
  severed: false,
  severance: { records: 3 },
};

function show(props: Partial<React.ComponentProps<typeof SeveranceConfirm>> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <SeveranceConfirm
      pick={null}
      targetLabel="@ada"
      bundle={STANDING}
      records={3}
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />,
  );
  return { onConfirm, onCancel };
}

describe("the severance confirmation", () => {
  it("opens as a modal, so focus and Esc come from the platform", () => {
    show();
    expect(screen.getByTestId<HTMLDialogElement>("severance-confirm").open).toBe(true);
  });

  it("asks the one question, whichever route reached it", () => {
    show();
    expect(screen.getByTestId("severance-confirm")).toHaveTextContent("Sever this?");
  });

  it("names what severance costs before anything is signed", () => {
    show({ records: 4 });
    expect(screen.getByTestId("severance-cost")).toHaveTextContent(
      "It takes 4 signed actions, each paid for separately.",
    );
  });

  it("counts a single action in the singular", () => {
    show({ records: 1 });
    expect(screen.getByTestId("severance-cost")).toHaveTextContent("It takes 1 signed action,");
  });

  it("says what reaching zero carries with it", () => {
    show();
    const consequences = screen.getByTestId("severance-consequences");
    expect(consequences).toHaveTextContent("stops reaching your feed");
    expect(consequences).toHaveTextContent("stop earning");
    expect(consequences).toHaveTextContent("nothing passes on through you");
  });

  it("states where the reader stands before they decide", () => {
    show();
    expect(screen.getByTestId("severance-standing")).toHaveTextContent("Where you stand now:");
    // The fold, clipped, is what the standing line shows.
    expect(screen.getByTestId("severance-standing")).toHaveTextContent("+0.60 / +0.40");
  });

  it("states the RAW sums, which are what the walk back actually walks", () => {
    // §8.3, §8.5: "every surface that explains cost — the severance
    // confirmation above all — states the raw sums". This bundle folds
    // to (+0.60, +0.40) but sums to (+1.60, +0.40); showing the fold
    // would understate the walk by a whole unit.
    show();
    const raw = screen.getByTestId("severance-raw");
    expect(raw).toHaveTextContent("What you'd be walking back:");
    expect(raw).toHaveTextContent("+1.60 / +0.40");
  });

  it("says there is nothing to walk back where there is no standing", () => {
    show({ bundle: null });
    expect(screen.getByTestId("severance-raw")).toHaveTextContent("haven't taken a stance");
  });

  it("adds the pick line only when a pick reached it", () => {
    show();
    expect(screen.queryByTestId("severance-pick")).toBeNull();
  });

  it("shows the pick that landed here, and asks the same question about it", () => {
    show({ pick: { pDirected: 0, pInterest: 0 }, records: 1 });
    expect(screen.getByTestId("severance-pick")).toBeInTheDocument();
    expect(screen.getByTestId("severance-confirm")).toHaveTextContent("Sever this?");
    expect(screen.getByTestId("severance-proceed")).toHaveTextContent("Sever");
  });

  it("refuses to bill for a bundle already at nothing", () => {
    show({ records: 0, alreadySevered: true });
    expect(screen.getByTestId("severance-cost")).toHaveTextContent(
      "You are already at nothing here.",
    );
    expect(screen.getByTestId("severance-proceed")).toBeDisabled();
  });

  // F7: the confirming action sits on the RIGHT, the platform convention.
  it("puts the confirming action last in the DOM order", () => {
    show();
    const buttons = screen.getByTestId("severance-confirm").querySelectorAll("button");
    expect(buttons[buttons.length - 1]).toBe(screen.getByTestId("severance-proceed"));
    expect(buttons[0]).toBe(screen.getByTestId("severance-cancel"));
  });

  it("keeps the standing when declined", () => {
    const { onCancel, onConfirm } = show();
    fireEvent.click(screen.getByTestId("severance-cancel"));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("proceeds only on the explicit act", () => {
    const { onConfirm } = show();
    fireEvent.click(screen.getByTestId("severance-proceed"));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("cannot be signed twice while the first is in flight", () => {
    const { onConfirm } = show({ busy: true });
    fireEvent.click(screen.getByTestId("severance-proceed"));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("stays up and says so when the signing pass did not complete", () => {
    show({ failed: true });
    expect(screen.getByTestId("severance-failed")).toHaveTextContent("That didn't send");
    expect(screen.getByTestId<HTMLDialogElement>("severance-confirm").open).toBe(true);
  });

  it("dresses a deliberate choice as one, never as a failure", () => {
    show();
    // `error` is for failure; a negative or ended stance is an ordinary
    // legitimate choice (design.md §2.4).
    expect(screen.getByTestId("severance-confirm").innerHTML).not.toContain("error");
  });
});
