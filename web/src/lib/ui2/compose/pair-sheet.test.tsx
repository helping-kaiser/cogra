// The composer's pair sheets, clause by clause:
// design/designs/canonical/behavior/TagPadCompose.md and RefPair.md.
//
// jsdom lays nothing out, so a drag is driven against a stubbed field box and
// its expected pick is computed by the same pure map the component asks
// (`pad-geometry`'s ranged forms, pinned in `pad-ranges.test.ts`).

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { nearestAnchor, STANCE_ANCHORS } from "@/lib/stance/anchors";
import type { StancePair } from "@/lib/stance/model";
import {
  KNOB_TRAVEL_INSET_PX,
  rangedPairFrom,
  snapToRanges,
  STANCE_RANGES,
  TAG_RANGES,
  TAG_RELEVANCE_FLOOR,
  type PadRanges,
} from "@/lib/stance/pad-geometry";
import { nearestTagAnchor, TAG_ANCHORS } from "@/lib/topics/anchors";
import { PULL_THRESHOLD } from "@/lib/ui/pull-to-refresh";
import { formatStancePair } from "@/lib/ui/stance-format";
import { formatTagPair } from "@/lib/ui/tag-format";

import { CITATION_FAMILY, PairSheet, TAG_FAMILY } from "./pair-sheet";

const RECT = { left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200, x: 0, y: 0 };

/** The host: holds the pair the sheet edits and whether the sheet is up. */
function Host({
  family,
  initial,
  title,
}: {
  family: typeof TAG_FAMILY;
  initial: StancePair;
  title: string;
}) {
  const [value, setValue] = useState(initial);
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" data-testid="reopen" onClick={() => setOpen(true)}>
        reopen
      </button>
      <PairSheet
        open={open}
        title={title}
        value={value}
        family={family}
        onDone={(pair) => {
          setValue(pair);
          setOpen(false);
        }}
        onDiscard={() => setOpen(false)}
        testId="sheet"
      />
      <output data-testid="value">{JSON.stringify(value)}</output>
      <output data-testid="open">{String(open)}</output>
    </>
  );
}

const held = (): StancePair => JSON.parse(screen.getByTestId("value").textContent ?? "null");
const isOpen = () => screen.getByTestId("open").textContent === "true";
const sheet = () => screen.getByTestId("sheet") as HTMLDialogElement;

/** A drag on the field from its centre, by `(dx, dy)` pixels. */
function dragField(dx: number, dy: number, pointerType = "touch") {
  const square = screen.getByTestId("sheet-field-square");
  vi.spyOn(square, "getBoundingClientRect").mockReturnValue(RECT as DOMRect);
  fireEvent.pointerDown(square, { pointerType, pointerId: 1, clientX: 100, clientY: 100 });
  fireEvent.pointerMove(square, { pointerType, pointerId: 1, clientX: 100 + dx, clientY: 100 + dy });
  fireEvent.pointerUp(square, { pointerType, pointerId: 1, clientX: 100 + dx, clientY: 100 + dy });
}

/** Where a released drag parks: the travel's pair, landed on the hundredths grid. */
const expectedDrag = (base: StancePair, dx: number, dy: number, ranges: PadRanges) =>
  snapToRanges(rangedPairFrom(base, RECT, { dx, dy }, KNOB_TRAVEL_INSET_PX, ranges), ranges);

/** A pull on the sheet's own surface — the swipe that drops a drawer. */
function swipeDown() {
  const dialog = sheet();
  fireEvent.pointerDown(dialog, { pointerType: "touch", clientY: 100 });
  fireEvent.pointerMove(dialog, { pointerType: "touch", clientY: 100 + PULL_THRESHOLD * 2 });
  fireEvent.pointerUp(dialog, { pointerType: "touch", clientY: 100 + PULL_THRESHOLD * 2 });
}

/** Escape and system Back both reach a modal dialog as a close request. */
function closeRequest() {
  act(() => sheet().close());
}

/** Set a pair exactly, through the sheet's own non-drag route. */
function setThroughTracks(pair: StancePair) {
  if (screen.queryByTestId("sheet-tracks") === null) {
    fireEvent.click(screen.getByTestId("sheet-exact-route"));
  }
  fireEvent.change(screen.getByTestId("sheet-tracks-directed"), {
    target: { value: String(pair.pDirected) },
  });
  fireEvent.change(screen.getByTestId("sheet-tracks-interest"), {
    target: { value: String(pair.pInterest) },
  });
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("TagPadCompose — a staged tag's pair", () => {
  const TAG_DEFAULT = { pDirected: 0.1, pInterest: 1 };
  const renderTag = (initial: StancePair = TAG_DEFAULT) =>
    render(<Host family={TAG_FAMILY} initial={initial} title="#coastroad" />);

  it("keeps the stage beneath inert: the sheet opens as a modal dialog", () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, "showModal");
    renderTag();
    expect(showModal).toHaveBeenCalled();
    expect(sheet().open).toBe(true);
  });

  it("is titled by the tag it edits", () => {
    renderTag();
    expect(sheet()).toHaveAttribute("aria-label", "#coastroad");
    expect(within(sheet()).getByRole("heading", { level: 2 })).toHaveTextContent("#coastroad");
  });

  it("carries no Un-tag control — its only controls are the exact route and Done", () => {
    renderTag();
    const buttons = within(sheet()).getAllByRole("button");
    expect(buttons.map((button) => button.dataset.testid)).toEqual([
      "sheet-exact-route",
      "sheet-done",
    ]);
    expect(within(sheet()).queryByRole("button", { name: /un-?tag|withdraw|remove/i })).toBeNull();
  });

  it("stands the pick's readout above the field", () => {
    renderTag();
    const readout = screen.getByTestId("sheet-readout");
    const group = screen.getByTestId("sheet-group");
    expect(readout.compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(readout).toHaveAttribute("aria-live", "polite");
  });

  it("runs relevance across from +0.01 to 1 and confidence up from 0 to 1", () => {
    renderTag();
    // The poles ring the field in the tag's words, relevance across.
    expect(screen.getByTestId("sheet-field-left")).toHaveTextContent("Barely");
    expect(screen.getByTestId("sheet-field-right")).toHaveTextContent("Entirely");
    expect(screen.getByTestId("sheet-field-bottom")).toHaveTextContent("Guessing");
    expect(screen.getByTestId("sheet-field-top")).toHaveTextContent("Certain");
    // Neither slot crosses zero, so no dead-ground line stands on the field.
    expect(screen.queryByTestId("sheet-field-zero-across")).toBeNull();
    expect(screen.queryByTestId("sheet-field-zero-down")).toBeNull();
    // The field's two corners are the two ends of the reach.
    dragField(-1000, 1000);
    expect(held()).toEqual(TAG_DEFAULT);
    fireEvent.click(screen.getByTestId("sheet-done"));
    expect(held()).toEqual({ pDirected: TAG_RELEVANCE_FLOOR, pInterest: 0 });
    fireEvent.click(screen.getByTestId("reopen"));
    dragField(1000, -1000);
    fireEvent.click(screen.getByTestId("sheet-done"));
    expect(held()).toEqual({ pDirected: 1, pInterest: 1 });
    // The non-drag route's tracks hold the same reach.
    fireEvent.click(screen.getByTestId("reopen"));
    fireEvent.click(screen.getByTestId("sheet-exact-route"));
    const directed = screen.getByTestId("sheet-tracks-directed");
    const interest = screen.getByTestId("sheet-tracks-interest");
    expect(directed).toHaveAttribute("min", "0.01");
    expect(directed).toHaveAttribute("max", "1");
    expect(interest).toHaveAttribute("min", "0");
    expect(interest).toHaveAttribute("max", "1");
  });

  it("stands at +0.10 / 1.00 when the author has not set it", () => {
    renderTag();
    expect(screen.getByTestId("sheet-exact")).toHaveTextContent("+0.10 / 1.00");
    const knob = screen.getByTestId("sheet-field-knob");
    expect(knob.style.top).toBe("0%");
    expect(parseFloat(knob.style.left)).toBeCloseTo(((0.1 - 0.01) / 0.99) * 100, 5);
  });

  it("reads the nearest of the tag's thirteen anchors beside the exact pair, never a stance face", () => {
    renderTag();
    const tagObjects = new Set(TAG_ANCHORS.map((anchor) => anchor.emoji));
    const stanceFaces = new Set(STANCE_ANCHORS.map((anchor) => anchor.emoji));
    // Both numbers non-zero: the thirteen objects read it.
    for (const relevance of [0.01, 0.3, 0.6, 0.86, 1]) {
      for (const confidence of [0.4, 0.75, 0.95]) {
        setThroughTracks({ pDirected: relevance, pInterest: confidence });
        const face = screen.getByTestId("sheet-face").textContent ?? "";
        expect(face).toBe(nearestTagAnchor(relevance, confidence).emoji);
        expect(tagObjects.has(face)).toBe(true);
        expect(stanceFaces.has(face)).toBe(false);
        expect(screen.getByTestId("sheet-exact")).toHaveTextContent(formatTagPair(relevance, confidence));
      }
    }
  });

  it("thinks at zero certainty, naming it, never one of the thirteen (faces follow the value)", () => {
    // The expectation is the rule's (tagReadout's), not the bare table's:
    // a checker computed from the table would wrongly pass a 🎣 here.
    renderTag();
    for (const relevance of [0.01, 0.6, 1]) {
      setThroughTracks({ pDirected: relevance, pInterest: 0 });
      expect(screen.getByTestId("sheet-face")).toHaveTextContent("🤔");
      expect(screen.getByTestId("sheet-spoken")).toHaveTextContent("Your pick: no certainty at all.");
    }
  });

  it("speaks the anchor's word and both axes with their values", () => {
    renderTag();
    expect(screen.getByTestId("sheet-spoken")).toHaveTextContent(
      `Your pick: ${nearestTagAnchor(0.1, 1).label}. How much it is about this +0.10, How sure you are 1.00`,
    );
  });

  it("follows a drag, never takes relevance below +0.01, and signs nothing", () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    renderTag();
    dragField(30, 40);
    const moved = expectedDrag(TAG_DEFAULT, 30, 40, TAG_RANGES);
    expect(screen.getByTestId("sheet-exact")).toHaveTextContent(
      formatTagPair(moved.pDirected, moved.pInterest),
    );
    // The drag stays in the sheet: nothing has reached the host yet.
    expect(held()).toEqual(TAG_DEFAULT);

    dragField(-1000, 0);
    expect(screen.getByTestId("sheet-exact")).toHaveTextContent(/^\+0\.01 \//);
    fireEvent.click(screen.getByTestId("sheet-done"));
    expect(held().pDirected).toBe(TAG_RELEVANCE_FLOOR);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("lands the released pair on the hundredths grid, never below the relevance floor", () => {
    renderTag();
    const half = 200 / 2 - KNOB_TRAVEL_INSET_PX;
    const perX = (1 - TAG_RELEVANCE_FLOOR) / (2 * half);
    const perY = 1 / (2 * half);
    // Relevance to 0.0137 and confidence to 0.4371 under the thumb.
    const dx = (0.0137 - TAG_DEFAULT.pDirected) / perX;
    const dy = -(0.4371 - TAG_DEFAULT.pInterest) / perY;
    dragField(dx, dy);
    fireEvent.click(screen.getByTestId("sheet-done"));
    expect(held()).toEqual({ pDirected: 0.01, pInterest: 0.44 });
  });

  it("owns its pointers — a downward drag on the field moves the knob, never drops the sheet", () => {
    renderTag();
    dragField(0, PULL_THRESHOLD * 3);
    expect(isOpen()).toBe(true);
    expect(sheet().open).toBe(true);
  });

  it("closes on Done, and the chip carries the pair it was given", () => {
    renderTag();
    dragField(50, 60);
    const moved = expectedDrag(TAG_DEFAULT, 50, 60, TAG_RANGES);
    fireEvent.click(screen.getByTestId("sheet-done"));
    expect(isOpen()).toBe(false);
    expect(held()).toEqual(moved);
  });

  it("closes on a scrim tap and keeps the pair it had", () => {
    renderTag();
    dragField(50, 60);
    fireEvent.click(sheet());
    expect(isOpen()).toBe(false);
    expect(held()).toEqual(TAG_DEFAULT);
    // Nothing staged in the sheet survives into the next opening.
    fireEvent.click(screen.getByTestId("reopen"));
    expect(screen.getByTestId("sheet-exact")).toHaveTextContent("+0.10 / 1.00");
  });

  it("closes on a swipe down and keeps the pair it had", () => {
    renderTag();
    dragField(50, 60);
    swipeDown();
    expect(isOpen()).toBe(false);
    expect(held()).toEqual(TAG_DEFAULT);
  });

  it("closes on Escape or system Back and keeps the pair it had", () => {
    renderTag();
    setThroughTracks({ pDirected: 0.7, pInterest: 0.2 });
    closeRequest();
    expect(isOpen()).toBe(false);
    expect(held()).toEqual(TAG_DEFAULT);
    fireEvent.click(screen.getByTestId("reopen"));
    expect(screen.getByTestId("sheet-exact")).toHaveTextContent("+0.10 / 1.00");
  });

  it("lands focus on its non-drag route, which swaps the field for bounded tracks in place", () => {
    renderTag();
    const route = screen.getByTestId("sheet-exact-route");
    expect(document.activeElement).toBe(route);
    expect(route).toHaveTextContent("Set exact values for #coastroad");
    expect(route.className).toContain("sr-only");
    expect(route.className).toContain("focus:not-sr-only");

    fireEvent.click(route);
    expect(screen.queryByTestId("sheet-field")).toBeNull();
    fireEvent.change(screen.getByTestId("sheet-tracks-directed"), { target: { value: "0.5" } });
    expect(screen.getByTestId("sheet-exact")).toHaveTextContent("+0.50 / 1.00");

    // Typing is one tap away, and a typed value is held to the same reach.
    fireEvent.click(screen.getByTestId("sheet-tracks-swap"));
    const typed = screen.getByTestId("sheet-tracks-directed");
    expect(typed).toHaveAttribute("type", "number");
    fireEvent.change(typed, { target: { value: "-3" } });
    expect(screen.getByTestId("sheet-exact")).toHaveTextContent("+0.01 / 1.00");
    // A third decimal lands on the nearest hundredth, as a released drag does.
    fireEvent.change(screen.getByTestId("sheet-tracks-interest"), { target: { value: "0.437" } });
    expect(screen.getByTestId("sheet-exact")).toHaveTextContent("+0.01 / 0.44");

    fireEvent.click(screen.getByTestId("sheet-done"));
    expect(held()).toEqual({ pDirected: 0.01, pInterest: 0.44 });
  });
});

describe("RefPair — a staged citation's pair", () => {
  const REF_DEFAULT = { pDirected: 0.1, pInterest: 0.1 };
  const TITLE = "The long way home — @ada";
  const renderRef = (initial: StancePair = REF_DEFAULT) =>
    render(<Host family={CITATION_FAMILY} initial={initial} title={TITLE} />);

  it("keeps the surface beneath inert: the sheet opens as a modal dialog", () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, "showModal");
    renderRef();
    expect(showModal).toHaveBeenCalled();
    expect(sheet().open).toBe(true);
  });

  it("is titled by the citation it edits", () => {
    renderRef();
    expect(sheet()).toHaveAttribute("aria-label", TITLE);
    expect(within(sheet()).getByRole("heading", { level: 2 })).toHaveTextContent(TITLE);
    expect(within(sheet()).queryByRole("button", { name: /remove|withdraw/i })).toBeNull();
  });

  it("stands the pick's readout above the field", () => {
    renderRef();
    const readout = screen.getByTestId("sheet-readout");
    const group = screen.getByTestId("sheet-group");
    expect(readout.compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(readout).toHaveAttribute("aria-live", "polite");
  });

  it("runs relevance across and support up, each from −1 to +1", () => {
    renderRef();
    expect(screen.getByTestId("sheet-field-left")).toHaveTextContent("Barely");
    expect(screen.getByTestId("sheet-field-right")).toHaveTextContent("Entirely");
    expect(screen.getByTestId("sheet-field-bottom")).toHaveTextContent("Against");
    expect(screen.getByTestId("sheet-field-top")).toHaveTextContent("For");
    // Both slots cross zero, so both dead-ground lines are drawn.
    expect(screen.getByTestId("sheet-field-zero-across")).toBeInTheDocument();
    expect(screen.getByTestId("sheet-field-zero-down")).toBeInTheDocument();
    dragField(-1000, 1000);
    fireEvent.click(screen.getByTestId("sheet-done"));
    expect(held()).toEqual({ pDirected: -1, pInterest: -1 });
    fireEvent.click(screen.getByTestId("reopen"));
    dragField(1000, -1000);
    fireEvent.click(screen.getByTestId("sheet-done"));
    expect(held()).toEqual({ pDirected: 1, pInterest: 1 });
    fireEvent.click(screen.getByTestId("reopen"));
    fireEvent.click(screen.getByTestId("sheet-exact-route"));
    for (const id of ["sheet-tracks-directed", "sheet-tracks-interest"]) {
      expect(screen.getByTestId(id)).toHaveAttribute("min", "-1");
      expect(screen.getByTestId(id)).toHaveAttribute("max", "1");
    }
  });

  it("stands at +0.10 / +0.10 when the author has not set it", () => {
    renderRef();
    expect(screen.getByTestId("sheet-exact")).toHaveTextContent("+0.10 / +0.10");
    const knob = screen.getByTestId("sheet-field-knob");
    expect(knob.style.left).toBe("55%");
    expect(knob.style.top).toBe("45%");
  });

  it("reads the nearest stance anchor's face beside the exact pair, never the anchor's word", () => {
    renderRef();
    for (const pair of [
      REF_DEFAULT,
      { pDirected: -0.8, pInterest: 0.6 },
      { pDirected: 0.9, pInterest: -0.9 },
    ]) {
      setThroughTracks(pair);
      const anchor = nearestAnchor(pair);
      expect(screen.getByTestId("sheet-face")).toHaveTextContent(anchor.emoji);
      expect(screen.getByTestId("sheet-exact")).toHaveTextContent(formatStancePair(pair));
      expect(screen.getByTestId("sheet-spoken").textContent).not.toContain(anchor.label);
    }
  });

  it("shrugs at (0, 0) and thinks at one zero, never a table face (faces follow the value)", () => {
    // The expectations are the rule's: the bare table would answer 🙂 at
    // the origin and 🙂/👀 on the zero lines.
    renderRef();
    for (const [pair, face] of [
      [{ pDirected: 0, pInterest: 0 }, "🤷"],
      [{ pDirected: 0, pInterest: 0.6 }, "🤔"],
      [{ pDirected: -0.5, pInterest: 0 }, "🤔"],
    ] as const) {
      setThroughTracks(pair);
      expect(screen.getByTestId("sheet-face")).toHaveTextContent(face);
      expect(screen.getByTestId("sheet-exact")).toHaveTextContent(formatStancePair(pair));
    }
  });

  it("speaks both axes with their values", () => {
    renderRef();
    expect(screen.getByTestId("sheet-spoken")).toHaveTextContent(
      "Your pick: How much it leans on this +0.10, For or against +0.10",
    );
  });

  it("follows a drag and signs nothing", () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    renderRef();
    dragField(-40, 25);
    const moved = expectedDrag(REF_DEFAULT, -40, 25, STANCE_RANGES);
    expect(screen.getByTestId("sheet-exact")).toHaveTextContent(formatStancePair(moved));
    expect(held()).toEqual(REF_DEFAULT);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("closes on Done, and the staged citation carries the pair it was given", () => {
    renderRef();
    dragField(-40, 25);
    const moved = expectedDrag(REF_DEFAULT, -40, 25, STANCE_RANGES);
    fireEvent.click(screen.getByTestId("sheet-done"));
    expect(isOpen()).toBe(false);
    expect(held()).toEqual(moved);
  });

  it("closes on a scrim tap and keeps the pair it had", () => {
    renderRef();
    dragField(-40, 25);
    fireEvent.click(sheet());
    expect(isOpen()).toBe(false);
    expect(held()).toEqual(REF_DEFAULT);
    fireEvent.click(screen.getByTestId("reopen"));
    expect(screen.getByTestId("sheet-exact")).toHaveTextContent("+0.10 / +0.10");
  });

  it("closes on a swipe down, Escape or system Back and keeps the pair it had", () => {
    renderRef();
    dragField(-40, 25);
    swipeDown();
    expect(isOpen()).toBe(false);
    expect(held()).toEqual(REF_DEFAULT);

    fireEvent.click(screen.getByTestId("reopen"));
    dragField(70, -10);
    closeRequest();
    expect(isOpen()).toBe(false);
    expect(held()).toEqual(REF_DEFAULT);
  });

  it("lands focus on its non-drag route, named for the citation", () => {
    renderRef();
    const route = screen.getByTestId("sheet-exact-route");
    expect(document.activeElement).toBe(route);
    expect(route).toHaveTextContent(`Set exact values for ${TITLE}`);
  });
});
