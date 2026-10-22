import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { StanceBundle } from "@/lib/stance/stance-data";
import { SeveranceConfirm } from "./severance-confirm";
import { AFFINITY_AXES } from "./stance-format";

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

// The master is `design/components/stance/SeveranceConfirm.jsx` and its
// prompt: title, the pick line when a pick reached it, the consequences, the
// raw total (the cap only when the sum passed it), the cost in things, the
// failure line, then the walk-back on the left and Keep it, filled, on the
// right.
describe("the severance confirmation", () => {
  it("opens as a modal, so focus and Esc come from the platform", () => {
    show();
    expect(screen.getByTestId<HTMLDialogElement>("severance-confirm").open).toBe(true);
  });

  it("asks the family's one question, whichever route reached it", () => {
    show();
    expect(screen.getByTestId("severance-confirm")).toHaveTextContent("Walk it all back?");
  });

  it("counts the cost in things, before anything is signed", () => {
    show({ records: 4 });
    expect(screen.getByTestId("severance-cost")).toHaveTextContent(
      "It signs 4 things, each paid separately.",
    );
  });

  it("counts a single thing in its own words", () => {
    show({ records: 1 });
    expect(screen.getByTestId("severance-cost")).toHaveTextContent(
      "It signs 1 thing, paid on its own.",
    );
  });

  it("says what reaching zero carries with it", () => {
    show();
    expect(screen.getByTestId("severance-consequences")).toHaveTextContent(
      "Your opinion of @ada drops to nothing. It stops reaching your feed, you stop earning from it, and nothing passes on through you.",
    );
  });

  it("leads with the RAW total, and states the cap only because the sum passed it", () => {
    // §8.3, §8.5 and the master: the total is what the reader built up; the
    // cap is what the feed reads of it. Both paint in both modes — the one
    // exemption from geek mode — so neither sits in a cg-exact span.
    show();
    const raw = screen.getByTestId("severance-raw");
    expect(raw).toHaveTextContent(
      "Everything you've said about @ada adds up to +1.60 / +0.40, and that is what this walks back.",
    );
    expect(raw).toHaveTextContent("Your feed reads it capped at +0.60 / +0.40.");
    expect(raw.querySelector(".cg-exact")).toBeNull();
  });

  it("states no cap where the sum never reached it", () => {
    show({ bundle: { ...STANDING, rawSum: STANDING.current } });
    expect(screen.getByTestId("severance-raw")).not.toHaveTextContent("capped");
  });

  it("says there is no opinion where there is none", () => {
    show({ bundle: null });
    expect(screen.getByTestId("severance-raw")).toHaveTextContent("🤷 No opinion on @ada yet.");
  });

  it("adds the pick line only when a pick reached it", () => {
    show();
    expect(screen.queryByTestId("severance-pick")).toBeNull();
  });

  it("shows the pick that landed here as a face and a pair, its word spoken only", () => {
    show({ pick: { pDirected: -1, pInterest: -1 }, records: 1 });
    const line = screen.getByTestId("severance-pick");
    expect(line).toHaveTextContent("Your pick: 💀 −1.00 / −1.00");
    expect(line.querySelector(".sr-only")).toHaveTextContent(
      "Your pick: Absolutely not, For or against −1.00, How much reaches you −1.00",
    );
    expect(screen.getByTestId("severance-proceed")).toHaveTextContent("Walk it back");
  });

  it("draws a one-zero pick as 🤔 speaking its state, as the pad does", () => {
    show({ pick: { pDirected: -0.6, pInterest: 0 }, records: 1 });
    const line = screen.getByTestId("severance-pick");
    expect(line).toHaveTextContent("Your pick: 🤔 −0.60 / +0.00");
    expect(line.querySelector(".sr-only")).toHaveTextContent(
      "Your pick: Against it, no interest either way",
    );
  });

  it("speaks a (0, 0) pick over an empty sign's standing as Says nothing, never Walked back", () => {
    // The one way a (0, 0) pick reaches this dialog: a standing at (0, 0)
    // that an empty sign left (seam 243, "Also ruled").
    show({
      pick: { pDirected: 0, pInterest: 0 },
      records: 1,
      bundle: { ...STANDING, current: { pDirected: 0, pInterest: 0 }, rawSum: { pDirected: 0, pInterest: 0 }, records: 1, severance: { records: 1 } },
    });
    const spoken = screen.getByTestId("severance-pick").querySelector(".sr-only");
    expect(spoken).toHaveTextContent("Your pick: Says nothing");
    expect(spoken).not.toHaveTextContent("Walked back");
  });

  it("refuses to bill for a bundle already at nothing", () => {
    show({ records: 0, alreadySevered: true });
    expect(screen.getByTestId("severance-cost")).toHaveTextContent(
      "You are already at nothing here.",
    );
    expect(screen.getByTestId("severance-proceed")).toBeDisabled();
  });

  // The destructive-dialog rule: the SAFE action is filled and keeps the
  // right-hand slot; the walk-back is a text button on the left.
  it("puts Keep it, filled, on the right and the walk-back, as text, on the left", () => {
    show();
    const buttons = screen.getByTestId("severance-confirm").querySelectorAll("button");
    expect(buttons[buttons.length - 1]).toBe(screen.getByTestId("severance-cancel"));
    expect(buttons[buttons.length - 2]).toBe(screen.getByTestId("severance-proceed"));
    expect(screen.getByTestId("severance-cancel")).toHaveTextContent("Keep it");
    expect(screen.getByTestId("severance-cancel").className).toContain("bg-primary");
    expect(screen.getByTestId("severance-proceed").className).not.toContain("bg-primary");
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

  it("cannot be signed twice, nor left, while the first is in flight", () => {
    const { onConfirm, onCancel } = show({ busy: true });
    fireEvent.click(screen.getByTestId("severance-proceed"));
    fireEvent.click(screen.getByTestId("severance-cancel"));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    // Locked, never dimmed.
    expect(screen.getByTestId("severance-proceed")).toBeEnabled();
    expect(screen.getByTestId("severance-proceed")).toHaveAttribute("aria-disabled", "true");
  });

  it("says what is happening once the wait passes 200ms", () => {
    show({ busy: true, slow: true });
    expect(screen.getByTestId("severance-proceed")).toHaveTextContent("Walking it back…");
  });

  it("stays up, says so and offers Retry when the signing did not complete", () => {
    show({ failed: true });
    expect(screen.getByTestId("severance-failed")).toHaveTextContent("That didn't send. Try again.");
    expect(screen.getByTestId("severance-failed")).toHaveAttribute("role", "alert");
    expect(screen.getByTestId("severance-proceed")).toHaveTextContent("Retry");
    expect(screen.getByTestId<HTMLDialogElement>("severance-confirm").open).toBe(true);
  });

  it("dresses a deliberate choice as one, never as a failure", () => {
    show();
    // `error` is for failure; a negative or ended stance is an ordinary
    // legitimate choice (design.md §2.4).
    expect(screen.getByTestId("severance-confirm").innerHTML).not.toContain("error");
  });
});

// jakob's I2 ruling (2026-09-15: "we want human wording not this nerdy
// stuff!"). Topics disconnect — the family's own words travel on its axes
// (`AFFINITY_AXES.severance`); the shape is the control's.
describe("the disconnect confirmation (a topic's own words)", () => {
  function showTopic(props: Partial<React.ComponentProps<typeof SeveranceConfirm>> = {}) {
    return show({ targetLabel: "#saltmaps", axes: AFFINITY_AXES, ...props });
  }

  it("asks with the target named", () => {
    showTopic();
    expect(screen.getByTestId("severance-confirm")).toHaveTextContent(
      "Disconnect from #saltmaps?",
    );
  });

  it("says what reaching zero carries with it, in the ruled words", () => {
    showTopic();
    expect(screen.getByTestId("severance-consequences")).toHaveTextContent(
      "You end up with no opinion towards #saltmaps. It stops reaching your feed, you stop earning from it, and nothing passes on through you.",
    );
  });

  it("states the total the ruled way — the raw pair inside one sentence", () => {
    showTopic();
    expect(screen.getByTestId("severance-raw")).toHaveTextContent(
      "Everything you've said about #saltmaps adds up to +1.60 / +0.40, and disconnecting clears all of it.",
    );
  });

  it("names the confirming action Disconnect, and Disconnecting… in flight", () => {
    showTopic();
    expect(screen.getByTestId("severance-proceed")).toHaveTextContent("Disconnect");
  });

  it("keeps 'Keep it' and the cost line shared with every other family", () => {
    showTopic({ records: 4 });
    expect(screen.getByTestId("severance-cancel")).toHaveTextContent("Keep it");
    expect(screen.getByTestId("severance-cost")).toHaveTextContent(
      "It signs 4 things, each paid separately.",
    );
  });
});
