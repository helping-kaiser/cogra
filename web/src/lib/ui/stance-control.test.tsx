import { act, fireEvent, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { DEFAULT_STANCE_INPUT_MODE, writeStanceInputMode } from "@/lib/stance/input-mode";
import { ORIGIN, TAP_DEFAULT } from "@/lib/stance/model";
import { KNOB_TRAVEL_INSET_PX } from "@/lib/stance/pad-geometry";
import { PAD_ANCHOR_GAP_PX } from "@/lib/stance/pad-placement";
import { writeStanceTaught } from "@/lib/stance/stance-coach";
import type { StanceTargetRef } from "@/lib/stance/stance-data";
import { createStubStanceData, type StubStanceOptions } from "@/lib/stance/stub-stance-data";
import { renderWithProviders } from "@/test/providers";
import { PAD_PARK_INSET_PX } from "./pad-parking";
import { NO_STANDING_LABEL, SEVERED_LABEL } from "./stance-readout";
import { LONG_PRESS_MS, PROJECTION_SETTLE_MS, StanceControl } from "./stance-control";

const TARGET: StanceTargetRef = { id: "post-1", kind: "post", label: "this post" };
const PREFIX = "stance-post-1";

/**
 * The 200×200 field the geometry tests use. `hold()` puts the pointer
 * down at (0, 0), so a pointer position below IS the travel from the
 * drag's origin, and HALF of the knob's travel is a full unit.
 */
const FIELD = 200;
const HALF = FIELD / 2 - KNOB_TRAVEL_INSET_PX;

const BUTTON_BOX = { width: 120, height: 48 };

function signedInStore() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "u1" });
  return store;
}

/** The gesture has been met, so a tap acts rather than teaching (§8.7). */
function alreadyTaught() {
  writeStanceTaught();
}

function mount(options: StubStanceOptions = {}, { signedIn = true } = {}) {
  const data = createStubStanceData(options);
  renderWithProviders(<StanceControl target={TARGET} testIdPrefix={PREFIX} />, {
    store: signedIn ? signedInStore() : createTokenStore(),
    stanceData: data,
  });
  return data;
}

const control = () => screen.getByTestId(PREFIX);

/** Rebuilds the target prop on every render, the way the real hosts do. */
function Host() {
  const [, setTick] = useState(0);
  return (
    <>
      <button type="button" data-testid="host-rerender" onClick={() => setTick((t) => t + 1)} />
      <StanceControl
        target={{ id: "post-1", kind: "post", label: "this post" }}
        testIdPrefix={PREFIX}
      />
    </>
  );
}

async function settle(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** Press and hold until the considered gesture opens. */
async function hold() {
  fireEvent.pointerDown(control(), { pointerId: 1, clientX: 0, clientY: 0 });
  await settle(LONG_PRESS_MS + 1);
}

/**
 * The release, which now parks rather than committing (§8.3), followed
 * by the browser's click for the press that held.
 */
async function release() {
  await act(async () => {
    fireEvent.pointerUp(control(), { pointerId: 1 });
    fireEvent.click(control());
  });
}

/** The explicit commit — the only thing on the pad that signs (§8.3). */
async function pressSet() {
  await act(async () => {
    fireEvent.click(screen.getByTestId(`${PREFIX}-set`));
  });
}

/** Drag, let go, and sign — the whole considered gesture. */
async function dragAndSet(clientX: number, clientY: number) {
  layOutPad();
  fireEvent.pointerMove(control(), { pointerId: 1, clientX, clientY });
  await settle();
  await release();
  await pressSet();
}

/**
 * jsdom lays nothing out, so every box the control measures is stubbed by
 * test id. The stub is on the prototype because the pad measures itself
 * in a layout effect, before a test could reach the node to patch it.
 */
type Box = { left?: number; top?: number; width: number; height: number };
const stubbedBoxes = new Map<string, Box>();
const realRect = Element.prototype.getBoundingClientRect;

function stubBox(testId: string, box: Box) {
  stubbedBoxes.set(testId, box);
}

Element.prototype.getBoundingClientRect = function getBoundingClientRect(this: Element): DOMRect {
  const testId = (this as HTMLElement).dataset?.testid;
  const box = testId === undefined ? undefined : stubbedBoxes.get(testId);
  if (box === undefined) return realRect.call(this);
  const left = box.left ?? 0;
  const top = box.top ?? 0;
  return {
    left,
    top,
    width: box.width,
    height: box.height,
    right: left + box.width,
    bottom: top + box.height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
};

function setViewport(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true, writable: true });
  Object.defineProperty(window, "innerHeight", {
    value: height,
    configurable: true,
    writable: true,
  });
}

/** Lay the field out at the size the geometry assertions assume. */
function layOutPad() {
  stubBox(`${PREFIX}-field`, { width: FIELD, height: FIELD });
  return screen.getByTestId(`${PREFIX}-field`);
}

const knob = () => screen.getByTestId(`${PREFIX}-knob`);
const percent = (value: string) => Number(value.replace("%", ""));

beforeEach(() => {
  window.localStorage.clear();
  stubbedBoxes.clear();
  setViewport(1024, 768);
  stubBox(PREFIX, { left: 400, top: 500, ...BUTTON_BOX });
  stubBox(`${PREFIX}-field`, { width: FIELD, height: FIELD });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the stance control at rest", () => {
  it("offers a stance where the viewer holds none", async () => {
    mount();
    await settle();
    expect(control()).toHaveTextContent(NO_STANDING_LABEL);
    expect(control()).toHaveAccessibleName(/Take a stance on this post/);
  });

  it("waits as a muted, translucent face rather than a bare word", async () => {
    // §8.3: "a viewer without one sees a muted, translucent face — the
    // same control at rest, visibly waiting to be given a value — never
    // a bare word."
    mount();
    await settle();
    const affordance = screen.getByTestId(`${PREFIX}-resting-face`);
    expect(affordance).toHaveTextContent("🤷");
    expect(affordance.className).toContain("opacity-40");
    expect(affordance.className).toContain("grayscale");
  });

  it("drops the muting the moment there is a standing to show", async () => {
    mount({ seed: { "post-1": { records: [{ pDirected: 0.55, pInterest: 0.2 }] } } });
    await settle();
    const face = screen.getByTestId(`${PREFIX}-resting-face`);
    expect(face).toHaveTextContent("😊");
    expect(face.className).not.toContain("opacity-40");
  });

  it("shrugs at a standing of exactly nothing rather than borrowing a face", async () => {
    // §8.4: the zero bundle is the absence of a feeling, and the table's
    // nearest neighbour at the origin is "🙂 Nice" — a lie. A bundle
    // folding two records that cancel is a real standing, not an absent
    // one, so it takes the shrug and the severed wording.
    mount({
      seed: {
        "post-1": {
          records: [
            { pDirected: 0.5, pInterest: 0.5 },
            { pDirected: -0.5, pInterest: -0.5 },
          ],
        },
      },
    });
    await settle();
    expect(screen.getByTestId(`${PREFIX}-resting-face`)).toHaveTextContent("🤷");
    expect(control()).not.toHaveTextContent("Nice");
    expect(control()).toHaveTextContent(SEVERED_LABEL);
    expect(control()).toHaveAccessibleName(/Severed, \+0\.00 \/ \+0\.00/);
  });

  it("wears the current standing's face, words, and exact pair", async () => {
    // §8.3: a viewer with a bundle sees its face and folded pair on the
    // resting target itself — the numbers are part of the default
    // reading, not an option behind a setting.
    mount({ seed: { "post-1": { records: [{ pDirected: 0.55, pInterest: 0.2 }] } } });
    await settle();
    expect(control()).toHaveTextContent("Like this");
    // Colour never carries stance alone (design.md §10).
    expect(control()).toHaveTextContent("😊");
    expect(screen.getByTestId(`${PREFIX}-resting-exact`)).toHaveTextContent("+0.55 / +0.20");
  });

  it("puts the standing in the accessible name, numbers included", async () => {
    mount({ seed: { "post-1": { records: [{ pDirected: -0.55, pInterest: 0.25 }] } } });
    await settle();
    expect(control()).toHaveAccessibleName(
      "Your stance on this post: Don't like this, -0.55 / +0.25. Tap to add a positive one.",
    );
  });

  it("shows no numbers where there is no standing to number", async () => {
    mount();
    await settle();
    expect(screen.queryByTestId(`${PREFIX}-resting-exact`)).toBeNull();
  });

  it("keeps the resting target at the 48px minimum", async () => {
    mount();
    await settle();
    expect(control().className).toContain("min-h-12");
    expect(control().className).toContain("min-w-12");
  });

  it("keeps the standing it has when a re-read faults", async () => {
    const data = mount({ seed: { "post-1": { records: [{ pDirected: 0.55, pInterest: 0.2 }] } } });
    await settle();
    const offline = createStubStanceData({ offline: true });
    data.bundle = offline.bundle;
    alreadyTaught();
    await act(async () => {
      fireEvent.click(control());
    });
    await settle();
    // A transient read fault must not blank a standing that is known.
    expect(control()).toHaveTextContent("Like this");
  });
});

describe("teaching the gesture", () => {
  it("teaches on the first tap ever and stages nothing", async () => {
    // §8.7: a tap that stages a priced act must not be the teaching
    // moment's casualty.
    const data = mount();
    await settle();
    await act(async () => {
      fireEvent.click(control());
    });
    expect(screen.getByTestId(`${PREFIX}-coach`)).toBeInTheDocument();
    expect(data.sent).toEqual([]);
    expect(screen.queryByTestId(`${PREFIX}-signed`)).toBeNull();
  });

  it("says outright that nothing was signed", async () => {
    mount();
    await settle();
    await act(async () => {
      fireEvent.click(control());
    });
    expect(screen.getByTestId(`${PREFIX}-coach`)).toHaveTextContent("Nothing was signed just now");
  });

  it("acts on every tap after the first", async () => {
    const data = mount();
    await settle();
    await act(async () => {
      fireEvent.click(control());
    });
    await act(async () => {
      fireEvent.click(control());
    });
    expect(data.sent).toEqual([{ target: "post-1", pick: TAP_DEFAULT }]);
  });

  it("stays until it is dismissed rather than timing out", async () => {
    mount();
    await settle();
    await act(async () => {
      fireEvent.click(control());
    });
    await settle(60_000);
    expect(screen.getByTestId(`${PREFIX}-coach`)).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByTestId(`${PREFIX}-coach-dismiss`));
    });
    expect(screen.queryByTestId(`${PREFIX}-coach`)).toBeNull();
  });

  it("retires on the first successful hold", async () => {
    mount();
    await settle();
    await act(async () => {
      fireEvent.click(control());
    });
    expect(screen.getByTestId(`${PREFIX}-coach`)).toBeInTheDocument();
    await hold();
    expect(screen.queryByTestId(`${PREFIX}-coach`)).toBeNull();
  });

  it("never teaches a viewer who found the hold on their own", async () => {
    const data = mount();
    await settle();
    await hold();
    // Off the origin, or the fold reads the pick as severance and asks
    // rather than committing.
    await dragAndSet(HALF / 2, 0);
    await act(async () => {
      fireEvent.click(control());
    });
    // The hold taught the gesture, so the next tap acts.
    expect(screen.queryByTestId(`${PREFIX}-coach`)).toBeNull();
    expect(data.sent).toHaveLength(2);
  });

  it("anchors clear of the target it teaches about", async () => {
    mount();
    await settle();
    stubBox(`${PREFIX}-coach`, { width: 256, height: 160 });
    await act(async () => {
      fireEvent.click(control());
    });
    const mark = screen.getByTestId(`${PREFIX}-coach`);
    expect(mark.style.position).toBe("fixed");
    // Above a target at y=500: the mark's bottom clears the target.
    expect(mark.dataset.side).toBe("above");
    expect(Number(mark.style.top.replace("px", ""))).toBe(500 - PAD_ANCHOR_GAP_PX - 160);
  });

  it("does not teach an anonymous reader, who is asked to join instead", async () => {
    const data = mount({}, { signedIn: false });
    await settle();
    await act(async () => {
      fireEvent.click(control());
    });
    expect(screen.getByTestId("join-prompt")).toBeInTheDocument();
    expect(screen.queryByTestId(`${PREFIX}-coach`)).toBeNull();
    expect(data.sent).toEqual([]);
  });
});

describe("the tap", () => {
  beforeEach(() => {
    alreadyTaught();
  });

  it("commits the low default verbatim — no delta against the bundle", async () => {
    // A history is present, so a client that folded anything into the
    // written value would send something other than the default.
    const data = mount({ seed: { "post-1": { records: [{ pDirected: 0.4, pInterest: -0.2 }] } } });
    await settle();
    await act(async () => {
      fireEvent.click(control());
    });
    expect(data.sent).toEqual([{ target: "post-1", pick: TAP_DEFAULT }]);
  });

  it("moves the resting target to the pending-inclusive fold at once", async () => {
    // §8.3: the answer is visible before the record lands. The number is
    // the fold's projection, never arithmetic done in the control.
    const data = mount({ seed: { "post-1": { records: [{ pDirected: 0.45, pInterest: 0.1 }] } } });
    await settle();
    expect(screen.getByTestId(`${PREFIX}-resting-exact`)).toHaveTextContent("+0.45 / +0.10");
    await act(async () => {
      fireEvent.click(control());
    });
    expect(screen.getByTestId(`${PREFIX}-resting-exact`)).toHaveTextContent("+0.55 / +0.20");
    expect(control()).toHaveTextContent("Like this");
    expect(data.sent).toHaveLength(1);
  });

  it("confirms the signature on the platform's transient surface", async () => {
    mount();
    await settle();
    // The live region is mounted before it has anything to say, or the
    // announcement is not heard at all.
    expect(screen.getByTestId(`${PREFIX}-signed-region`)).toBeInTheDocument();
    expect(screen.queryByTestId(`${PREFIX}-signed`)).toBeNull();
    await act(async () => {
      fireEvent.click(control());
    });
    // What it says is where the gesture LEFT them, not what they picked
    // (Android's `stance_signed`, PR #443 item 7): the tap's own pair is
    // (+0.10, +0.10) and the standing here folds to the same, but the
    // sentence names the standing and would keep naming it if a prior
    // bundle made the two differ.
    expect(screen.getByTestId(`${PREFIX}-signed`)).toHaveTextContent(
      "Signed, still settling. Where you stand now: How you stand +0.10, In your world +0.10",
    );
  });

  it("names the standing the gesture produced, not the pick that produced it", async () => {
    const data = mount({ seed: { "post-1": { records: [{ pDirected: 0.5, pInterest: 0.4 }] } } });
    await settle();
    await act(async () => {
      fireEvent.click(control());
    });
    // The tap sends (+0.10, +0.10) and the fold answers (+0.60, +0.50) —
    // the receipt carries the second, which is the whole point of naming
    // the standing rather than echoing the pick back.
    expect(data.sent).toEqual([{ target: "post-1", pick: { pDirected: 0.1, pInterest: 0.1 } }]);
    expect(screen.getByTestId(`${PREFIX}-signed`)).toHaveTextContent(
      "Where you stand now: How you stand +0.60, In your world +0.50",
    );
  });

  it("clears the confirmation rather than leaving it on the screen", async () => {
    mount();
    await settle();
    await act(async () => {
      fireEvent.click(control());
    });
    await settle(4001);
    expect(screen.queryByTestId(`${PREFIX}-signed`)).toBeNull();
    expect(screen.getByTestId(`${PREFIX}-signed-region`)).toBeInTheDocument();
  });

  it("re-reads the standing past whatever the last read left behind", async () => {
    // The standing read after a write must not be answered from the copy
    // taken before it, or the gesture reads as having done nothing.
    const data = mount();
    await settle();
    expect(data.freshFlags).toEqual([false]);
    await act(async () => {
      fireEvent.click(control());
    });
    await settle();
    expect(data.freshFlags.slice(1)).toEqual([true]);
  });

  it("takes the projected standing back down when the write does not go through", async () => {
    const data = mount({ seed: { "post-1": { records: [{ pDirected: 0.45, pInterest: 0.1 }] } } });
    await settle();
    const offline = createStubStanceData({ offline: true });
    data.commit = offline.commit;
    await act(async () => {
      fireEvent.click(control());
    });
    await settle();
    expect(screen.getByTestId(`${PREFIX}-resting-exact`)).toHaveTextContent("+0.45 / +0.10");
    expect(screen.getByTestId(`${PREFIX}-error`)).toBeInTheDocument();
  });

  it("asks an anonymous reader to join instead of bouncing the read", async () => {
    const data = mount({}, { signedIn: false });
    await settle();
    await act(async () => {
      fireEvent.click(control());
    });
    expect(screen.getByTestId("join-prompt")).toBeInTheDocument();
    expect(data.sent).toEqual([]);
  });

  it("surfaces a failed write beside the control, not as a read fault", async () => {
    mount({ offline: true });
    await settle();
    await act(async () => {
      fireEvent.click(control());
    });
    expect(screen.getByTestId(`${PREFIX}-error`)).toBeInTheDocument();
    expect(screen.queryByTestId(`${PREFIX}-signed`)).toBeNull();
  });
});

describe("the press-and-hold pad", () => {
  beforeEach(() => {
    alreadyTaught();
  });

  it("blooms at the origin, untilted toward either direction", async () => {
    mount();
    await settle();
    await hold();
    expect(screen.getByTestId(`${PREFIX}-pad`)).toBeInTheDocument();
    expect(knob().style.left).toBe("50%");
    expect(knob().style.top).toBe("50%");
  });

  it("does not open on a plain tap", async () => {
    mount();
    await settle();
    fireEvent.pointerDown(control(), { pointerId: 1, clientX: 0, clientY: 0 });
    await settle(LONG_PRESS_MS - 50);
    fireEvent.pointerUp(control(), { pointerId: 1 });
    await settle();
    expect(screen.queryByTestId(`${PREFIX}-pad`)).toBeNull();
  });

  it("maps horizontal to one parameter and vertical to the other", async () => {
    const data = mount();
    await settle();
    await hold();
    await dragAndSet(HALF / 2, -HALF);
    expect(data.sent).toHaveLength(1);
    expect(data.sent[0].pick.pDirected).toBeCloseTo(0.5, 10);
    expect(data.sent[0].pick.pInterest).toBeCloseTo(1, 10);
  });

  it("reaches the corners at the drawn corners", async () => {
    // §8.3: the drawn field IS the value space, so the extreme values sit
    // where the drawing ends rather than somewhere past it.
    const data = mount();
    await settle();
    await hold();
    layOutPad();
    fireEvent.pointerMove(control(), { pointerId: 1, clientX: -HALF, clientY: HALF });
    await settle();
    expect(percent(knob().style.left)).toBeCloseTo(0, 10);
    expect(percent(knob().style.top)).toBeCloseTo(100, 10);
    await release();
    await pressSet();
    expect(data.sent[0].pick).toEqual({ pDirected: -1, pInterest: -1 });
  });

  it("keeps the knob on the drawing through any pointer sequence", async () => {
    // The adversarial case behind the escaping knob: a drag that leaves
    // the pad entirely, doubles back, and leaves again.
    mount();
    await settle();
    await hold();
    layOutPad();
    const sequence: [number, number][] = [
      [10_000, 10_000],
      [-10_000, -10_000],
      [0, -10_000],
      [10_000, 0],
      [HALF, -HALF],
      [-3, 7],
      [-10_000, 10_000],
      [10_000, -10_000],
    ];
    for (const [clientX, clientY] of sequence) {
      fireEvent.pointerMove(control(), { pointerId: 1, clientX, clientY });
      await settle();
      const x = percent(knob().style.left);
      const y = percent(knob().style.top);
      expect(x, `left at ${clientX},${clientY}`).toBeGreaterThanOrEqual(0);
      expect(x, `left at ${clientX},${clientY}`).toBeLessThanOrEqual(100);
      expect(y, `top at ${clientX},${clientY}`).toBeGreaterThanOrEqual(0);
      expect(y, `top at ${clientX},${clientY}`).toBeLessThanOrEqual(100);
    }
  });

  it("draws the field as a rounded square and travels the knob inside it", async () => {
    mount();
    await settle();
    await hold();
    const field = screen.getByTestId(`${PREFIX}-field`);
    expect(field.className).toContain("rounded-large");
    expect(field.className).not.toContain("rounded-full");
    // The knob's percentages are of a box inset from the field, which is
    // what keeps the knob itself inside the drawn corner.
    const travelBox = knob().parentElement;
    expect(travelBox?.style.inset).toBe(`${KNOB_TRAVEL_INSET_PX}px`);
  });

  it("measures the pick as travel from where the thumb went down", async () => {
    // An absolute mapping would read this as the pad's own centre and
    // pick something else entirely.
    const data = mount();
    await settle();
    fireEvent.pointerDown(control(), { pointerId: 1, clientX: 640, clientY: 480 });
    await settle(LONG_PRESS_MS + 1);
    await dragAndSet(640 + HALF / 2, 480);
    expect(data.sent[0].pick.pDirected).toBeCloseTo(0.5, 10);
    expect(data.sent[0].pick.pInterest).toBeCloseTo(0, 10);
  });

  it("opens at the origin wherever the press landed", async () => {
    mount();
    await settle();
    fireEvent.pointerDown(control(), { pointerId: 1, clientX: 640, clientY: 480 });
    await settle(LONG_PRESS_MS + 1);
    expect(knob().style.left).toBe("50%");
    expect(knob().style.top).toBe("50%");
  });

  it("cancels on Escape without writing anything", async () => {
    const data = mount();
    await settle();
    await hold();
    await act(async () => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(screen.queryByTestId(`${PREFIX}-pad`)).toBeNull();
    expect(data.sent).toEqual([]);
  });
});

describe("the release that never commits", () => {
  beforeEach(() => {
    alreadyTaught();
  });

  it("leaves the pick standing and the pad open, and signs nothing", async () => {
    // §8.3: "an accidental lift must never sign a priced act."
    const data = mount();
    await settle();
    await hold();
    layOutPad();
    fireEvent.pointerMove(control(), { pointerId: 1, clientX: HALF, clientY: 0 });
    await settle();
    await release();
    expect(screen.getByTestId(`${PREFIX}-pad`)).toBeInTheDocument();
    expect(screen.getByTestId(`${PREFIX}-exact`)).toHaveTextContent("+1.00 / +0.00");
    expect(data.sent).toEqual([]);
  });

  it("signs the standing pick when Set is pressed, and closes", async () => {
    const data = mount();
    await settle();
    await hold();
    await dragAndSet(HALF, 0);
    expect(data.sent).toEqual([{ target: "post-1", pick: { pDirected: 1, pInterest: 0 } }]);
    expect(screen.queryByTestId(`${PREFIX}-pad`)).toBeNull();
  });

  it("adjusts the standing pick on a second drag rather than starting over", async () => {
    // The pad parks, so the field is the surface a further adjustment
    // happens on — and it moves the knob by the same accumulated travel.
    const data = mount();
    await settle();
    await hold();
    layOutPad();
    fireEvent.pointerMove(control(), { pointerId: 1, clientX: HALF / 2, clientY: 0 });
    await settle();
    await release();
    const field = screen.getByTestId(`${PREFIX}-field`);
    fireEvent.pointerDown(field, { pointerId: 2, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(field, { pointerId: 2, clientX: HALF / 4, clientY: 0 });
    await settle();
    await act(async () => {
      fireEvent.pointerUp(field, { pointerId: 2 });
    });
    await pressSet();
    expect(data.sent[0].pick.pDirected).toBeCloseTo(0.75, 10);
  });

  it("dismisses on Cancel and stages nothing", async () => {
    const data = mount();
    await settle();
    await hold();
    layOutPad();
    fireEvent.pointerMove(control(), { pointerId: 1, clientX: HALF, clientY: 0 });
    await settle();
    await release();
    await act(async () => {
      fireEvent.click(screen.getByTestId(`${PREFIX}-cancel`));
    });
    expect(screen.queryByTestId(`${PREFIX}-pad`)).toBeNull();
    expect(data.sent).toEqual([]);
  });

  it("dismisses on a press outside and stages nothing", async () => {
    const data = mount();
    await settle();
    await hold();
    await release();
    await act(async () => {
      fireEvent.pointerDown(screen.getByTestId(`${PREFIX}-scrim`), { pointerId: 3 });
    });
    expect(screen.queryByTestId(`${PREFIX}-pad`)).toBeNull();
    expect(data.sent).toEqual([]);
  });

  it("keeps the pad open on a lost pointer, so nothing is lost or signed", async () => {
    // A pointer the platform took away is not a decision. The pick
    // stands and the reader still has Set and Cancel in front of them.
    const data = mount();
    await settle();
    await hold();
    layOutPad();
    fireEvent.pointerMove(control(), { pointerId: 1, clientX: HALF, clientY: 0 });
    await settle();
    await act(async () => {
      fireEvent.pointerCancel(control(), { pointerId: 1 });
    });
    expect(screen.getByTestId(`${PREFIX}-pad`)).toBeInTheDocument();
    expect(screen.getByTestId(`${PREFIX}-exact`)).toHaveTextContent("+1.00 / +0.00");
    expect(data.sent).toEqual([]);
  });

  it("explains the gesture on demand, and says releasing changes nothing", async () => {
    // §8.3: the `?` is for anyone meeting the control after the one-time
    // coach mark is spent.
    mount();
    await settle();
    await hold();
    await release();
    expect(screen.queryByTestId(`${PREFIX}-explanation`)).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByTestId(`${PREFIX}-explain`));
    });
    const explanation = screen.getByTestId(`${PREFIX}-explanation`);
    expect(explanation).toHaveTextContent("letting go changes nothing");
    expect(explanation).toHaveTextContent("Set signs it");
    expect(screen.getByTestId(`${PREFIX}-explain`)).toHaveAccessibleName("How stances work");
  });

  it("closes the explanation again rather than trapping the reader in it", async () => {
    mount();
    await settle();
    await hold();
    await release();
    await act(async () => {
      fireEvent.click(screen.getByTestId(`${PREFIX}-explain`));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId(`${PREFIX}-explain`));
    });
    expect(screen.queryByTestId(`${PREFIX}-explanation`)).toBeNull();
  });
});

describe("the touch path", () => {
  beforeEach(() => {
    alreadyTaught();
  });

  it("keeps the browser from claiming the drag as a scroll", async () => {
    mount();
    await settle();
    expect(control().className).toContain("touch-none");
    await hold();
    expect(screen.getByTestId(`${PREFIX}-pad`).className).toContain("touch-none");
    expect(screen.getByTestId(`${PREFIX}-field`).className).toContain("touch-none");
  });

  it("keeps a long press from becoming a context menu instead of a gesture", async () => {
    mount();
    await settle();
    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    await act(async () => {
      control().dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    // The selection callout is the same interruption by another name.
    expect(control().className).toContain("select-none");
  });
});

describe("the touches the control owns", () => {
  beforeEach(() => {
    alreadyTaught();
  });

  /**
   * The control inside a surface that acts on the same events — a feed
   * card wrapping its content in a link is the real case. §8.3: opening
   * the pad must never also open the post, and dismissing it must never
   * navigate.
   */
  function mountInHost() {
    const data = createStubStanceData();
    const host = vi.fn();
    renderWithProviders(
      <div data-testid="host-surface" onClick={host} onPointerDown={host} onPointerUp={host}>
        <StanceControl target={TARGET} testIdPrefix={PREFIX} />
      </div>,
      { store: signedInStore(), stanceData: data },
    );
    return { data, host };
  }

  it("keeps a tap on the resting target off the surface underneath", async () => {
    const { host } = mountInHost();
    await settle();
    await act(async () => {
      fireEvent.pointerDown(control(), { pointerId: 1, clientX: 0, clientY: 0 });
      fireEvent.pointerUp(control(), { pointerId: 1 });
      fireEvent.click(control());
    });
    expect(host).not.toHaveBeenCalled();
  });

  it("keeps the hold that opens the pad off the surface underneath", async () => {
    const { host } = mountInHost();
    await settle();
    await hold();
    await release();
    expect(screen.getByTestId(`${PREFIX}-pad`)).toBeInTheDocument();
    expect(host).not.toHaveBeenCalled();
  });

  it("keeps the open pad's own touches off the surface underneath", async () => {
    const { host } = mountInHost();
    await settle();
    await hold();
    await release();
    const field = screen.getByTestId(`${PREFIX}-field`);
    await act(async () => {
      fireEvent.pointerDown(field, { pointerId: 2, clientX: 0, clientY: 0 });
      fireEvent.pointerUp(field, { pointerId: 2 });
    });
    expect(host).not.toHaveBeenCalled();
  });

  it("keeps the dismissal off the surface underneath", async () => {
    const { host } = mountInHost();
    await settle();
    await hold();
    await release();
    await act(async () => {
      fireEvent.pointerDown(screen.getByTestId(`${PREFIX}-scrim`), { pointerId: 3 });
    });
    expect(screen.queryByTestId(`${PREFIX}-pad`)).toBeNull();
    expect(host).not.toHaveBeenCalled();
  });

  it("covers everything behind the open pad rather than a patch of it", async () => {
    mount();
    await settle();
    await hold();
    const scrim = screen.getByTestId(`${PREFIX}-scrim`);
    expect(scrim.className).toContain("fixed");
    expect(scrim.className).toContain("inset-0");
    // Under the pad, over everything else.
    expect(scrim.className).toContain("z-10");
    expect(screen.getByTestId(`${PREFIX}-pad`).className).toContain("z-20");
  });

  it("takes the scrim away with the pad, so a closed control blocks nothing", async () => {
    mount();
    await settle();
    await hold();
    await release();
    await act(async () => {
      fireEvent.click(screen.getByTestId(`${PREFIX}-cancel`));
    });
    expect(screen.queryByTestId(`${PREFIX}-scrim`)).toBeNull();
  });
});

describe("where the pad blooms", () => {
  beforeEach(() => {
    alreadyTaught();
  });

  /** The parked spot: lower centre, whatever the viewport (§8.3). */
  const expectParked = () => {
    const pad = screen.getByTestId(`${PREFIX}-pad`);
    expect(pad.style.position).toBe("fixed");
    expect(pad.style.left).toBe("50%");
    expect(pad.style.transform).toBe("translateX(-50%)");
    expect(pad.style.bottom).toBe(`${PAD_PARK_INSET_PX}px`);
    // Nothing is anchored, so nothing measured a target into a `top`.
    expect(pad.style.top).toBe("");
  };

  it("parks at the lower centre on a desktop viewport", async () => {
    setViewport(1280, 800);
    mount();
    await settle();
    await hold();
    expectParked();
  });

  it("parks at the same lower centre on a phone viewport", async () => {
    setViewport(360, 640);
    mount();
    await settle();
    await hold();
    expectParked();
  });

  it("takes the same spot wherever the target and the press are", async () => {
    // §8.3: "the same place every time, regardless of which control
    // opened it" — muscle memory is part of the control.
    for (const [left, top] of [
      [0, 0],
      [1024 - BUTTON_BOX.width, 0],
      [0, 768 - BUTTON_BOX.height],
      [1024 - BUTTON_BOX.width, 768 - BUTTON_BOX.height],
    ] as const) {
      stubBox(PREFIX, { left, top, ...BUTTON_BOX });
      mount();
      await settle();
      // The press lands far from the target the pad belongs to.
      fireEvent.pointerDown(control(), { pointerId: 1, clientX: 900, clientY: 40 });
      await settle(LONG_PRESS_MS + 1);
      expectParked();
      await act(async () => {
        fireEvent.click(screen.getByTestId(`${PREFIX}-cancel`));
      });
      screen.getByTestId(PREFIX).remove();
    }
  });

  it("does not move when the viewport changes under it", async () => {
    // The keyboard, a rotation: an anchored pad re-measures and jumps.
    // A parked one has no measurement to invalidate.
    mount();
    await settle();
    await hold();
    setViewport(360, 640);
    await act(async () => {
      window.dispatchEvent(new Event("resize"));
    });
    expectParked();
  });

  it("keeps a pad taller than the screen scrollable rather than off it", async () => {
    setViewport(360, 380);
    mount();
    await settle();
    await hold();
    const pad = screen.getByTestId(`${PREFIX}-pad`);
    expect(pad.style.maxHeight).toBe(`calc(100dvh - ${PAD_PARK_INSET_PX * 2}px)`);
    expect(pad.className).toContain("overflow-y-auto");
  });
});

describe("the readout", () => {
  beforeEach(() => {
    alreadyTaught();
  });

  // A fold that is deliberately NOT a sum: any client-side arithmetic
  // would disagree with it, so these assertions fail if the control ever
  // computes standing or a landing instead of reading them.
  const lastWins: StubStanceOptions["fold"] = (records) =>
    records.length === 0 ? ORIGIN : records[records.length - 1];

  it("shows the standing the fold reports, not one it derived", async () => {
    mount({
      fold: lastWins,
      seed: {
        "post-1": {
          records: [
            { pDirected: 0.9, pInterest: 0.9 },
            { pDirected: -0.9, pInterest: -0.9 },
          ],
        },
      },
    });
    // A summing client would read (0, 0) — severed. The fold says
    // otherwise, and the fold is what the readout shows.
    await settle();
    expect(control()).toHaveTextContent("Absolutely not");
  });

  it("shows the face, the words, and the exact pair, live with the drag", async () => {
    // §8.3: the numbers are part of the default reading — the face
    // carries the feel and the pair carries the fact.
    mount({ fold: lastWins });
    await settle();
    await hold();
    layOutPad();
    expect(screen.getByTestId(`${PREFIX}-exact`)).toHaveTextContent("+0.00 / +0.00");
    fireEvent.pointerMove(control(), { pointerId: 1, clientX: HALF * 0.4, clientY: -HALF * 0.2 });
    await settle();
    expect(screen.getByTestId(`${PREFIX}-exact`)).toHaveTextContent("+0.40 / +0.20");
    expect(screen.getByTestId(`${PREFIX}-face`)).toHaveTextContent("Like this");
  });

  it("names the axes for a reader with no field in front of them", async () => {
    mount({ fold: lastWins });
    await settle();
    await hold();
    expect(screen.getByTestId(`${PREFIX}-exact`)).toHaveTextContent(
      "How you stand +0.00, In your world +0.00",
    );
  });

  it("shows where the pick lands the bundle, as its own line", async () => {
    mount({ fold: lastWins, seed: { "post-1": { records: [{ pDirected: 0.9, pInterest: 0.9 }] } } });
    await settle();
    await hold();
    layOutPad();
    fireEvent.pointerMove(control(), { pointerId: 1, clientX: -HALF, clientY: HALF });
    await settle(PROJECTION_SETTLE_MS + 1);
    expect(screen.getByTestId(`${PREFIX}-face`)).toHaveTextContent("Absolutely not");
    expect(screen.getByTestId(`${PREFIX}-landing`)).toHaveTextContent("This leaves you at:");
    expect(screen.getByTestId(`${PREFIX}-landing`)).toHaveTextContent("Absolutely not");
    // Face, words, AND the exact pair — the same three the standing
    // carries (§8.3). The emoji alone is half a reading.
    expect(screen.getByTestId(`${PREFIX}-landing`)).toHaveTextContent("-1.00 / -1.00");
    expect(screen.getByTestId(`${PREFIX}-standing`)).toHaveTextContent("Where you stand now:");
    expect(screen.getByTestId(`${PREFIX}-standing`)).toHaveTextContent("All in");
    // The standing carries its numbers too.
    expect(screen.getByTestId(`${PREFIX}-standing`)).toHaveTextContent("+0.90 / +0.90");
  });

  it("keeps the two lines apart, one above the field and one below it", async () => {
    mount({ fold: lastWins, seed: { "post-1": { records: [{ pDirected: 0.9, pInterest: 0.9 }] } } });
    await settle();
    await hold();
    const field = screen.getByTestId(`${PREFIX}-field`);
    const standing = screen.getByTestId(`${PREFIX}-standing`);
    const landing = screen.getByTestId(`${PREFIX}-landing`);
    expect(standing).not.toBe(landing);
    // DOCUMENT_POSITION_FOLLOWING: the field comes after the standing,
    // and the landing after the field.
    expect(standing.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(field.compareDocumentPosition(landing) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("says a stance carries nothing where the fold flags the landing inert", async () => {
    mount({ fold: lastWins });
    await settle();
    await hold();
    layOutPad();
    // Valence at zero, connection alive: the axis wording follows.
    fireEvent.pointerMove(control(), { pointerId: 1, clientX: 0, clientY: -HALF });
    await settle(PROJECTION_SETTLE_MS + 1);
    expect(screen.getByTestId(`${PREFIX}-landing`)).toHaveTextContent(
      "Where you stand would carry nothing.",
    );
  });

  it("says what reaches you would carry nothing where the other axis is inert", async () => {
    mount({ fold: lastWins });
    await settle();
    await hold();
    layOutPad();
    fireEvent.pointerMove(control(), { pointerId: 1, clientX: HALF, clientY: 0 });
    await settle(PROJECTION_SETTLE_MS + 1);
    expect(screen.getByTestId(`${PREFIX}-landing`)).toHaveTextContent(
      "What reaches you would carry nothing.",
    );
  });

  it("says it is still working the landing out rather than showing a stale one", async () => {
    mount({ fold: lastWins });
    await settle();
    await hold();
    // The settle has not elapsed, so no landing has been read yet.
    expect(screen.getByTestId(`${PREFIX}-landing`)).toHaveTextContent(
      "Working out where this leaves you…",
    );
  });

  it("names a landing that reaches severance as what it nets, not as a reading", async () => {
    mount({ fold: lastWins });
    await settle();
    await hold();
    layOutPad();
    // The origin: both axes at zero, which the fold flags as severance.
    await settle(PROJECTION_SETTLE_MS + 1);
    expect(screen.getByTestId(`${PREFIX}-landing`)).toHaveTextContent(
      "This pick nets everything you've said about it back to nothing.",
    );
  });

  it("counts pending stances in every read it makes", async () => {
    const data = mount({ seed: { "post-1": { records: [TAP_DEFAULT] } } });
    await settle();
    await hold();
    await settle(PROJECTION_SETTLE_MS + 1);
    expect(data.pendingFlags.length).toBeGreaterThan(0);
    expect(data.pendingFlags.every((flag) => flag)).toBe(true);
  });
});

describe("severance", () => {
  beforeEach(() => {
    alreadyTaught();
  });

  // Dragging past the field clamps to exactly ±1, so the stand-in's sum
  // against a (+1, +1) history is exactly (0, 0) — the assertion is about
  // the branch, not about floating point.
  const dragToFarCorner = async () => {
    await dragAndSet(-500, 700);
  };

  it("confirms a pick that lands at zero rather than refusing it", async () => {
    const data = mount({ seed: { "post-1": { records: [{ pDirected: 1, pInterest: 1 }] } } });
    await settle();
    await hold();
    await dragToFarCorner();
    expect(screen.getByTestId("severance-confirm")).toBeInTheDocument();
    expect(data.sent).toEqual([]);
  });

  it("leaves the resting target alone until severance is confirmed", async () => {
    mount({ seed: { "post-1": { records: [{ pDirected: 1, pInterest: 1 }] } } });
    await settle();
    await hold();
    await dragToFarCorner();
    // Nothing was staged, so nothing may claim to have landed.
    expect(screen.getByTestId(`${PREFIX}-resting-exact`)).toHaveTextContent("+1.00 / +1.00");
  });

  it("writes the raw pick once that landing is confirmed", async () => {
    const data = mount({ seed: { "post-1": { records: [{ pDirected: 1, pInterest: 1 }] } } });
    await settle();
    await hold();
    await dragToFarCorner();
    await act(async () => {
      fireEvent.click(screen.getByTestId("severance-proceed"));
    });
    // The raw edge, not the batch: an accidental landing writes the pick.
    expect(data.sent).toEqual([{ target: "post-1", pick: { pDirected: -1, pInterest: -1 } }]);
    expect(data.severed).toEqual([]);
  });

  it("is findable from the open pad, and states what reaching zero takes", async () => {
    mount({
      seed: {
        "post-1": {
          records: [
            { pDirected: 0.5, pInterest: 0.5 },
            { pDirected: 0.2, pInterest: 0.1 },
          ],
        },
      },
    });
    await settle();
    await hold();
    await act(async () => {
      fireEvent.click(screen.getByTestId(`${PREFIX}-sever`));
    });
    expect(screen.getByTestId("severance-cost")).toHaveTextContent(
      "It takes 2 signed actions, each paid for separately.",
    );
  });

  it("stages the counter-record batch once confirmed", async () => {
    const data = mount({
      seed: {
        "post-1": {
          records: [
            { pDirected: 0.5, pInterest: 0.5 },
            { pDirected: 0.2, pInterest: 0.1 },
          ],
        },
      },
    });
    await settle();
    await hold();
    await act(async () => {
      fireEvent.click(screen.getByTestId(`${PREFIX}-sever`));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("severance-proceed"));
    });
    expect(data.severed).toEqual(["post-1"]);
    // The batch count stays in the receipt — the cost the reader agreed
    // to is part of what completed — and severance says itself rather
    // than reading out a face and a pair at the origin.
    expect(screen.getByTestId(`${PREFIX}-signed`)).toHaveTextContent(
      "Signed 2 actions, still settling. You've severed this post.",
    );
  });

  it("writes nothing when the confirmation is declined", async () => {
    const data = mount({ seed: { "post-1": { records: [{ pDirected: 0.5, pInterest: 0.5 }] } } });
    await settle();
    await hold();
    await act(async () => {
      fireEvent.click(screen.getByTestId(`${PREFIX}-sever`));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("severance-cancel"));
    });
    expect(data.severed).toEqual([]);
    expect(data.sent).toEqual([]);
  });

  it("keeps the route findable but refuses to bill for nothing", async () => {
    // §8.5 wants severance findable from the open pad; with no standing
    // there is nothing to walk back, and the dialog says so rather than
    // hiding the route and leaving the state unreachable.
    const data = mount();
    await settle();
    await hold();
    await act(async () => {
      fireEvent.click(screen.getByTestId(`${PREFIX}-sever`));
    });
    expect(screen.getByTestId("severance-cost")).toHaveTextContent(
      "You are already at nothing here.",
    );
    expect(screen.getByTestId("severance-proceed")).toBeDisabled();
    expect(data.severed).toEqual([]);
  });

  it("keeps the confirmation up and says so when the batch does not go through", async () => {
    const data = mount({
      seed: { "post-1": { records: [{ pDirected: 0.5, pInterest: 0.5 }] } },
    });
    await settle();
    await hold();
    await act(async () => {
      fireEvent.click(screen.getByTestId(`${PREFIX}-sever`));
    });
    // The seam goes down between opening the dialog and confirming.
    const offline = createStubStanceData({ offline: true });
    data.sever = offline.sever;
    await act(async () => {
      fireEvent.click(screen.getByTestId("severance-proceed"));
    });
    expect(screen.getByTestId("severance-failed")).toBeInTheDocument();
    expect(screen.getByTestId<HTMLDialogElement>("severance-confirm").open).toBe(true);
  });
});

describe("the alternate inputs", () => {
  beforeEach(() => {
    alreadyTaught();
  });

  it("are reachable without ever dragging", async () => {
    mount();
    await settle();
    expect(DEFAULT_STANCE_INPUT_MODE).toBe("pad");
    await act(async () => {
      fireEvent.click(screen.getByTestId(`${PREFIX}-choose`));
    });
    expect(screen.getByTestId("stance-alternates")).toBeInTheDocument();
    // While the pad is the chosen input neither alternate is picked, so
    // both are offered.
    expect(screen.getByTestId("stance-alt-directed")).toBeInTheDocument();
    expect(screen.getByTestId("stance-entry-directed")).toBeInTheDocument();
  });

  it("write the picked pair verbatim", async () => {
    const data = mount();
    await settle();
    await act(async () => {
      fireEvent.click(screen.getByTestId(`${PREFIX}-choose`));
    });
    fireEvent.change(screen.getByTestId("stance-alt-directed"), { target: { value: "-0.75" } });
    fireEvent.change(screen.getByTestId("stance-entry-interest"), { target: { value: "0.25" } });
    await act(async () => {
      fireEvent.click(screen.getByTestId("stance-alt-commit"));
    });
    expect(data.sent).toEqual([
      { target: "post-1", pick: { pDirected: -0.75, pInterest: 0.25 } },
    ]);
  });

  it("bound direct entry to the field rather than trusting what was typed", async () => {
    const data = mount();
    await settle();
    await act(async () => {
      fireEvent.click(screen.getByTestId(`${PREFIX}-choose`));
    });
    fireEvent.change(screen.getByTestId("stance-entry-directed"), { target: { value: "7" } });
    await act(async () => {
      fireEvent.click(screen.getByTestId("stance-alt-commit"));
    });
    expect(data.sent[0].pick.pDirected).toBe(1);
  });

  it("carry the same exact pair the pad shows", async () => {
    mount();
    await settle();
    await act(async () => {
      fireEvent.click(screen.getByTestId(`${PREFIX}-choose`));
    });
    expect(screen.getByTestId(`${PREFIX}-exact`)).toHaveTextContent("+0.00 / +0.00");
    expect(screen.getByTestId(`${PREFIX}-exact`)).toHaveTextContent(
      "How you stand +0.00, In your world +0.00",
    );
  });

  it("replace the pad everywhere once chosen, the hold gesture included", async () => {
    writeStanceInputMode("sliders");
    mount();
    await settle();
    await hold();
    expect(screen.queryByTestId(`${PREFIX}-pad`)).toBeNull();
    expect(screen.getByTestId("stance-alternates")).toBeInTheDocument();
    expect(screen.queryByTestId("stance-entry-directed")).toBeNull();
  });
});

describe("a supplied bundle", () => {
  it("is used as-is, so the hosting read is not asked twice", async () => {
    const data = createStubStanceData();
    renderWithProviders(
      <StanceControl
        target={TARGET}
        bundle={{
          current: { pDirected: 0.9, pInterest: 0.25 },
          records: 3,
          inert: false,
          severed: false,
          severance: { records: 3 },
        }}
        testIdPrefix={PREFIX}
      />,
      { store: signedInStore(), stanceData: data },
    );
    await settle();
    expect(control()).toHaveTextContent("Love this");
    expect(screen.getByTestId(`${PREFIX}-resting-exact`)).toHaveTextContent("+0.90 / +0.25");
    expect(data.pendingFlags).toEqual([]);
  });

  it("still answers a tap of its own, past the copy the host read", async () => {
    alreadyTaught();
    const data = createStubStanceData({
      seed: { "post-1": { records: [{ pDirected: 0.4, pInterest: 0.1 }] } },
    });
    renderWithProviders(
      <StanceControl
        target={TARGET}
        bundle={{
          current: { pDirected: 0.4, pInterest: 0.1 },
          records: 1,
          inert: false,
          severed: false,
          severance: { records: 1 },
        }}
        testIdPrefix={PREFIX}
      />,
      { store: signedInStore(), stanceData: data },
    );
    await settle();
    await act(async () => {
      fireEvent.click(control());
    });
    await settle();
    expect(screen.getByTestId(`${PREFIX}-resting-exact`)).toHaveTextContent("+0.50 / +0.20");
    expect(data.freshFlags).toEqual([true]);
  });
});

describe("the pick that never happened", () => {
  it("leaves the pad closed and the seam untouched while at rest", async () => {
    const data = mount();
    await settle(PROJECTION_SETTLE_MS * 4);
    expect(screen.queryByTestId(`${PREFIX}-pad`)).toBeNull();
    expect(data.sent).toEqual([]);
    expect(data.severed).toEqual([]);
  });

  it("reads the standing once, however often the host re-renders it", async () => {
    // The hosts build `target` inline, so a read keyed on the prop's
    // identity rather than on its fields would re-run on every render.
    const data = createStubStanceData();
    renderWithProviders(<Host />, { store: signedInStore(), stanceData: data });
    await settle();
    for (let i = 0; i < 3; i += 1) {
      await act(async () => {
        fireEvent.click(screen.getByTestId("host-rerender"));
      });
      await settle();
    }
    expect(data.pendingFlags).toHaveLength(1);
  });
});
