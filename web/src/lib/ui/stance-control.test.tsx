import { act, fireEvent, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import {
  DEFAULT_STANCE_INPUT_MODE,
  writeStanceInputMode,
  type StanceInputMode,
} from "@/lib/stance/input-mode";
import { keepPick, listKeptPicks } from "@/lib/stance/kept-picks";
import { KeptPicksNavigation } from "@/lib/stance/kept-picks-route";
import { markSettling } from "@/lib/stance/settling";
import { ORIGIN, TAP_DEFAULT } from "@/lib/stance/model";
import { KNOB_TRAVEL_INSET_PX } from "@/lib/stance/pad-geometry";
import { writeStanceTaught } from "@/lib/stance/stance-coach";
import type { StanceTargetRef } from "@/lib/stance/stance-data";
import { createStubStanceData, type StubStanceOptions } from "@/lib/stance/stub-stance-data";
import { raisedLayersForTests } from "@/lib/ui2/covering-layer";
import { renderWithProviders } from "@/test/providers";
import { PAD_PARK_INSET_PX, PadParkingProvider } from "./pad-parking";
import { NO_STANDING_LABEL, SEVERED_LABEL } from "./stance-readout";
import { LONG_PRESS_MS, SETTING_AFTER_MS, StanceControl } from "./stance-control";
import { AFFINITY_AXES, type StanceAxes } from "./stance-format";

const TARGET: StanceTargetRef = { id: "post-1", kind: "post", label: "this post" };
const PREFIX = "stance-post-1";
/** The square the drag happens on — the master field, inside its gutters. */
const FIELD_ID = `${PREFIX}-field-square`;

/** A topic target, for the disconnect-family tests (copy-voice.md "the
 * topic disconnects"). */
const TOPIC_TARGET: StanceTargetRef = { id: "saltmaps", kind: "topic", label: "#saltmaps" };

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

/** Where a kept pick's anchor sent the reader (`useOpenKeptPicks`). */
const navigated: string[] = [];

function mount(
  options: StubStanceOptions = {},
  {
    signedIn = true,
    target = TARGET,
    axes,
    barBeneath = false,
    mode = "pad",
  }: {
    signedIn?: boolean;
    target?: StanceTargetRef;
    axes?: StanceAxes;
    barBeneath?: boolean;
    mode?: StanceInputMode;
  } = {},
) {
  if (mode !== "pad") writeStanceInputMode(mode);
  const data = createStubStanceData(options);
  renderWithProviders(
    <KeptPicksNavigation navigate={(href) => navigated.push(href)}>
      <PadParkingProvider value={barBeneath}>
        <StanceControl target={target} testIdPrefix={PREFIX} axes={axes} />
      </PadParkingProvider>
    </KeptPicksNavigation>,
    {
      store: signedIn ? signedInStore() : createTokenStore(),
      stanceData: data,
    },
  );
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

/**
 * The clock moves `ms`, and the custody the kept picks live in (IndexedDB,
 * which answers on the REAL `setImmediate` — see the fake-timer set below) is
 * given a few real turns to answer.
 */
async function settle(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
    for (let turn = 0; turn < 10; turn += 1) await new Promise((resolve) => setImmediate(resolve));
    await vi.advanceTimersByTimeAsync(0);
  });
}

/**
 * The tap — down, up, and the browser's click — which opens the pad and
 * stages nothing (stance-control.md "The gesture").
 */
async function openPad() {
  await act(async () => {
    fireEvent.pointerDown(control(), { pointerId: 9, clientX: 0, clientY: 0 });
    fireEvent.pointerUp(control(), { pointerId: 9 });
    fireEvent.click(control());
  });
}

/**
 * Press and hold past the threshold, then lift — the browser's click for
 * that press included. The hold signs the low default; the lift and its
 * click must do nothing more.
 */
async function hold() {
  fireEvent.pointerDown(control(), { pointerId: 1, clientX: 0, clientY: 0 });
  await settle(LONG_PRESS_MS + 1);
  await act(async () => {
    fireEvent.pointerUp(control(), { pointerId: 1 });
    fireEvent.click(control());
  });
  await settle();
}

/** Whether a drag on the open pad's field is under way. */
let dragging = false;

/**
 * Moves the knob by dragging the open pad's field. The first move puts
 * the thumb down at (0, 0), so a position below IS the travel from where
 * the drag began — and the drag builds on the pick already standing,
 * which on a fresh pad is the default (+0.10, +0.10).
 */
function moveKnob(clientX: number, clientY: number) {
  const field = screen.getByTestId(FIELD_ID);
  if (!dragging) {
    fireEvent.pointerDown(field, { pointerId: 1, clientX: 0, clientY: 0 });
    dragging = true;
  }
  fireEvent.pointerMove(field, { pointerId: 1, clientX, clientY });
}

/** The release, which parks rather than committing (§8.3). */
async function release() {
  await act(async () => {
    fireEvent.pointerUp(screen.getByTestId(FIELD_ID), { pointerId: 1 });
  });
  dragging = false;
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
  moveKnob(clientX, clientY);
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
  stubBox(FIELD_ID, { width: FIELD, height: FIELD });
  return screen.getByTestId(FIELD_ID);
}

const knob = () => screen.getByTestId(`${PREFIX}-field-knob`);
const percent = (value: string) => Number(value.replace("%", ""));

beforeEach(() => {
  window.localStorage.clear();
  navigated.length = 0;
  stubbedBoxes.clear();
  dragging = false;
  setViewport(1024, 768);
  stubBox(PREFIX, { left: 400, top: 500, ...BUTTON_BOX });
  stubBox(FIELD_ID, { width: FIELD, height: FIELD });
  // Every clock but `setImmediate`: fake-indexeddb answers on it, and a faked
  // one leaves the kept picks' custody waiting forever.
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the stance control at rest", () => {
  it("offers an opinion where the viewer holds none, by name and never by a drawn word", async () => {
    // StanceControl.prompt.md: no opinion yet is the muted face, "never a
    // bare word"; the accessible name says what the face is for.
    mount();
    await settle();
    expect(control()).not.toHaveTextContent(NO_STANDING_LABEL);
    expect(control()).toHaveAccessibleName("Give your opinion on this post");
  });

  it("waits as a muted, translucent face rather than a bare word", async () => {
    // §8.3: "a viewer without one sees a muted, translucent face — the
    // same control at rest, visibly waiting to be given a value — never
    // a bare word." The face is 🫥, outside the table and distinct from
    // the shrug a zero standing owns (Q42, Android parity).
    mount();
    await settle();
    const affordance = screen.getByTestId(`${PREFIX}-resting-face`);
    expect(affordance).toHaveTextContent("🫥");
    expect(affordance).not.toHaveTextContent("🤷");
    expect(affordance.className).toContain("opacity-40");
    expect(affordance.className).toContain("grayscale");
  });

  it("draws a line face in the host's ink on an empty face (the vouch card)", async () => {
    // stance-control.md, jakob 2026-10-14: the card's unset state is the line
    // face, `sentiment_neutral`, in the ink the host hands — never the 🫥,
    // whose fixed pale greys cannot read on the card's ground — and at full
    // opacity: the line face carries no muting of its own.
    const data = createStubStanceData({});
    renderWithProviders(
      <StanceControl
        target={TARGET}
        testIdPrefix={PREFIX}
        lineFaceInk="var(--on-tertiary-container)"
      />,
      { store: signedInStore(), stanceData: data },
    );
    await settle();
    const face = screen.getByTestId(`${PREFIX}-resting-face`);
    expect(face).not.toHaveTextContent("🫥");
    expect(face.style.color).toBe("var(--on-tertiary-container)");
    expect(face.className).not.toContain("opacity-40");
    expect(face.className).not.toContain("grayscale");
    const glyph = face.querySelector("svg");
    expect(glyph).not.toBeNull();
    expect(glyph?.querySelectorAll("path")).toHaveLength(4);
    // The accessible name is the muted face's own, unchanged.
    expect(screen.getByTestId(PREFIX)).toHaveAttribute(
      "aria-label",
      `Give your opinion on ${TARGET.label}`,
    );
  });

  it("keeps a set stance's own emoji even where the host hands a line-face ink", async () => {
    const data = createStubStanceData({
      seed: { "post-1": { records: [{ pDirected: 0.55, pInterest: 0.2 }] } },
    });
    renderWithProviders(
      <StanceControl
        target={TARGET}
        testIdPrefix={PREFIX}
        lineFaceInk="var(--on-tertiary-container)"
      />,
      { store: signedInStore(), stanceData: data },
    );
    await settle();
    const face = screen.getByTestId(`${PREFIX}-resting-face`);
    expect(face).toHaveTextContent("😊");
    expect(face.querySelector("svg")).toBeNull();
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
    // The shrug, not the resting face: this bundle exists and came to
    // nothing, which is not the same as never having been given anything.
    expect(screen.getByTestId(`${PREFIX}-resting-face`)).toHaveTextContent("🤷");
    expect(control()).not.toHaveTextContent("Nice");
    // The word is the accessible name's, never drawn (StanceControl.prompt.md).
    expect(control()).not.toHaveTextContent(SEVERED_LABEL);
    expect(control()).toHaveAccessibleName(/Walked back, \+0\.00 \/ \+0\.00/);
  });

  it("wears the face, with the exact pair as the geek reading, and never the words", async () => {
    // StanceControl.prompt.md: "At rest it shows the current opinion — the
    // face, with the exact pair beside it in a `cg-exact` span that paints
    // only in geek mode. … The anchor's words are not drawn beside it."
    mount({ seed: { "post-1": { records: [{ pDirected: 0.55, pInterest: 0.2 }] } } });
    await settle();
    expect(control()).toHaveTextContent("😊");
    expect(control()).not.toHaveTextContent("Like this");
    const exact = screen.getByTestId(`${PREFIX}-resting-exact`);
    expect(exact).toHaveTextContent("+0.55 / +0.20");
    expect(exact.className).toContain("cg-exact");
    // The words ride the accessible name, in both modes (§10).
    expect(control()).toHaveAccessibleName(/Like this, \+0\.55 \/ \+0\.20/);
  });

  it("puts the opinion in the accessible name, numbers included, minus as U+2212", async () => {
    mount({ seed: { "post-1": { records: [{ pDirected: -0.55, pInterest: 0.25 }] } } });
    await settle();
    expect(control()).toHaveAccessibleName(
      "Your opinion on this post: Don't like this, −0.55 / +0.25. Press and hold to add a positive one.",
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

  // THE WIDE ANCHOR (StanceControl.jsx `wide`; ProfileHeader.jsx): the row's
  // one action on a profile, stretched in the outline button's clothes, its
  // words drawn beside the face only while there is no pair to show.
  it("wears the wide anchor's outline and words where the profile asks for it", async () => {
    renderWithProviders(<StanceControl target={TARGET} testIdPrefix={PREFIX} wide />, {
      store: signedInStore(),
      stanceData: createStubStanceData({}),
    });
    await settle();
    expect(control().className).toContain("flex-1");
    expect(control().className).toContain("border-outline");
    expect(control().className).toContain("min-h-10");
    expect(screen.getByTestId(`${PREFIX}-words`)).toHaveTextContent("Your opinion");
    // The words are drawn, never a second name.
    expect(control()).toHaveAccessibleName("Give your opinion on this post");
  });

  it("drops the wide anchor's words once there is a pair to show", async () => {
    renderWithProviders(<StanceControl target={TARGET} testIdPrefix={PREFIX} wide />, {
      store: signedInStore(),
      stanceData: createStubStanceData({ seed: { "post-1": { records: [{ pDirected: 0.55, pInterest: 0.2 }] } } }),
    });
    await settle();
    expect(screen.queryByTestId(`${PREFIX}-words`)).toBeNull();
    expect(screen.getByTestId(`${PREFIX}-resting-exact`)).toHaveTextContent("+0.55 / +0.20");
  });

  it("keeps the standing it has when a re-read faults", async () => {
    const data = mount({ seed: { "post-1": { records: [{ pDirected: 0.55, pInterest: 0.2 }] } } });
    await settle();
    const offline = createStubStanceData({ offline: true });
    data.bundle = offline.bundle;
    alreadyTaught();
    await hold();
    await settle();
    // A transient read fault must not blank a standing that is known.
    expect(control()).toHaveAccessibleName(/Like this/);
  });
});

describe("teaching the gesture", () => {
  // stance-control.md "Teaching it": the pad is the teacher. The
  // account's first open ever carries two coaching lines; they close with
  // the pad and never show again, and nothing else teaches it.

  it("teaches on the first open ever, inside the pad, and stages nothing", async () => {
    const data = mount();
    await settle();
    await openPad();
    const pad = screen.getByTestId(`${PREFIX}-pad`);
    expect(pad).toContainElement(screen.getByTestId(`${PREFIX}-coaching`));
    expect(data.sent).toEqual([]);
    expect(screen.queryByTestId(`${PREFIX}-signed`)).toBeNull();
  });

  it("says the shortcut, and that nothing is signed until Set", async () => {
    mount();
    await settle();
    await openPad();
    const coaching = screen.getByTestId(`${PREFIX}-coaching`);
    expect(coaching).toHaveTextContent(
      "Later, tap the small face under a post to open this — press and hold it instead and a gentle",
    );
    expect(coaching).toHaveTextContent("is signed on the spot.");
    expect(coaching).toHaveTextContent(
      "Nothing is signed until Set. Prefer sliders or exact numbers? Swap the input in settings.",
    );
    // The face is drawn; its spoken twin says the face and the pair.
    expect(coaching).toHaveTextContent("Nice, For or against +0.10, How much reaches you +0.10");
    // The pair itself rides a geek-mode tail (VouchBackPad.md: "the
    // coaching's exact pair shows only when the reader has asked for exact
    // values").
    const tail = coaching.querySelector(".cg-exact");
    expect(tail).toHaveTextContent("(+0.10 / +0.10)");
    expect(tail).toHaveAttribute("aria-hidden", "true");
  });

  it("never teaches twice: the lines close with the pad", async () => {
    const data = mount();
    await settle();
    await openPad();
    await act(async () => {
      fireEvent.click(screen.getByTestId(`${PREFIX}-cancel`));
    });
    await openPad();
    expect(screen.getByTestId(`${PREFIX}-pad`)).toBeInTheDocument();
    expect(screen.queryByTestId(`${PREFIX}-coaching`)).toBeNull();
    expect(data.sent).toEqual([]);
  });

  it("stays as long as its pad does rather than timing out", async () => {
    mount();
    await settle();
    await openPad();
    await settle(60_000);
    expect(screen.getByTestId(`${PREFIX}-coaching`)).toBeInTheDocument();
    await act(async () => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(screen.queryByTestId(`${PREFIX}-coaching`)).toBeNull();
  });

  it("is not spent by a hold, which opens nothing to teach in", async () => {
    const data = mount();
    await settle();
    await hold();
    expect(data.sent).toHaveLength(1);
    await openPad();
    expect(screen.getByTestId(`${PREFIX}-coaching`)).toBeInTheDocument();
  });

  it("is spent by a first open of the alternates, which carry no lines", async () => {
    mount();
    await settle();
    await act(async () => {
      fireEvent.click(screen.getByTestId(`${PREFIX}-choose`));
    });
    expect(screen.queryByTestId(`${PREFIX}-coaching`)).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByTestId("stance-alt-cancel"));
    });
    await openPad();
    expect(screen.queryByTestId(`${PREFIX}-coaching`)).toBeNull();
  });

  it("speaks between the field and the landing line, where the pad parks", async () => {
    mount();
    await settle();
    await openPad();
    const coaching = screen.getByTestId(`${PREFIX}-coaching`);
    const field = screen.getByTestId(FIELD_ID);
    const landing = screen.getByTestId(`${PREFIX}-landing`);
    expect(field.compareDocumentPosition(coaching) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(coaching.compareDocumentPosition(landing) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("does not teach an anonymous reader, who is asked to join instead", async () => {
    const data = mount({}, { signedIn: false });
    await settle();
    await openPad();
    expect(screen.getByTestId("join-prompt")).toBeInTheDocument();
    expect(screen.queryByTestId(`${PREFIX}-pad`)).toBeNull();
    expect(screen.queryByTestId(`${PREFIX}-coaching`)).toBeNull();
    expect(data.sent).toEqual([]);
  });
});

describe("the tap", () => {
  beforeEach(() => {
    alreadyTaught();
  });

  it("opens the pad and stages nothing", async () => {
    const data = mount({ seed: { "post-1": { records: [{ pDirected: 0.4, pInterest: -0.2 }] } } });
    await settle();
    await openPad();
    expect(screen.getByTestId(`${PREFIX}-pad`)).toBeInTheDocument();
    await settle(60_000);
    expect(data.sent).toEqual([]);
    expect(screen.queryByTestId(`${PREFIX}-signed`)).toBeNull();
    // The resting target still wears what was there before.
    expect(screen.getByTestId(`${PREFIX}-resting-exact`)).toHaveTextContent("+0.40 / −0.20");
  });

  it("opens the pad from a keyboard press too, which is a click without a pointer", async () => {
    const data = mount();
    await settle();
    await act(async () => {
      fireEvent.click(control());
    });
    expect(screen.getByTestId(`${PREFIX}-pad`)).toBeInTheDocument();
    expect(data.sent).toEqual([]);
  });

  it("opens even after a hold whose lift never became a click", async () => {
    // A long press can end without the browser's click — the platform
    // swallows it — and the swallow the hold armed must not eat the
    // next tap.
    const data = mount();
    await settle();
    fireEvent.pointerDown(control(), { pointerId: 1, clientX: 0, clientY: 0 });
    await settle(LONG_PRESS_MS + 1);
    await act(async () => {
      fireEvent.pointerUp(control(), { pointerId: 1 });
    });
    await settle();
    expect(data.sent).toHaveLength(1);
    await openPad();
    expect(screen.getByTestId(`${PREFIX}-pad`)).toBeInTheDocument();
  });
});

describe("the hold", () => {
  beforeEach(() => {
    alreadyTaught();
  });

  it("commits the low default verbatim — no delta against the bundle", async () => {
    // A history is present, so a client that folded anything into the
    // written value would send something other than the default.
    const data = mount({ seed: { "post-1": { records: [{ pDirected: 0.4, pInterest: -0.2 }] } } });
    await settle();
    await hold();
    expect(data.sent).toEqual([{ target: "post-1", pick: TAP_DEFAULT }]);
  });

  it("opens nothing — neither during the hold nor on the lift after it", async () => {
    const data = mount();
    await settle();
    fireEvent.pointerDown(control(), { pointerId: 1, clientX: 0, clientY: 0 });
    await settle(LONG_PRESS_MS + 1);
    expect(screen.queryByTestId(`${PREFIX}-pad`)).toBeNull();
    await act(async () => {
      fireEvent.pointerUp(control(), { pointerId: 1 });
      fireEvent.click(control());
    });
    await settle();
    expect(screen.queryByTestId(`${PREFIX}-pad`)).toBeNull();
    expect(screen.queryByTestId(`${PREFIX}-scrim`)).toBeNull();
    expect(data.sent).toHaveLength(1);
  });

  it("goes inert at the hold, so a second press in the signature's gap arms nothing", async () => {
    // stance-control.md "Confirmation": the anchor goes inert at the
    // hold. The projection is held open here, so the gap is observable.
    const data = mount();
    await settle();
    const project = data.project;
    const held: (() => void)[] = [];
    data.project = (target, pick) =>
      new Promise((resolve) => {
        held.push(() => resolve(project(target, pick)));
      });
    await hold();
    fireEvent.pointerDown(control(), { pointerId: 2, clientX: 0, clientY: 0 });
    await settle(LONG_PRESS_MS + 1);
    await act(async () => {
      for (const open of held) open();
    });
    await settle();
    expect(data.sent).toHaveLength(1);
  });

  it("does not sign a press lifted before the threshold — that is a tap", async () => {
    const data = mount();
    await settle();
    fireEvent.pointerDown(control(), { pointerId: 1, clientX: 0, clientY: 0 });
    await settle(LONG_PRESS_MS - 50);
    await act(async () => {
      fireEvent.pointerUp(control(), { pointerId: 1 });
    });
    await settle(LONG_PRESS_MS * 4);
    expect(data.sent).toEqual([]);
  });

  it("does not sign a press that slid off the face before the threshold", async () => {
    // The target sits at (400, 500), 120×48. A thumb that travels off it
    // has stopped holding it, whatever it does afterwards.
    const data = mount();
    await settle();
    fireEvent.pointerDown(control(), { pointerId: 1, clientX: 420, clientY: 520 });
    fireEvent.pointerMove(control(), { pointerId: 1, clientX: 420, clientY: 300 });
    await settle(LONG_PRESS_MS * 4);
    expect(data.sent).toEqual([]);
  });

  it("still signs a hold whose thumb wobbles on the face", async () => {
    const data = mount();
    await settle();
    fireEvent.pointerDown(control(), { pointerId: 1, clientX: 420, clientY: 520 });
    fireEvent.pointerMove(control(), { pointerId: 1, clientX: 424, clientY: 523 });
    await settle(LONG_PRESS_MS + 1);
    expect(data.sent).toHaveLength(1);
  });

  it("moves the resting target to the pending-inclusive fold at once", async () => {
    // §8.3: the answer is visible before the record lands. The number is
    // the fold's projection, never arithmetic done in the control.
    const data = mount({ seed: { "post-1": { records: [{ pDirected: 0.45, pInterest: 0.1 }] } } });
    await settle();
    expect(screen.getByTestId(`${PREFIX}-resting-exact`)).toHaveTextContent("+0.45 / +0.10");
    await hold();
    expect(screen.getByTestId(`${PREFIX}-resting-exact`)).toHaveTextContent("+0.55 / +0.20");
    expect(control()).toHaveTextContent("😊");
    expect(data.sent).toHaveLength(1);
  });

  it("never moves the face before the signature is taken (RowSigning.md)", async () => {
    const data = mount({ seed: { "post-1": { records: [{ pDirected: 0.45, pInterest: 0.1 }] } } });
    await settle();
    const commit = data.commit;
    const held: (() => void)[] = [];
    data.commit = (target, pick) =>
      new Promise((resolve) => {
        held.push(() => resolve(commit(target, pick)));
      });
    fireEvent.pointerDown(control(), { pointerId: 1, clientX: 0, clientY: 0 });
    await settle(LONG_PRESS_MS + 1);
    expect(screen.getByTestId(`${PREFIX}-resting-exact`)).toHaveTextContent("+0.45 / +0.10");
    await act(async () => {
      for (const open of held) open();
    });
    await settle();
    expect(screen.getByTestId(`${PREFIX}-resting-exact`)).toHaveTextContent("+0.55 / +0.20");
  });

  it("says Signing… under the face past 200ms, and never before", async () => {
    const data = mount();
    await settle();
    const commit = data.commit;
    const held: (() => void)[] = [];
    data.commit = (target, pick) =>
      new Promise((resolve) => {
        held.push(() => resolve(commit(target, pick)));
      });
    fireEvent.pointerDown(control(), { pointerId: 1, clientX: 0, clientY: 0 });
    await settle(LONG_PRESS_MS + 1);
    expect(screen.queryByTestId(`${PREFIX}-row-line`)).toBeNull();
    // Inert at once, and saying so only past the wait.
    expect(control()).toHaveAttribute("aria-busy", "true");
    await settle(SETTING_AFTER_MS);
    expect(screen.getByTestId(`${PREFIX}-row-line`)).toHaveTextContent("Signing…");
    expect(screen.getByTestId(`${PREFIX}-row-line`)).toHaveAttribute("role", "status");
    await act(async () => {
      for (const open of held) open();
    });
    await settle();
    expect(screen.queryByTestId(`${PREFIX}-row-line`)).toBeNull();
  });

  it("rings the face while held, and clears the ring when the press lifts early", async () => {
    mount();
    await settle();
    fireEvent.pointerDown(control(), { pointerId: 1, clientX: 0, clientY: 0 });
    await settle(LONG_PRESS_MS / 2);
    const ring = screen.getByTestId(`${PREFIX}-hold-ring`);
    expect(ring.querySelector("circle")).toHaveAttribute("stroke", "var(--primary)");
    expect(ring).toHaveAttribute("width", "40");
    await act(async () => {
      fireEvent.pointerUp(control(), { pointerId: 1 });
    });
    expect(screen.queryByTestId(`${PREFIX}-hold-ring`)).toBeNull();
  });

  it("says the write rule's refusal quietly on the row, with no Retry", async () => {
    // RowWriteRule.md: a notice, not a fault — the quiet register, polite.
    const data = mount({ refuse: "WRITE_RULE_FAILED" });
    await settle();
    await hold();
    const line = screen.getByTestId(`${PREFIX}-row-line`);
    expect(line).toHaveTextContent("You can't sign right now.");
    expect(line).toHaveAttribute("role", "status");
    expect(screen.queryByTestId(`${PREFIX}-row-line-retry`)).toBeNull();
    expect(screen.getByTestId(`${PREFIX}-resting-face`)).toHaveTextContent("🫥");
    expect(data.sent).toEqual([]);
  });

  it("confirms the signature on the platform's transient surface", async () => {
    mount();
    await settle();
    // The live region is mounted before it has anything to say, or the
    // announcement is not heard at all.
    expect(screen.getByTestId(`${PREFIX}-signed-region`)).toBeInTheDocument();
    expect(screen.queryByTestId(`${PREFIX}-signed`)).toBeNull();
    await hold();
    // What it says is where the gesture LEFT them, not what they picked
    // (Android's `stance_signed`, PR #443 item 7): the hold's own pair is
    // (+0.10, +0.10) and the standing here folds to the same, but the
    // sentence names the standing and would keep naming it if a prior
    // bundle made the two differ.
    expect(screen.getByTestId(`${PREFIX}-signed`)).toHaveTextContent(
      "Signed, still settling. Current opinion: Nice, For or against +0.10, How much reaches you +0.10",
    );
    // Built from spans (`signedLine`): the face is drawn and the digits ride
    // a geek-mode span behind it.
    const signed = screen.getByTestId(`${PREFIX}-signed`);
    expect(signed.querySelector(".cg-exact")).toHaveTextContent("(+0.10 / +0.10)");
  });

  it("names the standing the gesture produced, not the pick that produced it", async () => {
    const data = mount({ seed: { "post-1": { records: [{ pDirected: 0.5, pInterest: 0.4 }] } } });
    await settle();
    await hold();
    // The hold sends (+0.10, +0.10) and the fold answers (+0.60, +0.50) —
    // the receipt carries the second, which is the whole point of naming
    // the standing rather than echoing the pick back.
    expect(data.sent).toEqual([{ target: "post-1", pick: { pDirected: 0.1, pInterest: 0.1 } }]);
    expect(screen.getByTestId(`${PREFIX}-signed`)).toHaveTextContent(
      "Current opinion: Really into this, For or against +0.60, How much reaches you +0.50",
    );
  });

  it("clears the confirmation rather than leaving it on the screen", async () => {
    mount();
    await settle();
    await hold();
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
    await hold();
    await settle();
    expect(data.freshFlags.slice(1)).toEqual([true]);
  });

  it("leaves the face where it was when the hold does not sign, and offers Retry", async () => {
    // RowSigning.md: "the face stays where it was AND the line under it
    // reads That didn't sign. in the failure voice followed by Retry".
    const data = mount({ seed: { "post-1": { records: [{ pDirected: 0.45, pInterest: 0.1 }] } } });
    await settle();
    const commit = data.commit;
    const offline = createStubStanceData({ offline: true });
    data.commit = offline.commit;
    await hold();
    await settle();
    expect(screen.getByTestId(`${PREFIX}-resting-exact`)).toHaveTextContent("+0.45 / +0.10");
    const line = screen.getByTestId(`${PREFIX}-row-line`);
    expect(line).toHaveTextContent("That didn't sign.");
    expect(line).toHaveAttribute("role", "alert");
    // Retry asks the same hold again.
    data.commit = commit;
    await act(async () => {
      fireEvent.click(screen.getByTestId(`${PREFIX}-row-line-retry`));
    });
    await settle();
    expect(data.sent).toEqual([{ target: "post-1", pick: TAP_DEFAULT }]);
    expect(screen.queryByTestId(`${PREFIX}-row-line`)).toBeNull();
  });

  it("asks an anonymous reader to join instead of bouncing the read", async () => {
    const data = mount({}, { signedIn: false });
    await settle();
    await hold();
    expect(screen.getByTestId("join-prompt")).toBeInTheDocument();
    expect(data.sent).toEqual([]);
  });

  it("surfaces a failed write beside the control, not as a read fault", async () => {
    mount({ offline: true });
    await settle();
    await hold();
    expect(screen.getByTestId(`${PREFIX}-row-line`)).toBeInTheDocument();
    // Never a snackbar for a failure.
    expect(screen.queryByTestId(`${PREFIX}-signed`)).toBeNull();
  });
});

describe("the pad the tap opens", () => {
  beforeEach(() => {
    alreadyTaught();
  });

  it("blooms at the default, +0.10 / +0.10", async () => {
    // stance-control.md (jakob 2026-10-05): the hold's own modest
    // positive, so Set on a pick never moved signs exactly what the hold
    // would.
    mount();
    await settle();
    await openPad();
    expect(screen.getByTestId(`${PREFIX}-pad`)).toBeInTheDocument();
    expect(knob().style.left).toBe("55%");
    expect(knob().style.top).toBe("45%");
    expect(screen.getByTestId(`${PREFIX}-exact`)).toHaveTextContent("+0.10 / +0.10");
  });

  it("signs exactly what the hold would when Set meets an unmoved pick", async () => {
    const data = mount();
    await settle();
    await openPad();
    await pressSet();
    expect(data.sent).toEqual([{ target: "post-1", pick: TAP_DEFAULT }]);
  });

  it("does not open on a hold", async () => {
    mount();
    await settle();
    fireEvent.pointerDown(control(), { pointerId: 1, clientX: 0, clientY: 0 });
    await settle(LONG_PRESS_MS + 1);
    expect(screen.queryByTestId(`${PREFIX}-pad`)).toBeNull();
  });

  it("maps horizontal to one parameter and vertical to the other", async () => {
    const data = mount();
    await settle();
    await openPad();
    await dragAndSet(HALF / 2, -HALF / 2);
    expect(data.sent).toHaveLength(1);
    // From the default: half a unit across, half a unit up.
    expect(data.sent[0].pick.pDirected).toBeCloseTo(0.6, 10);
    expect(data.sent[0].pick.pInterest).toBeCloseTo(0.6, 10);
  });

  it("reaches the corners at the drawn corners", async () => {
    // §8.3: the drawn field IS the value space, so the extreme values sit
    // where the drawing ends rather than somewhere past it.
    const data = mount();
    await settle();
    await openPad();
    layOutPad();
    // Past the corner from the default: the corner, and nothing beyond.
    moveKnob(-2 * HALF, 2 * HALF);
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
    await openPad();
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
      moveKnob(clientX, clientY);
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
    await openPad();
    const field = screen.getByTestId(FIELD_ID);
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
    await openPad();
    const field = layOutPad();
    fireEvent.pointerDown(field, { pointerId: 1, clientX: 640, clientY: 480 });
    fireEvent.pointerMove(field, { pointerId: 1, clientX: 640 + HALF / 2, clientY: 480 });
    await settle();
    await act(async () => {
      fireEvent.pointerUp(field, { pointerId: 1 });
    });
    await pressSet();
    expect(data.sent[0].pick.pDirected).toBeCloseTo(0.6, 10);
    expect(data.sent[0].pick.pInterest).toBeCloseTo(0.1, 10);
  });

  it("opens at the default wherever the tap landed", async () => {
    mount();
    await settle();
    await act(async () => {
      fireEvent.pointerDown(control(), { pointerId: 1, clientX: 640, clientY: 480 });
      fireEvent.pointerUp(control(), { pointerId: 1 });
      fireEvent.click(control(), { clientX: 640, clientY: 480 });
    });
    expect(knob().style.left).toBe("55%");
    expect(knob().style.top).toBe("45%");
  });

  it("cancels on Escape without writing anything", async () => {
    const data = mount();
    await settle();
    await openPad();
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
    await openPad();
    layOutPad();
    moveKnob(HALF, 0);
    await settle();
    await release();
    expect(screen.getByTestId(`${PREFIX}-pad`)).toBeInTheDocument();
    expect(screen.getByTestId(`${PREFIX}-exact`)).toHaveTextContent("+1.00 / +0.10");
    expect(data.sent).toEqual([]);
  });

  it("signs the standing pick when Set is pressed, and closes", async () => {
    const data = mount();
    await settle();
    await openPad();
    await dragAndSet(HALF, 0);
    expect(data.sent).toEqual([{ target: "post-1", pick: { pDirected: 1, pInterest: 0.1 } }]);
    expect(screen.queryByTestId(`${PREFIX}-pad`)).toBeNull();
  });

  it("adjusts the standing pick on a second drag rather than starting over", async () => {
    // The pad parks, so the field is the surface a further adjustment
    // happens on — and it moves the knob by the same accumulated travel.
    const data = mount();
    await settle();
    await openPad();
    layOutPad();
    moveKnob(HALF / 2, 0);
    await settle();
    await release();
    const field = screen.getByTestId(FIELD_ID);
    fireEvent.pointerDown(field, { pointerId: 2, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(field, { pointerId: 2, clientX: HALF / 4, clientY: 0 });
    await settle();
    await act(async () => {
      fireEvent.pointerUp(field, { pointerId: 2 });
    });
    await pressSet();
    // +0.10, then half a unit, then a quarter.
    expect(data.sent[0].pick.pDirected).toBeCloseTo(0.85, 10);
  });

  it("dismisses on Cancel and stages nothing", async () => {
    const data = mount();
    await settle();
    await openPad();
    layOutPad();
    moveKnob(HALF, 0);
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
    await openPad();
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
    await openPad();
    layOutPad();
    moveKnob(HALF, 0);
    await settle();
    await act(async () => {
      fireEvent.pointerCancel(screen.getByTestId(FIELD_ID), { pointerId: 1 });
    });
    expect(screen.getByTestId(`${PREFIX}-pad`)).toBeInTheDocument();
    expect(screen.getByTestId(`${PREFIX}-exact`)).toHaveTextContent("+1.00 / +0.10");
    expect(data.sent).toEqual([]);
  });

  it("explains the gesture on demand, and says releasing changes nothing", async () => {
    // stance-control.md "The gesture": the `?` replaces the pad's body
    // with four lines of help (copy-voice.md "The pad's four help lines").
    mount();
    await settle();
    await openPad();
    await release();
    expect(screen.queryByTestId(`${PREFIX}-explanation`)).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByTestId(`${PREFIX}-explain`));
    });
    const explanation = screen.getByTestId(`${PREFIX}-explanation`);
    expect(explanation.querySelectorAll("p")).toHaveLength(4);
    expect(explanation).toHaveTextContent("Letting go changes nothing. Set signs it, Cancel leaves without signing.");
    expect(explanation).toHaveTextContent("that's why the two faces can differ.");
    expect(explanation).toHaveTextContent("Walk it back takes everything you've said to nothing.");
    expect(screen.getByTestId(`${PREFIX}-explain`)).toHaveAccessibleName("How opinions work");
  });

  it("replaces the pad's body with the help, and disables Set while it shows", async () => {
    const data = mount();
    await settle();
    await openPad();
    await act(async () => {
      fireEvent.click(screen.getByTestId(`${PREFIX}-explain`));
    });
    // The field is not there to check against, so nothing signs through it.
    expect(screen.queryByTestId(`${PREFIX}-field`)).toBeNull();
    expect(screen.getByTestId(`${PREFIX}-set`)).toBeDisabled();
    await pressSet();
    expect(data.sent).toEqual([]);
    await act(async () => {
      fireEvent.click(screen.getByTestId(`${PREFIX}-explain-back`));
    });
    expect(screen.getByTestId(FIELD_ID)).toBeInTheDocument();
    expect(screen.getByTestId(`${PREFIX}-set`)).toBeEnabled();
  });

  it("closes the explanation again rather than trapping the reader in it", async () => {
    mount();
    await settle();
    await openPad();
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

// THE PAD AS ITS MASTERS DRAW IT (`StanceControl.jsx`, `StancePad.jsx`,
// PadStanding.md) — the shell, the field, the `?` and the commit row that
// jakob's round-6 hand test found far from the board.
describe("the pad as its masters draw it", () => {
  beforeEach(() => {
    alreadyTaught();
  });

  const standingBundle = { seed: { "post-1": { records: [{ pDirected: 1, pInterest: 1 }] } } };

  it("is a modal dialog named for its target, 17rem wide, 12px between its parts", async () => {
    mount();
    await settle();
    await openPad();
    const pad = screen.getByTestId(`${PREFIX}-pad`);
    expect(pad).toHaveAttribute("role", "dialog");
    expect(pad).toHaveAttribute("aria-modal", "true");
    expect(pad).toHaveAccessibleName("Opinion pad for this post");
    expect(pad.className).toContain("w-[17rem]");
    // 17rem of CONTENT, as the master's inline style measures it: its 16px
    // padding comes on top (304px in all), not out of the 17rem.
    expect(pad.className).toContain("box-content");
    expect(pad.className).toContain("gap-3");
    expect(pad.className).toContain("p-4");
    expect(pad.className).toContain("rounded-extra-large");
    expect(pad.className).toContain("bg-surface-container-high");
  });

  it("moves focus into the pad on open and back to the face on close", async () => {
    mount();
    await settle();
    await openPad();
    expect(document.activeElement).toBe(screen.getByTestId(`${PREFIX}-pad`));
    await act(async () => {
      fireEvent.click(screen.getByTestId(`${PREFIX}-cancel`));
    });
    expect(document.activeElement).toBe(control());
  });

  it("keeps Tab inside the pad while it is up", async () => {
    mount();
    await settle();
    await openPad();
    const set = screen.getByTestId(`${PREFIX}-set`);
    set.focus();
    await act(async () => {
      fireEvent.keyDown(screen.getByTestId(`${PREFIX}-pad`), { key: "Tab" });
    });
    // Past the last control, Tab wraps to the first — the corner `?`.
    expect(document.activeElement).toBe(screen.getByTestId(`${PREFIX}-explain`));
  });

  it("names the field's four ends in gutters outside it, nothing inside", async () => {
    // StancePad.prompt.md: "The four pole words sit OUTSIDE the field, in
    // gutters the component reserves" — 56px either side, 20px above/below.
    mount();
    await settle();
    await openPad();
    expect(screen.getByTestId(`${PREFIX}-field-left`)).toHaveTextContent("Against");
    expect(screen.getByTestId(`${PREFIX}-field-right`)).toHaveTextContent("For");
    expect(screen.getByTestId(`${PREFIX}-field-top`)).toHaveTextContent("More");
    expect(screen.getByTestId(`${PREFIX}-field-bottom`)).toHaveTextContent("Less");
    const field = screen.getByTestId(`${PREFIX}-field`);
    expect(field.className).toContain("px-[56px]");
    expect(field.className).toContain("py-[20px]");
    const square = screen.getByTestId(FIELD_ID);
    expect(square).not.toHaveTextContent("Against");
    expect(square.className).toContain("bg-surface-container-highest");
    // The dead ground: both zero lines, in the hairline role.
    expect(screen.getByTestId(`${PREFIX}-field-zero-across`).className).toContain("bg-outline-variant");
    expect(screen.getByTestId(`${PREFIX}-field-zero-down`).className).toContain("bg-outline-variant");
  });

  it("draws a topic's own ends on the field", async () => {
    mount({}, { target: TOPIC_TARGET, axes: AFFINITY_AXES });
    await settle();
    await openPad();
    expect(screen.getByTestId(`${PREFIX}-field-left`)).toHaveTextContent("Dislike");
    expect(screen.getByTestId(`${PREFIX}-field-top`)).toHaveTextContent("Close to me");
  });

  it("puts the knob's pressed layer on while a pointer is down, and never scales it", async () => {
    mount();
    await settle();
    await openPad();
    const travel = knob().parentElement!;
    expect(travel.children).toHaveLength(1);
    fireEvent.pointerDown(screen.getByTestId(FIELD_ID), { pointerId: 1, clientX: 0, clientY: 0 });
    await settle();
    expect(travel.children).toHaveLength(2);
    const layer = travel.children[0] as HTMLElement;
    expect(layer.className).toContain("size-10");
    expect(layer.className).toContain("opacity-10");
    expect(knob().className).toContain("size-5");
    await release();
    expect(travel.children).toHaveLength(1);
  });

  it("carries a circled ? in its top-right corner, out of the commit row", async () => {
    mount();
    await settle();
    await openPad();
    const help = screen.getByTestId(`${PREFIX}-explain`);
    expect(help.className).toContain("absolute");
    expect(help.className).toContain("right-1");
    expect(help.className).toContain("top-1");
    const ring = help.firstElementChild as HTMLElement;
    expect(ring.className).toContain("size-8");
    expect(ring.className).toContain("rounded-full");
    expect(ring.className).toContain("border-outline-variant");
    expect(screen.getByTestId(`${PREFIX}-cancel`).parentElement).not.toContainElement(help);
  });

  it("sets Walk it back, Cancel and Set in ONE row, the walk-away pushed left", async () => {
    // PadStanding.md: "the pad carries four controls, Walk it back on the
    // left pushed away from Cancel and Set on the right".
    mount(standingBundle);
    await settle();
    await openPad();
    const sever = screen.getByTestId(`${PREFIX}-sever`);
    const cancel = screen.getByTestId(`${PREFIX}-cancel`);
    const set = screen.getByTestId(`${PREFIX}-set`);
    expect(sever.parentElement).toBe(cancel.parentElement);
    expect(set.parentElement).toBe(cancel.parentElement);
    expect([...cancel.parentElement!.children]).toEqual([sever, cancel, set]);
    expect(sever.className).toContain("mr-auto");
    expect(cancel.parentElement!.className).toContain("justify-end");
  });

  it("keeps the pad open while Set's signing waits, saying Setting… past 200ms", async () => {
    // PadStanding.md: Set refuses a second press, the pad stays open, never
    // dims, and reads Setting… only once 200ms pass unanswered.
    const data = mount();
    await settle();
    await openPad();
    const commit = data.commit;
    const held: (() => void)[] = [];
    data.commit = (target, pick) =>
      new Promise((resolve) => {
        held.push(() => resolve(commit(target, pick)));
      });
    await pressSet();
    const set = screen.getByTestId(`${PREFIX}-set`);
    expect(screen.getByTestId(`${PREFIX}-pad`)).toBeInTheDocument();
    expect(set).toHaveTextContent("Set");
    expect(set).toHaveAttribute("aria-disabled", "true");
    expect(set).toBeEnabled();
    await settle(SETTING_AFTER_MS);
    expect(set).toHaveTextContent("Setting…");
    await pressSet();
    await act(async () => {
      for (const open of held) open();
    });
    await settle();
    expect(data.sent).toHaveLength(1);
    expect(screen.queryByTestId(`${PREFIX}-pad`)).toBeNull();
  });

  it("keeps the pad at the pick with the fault and an outlined Retry when Set fails", async () => {
    // PadFailed.md.
    const data = mount();
    await settle();
    await openPad();
    const commit = data.commit;
    data.commit = createStubStanceData({ offline: true }).commit;
    await pressSet();
    await settle();
    expect(screen.getByTestId(`${PREFIX}-pad`)).toBeInTheDocument();
    const fault = screen.getByTestId(`${PREFIX}-pad-failed`);
    expect(fault).toHaveTextContent("That didn't send. Try again.");
    expect(fault).toHaveAttribute("role", "alert");
    const retry = screen.getByTestId(`${PREFIX}-set`);
    expect(retry).toHaveTextContent("Retry");
    expect(retry.className).toContain("border-outline");
    // Never on the snackbar, and nothing on the row.
    expect(screen.queryByTestId(`${PREFIX}-signed`)).toBeNull();
    expect(screen.queryByTestId(`${PREFIX}-row-line`)).toBeNull();
    data.commit = commit;
    await pressSet();
    await settle();
    expect(data.sent).toEqual([{ target: "post-1", pick: TAP_DEFAULT }]);
    expect(screen.queryByTestId(`${PREFIX}-pad`)).toBeNull();
  });

  it("stands the write rule's notice where the landing and the commit row were", async () => {
    // PadWriteRule.md.
    const data = mount({ refuse: "WRITE_RULE_FAILED" });
    await settle();
    await openPad();
    await pressSet();
    await settle();
    const notice = screen.getByTestId(`${PREFIX}-write-rule`);
    expect(notice).toHaveTextContent("You can't sign right now");
    expect(notice).toHaveTextContent(
      "Each signing is paid for, and there's only so much to go around at a time. Nothing was signed or spent.",
    );
    expect(notice.className).toContain("bg-tertiary-container");
    expect(screen.queryByTestId(`${PREFIX}-set`)).toBeNull();
    expect(screen.queryByTestId(`${PREFIX}-cancel`)).toBeNull();
    expect(screen.queryByTestId(`${PREFIX}-landing`)).toBeNull();
    // The field and the standing stay where they were.
    expect(screen.getByTestId(FIELD_ID)).toBeInTheDocument();
    // Its own ? opens Why signing waits.
    await act(async () => {
      fireEvent.click(screen.getByTestId(`${PREFIX}-write-rule-help`));
    });
    expect(screen.getByTestId(`${PREFIX}-notice-help`)).toHaveAttribute("aria-label", "Why signing waits");
    await act(async () => {
      fireEvent.click(screen.getByTestId(`${PREFIX}-not-now`));
    });
    expect(screen.queryByTestId(`${PREFIX}-pad`)).toBeNull();
    expect(data.sent).toEqual([]);
  });

  it("asks the walk-back over the parked pad, and Keep it returns to the pick", async () => {
    // PadStanding.md: "the dialog Walk it all back? opens over the pad, which
    // stays parked beneath it".
    mount(standingBundle);
    await settle();
    await openPad();
    await act(async () => {
      fireEvent.click(screen.getByTestId(`${PREFIX}-sever`));
    });
    expect(screen.getByTestId("severance-confirm")).toHaveTextContent("Walk it all back?");
    expect(screen.getByTestId(`${PREFIX}-pad`)).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByTestId("severance-cancel"));
    });
    expect(screen.queryByTestId("severance-confirm")).toBeNull();
    expect(screen.getByTestId(`${PREFIX}-pad`)).toBeInTheDocument();
  });
});

// THE KEY ELSEWHERE (PadKeyAbsent.md, PadPending.md) — drawn against stubbed
// data only: no real key, no restore ever runs here.
describe("the pad with the signing key elsewhere", () => {
  beforeEach(() => {
    alreadyTaught();
  });

  const keepPending = async () => {
    await act(async () => {
      fireEvent.click(screen.getByTestId(`${PREFIX}-keep-pending`));
    });
  };

  it("opens anyway, carrying the key notice where the landing and the actions would", async () => {
    const data = mount({ keyAbsent: true });
    await settle();
    await openPad();
    await settle();
    const notice = screen.getByTestId(`${PREFIX}-key-absent`);
    expect(notice).toHaveTextContent("Your key isn't on this browser");
    expect(notice).toHaveTextContent(
      "Signing needs your key, which isn't in this browser — the write waits as pending.",
    );
    expect(notice).toHaveTextContent("Restore the key with your recovery code to finish.");
    expect(notice.className).toContain("bg-tertiary-container");
    expect(notice.innerHTML).not.toContain("error");
    expect(screen.getByTestId(`${PREFIX}-restore`)).toHaveAttribute("href", "/restore");
    expect(screen.getByTestId(`${PREFIX}-key-help`)).toHaveAccessibleName("Your key");
    // No Set, no Cancel, no Walk it back, no landing line.
    for (const gone of ["set", "cancel", "sever", "landing"]) {
      expect(screen.queryByTestId(`${PREFIX}-${gone}`)).toBeNull();
    }
    // The standing, the pick's readout and the field still stand.
    expect(screen.getByTestId(`${PREFIX}-standing`)).toBeInTheDocument();
    expect(screen.getByTestId(`${PREFIX}-pick`)).toBeInTheDocument();
    expect(screen.getByTestId(FIELD_ID)).toBeInTheDocument();
    expect(data.sent).toEqual([]);
  });

  it("opens the pad on a hold too, and signs nothing", async () => {
    const data = mount({ keyAbsent: true });
    await settle();
    await hold();
    await settle();
    expect(screen.getByTestId(`${PREFIX}-key-absent`)).toBeInTheDocument();
    expect(data.sent).toEqual([]);
  });

  it("moves the pick under a drag, and still signs nothing", async () => {
    const data = mount({ keyAbsent: true });
    await settle();
    await openPad();
    await settle();
    layOutPad();
    moveKnob(HALF / 2, 0);
    await settle();
    await release();
    expect(screen.getByTestId(`${PREFIX}-exact`)).toHaveTextContent("+0.60 / +0.10");
    expect(data.sent).toEqual([]);
  });

  it("keeps the pick only by its own words, and the anchor then wears it", async () => {
    // PadPending.md: the kept pick's face, `Waiting for your key` under it,
    // and an accessible name that says what it waits on.
    const data = mount({ keyAbsent: true });
    await settle();
    await openPad();
    await settle();
    layOutPad();
    moveKnob(HALF * 0.45, -HALF * 0.1);
    await settle();
    await release();
    await keepPending();
    await settle();
    expect(screen.queryByTestId(`${PREFIX}-pad`)).toBeNull();
    expect(screen.getByTestId(`${PREFIX}-resting-face`)).toHaveTextContent("😊");
    expect(screen.getByTestId(`${PREFIX}-kept`)).toHaveTextContent("Waiting for your key");
    expect(screen.getByTestId(`${PREFIX}-kept`)).not.toHaveTextContent("Still settling");
    expect(control()).toHaveAccessibleName(
      "Your opinion on this post, waiting for your key: Like this, +0.55 / +0.20.",
    );
    expect(data.sent).toEqual([]);
    // Tapping the kept face opens the pad again, holding the kept pick.
    await openPad();
    await settle();
    expect(screen.getByTestId(`${PREFIX}-exact`)).toHaveTextContent("+0.55 / +0.20");
    expect(screen.getByTestId(`${PREFIX}-key-absent`)).toBeInTheDocument();
  });

  it("drops the pick on a press outside, as a Cancel would", async () => {
    mount({ keyAbsent: true });
    await settle();
    await openPad();
    await settle();
    await act(async () => {
      fireEvent.pointerDown(screen.getByTestId(`${PREFIX}-scrim`), { pointerId: 3 });
    });
    expect(screen.queryByTestId(`${PREFIX}-pad`)).toBeNull();
    expect(screen.queryByTestId(`${PREFIX}-kept`)).toBeNull();
  });

  it("carries the pad's one ?: the notice's, never the pad's own beside it", async () => {
    // PadKeyAbsent draws no pad "?" over the notice's — at most one per screen.
    mount({ keyAbsent: true });
    await settle();
    await openPad();
    await settle();
    expect(screen.getByTestId(`${PREFIX}-key-help`)).toBeInTheDocument();
    expect(screen.queryByTestId(`${PREFIX}-explain`)).toBeNull();
  });

  it("opens the Your key text from the notice's ?", async () => {
    mount({ keyAbsent: true });
    await settle();
    await openPad();
    await settle();
    await act(async () => {
      fireEvent.click(screen.getByTestId(`${PREFIX}-key-help`));
    });
    expect(screen.getByTestId(`${PREFIX}-notice-help`)).toHaveTextContent("Your key");
  });

  it("replaces a pick kept on the same target, and keeps several targets at once", async () => {
    // PadKeyAbsent.md:31,35.
    await keepPick("u1", { kind: "post", id: "other" }, { pDirected: 0.3, pInterest: 0.3 });
    await keepPick("u1", { kind: "post", id: "post-1" }, { pDirected: 0.1, pInterest: 0.1 });
    mount({ keyAbsent: true });
    await settle();
    await openPad();
    await settle();
    expect(screen.getByTestId(`${PREFIX}-exact`)).toHaveTextContent("+0.10 / +0.10");
    layOutPad();
    moveKnob(HALF * 0.45, -HALF * 0.1);
    await settle();
    await release();
    await keepPending();
    await settle();
    const kept = await listKeptPicks("u1");
    expect(kept.map((k) => [k.target.id, k.pick])).toEqual([
      ["other", { pDirected: 0.3, pInterest: 0.3 }],
      ["post-1", { pDirected: 0.55, pInterest: 0.2 }],
    ]);
  });

  it("drops Restore the key and says so when the account has no backup, keeping Keep it pending", async () => {
    // PadKeyAbsent.md:49; KeyElsewhereNoBackup.md:15-17.
    mount({ keyAbsent: true, noBackup: true });
    await settle();
    await openPad();
    await settle();
    const notice = screen.getByTestId(`${PREFIX}-key-absent`);
    expect(notice).toHaveTextContent(
      "This account has no backup, so the key can't be brought here yet. Make a recovery code on the device that holds it, then restore it here. Until then, anything you sign waits as pending.",
    );
    expect(notice).not.toHaveTextContent("Restore the key with your recovery code to finish.");
    expect(screen.queryByTestId(`${PREFIX}-restore`)).toBeNull();
    expect(screen.getByTestId(`${PREFIX}-keep-pending`)).toHaveTextContent("Keep it pending, restore later");
  });

  it("carries the same notice in the alternates, in place of the landing and the actions", async () => {
    // §8.6: the alternates replace the pad everywhere, the key notice included.
    const data = mount({ keyAbsent: true }, { mode: "sliders" });
    await settle();
    await openPad();
    await settle();
    const dialog = screen.getByTestId("stance-alternates");
    expect(dialog).toContainElement(screen.getByTestId(`${PREFIX}-key-absent`));
    for (const gone of ["stance-alt-commit", "stance-alt-cancel", "stance-alt-help"]) {
      expect(screen.queryByTestId(gone)).toBeNull();
    }
    await keepPending();
    await settle();
    expect(screen.queryByTestId("stance-alternates")).toBeNull();
    expect(screen.getByTestId(`${PREFIX}-kept`)).toHaveTextContent("Waiting for your key");
    expect(data.sent).toEqual([]);
  });
});

// PadPending.md — the anchor while the key is elsewhere and a pick waits.
describe("a pick kept pending, the key elsewhere", () => {
  beforeEach(() => {
    alreadyTaught();
  });

  it("wears the kept pick's face and Waiting for your key, the bundle untouched", async () => {
    await keepPick("u1", { kind: "post", id: "post-1" }, { pDirected: 0.55, pInterest: 0.2 });
    const data = mount({ keyAbsent: true });
    await settle();
    expect(screen.getByTestId(`${PREFIX}-resting-face`)).toHaveTextContent("😊");
    expect(screen.getByTestId(`${PREFIX}-kept`)).toHaveTextContent("Waiting for your key");
    expect(control()).toHaveAccessibleName(
      "Your opinion on this post, waiting for your key: Like this, +0.55 / +0.20.",
    );
    expect(data.recordsOf("post-1")).toEqual([]);
  });

  it("opens the pad holding the kept pick on a hold, and signs nothing", async () => {
    await keepPick("u1", { kind: "post", id: "post-1" }, { pDirected: 0.55, pInterest: 0.2 });
    const data = mount({ keyAbsent: true });
    await settle();
    await hold();
    await settle();
    expect(screen.getByTestId(`${PREFIX}-key-absent`)).toBeInTheDocument();
    expect(screen.getByTestId(`${PREFIX}-exact`)).toHaveTextContent("+0.55 / +0.20");
    expect(data.sent).toEqual([]);
  });
});

// PadPendingReview.md — the anchor once the key is back and the review was left unsigned.
describe("a pick kept pending, the key back", () => {
  beforeEach(() => {
    alreadyTaught();
  });

  it("wears the kept pick's face and Waiting for your review, never Still settling", async () => {
    await keepPick("u1", { kind: "post", id: "post-1" }, { pDirected: 0.55, pInterest: 0.2 });
    mount();
    await settle();
    expect(screen.getByTestId(`${PREFIX}-resting-face`)).toHaveTextContent("😊");
    const line = screen.getByTestId(`${PREFIX}-kept`);
    expect(line).toHaveTextContent("Waiting for your review");
    expect(line).not.toHaveTextContent("Waiting for your key");
    expect(line).not.toHaveTextContent("Still settling");
    expect(control()).toHaveAccessibleName(
      "Your opinion on this post, waiting for your review: Like this, +0.55 / +0.20.",
    );
  });

  it("opens the kept picks' review on a tap — never the key notice, never a pad", async () => {
    await keepPick("u1", { kind: "post", id: "post-1" }, { pDirected: 0.55, pInterest: 0.2 });
    mount();
    await settle();
    await openPad();
    await settle();
    expect(navigated).toEqual(["/kept-picks?from=%2F"]);
    expect(screen.queryByTestId(`${PREFIX}-pad`)).toBeNull();
    expect(screen.queryByTestId(`${PREFIX}-key-absent`)).toBeNull();
  });

  it("opens the review on a hold too, and the hold signs nothing", async () => {
    await keepPick("u1", { kind: "post", id: "post-1" }, { pDirected: 0.55, pInterest: 0.2 });
    const data = mount();
    await settle();
    await hold();
    await settle();
    expect(navigated).toEqual(["/kept-picks?from=%2F"]);
    expect(data.sent).toEqual([]);
  });

  it("waits for the key again once the key leaves this device", async () => {
    // PadPendingReview.md:19 / PadPending.md:21.
    await keepPick("u1", { kind: "post", id: "post-1" }, { pDirected: 0.55, pInterest: 0.2 });
    mount({ keyAbsent: true });
    await settle();
    expect(screen.getByTestId(`${PREFIX}-kept`)).toHaveTextContent("Waiting for your key");
    await openPad();
    await settle();
    expect(screen.getByTestId(`${PREFIX}-key-absent`)).toBeInTheDocument();
    expect(navigated).toEqual([]);
  });

  it("wears Still settling under the face once the batch is signed, until the record is ordered", async () => {
    // PadPendingReview.md:21 — `Still settling`, never `Waiting for your review`.
    markSettling([{ kind: "post", id: "post-1" }]);
    mount({
      seed: { "post-1": { records: [{ pDirected: 0.55, pInterest: 0.2 }] } },
      unorderedRecords: 1,
    });
    await settle();
    expect(screen.queryByTestId(`${PREFIX}-kept`)).toBeNull();
    expect(screen.getByTestId(`${PREFIX}-settling`)).toHaveTextContent("Still settling");
  });

  it("drops Still settling once the ordered read counts the record", async () => {
    markSettling([{ kind: "post", id: "post-1" }]);
    mount({ seed: { "post-1": { records: [{ pDirected: 0.55, pInterest: 0.2 }] } } });
    await settle();
    await settle();
    expect(screen.queryByTestId(`${PREFIX}-settling`)).toBeNull();
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
    await openPad();
    expect(screen.getByTestId(`${PREFIX}-pad`).className).toContain("touch-none");
    expect(screen.getByTestId(FIELD_ID).className).toContain("touch-none");
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

  it("keeps the tap that opens the pad off the surface underneath", async () => {
    const { host } = mountInHost();
    await settle();
    await openPad();
    await release();
    expect(screen.getByTestId(`${PREFIX}-pad`)).toBeInTheDocument();
    expect(host).not.toHaveBeenCalled();
  });

  it("keeps the hold that signs, and its lift, off the surface underneath", async () => {
    const { data, host } = mountInHost();
    await settle();
    await hold();
    expect(data.sent).toHaveLength(1);
    expect(host).not.toHaveBeenCalled();
  });

  it("keeps the open pad's own touches off the surface underneath", async () => {
    const { host } = mountInHost();
    await settle();
    await openPad();
    await release();
    const field = screen.getByTestId(FIELD_ID);
    await act(async () => {
      fireEvent.pointerDown(field, { pointerId: 2, clientX: 0, clientY: 0 });
      fireEvent.pointerUp(field, { pointerId: 2 });
    });
    expect(host).not.toHaveBeenCalled();
  });

  it("keeps the dismissal off the surface underneath", async () => {
    const { host } = mountInHost();
    await settle();
    await openPad();
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
    await openPad();
    const scrim = screen.getByTestId(`${PREFIX}-scrim`);
    expect(scrim.className).toContain("fixed");
    expect(scrim.className).toContain("inset-0");
    // Over the band and the bar too (z-40, above both), the pad after it.
    expect(scrim.className).toContain("z-40");
    expect(screen.getByTestId(`${PREFIX}-pad`).className).toContain("z-40");
    expect(scrim.compareDocumentPosition(screen.getByTestId(`${PREFIX}-pad`)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("dims what it covers with the dialog's wash (PadStanding.jsx)", async () => {
    // jakob's round-6 item 1: the ordinary pad drew no wash at all.
    mount();
    await settle();
    await openPad();
    const scrim = screen.getByTestId(`${PREFIX}-scrim`);
    expect(scrim.className).toContain("bg-scrim/50");
    expect(scrim.className).toContain("cg-scrim-in");
    // Portalled to the document, so no card's stacking context can hold it
    // under the band or the bar.
    expect(scrim.parentElement).toBe(document.body);
  });

  it("takes the scrim away with the pad, so a closed control blocks nothing", async () => {
    mount();
    await settle();
    await openPad();
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
    // Centred around its own width without a transform, so the bloom's
    // rise owns `transform` (`pad-parking.ts`).
    expect(pad.style.left).toBe("0px");
    expect(pad.style.right).toBe("0px");
    expect(pad.style.transform).toBe("");
    expect(pad.style.bottom).toBe(`${PAD_PARK_INSET_PX}px`);
    // Nothing is anchored, so nothing measured a target into a `top`.
    expect(pad.style.top).toBe("");
  };

  it("parks 16px above the bottom bar where the surface has one (PadStanding.md)", async () => {
    mount({}, { barBeneath: true });
    await settle();
    await openPad();
    expect(screen.getByTestId(`${PREFIX}-pad`).style.bottom).toBe(
      "calc(80px + env(safe-area-inset-bottom, 0px))",
    );
  });

  it("parks at the lower centre on a desktop viewport", async () => {
    setViewport(1280, 800);
    mount();
    await settle();
    await openPad();
    expectParked();
  });

  it("parks at the same lower centre on a phone viewport", async () => {
    setViewport(360, 640);
    mount();
    await settle();
    await openPad();
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
      // The tap lands far from the target the pad belongs to.
      await act(async () => {
        fireEvent.pointerDown(control(), { pointerId: 1, clientX: 900, clientY: 40 });
        fireEvent.pointerUp(control(), { pointerId: 1 });
        fireEvent.click(control(), { clientX: 900, clientY: 40 });
      });
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
    await openPad();
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
    await openPad();
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
    expect(control()).toHaveAccessibleName(/Absolutely not/);
    expect(control()).toHaveTextContent("💀");
  });

  it("shows the pick's face and its geek pair live with the drag, never its words", async () => {
    // StanceReadout.prompt.md: "Face and pair — never the anchor's words as
    // well"; the pair always in the markup, in a `cg-exact` span.
    mount({ fold: lastWins });
    await settle();
    await openPad();
    layOutPad();
    expect(screen.getByTestId(`${PREFIX}-exact`)).toHaveTextContent("+0.10 / +0.10");
    expect(screen.getByTestId(`${PREFIX}-exact`).className).toContain("cg-exact");
    moveKnob(HALF * 0.3, -HALF * 0.1);
    await settle();
    expect(screen.getByTestId(`${PREFIX}-exact`)).toHaveTextContent("+0.40 / +0.20");
    expect(screen.getByTestId(`${PREFIX}-face`)).toHaveTextContent("😊");
    expect(screen.getByTestId(`${PREFIX}-face`)).not.toHaveTextContent("Like this");
  });

  it("labels the three readouts Current opinion, Your pick and Resulting opinion", async () => {
    mount({ seed: { "post-1": { records: [{ pDirected: 0.3, pInterest: 0.2 }] } } });
    await settle();
    await openPad();
    expect(screen.getByTestId(`${PREFIX}-standing-label`)).toHaveTextContent("Current opinion");
    expect(screen.getByTestId(`${PREFIX}-pick-label`)).toHaveTextContent("Your pick");
    expect(screen.getByTestId(`${PREFIX}-landing-label`)).toHaveTextContent("Resulting opinion");
    // Each pair is the geek reading; the faces are what paint by default.
    for (const part of ["standing-exact", "exact", "landing-exact"]) {
      expect(screen.getByTestId(`${PREFIX}-${part}`).className).toContain("cg-exact");
    }
  });

  it("names the opinion and the axes for a reader with no field in front of them", async () => {
    mount({ fold: lastWins });
    await settle();
    await openPad();
    expect(screen.getByTestId(`${PREFIX}-pick`)).toHaveTextContent(
      "Your pick: Nice, For or against +0.10, How much reaches you +0.10",
    );
  });

  it("speaks a moving pick only once it has rested 500ms", async () => {
    mount();
    await settle();
    await openPad();
    layOutPad();
    const spoken = () => screen.getByTestId(`${PREFIX}-pick`).querySelector(".sr-only");
    moveKnob(HALF * 0.3, -HALF * 0.1);
    await settle(100);
    // Drawn at once, spoken once it rests.
    expect(screen.getByTestId(`${PREFIX}-exact`)).toHaveTextContent("+0.40 / +0.20");
    expect(spoken()).toHaveTextContent("+0.10");
    await settle(500);
    expect(spoken()).toHaveTextContent("For or against +0.40, How much reaches you +0.20");
  });

  it("shows where the pick lands the bundle, as its own line", async () => {
    mount({ fold: lastWins, seed: { "post-1": { records: [{ pDirected: 0.9, pInterest: 0.9 }] } } });
    await settle();
    await openPad();
    layOutPad();
    moveKnob(-2 * HALF, 2 * HALF);
    await act(async () => {});
    // The PICK's face, from the anchor table (§8.4).
    expect(screen.getByTestId(`${PREFIX}-face`)).toHaveTextContent("💀");
    // The LANDING is its own readout and its own number: the raw sums are
    // (+0.90, +0.90), so a (−1, −1) pick lands at (−0.10, −0.10).
    expect(screen.getByTestId(`${PREFIX}-landing-label`)).toHaveTextContent("Resulting opinion");
    expect(screen.getByTestId(`${PREFIX}-landing-face`)).toHaveTextContent("😑");
    expect(screen.getByTestId(`${PREFIX}-landing-exact`)).toHaveTextContent("−0.10 / −0.10");
    // The word reaches a screen reader only (StanceReadout.prompt.md), once
    // the pick has rested.
    await settle(500);
    expect(screen.getByTestId(`${PREFIX}-landing`).querySelector(".sr-only")).toHaveTextContent(
      "Resulting opinion: Meh",
    );
    // The STANDING is still the fold's own answer, never derived here.
    expect(screen.getByTestId(`${PREFIX}-standing-label`)).toHaveTextContent("Current opinion");
    expect(screen.getByTestId(`${PREFIX}-standing-face`)).toHaveTextContent("🔥");
    expect(screen.getByTestId(`${PREFIX}-standing-exact`)).toHaveTextContent("+0.90 / +0.90");
  });

  it("keeps the two lines apart, one above the field and one below it", async () => {
    mount({ fold: lastWins, seed: { "post-1": { records: [{ pDirected: 0.9, pInterest: 0.9 }] } } });
    await settle();
    await openPad();
    const field = screen.getByTestId(FIELD_ID);
    const standing = screen.getByTestId(`${PREFIX}-standing`);
    const landing = screen.getByTestId(`${PREFIX}-landing`);
    expect(standing).not.toBe(landing);
    // DOCUMENT_POSITION_FOLLOWING: the field comes after the standing,
    // and the landing after the field.
    expect(standing.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(field.compareDocumentPosition(landing) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("reads a one-zero landing as its state under 🤔 (jakob 2026-10-20)", async () => {
    // Raw sums that the default's +0.10 cancels on the first axis exactly.
    mount({ rawSum: () => ({ pDirected: -0.1, pInterest: 0 }), seed: { "post-1": { records: [ORIGIN] } } });
    await settle();
    await openPad();
    layOutPad();
    // Valence at zero, connection alive: the axis wording follows.
    moveKnob(0, -HALF);
    expect(screen.getByTestId(`${PREFIX}-landing-label`)).toHaveTextContent("Resulting opinion");
    expect(screen.getByTestId(`${PREFIX}-landing-zero`)).toHaveTextContent("🤔");
    expect(screen.getByTestId(`${PREFIX}-landing`)).toHaveTextContent(
      "Interested, no side taken — this won't shape anyone's feed.",
    );
  });

  it("opens the 🤔's three lines in place, Set waiting while they show", async () => {
    // PadStanding.md: "WHEN tap the landing's 🤔 -> its three lines replace
    // the pad's body in place, Back to the pad under them AND Set is
    // disabled while they show AND NEVER a dialog opens".
    const data = mount({ rawSum: () => ({ pDirected: -0.1, pInterest: 0 }), seed: { "post-1": { records: [ORIGIN] } } });
    await settle();
    await openPad();
    layOutPad();
    moveKnob(0, -HALF);
    await release();
    const door = screen.getByTestId(`${PREFIX}-landing-zero`);
    expect(door).toHaveAccessibleName("Interested, no side taken");
    await act(async () => {
      fireEvent.click(door);
    });
    const lines = screen.getByTestId(`${PREFIX}-explanation`);
    expect(lines.querySelectorAll("p")).toHaveLength(3);
    expect(lines).toHaveTextContent("It still counts among your opinions.");
    expect(lines).toHaveTextContent("It shapes no one's feed, earns nothing, and nothing passes on through you.");
    expect(lines).toHaveTextContent("Walk it back is different: its own act, confirmed and paid for, that leaves a clean slate.");
    expect(screen.queryByTestId(FIELD_ID)).toBeNull();
    expect(screen.getByTestId(`${PREFIX}-set`)).toBeDisabled();
    await act(async () => {
      fireEvent.click(screen.getByTestId(`${PREFIX}-explain-back`));
    });
    expect(screen.getByTestId(FIELD_ID)).toBeInTheDocument();
    expect(data.sent).toEqual([]);
  });

  it("reads the other axis's zero by the sign of the number that stands", async () => {
    mount({ rawSum: () => ({ pDirected: 0, pInterest: -0.1 }), seed: { "post-1": { records: [ORIGIN] } } });
    await settle();
    await openPad();
    layOutPad();
    moveKnob(HALF, 0);
    expect(screen.getByTestId(`${PREFIX}-landing`)).toHaveTextContent(
      "For it, no interest either way — this won't shape anyone's feed.",
    );
  });

  it("moves the landing with the drag, without waiting on a round trip", async () => {
    // §8.3: "the landing is a local fold (clip of sum plus pick)
    // recomputed live under the drag, with no round trip and no visible
    // lag." No timer is advanced anywhere in this test.
    mount({ seed: { "post-1": { records: [{ pDirected: 0.3, pInterest: 0.2 }] } } });
    await settle();
    await openPad();
    layOutPad();
    // (+0.30, +0.20) plus the default moved to (+0.50, +0.30), then (+0.70, +0.50).
    moveKnob(HALF * 0.4, -HALF * 0.2);
    await act(async () => {});
    expect(screen.getByTestId(`${PREFIX}-landing`)).toHaveTextContent("+0.80 / +0.50");
    moveKnob(HALF * 0.6, -HALF * 0.4);
    await act(async () => {});
    expect(screen.getByTestId(`${PREFIX}-landing`)).toHaveTextContent("+1.00 / +0.70");
  });

  it("folds against the served RAW sums, not the fold the standing shows", async () => {
    // The guard: raw sums that no client-side arithmetic on `current`
    // could produce. The standing is the LAST record, the raw sum is a
    // different number again, and only one of them gives this landing.
    mount({
      fold: lastWins,
      rawSum: () => ({ pDirected: 0.25, pInterest: -0.5 }),
      seed: {
        "post-1": {
          records: [
            { pDirected: 0.9, pInterest: 0.9 },
            { pDirected: -0.8, pInterest: 0.1 },
          ],
        },
      },
    });
    await settle();
    await openPad();
    layOutPad();
    moveKnob(HALF * 0.5, 0);
    await act(async () => {});
    // 0.25 + 0.60 and −0.50 + 0.10 — neither the standing (−0.80, +0.10)
    // nor a sum of the records (+0.10, +1.00) lands here.
    expect(screen.getByTestId(`${PREFIX}-landing`)).toHaveTextContent("+0.85 / −0.40");
  });

  it("clips a landing the raw sums push past the edge", async () => {
    // "Clipped is not hidden" (§8.3): the raw sum carries the history,
    // and the landing shows the fold the graph actually reads.
    mount({ rawSum: () => ({ pDirected: 4, pInterest: 4 }), seed: { "post-1": { records: [ORIGIN] } } });
    await settle();
    await openPad();
    layOutPad();
    moveKnob(HALF, -HALF);
    await act(async () => {});
    expect(screen.getByTestId(`${PREFIX}-landing`)).toHaveTextContent("+1.00 / +1.00");
  });

  it("does not call a pick severance when the raw sums say it is nowhere near", async () => {
    // The bug raw sums exist to stop: against a CLIPPED (+1, +1) a
    // (−1, −1) pick reads as severance, while the graph lands at
    // (+4, +4) and nothing of the sort happens.
    mount({ rawSum: () => ({ pDirected: 5, pInterest: 5 }), seed: { "post-1": { records: [ORIGIN] } } });
    await settle();
    await openPad();
    layOutPad();
    moveKnob(-2 * HALF, 2 * HALF);
    await act(async () => {});
    const line = screen.getByTestId(`${PREFIX}-landing`);
    expect(line).not.toHaveTextContent("back to nothing");
    expect(line).toHaveTextContent("+1.00 / +1.00");
  });

  it("says nothing about a landing while the standing is still unknown", async () => {
    // A landing needs a bundle to land in; guessing at one is worse than
    // saying so.
    mount({ offline: true });
    await settle();
    await openPad();
    expect(screen.getByTestId(`${PREFIX}-landing`)).toHaveTextContent(
      "Adding it up…",
    );
  });

  it("names a landing that reaches severance as what it nets, not as a reading", async () => {
    // Raw sums the default's (+0.10, +0.10) nets to exactly the origin:
    // both axes at zero, which the fold flags as severance.
    mount({
      rawSum: () => ({ pDirected: -0.1, pInterest: -0.1 }),
      seed: { "post-1": { records: [ORIGIN] } },
    });
    await settle();
    await openPad();
    layOutPad();
    expect(screen.getByTestId(`${PREFIX}-landing`)).toHaveTextContent(
      "This takes you back to zero.",
    );
  });

  it("counts pending stances in every read it makes", async () => {
    const data = mount({ seed: { "post-1": { records: [TAP_DEFAULT] } } });
    await settle();
    await openPad();
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
    await openPad();
    await dragToFarCorner();
    expect(screen.getByTestId("severance-confirm")).toBeInTheDocument();
    expect(data.sent).toEqual([]);
  });

  // THE RELEASE LANDS ON A HUNDREDTH: a drag a hair short of the raw sums'
  // opposite lands EXACTLY on it, so the pick that reads as netting 0.00 is
  // the severance the gate asks about — not a float a few thousandths off it
  // that would sign silently.
  it("asks about a near-zero landing once the release lands it on the grid", async () => {
    const data = mount({ seed: { "post-1": { records: [{ pDirected: 0.3, pInterest: 0.3 }] } } });
    await settle();
    await openPad();
    // From the pad's +0.10 / +0.10 to −0.296 / −0.303 under the thumb.
    await dragAndSet((-0.296 - 0.1) * HALF, (0.303 + 0.1) * HALF);
    expect(screen.getByTestId("severance-confirm")).toBeInTheDocument();
    expect(data.sent).toEqual([]);
  });

  it("lands the released pick on the nearest hundredths", async () => {
    const data = mount();
    await settle();
    await openPad();
    await dragAndSet((0.4371 - 0.1) * HALF, -(0.2049 - 0.1) * HALF);
    expect(data.sent).toEqual([{ target: "post-1", pick: { pDirected: 0.44, pInterest: 0.2 } }]);
  });

  it("leaves the resting target alone until severance is confirmed", async () => {
    mount({ seed: { "post-1": { records: [{ pDirected: 1, pInterest: 1 }] } } });
    await settle();
    await openPad();
    await dragToFarCorner();
    // Nothing was staged, so nothing may claim to have landed.
    expect(screen.getByTestId(`${PREFIX}-resting-exact`)).toHaveTextContent("+1.00 / +1.00");
  });

  it("writes the raw pick once that landing is confirmed", async () => {
    const data = mount({ seed: { "post-1": { records: [{ pDirected: 1, pInterest: 1 }] } } });
    await settle();
    await openPad();
    await dragToFarCorner();
    await act(async () => {
      fireEvent.click(screen.getByTestId("severance-proceed"));
    });
    // The raw edge, not the batch: an accidental landing writes the pick.
    expect(data.sent).toEqual([{ target: "post-1", pick: { pDirected: -1, pInterest: -1 } }]);
    expect(data.severed).toEqual([]);
  });

  it("offers the walk-away, named, once a record stands behind the bundle", async () => {
    mount({ seed: { "post-1": { records: [{ pDirected: 0.5, pInterest: 0.5 }] } } });
    await settle();
    await openPad();
    expect(screen.getByTestId(`${PREFIX}-sever`)).toHaveTextContent("Walk it back");
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
    await openPad();
    await act(async () => {
      fireEvent.click(screen.getByTestId(`${PREFIX}-sever`));
    });
    expect(screen.getByTestId("severance-cost")).toHaveTextContent(
      "It signs 2 things, each paid separately.",
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
    await openPad();
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
      "Signed 2 things, still settling. You've walked this post back to nothing.",
    );
  });

  it("writes nothing when the confirmation is declined", async () => {
    const data = mount({ seed: { "post-1": { records: [{ pDirected: 0.5, pInterest: 0.5 }] } } });
    await settle();
    await openPad();
    await act(async () => {
      fireEvent.click(screen.getByTestId(`${PREFIX}-sever`));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("severance-cancel"));
    });
    expect(data.severed).toEqual([]);
    expect(data.sent).toEqual([]);
  });

  it("offers no route at all with nothing to walk back", async () => {
    // §8.5 wants severance findable from the open pad, and the route
    // used to stand with no standing behind it — leading only to a
    // dialog saying there was nothing to bill for. The master closed
    // that (`design/components/stance/StanceControl.jsx`, "SEVER NEEDS
    // SOMETHING TO SEVER … It arrives with the first stance"), and the
    // pair `TagPage` / `TagPageHeldPad` draws the two states: three
    // controls over a topic nobody holds, four over a held one.
    const data = mount();
    await settle();
    await openPad();
    expect(screen.queryByTestId(`${PREFIX}-sever`)).not.toBeInTheDocument();
    expect(data.severed).toEqual([]);
  });

  it("keeps the confirmation up and says so when the batch does not go through", async () => {
    const data = mount({
      seed: { "post-1": { records: [{ pDirected: 0.5, pInterest: 0.5 }] } },
    });
    await settle();
    await openPad();
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

// THE EMPTY SIGN (EmptySignConfirm.md, PadStanding.md:71; jakob 2026-10-21,
// seam 242/243): a (0, 0) landing over NOTHING standing — no record, or a
// bundle already walked back — asks its own question, never the walk-back's;
// over anything standing, an empty sign's standing included, it is the
// walk-back's.
describe("the empty sign", () => {
  beforeEach(() => {
    alreadyTaught();
  });

  /** From the pad's +0.10 / +0.10 to exactly (0, 0), then Set. */
  const dragToNothing = async () => {
    await dragAndSet(-0.1 * HALF, 0.1 * HALF);
  };
  const isZero = (value: number) => value + 0 === 0;

  it("asks Sign an empty opinion?, never the walk-back, with nothing standing", async () => {
    const data = mount();
    await settle();
    await openPad();
    await dragToNothing();
    expect(screen.getByTestId<HTMLDialogElement>("empty-sign-confirm").open).toBe(true);
    expect(screen.queryByTestId("severance-confirm")).not.toBeInTheDocument();
    expect(screen.getByTestId("empty-sign-confirm")).toHaveTextContent(
      "This says nothing about this post, shapes no feed, and leaves you where you are.",
    );
    // An ask, never a block: Set stayed enabled and nothing is signed yet.
    expect(screen.getByTestId<HTMLButtonElement>(`${PREFIX}-set`).disabled).toBe(false);
    expect(data.sent).toEqual([]);
  });

  it("asks the same over a bundle already walked back to nothing", async () => {
    mount({
      seed: { "post-1": { records: [{ pDirected: 0.5, pInterest: 0.5 }, { pDirected: -0.5, pInterest: -0.5 }] } },
    });
    await settle();
    await openPad();
    await dragToNothing();
    expect(screen.getByTestId("empty-sign-confirm")).toBeInTheDocument();
    expect(screen.queryByTestId("severance-confirm")).not.toBeInTheDocument();
  });

  it("opens the walk-back, not the ask, over an empty sign's standing (seam 243)", async () => {
    // records > 0 and not severed: something stands, saying nothing.
    mount({ seed: { "post-1": { records: [ORIGIN] } } });
    await settle();
    await openPad();
    await dragToNothing();
    expect(screen.getByTestId("severance-confirm")).toBeInTheDocument();
    expect(screen.queryByTestId("empty-sign-confirm")).not.toBeInTheDocument();
  });

  it("signs the one record on Set it anyway and takes the ORDINARY path", async () => {
    const data = mount();
    await settle();
    await openPad();
    await dragToNothing();
    await act(async () => {
      fireEvent.click(screen.getByTestId("empty-sign-proceed"));
    });
    await settle();
    // One ordinary record, the pick verbatim.
    expect(data.sent).toHaveLength(1);
    expect(isZero(data.sent[0].pick.pDirected) && isZero(data.sent[0].pick.pInterest)).toBe(true);
    expect(data.severed).toEqual([]);
    expect(screen.queryByTestId("empty-sign-confirm")).not.toBeInTheDocument();
    expect(screen.queryByTestId(`${PREFIX}-pad`)).not.toBeInTheDocument();
    // The ordinary snackbar, 🤷 speaking Says nothing (EmptySignConfirm.md:27).
    const snackbar = screen.getByTestId(`${PREFIX}-signed`);
    expect(snackbar).toHaveTextContent("Signed, still settling. Current opinion 🤷");
    expect(snackbar).toHaveTextContent("Current opinion: Says nothing");
    expect(snackbar).not.toHaveTextContent("walked");
    // At rest: 🤷 speaking Says nothing, never Walked back (:29).
    expect(screen.getByTestId(`${PREFIX}-resting-face`)).toHaveTextContent("🤷");
    expect(control()).toHaveAccessibleName(/Says nothing, \+0\.00 \/ \+0\.00/);
    // Walk it back stands on the pad over it, its cost 1 thing (:31).
    await openPad();
    expect(screen.getByTestId(`${PREFIX}-standing`).querySelector(".sr-only")).toHaveTextContent(
      "Current opinion: Says nothing",
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId(`${PREFIX}-sever`));
    });
    expect(screen.getByTestId("severance-cost")).toHaveTextContent("It signs 1 thing, paid on its own.");
  });

  it("returns to the parked pick on Keep it, and Escape over the ask keeps the pad", async () => {
    const data = mount();
    await settle();
    await openPad();
    await dragToNothing();
    await act(async () => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    // The pad's own Escape stands down while the ask is up.
    expect(screen.getByTestId(`${PREFIX}-pad`)).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByTestId("empty-sign-keep"));
    });
    expect(screen.queryByTestId("empty-sign-confirm")).not.toBeInTheDocument();
    expect(screen.getByTestId(`${PREFIX}-pad`)).toBeInTheDocument();
    expect(screen.getByTestId(`${PREFIX}-exact`)).toHaveTextContent("+0.00 / +0.00");
    expect(data.sent).toEqual([]);
  });

  it("keeps the ask up with the fault line and Retry when the signing does not go through", async () => {
    const data = mount();
    await settle();
    await openPad();
    await dragToNothing();
    data.commit = createStubStanceData({ offline: true }).commit;
    await act(async () => {
      fireEvent.click(screen.getByTestId("empty-sign-proceed"));
    });
    expect(screen.getByTestId("empty-sign-failed")).toHaveTextContent("That didn't send. Try again.");
    expect(screen.getByTestId("empty-sign-proceed")).toHaveTextContent("Retry");
    expect(screen.getByTestId<HTMLDialogElement>("empty-sign-confirm").open).toBe(true);
  });

  it("reads Setting… past 200ms and locks its ways out while it signs", async () => {
    const data = mount();
    await settle();
    await openPad();
    await dragToNothing();
    const gate: { answer?: () => void } = {};
    const commit = data.commit;
    data.commit = (target, pick) =>
      new Promise((resolve) => {
        gate.answer = () => resolve(commit(target, pick));
      });
    await act(async () => {
      fireEvent.click(screen.getByTestId("empty-sign-proceed"));
    });
    await settle(SETTING_AFTER_MS + 1);
    expect(screen.getByTestId("empty-sign-proceed")).toHaveTextContent("Setting…");
    await act(async () => {
      fireEvent.click(screen.getByTestId("empty-sign-keep"));
    });
    expect(screen.getByTestId("empty-sign-confirm")).toBeInTheDocument();
    await act(async () => {
      gate.answer?.();
    });
    await settle();
    expect(screen.queryByTestId("empty-sign-confirm")).not.toBeInTheDocument();
  });
});

// THE VOUCH-IN RIDER (EmptySignConfirm.md:9/:11; ApprovePad.md:43-45,
// VouchAskPad.md:37-39): where the opinion vouches its target in, the ask's
// first line warns harder, and `Set it anyway` IS the act.
describe("the empty sign where the opinion vouches someone in", () => {
  beforeEach(() => {
    alreadyTaught();
  });

  it("warns that they start cut off, and Set it anyway proceeds as the pad's Set", async () => {
    const onTaken = vi.fn();
    const data = createStubStanceData();
    renderWithProviders(
      <StanceControl
        target={{ id: "rafa", kind: "profile", label: "@rafa" }}
        testIdPrefix={PREFIX}
        vouchesIn
        variant={{ title: "Your vouch", help: ["Help."], note: "Vouching is the act.", onTaken }}
      />,
      { store: signedInStore(), stanceData: data },
    );
    await settle();
    await openPad();
    await dragAndSet(-0.1 * HALF, 0.1 * HALF);
    expect(screen.getByTestId("empty-sign-effect")).toHaveTextContent(
      "@rafa would be vouched in but start out cut off: no feed can carry them, and community funds stay closed to them, until someone gives them an opinion that says something.",
    );
    expect(screen.queryByTestId("severance-confirm")).not.toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByTestId("empty-sign-proceed"));
    });
    await settle();
    expect(data.sent).toHaveLength(1);
    expect(onTaken).toHaveBeenCalledTimes(1);
  });

  it("keeps the ordinary first line on any other pad", async () => {
    mount();
    await settle();
    await openPad();
    await dragAndSet(-0.1 * HALF, 0.1 * HALF);
    expect(screen.getByTestId("empty-sign-effect")).toHaveTextContent(
      "This says nothing about this post, shapes no feed, and leaves you where you are.",
    );
  });
});

// jakob's I2 ruling (copy-voice.md "Awaiting blessing — the topic
// disconnects", 2026-09-15): a topic disconnects, never severs. Every
// other kind above (`describe("severance", ...)`, target kind "post")
// keeps the severance wording verbatim — the split is by record family,
// not by surface.
describe("a topic's own way out — disconnect, not sever", () => {
  beforeEach(() => {
    alreadyTaught();
  });

  it("names the pad's way out Disconnect, never Walk it back", async () => {
    mount(
      { seed: { saltmaps: { records: [{ pDirected: 0.5, pInterest: 0.5 }] } } },
      { target: TOPIC_TARGET, axes: AFFINITY_AXES },
    );
    await settle();
    await openPad();
    expect(screen.getByTestId(`${PREFIX}-sever`)).toHaveTextContent("Disconnect");
  });

  it("passes the topic kind to the confirmation, which asks in the ruled words", async () => {
    mount(
      { seed: { saltmaps: { records: [{ pDirected: 0.5, pInterest: 0.5 }] } } },
      { target: TOPIC_TARGET, axes: AFFINITY_AXES },
    );
    await settle();
    await openPad();
    await act(async () => {
      fireEvent.click(screen.getByTestId(`${PREFIX}-sever`));
    });
    expect(screen.getByTestId("severance-confirm")).toHaveTextContent(
      "Disconnect from #saltmaps?",
    );
    expect(screen.getByTestId("severance-proceed")).toHaveTextContent("Disconnect");
  });

  it("reads a disconnected topic as 'No opinion towards #saltmaps.' once signed", async () => {
    const data = mount(
      { seed: { saltmaps: { records: [{ pDirected: 0.5, pInterest: 0.5 }] } } },
      { target: TOPIC_TARGET, axes: AFFINITY_AXES },
    );
    await settle();
    await openPad();
    await act(async () => {
      fireEvent.click(screen.getByTestId(`${PREFIX}-sever`));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("severance-proceed"));
    });
    expect(data.severed).toEqual(["saltmaps"]);
    expect(screen.getByTestId(`${PREFIX}-signed`)).toHaveTextContent(
      "Signed, still settling. No opinion towards #saltmaps.",
    );
  });
});

describe("the alternate inputs", () => {
  beforeEach(() => {
    alreadyTaught();
  });

  // StanceControl.prompt.md: `Choose your opinion on {targetLabel}`, visually
  // hidden until focused — one tab away, never printed beside every stance in
  // a feed, and named for its target so a page never repeats one name.
  it("stand behind a route that is named but not drawn", async () => {
    mount();
    await settle();
    const route = screen.getByTestId(`${PREFIX}-choose`);
    expect(route).toHaveTextContent("Choose your opinion on this post");
    expect(route.className).toContain("sr-only");
    expect(route.className).toContain("focus:not-sr-only");
  });

  // The card's affordance row is one line that never wraps: the face and the
  // pair never shrink, and no word stands beside them to give way.
  it("keep the resting face and pair from shrinking, with no word beside them", async () => {
    mount({ seed: { "post-1": { records: [{ pDirected: 0.55, pInterest: 0.2 }] } } });
    await settle();
    expect(screen.getByTestId(`${PREFIX}-resting-exact`).className).toContain("flex-none");
    expect(screen.getByTestId(`${PREFIX}-resting-exact`).className).toContain("whitespace-nowrap");
    expect(control()).not.toHaveTextContent("Like this");
  });

  it("are reachable without ever dragging, one control at a time", async () => {
    // StanceAlternates.prompt.md: "Sliders lead; `Type exact values` swaps
    // to the typed fields and back. Never render both at once."
    mount();
    await settle();
    expect(DEFAULT_STANCE_INPUT_MODE).toBe("pad");
    await act(async () => {
      fireEvent.click(screen.getByTestId(`${PREFIX}-choose`));
    });
    expect(screen.getByTestId("stance-alternates")).toBeInTheDocument();
    expect(screen.getByTestId("stance-alt-directed")).toBeInTheDocument();
    expect(screen.queryByTestId("stance-entry-directed")).toBeNull();
    expect(screen.getByTestId("stance-alt-swap")).toHaveTextContent("Type exact values");
    await act(async () => {
      fireEvent.click(screen.getByTestId("stance-alt-swap"));
    });
    expect(screen.getByTestId("stance-entry-directed")).toBeInTheDocument();
    expect(screen.queryByTestId("stance-alt-directed")).toBeNull();
    expect(screen.getByTestId("stance-alt-swap")).toHaveTextContent("Use sliders");
  });

  it("name the poles under the sliders and paint the value only as the geek reading", async () => {
    mount();
    await settle();
    await act(async () => {
      fireEvent.click(screen.getByTestId(`${PREFIX}-choose`));
    });
    expect(screen.getByTestId("stance-alt-directed-poles")).toHaveTextContent("AgainstFor");
    expect(screen.getByTestId("stance-alt-interest-poles")).toHaveTextContent("LessMore");
    const label = screen.getByText("For or against", { exact: false, selector: "label" });
    expect(label.querySelector(".cg-exact")).toHaveTextContent("+0.10");
  });

  it("carry the pad's own ? whose help replaces the body in place", async () => {
    mount();
    await settle();
    await act(async () => {
      fireEvent.click(screen.getByTestId(`${PREFIX}-choose`));
    });
    const help = screen.getByTestId("stance-alt-help");
    expect(help).toHaveAccessibleName("How opinions work");
    await act(async () => {
      fireEvent.click(help);
    });
    const lines = screen.getByTestId("stance-alt-explanation");
    expect(lines.querySelectorAll("p")).toHaveLength(4);
    expect(lines).toHaveTextContent("Two values, not one.");
    expect(lines).toHaveTextContent("Nothing is signed until you press Sign it.");
  });

  it("write the picked pair verbatim", async () => {
    const data = mount();
    await settle();
    await act(async () => {
      fireEvent.click(screen.getByTestId(`${PREFIX}-choose`));
    });
    fireEvent.change(screen.getByTestId("stance-alt-directed"), { target: { value: "-0.75" } });
    await act(async () => {
      fireEvent.click(screen.getByTestId("stance-alt-swap"));
    });
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
    await act(async () => {
      fireEvent.click(screen.getByTestId("stance-alt-swap"));
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
    // The alternates open at the default too, as the pad does.
    expect(screen.getByTestId(`${PREFIX}-exact`)).toHaveTextContent("+0.10 / +0.10");
    expect(screen.getByTestId(`${PREFIX}-pick`)).toHaveTextContent(
      "For or against +0.10, How much reaches you +0.10",
    );
  });

  it("replace the pad everywhere once chosen, the tap that opens it included", async () => {
    writeStanceInputMode("sliders");
    mount();
    await settle();
    await openPad();
    expect(screen.queryByTestId(`${PREFIX}-pad`)).toBeNull();
    expect(screen.getByTestId("stance-alternates")).toBeInTheDocument();
    expect(screen.queryByTestId("stance-entry-directed")).toBeNull();
  });

  it("open on the typed fields for a reader who chose them in settings", async () => {
    writeStanceInputMode("entry");
    mount();
    await settle();
    await openPad();
    expect(screen.getByTestId("stance-entry-directed")).toBeInTheDocument();
    expect(screen.queryByTestId("stance-alt-directed")).toBeNull();
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
          rawSum: { pDirected: 0.9, pInterest: 0.25 },
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
    expect(control()).toHaveAccessibleName(/Love this/);
    expect(control()).toHaveTextContent("😍");
    expect(screen.getByTestId(`${PREFIX}-resting-exact`)).toHaveTextContent("+0.90 / +0.25");
    expect(data.pendingFlags).toEqual([]);
  });

  it("still answers a hold of its own, past the copy the host read", async () => {
    alreadyTaught();
    const data = createStubStanceData({
      seed: { "post-1": { records: [{ pDirected: 0.4, pInterest: 0.1 }] } },
    });
    renderWithProviders(
      <StanceControl
        target={TARGET}
        bundle={{
          current: { pDirected: 0.4, pInterest: 0.1 },
          rawSum: { pDirected: 0.4, pInterest: 0.1 },
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
    await hold();
    await settle();
    expect(screen.getByTestId(`${PREFIX}-resting-exact`)).toHaveTextContent("+0.50 / +0.20");
    expect(data.freshFlags).toEqual([true]);
  });
});

describe("the pick that never happened", () => {
  it("leaves the pad closed and the seam untouched while at rest", async () => {
    const data = mount();
    await settle(1000);
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

// THE OPINION PAD PAUSES, IT DOES NOT SUSPEND (Feed.md:39/41): the control
// announces its pad — and the alternates that replace it — as a `pause`
// layer, which is what the stage reads (`covering-layer.tsx`).
describe("the pad as a covering layer", () => {
  it("announces the open pad as a pause, and stops announcing it once closed", async () => {
    alreadyTaught();
    mount();
    await settle();
    expect(raisedLayersForTests()).toEqual([]);

    await openPad();
    expect(raisedLayersForTests()).toEqual(["pause"]);

    await act(async () => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(raisedLayersForTests()).toEqual([]);
  });

  it("announces the alternates as a pause too — they are the pad in its other form", async () => {
    mount();
    await settle();
    await act(async () => {
      fireEvent.click(screen.getByTestId(`${PREFIX}-choose`));
    });
    expect(raisedLayersForTests()).toEqual(["pause"]);
  });
});
