// EditPad (design/designs/canonical/screens/EditPad.jsx; EditPad.md) — the
// round-15 one-axis pad over a post edit: PICK-IS-THE-EDGE, the three
// readouts, the honest cap, and Walk it all back.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { KNOB_TRAVEL_INSET_PX, valenceTravelHalfExtent } from "@/lib/stance/pad-geometry";

import { BackingEditPad } from "./backing-edit-pad";

function renderPad({ pick = 0, rawSum = 0.1 as number | null } = {}) {
  const props = {
    onSet: vi.fn(),
    onClose: vi.fn(),
    onHelp: vi.fn(),
  };
  render(
    <BackingEditPad open pick={pick} rawSum={rawSum} testId="pad" {...props} />,
  );
  return props;
}

const text = (id: string) => screen.getByTestId(id).textContent;
const strip = () => screen.getByTestId("pad-field-strip");

describe("EditPad", () => {
  it("is the backing pad, its dot Your backing on your post", () => {
    const { onHelp } = renderPad();
    expect(screen.getByTestId("pad")).toHaveAttribute("aria-label", "Backing pad for your own post");
    const help = screen.getByTestId("pad-help");
    expect(help).toHaveAttribute("aria-label", "Your backing on your post");
    help.click();
    expect(onHelp).toHaveBeenCalledOnce();
  });

  it("offers one axis, For or Against, and never a second", () => {
    renderPad();
    expect(strip()).toHaveAttribute("aria-label", "For or against");
    expect(screen.getByText("Against")).toBeInTheDocument();
    expect(screen.getByText("For")).toBeInTheDocument();
    expect(screen.queryByText("Less")).not.toBeInTheDocument();
    expect(screen.queryByText("More")).not.toBeInTheDocument();
  });

  // PICK-IS-THE-EDGE: the pad opens at the edit's own pick, 0.00 unmoved.
  it("opens at the edit's pick — 0.00, 🤔, when unmoved", () => {
    renderPad({ pick: 0, rawSum: 0.1 });
    expect(text("pad-pick-face")).toBe("🤔");
    expect(text("pad-pick-exact")).toBe("+0.00");
    expect(strip()).toHaveAttribute("aria-valuenow", "0");
  });

  it("reads Current backing and Your pick above the strip and Backing after below, never merged", () => {
    renderPad({ pick: 0.3, rawSum: 0.1 });
    // The board's own fixture: +0.10 standing, +0.30 picked, +0.40 after.
    expect(within(screen.getByTestId("pad-current")).getByText("Current backing")).toBeInTheDocument();
    expect(text("pad-current-exact")).toBe("+0.10");
    expect(within(screen.getByTestId("pad-pick")).getByText("Your pick")).toBeInTheDocument();
    expect(text("pad-pick-exact")).toBe("+0.30");
    expect(within(screen.getByTestId("pad-after")).getByText("Backing after")).toBeInTheDocument();
    expect(text("pad-after-exact")).toBe("+0.40");
    // Order: current, pick, strip, after.
    const order = ["pad-current", "pad-pick", "pad-field-strip", "pad-after"].map((id) =>
      screen.getByTestId(id),
    );
    for (let i = 1; i < order.length; i += 1) {
      expect(order[i - 1]!.compareDocumentPosition(order[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it("follows the pick as the strip moves, the after with it, and stages nothing", () => {
    const { onSet } = renderPad({ pick: 0, rawSum: 0.1 });
    fireEvent.keyDown(strip(), { key: "ArrowRight" });
    expect(text("pad-pick-exact")).toBe("+0.05");
    expect(text("pad-after-exact")).toBe("+0.15");
    expect(onSet).not.toHaveBeenCalled();
  });

  it("folds the RAW sum: past the cap the after is clipped and the total stated", () => {
    renderPad({ pick: 0.3, rawSum: 1.1 });
    expect(text("pad-current-exact")).toBe("+1.00");
    expect(text("pad-after-exact")).toBe("+1.00");
    expect(text("pad-cap")).toBe("Adds up to +1.40; your feed reads it capped at +1.00.");
  });

  it("draws no cap line while the sum stays inside ±1", () => {
    renderPad({ pick: 0.3, rawSum: 0.1 });
    expect(screen.queryByTestId("pad-cap")).not.toBeInTheDocument();
  });

  it("reads any value of exactly 0.00 as 🤔", () => {
    renderPad({ pick: -0.1, rawSum: 0.1 });
    expect(text("pad-after-face")).toBe("🤔");
  });

  describe("Walk it all back", () => {
    it("stands on the left of the commit row, pushed away from Cancel and Set", () => {
      renderPad();
      const walk = screen.getByTestId("pad-walk-back");
      expect(walk).toHaveTextContent("Walk it all back");
      expect(walk.parentElement!.className).toContain("mr-auto");
      expect(
        walk.compareDocumentPosition(screen.getByTestId("pad-cancel")) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it("parks the pick at the raw sum's opposite, so the after reads 0.00 — no dialog, nothing staged", () => {
      const { onSet, onClose } = renderPad({ pick: 0, rawSum: 0.35 });
      fireEvent.click(screen.getByTestId("pad-walk-back"));
      expect(text("pad-pick-exact")).toBe("−0.35");
      expect(text("pad-after-face")).toBe("🤔");
      expect(text("pad-after-exact")).toBe("+0.00");
      expect(onSet).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });

    it("past ±1 parks as far as one record reaches", () => {
      renderPad({ pick: 0, rawSum: 1.4 });
      fireEvent.click(screen.getByTestId("pad-walk-back"));
      expect(text("pad-pick-exact")).toBe("−1.00");
      expect(text("pad-after-exact")).toBe("+0.40");
    });

    // Two edits' worth of backing (two +1.00 edits over the mint): one
    // walk-back reaches only to +1.00 — the rest is another edit's.
    it("at a raw sum of +2.00 reads capped, and one walk-back still leaves +1.00", () => {
      renderPad({ pick: 0, rawSum: 2 });
      expect(text("pad-current-exact")).toBe("+1.00");
      expect(text("pad-after-exact")).toBe("+1.00");
      expect(text("pad-cap")).toBe("Adds up to +2.00; your feed reads it capped at +1.00.");
      fireEvent.click(screen.getByTestId("pad-walk-back"));
      expect(text("pad-pick-exact")).toBe("−1.00");
      expect(text("pad-after-exact")).toBe("+1.00");
      expect(screen.queryByTestId("pad-cap")).not.toBeInTheDocument();
    });

    it("is greyed and does nothing while the backing already nets 0.00", () => {
      renderPad({ pick: 0.2, rawSum: 0 });
      const walk = screen.getByTestId("pad-walk-back");
      expect(walk).toBeDisabled();
      fireEvent.click(walk);
      expect(text("pad-pick-exact")).toBe("+0.20");
    });
  });

  it("Set hands the staged pick back — at 0.00 too, with no dialog", () => {
    const { onSet } = renderPad({ pick: 0.2, rawSum: 0.1 });
    fireEvent.keyDown(strip(), { key: "ArrowLeft", shiftKey: true });
    fireEvent.click(screen.getByTestId("pad-set"));
    expect(onSet).toHaveBeenCalledWith(0);
    expect(screen.queryByText("Start it unreachable?")).not.toBeInTheDocument();
  });

  // THE PICK PARKS ON A HUNDREDTH (EditPad.md): the knob follows the drag
  // wherever the finger is, and the release lands the pick on the nearest
  // hundredth — so a pick that reads `+0.00` is EXACTLY 0, wears 🤔 "No side taken", and Set
  // hands back the 0 that adds no record (EditPad.md "GIVEN the pick reads
  // 0.00 … NEVER a record is added to the batch").
  describe("release on the hundredths grid", () => {
    const WIDTH = 300;
    const half = valenceTravelHalfExtent({ left: 0, top: 0, width: WIDTH, height: 56 }, KNOB_TRAVEL_INSET_PX);

    /** Drags the strip from x=0 by enough travel to carry `from` to `to`, without letting go. */
    function dragTo(from: number, to: number) {
      strip().getBoundingClientRect = () => new DOMRect(0, 0, WIDTH, 56);
      fireEvent.pointerDown(strip(), { pointerId: 1, clientX: 0, clientY: 0 });
      fireEvent.pointerMove(strip(), { pointerId: 1, clientX: (to - from) * half, clientY: 0 });
    }

    it("follows the finger off the grid mid-drag, then lands on exactly 0 at release", () => {
      const { onSet } = renderPad({ pick: 0.2, rawSum: 0.1 });
      dragTo(0.2, 0.0031);
      // Mid-drag the pick is the float under the thumb: it prints +0.00
      // and is not the zero that wears 🤔 "No side taken".
      expect(text("pad-pick-exact")).toBe("+0.00");
      expect(text("pad-pick-face")).not.toBe("🤔");
      fireEvent.pointerUp(strip(), { pointerId: 1 });
      expect(text("pad-pick-face")).toBe("🤔");
      expect(strip()).toHaveAttribute("aria-valuenow", "0");
      fireEvent.click(screen.getByTestId("pad-set"));
      expect(onSet).toHaveBeenCalledOnce();
      expect(Object.is(onSet.mock.calls[0]![0], 0)).toBe(true);
    });

    it("lands a pick just below zero on +0, never −0", () => {
      const { onSet } = renderPad({ pick: 0, rawSum: 0.1 });
      dragTo(0, -0.0042);
      fireEvent.pointerUp(strip(), { pointerId: 1 });
      fireEvent.click(screen.getByTestId("pad-set"));
      expect(Object.is(onSet.mock.calls[0]![0], 0)).toBe(true);
    });

    it("lands anywhere else on the nearest hundredth", () => {
      const { onSet } = renderPad({ pick: 0, rawSum: 0.1 });
      dragTo(0, 0.4371);
      fireEvent.pointerUp(strip(), { pointerId: 1 });
      fireEvent.click(screen.getByTestId("pad-set"));
      expect(onSet).toHaveBeenCalledWith(0.44);
    });

    it("moves nothing on a tap that never travelled", () => {
      const { onSet } = renderPad({ pick: 0.2, rawSum: 0.1 });
      fireEvent.pointerDown(strip(), { pointerId: 1, clientX: 40, clientY: 0 });
      fireEvent.pointerUp(strip(), { pointerId: 1 });
      fireEvent.click(screen.getByTestId("pad-set"));
      expect(onSet).toHaveBeenCalledWith(0.2);
    });

    it("lands a cancelled pointer on the grid too", () => {
      const { onSet } = renderPad({ pick: 0, rawSum: 0.1 });
      dragTo(0, 0.0049);
      fireEvent.pointerCancel(strip(), { pointerId: 1 });
      fireEvent.click(screen.getByTestId("pad-set"));
      expect(Object.is(onSet.mock.calls[0]![0], 0)).toBe(true);
    });
  });

  it("Cancel stages nothing", () => {
    const { onSet, onClose } = renderPad({ pick: 0, rawSum: 0.1 });
    fireEvent.keyDown(strip(), { key: "ArrowRight" });
    fireEvent.click(screen.getByTestId("pad-cancel"));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onSet).not.toHaveBeenCalled();
  });

  // AN UNREAD BACKING: the read of the author's Publish bundle answered none
  // or failed (`fetchPostBacking`). The two readouts that need it stop at a
  // flagged placeholder, and the walk-back — which parks against the raw sum —
  // greys.
  describe("while the backing is unread", () => {
    it("stops Current backing and Backing after at the placeholder and greys the walk-back", () => {
      renderPad({ pick: 0.3, rawSum: null });
      expect(text("pad-current-unread")).toBe("Not readable yet");
      expect(text("pad-after-unread")).toBe("Not readable yet");
      expect(screen.queryByTestId("pad-cap")).not.toBeInTheDocument();
      expect(screen.getByTestId("pad-walk-back")).toBeDisabled();
      // The pick itself is whole: it is the record, and needs no read.
      expect(text("pad-pick-exact")).toBe("+0.30");
    });
  });
});
