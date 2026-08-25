import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "@/lib/session/token-store";
import { DEFAULT_STANCE_INPUT_MODE, writeStanceInputMode } from "@/lib/stance/input-mode";
import { ORIGIN, TAP_DEFAULT } from "@/lib/stance/model";
import type { StanceTargetRef } from "@/lib/stance/stance-data";
import { createStubStanceData, type StubStanceOptions } from "@/lib/stance/stub-stance-data";
import { renderWithProviders } from "@/test/providers";
import { LONG_PRESS_MS, PROJECTION_SETTLE_MS, StanceControl } from "./stance-control";

const TARGET: StanceTargetRef = { id: "post-1", label: "this post" };
const PREFIX = "stance-post-1";

/** The 200×200 pad the geometry tests use: radius 100, half-side 100/√2. */
const HALF = 100 / Math.SQRT2;

function signedInStore() {
  const store = createTokenStore();
  store.save({ accessToken: "access-1", refreshToken: "refresh-1", accountId: "u1" });
  return store;
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

/** Lay the pad out — jsdom measures everything as zero on its own. */
function layOutPad() {
  const field = screen.getByTestId(`${PREFIX}-field`);
  field.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200, x: 0, y: 0 }) as DOMRect;
  return field;
}

beforeEach(() => {
  window.localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the stance control at rest", () => {
  it("offers a stance where the viewer holds none", async () => {
    mount();
    await settle();
    expect(control()).toHaveTextContent("Stance");
    expect(control()).toHaveAccessibleName(/Take a stance on this post/);
  });

  it("wears the current standing's face, with the words beside it", async () => {
    mount({ seed: { "post-1": { records: [{ pDirected: 0.55, pInterest: 0.2 }] } } });
    await settle();
    expect(control()).toHaveTextContent("Like this");
    // Colour never carries stance alone (design.md §10).
    expect(control()).toHaveTextContent("😊");
  });

  it("keeps the resting target at the 48px minimum", async () => {
    mount();
    await settle();
    expect(control().className).toContain("min-h-12");
    expect(control().className).toContain("min-w-12");
  });
});

describe("the tap", () => {
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

  it("reports the signature rather than announcing an arrival", async () => {
    mount();
    await settle();
    await act(async () => {
      fireEvent.click(control());
    });
    expect(screen.getByTestId(`${PREFIX}-signed`)).toHaveTextContent("still settling");
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
  it("blooms at the origin, untilted toward either direction", async () => {
    mount();
    await settle();
    await hold();
    expect(screen.getByTestId(`${PREFIX}-pad`)).toBeInTheDocument();
    const knob = screen.getByTestId(`${PREFIX}-knob`);
    expect(knob.style.left).toBe("50%");
    expect(knob.style.top).toBe("50%");
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
    layOutPad();
    fireEvent.pointerMove(control(), { pointerId: 1, clientX: 100 + HALF / 2, clientY: 100 - HALF });
    await settle();
    await act(async () => {
      fireEvent.pointerUp(control(), { pointerId: 1 });
    });
    expect(data.sent).toHaveLength(1);
    expect(data.sent[0].pick.pDirected).toBeCloseTo(0.5, 10);
    expect(data.sent[0].pick.pInterest).toBeCloseTo(1, 10);
  });

  it("reaches the corner a circular pad would otherwise refuse", async () => {
    const data = mount();
    await settle();
    await hold();
    layOutPad();
    // The value square is inscribed in the bloom, so its corner sits on
    // the circle rather than outside the reachable field (§8.2 vs §8.3).
    fireEvent.pointerMove(control(), { pointerId: 1, clientX: 100 - HALF, clientY: 100 + HALF });
    await settle();
    await act(async () => {
      fireEvent.pointerUp(control(), { pointerId: 1 });
    });
    expect(data.sent[0].pick).toEqual({ pDirected: -1, pInterest: -1 });
  });

  it("commits the release, and does not also fire the tap default", async () => {
    const data = mount();
    await settle();
    await hold();
    layOutPad();
    fireEvent.pointerMove(control(), { pointerId: 1, clientX: 100 + HALF, clientY: 100 });
    await settle();
    await act(async () => {
      fireEvent.pointerUp(control(), { pointerId: 1 });
      fireEvent.click(control());
    });
    expect(data.sent).toEqual([{ target: "post-1", pick: { pDirected: 1, pInterest: 0 } }]);
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

  it("cancels on a lost pointer without writing anything", async () => {
    const data = mount();
    await settle();
    await hold();
    await act(async () => {
      fireEvent.pointerCancel(control(), { pointerId: 1 });
    });
    expect(screen.queryByTestId(`${PREFIX}-pad`)).toBeNull();
    expect(data.sent).toEqual([]);
  });
});

describe("the readout", () => {
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

  it("shows where the pick lands the bundle, as its own line", async () => {
    mount({ fold: lastWins, seed: { "post-1": { records: [{ pDirected: 0.9, pInterest: 0.9 }] } } });
    await settle();
    await hold();
    layOutPad();
    fireEvent.pointerMove(control(), { pointerId: 1, clientX: 100 - HALF, clientY: 100 + HALF });
    await settle(PROJECTION_SETTLE_MS + 1);
    expect(screen.getByTestId(`${PREFIX}-face`)).toHaveTextContent("Absolutely not");
    expect(screen.getByTestId(`${PREFIX}-landing`)).toHaveTextContent("Absolutely not");
    expect(screen.getByTestId(`${PREFIX}-standing`)).toHaveTextContent("All in");
  });

  it("says a stance carries nothing where the landing is inert on one axis", async () => {
    mount({ fold: lastWins });
    await settle();
    await hold();
    layOutPad();
    fireEvent.pointerMove(control(), { pointerId: 1, clientX: 100, clientY: 100 - HALF });
    await settle(PROJECTION_SETTLE_MS + 1);
    expect(screen.getByTestId(`${PREFIX}-landing`)).toHaveTextContent("would carry nothing");
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
  // Dragging past the field clamps to exactly ±1, so the stand-in's sum
  // against a (+1, +1) history is exactly (0, 0) — the assertion is about
  // the branch, not about floating point.
  const dragToFarCorner = async () => {
    layOutPad();
    fireEvent.pointerMove(control(), { pointerId: 1, clientX: -500, clientY: 700 });
    await settle();
    await act(async () => {
      fireEvent.pointerUp(control(), { pointerId: 1 });
    });
  };

  it("confirms a pick that lands at zero rather than refusing it", async () => {
    const data = mount({ seed: { "post-1": { records: [{ pDirected: 1, pInterest: 1 }] } } });
    await settle();
    await hold();
    await dragToFarCorner();
    expect(screen.getByTestId("severance-confirm")).toBeInTheDocument();
    expect(data.sent).toEqual([]);
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
    expect(screen.getByTestId("severance-cost")).toHaveTextContent("2 signed steps");
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
    expect(screen.getByTestId(`${PREFIX}-signed`)).toHaveTextContent("2 steps");
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

  it("offers nothing to cut off where there is no standing", async () => {
    mount();
    await settle();
    await hold();
    expect(screen.queryByTestId(`${PREFIX}-sever`)).toBeNull();
  });
});

describe("the alternate inputs", () => {
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

  it("show exact values, which the pad keeps off the default reading", async () => {
    mount();
    await settle();
    await act(async () => {
      fireEvent.click(screen.getByTestId(`${PREFIX}-choose`));
    });
    expect(screen.getByTestId(`${PREFIX}-exact`)).toHaveTextContent("0.00, 0.00");
    await act(async () => {
      fireEvent.click(screen.getByTestId("stance-alt-cancel"));
    });
    await hold();
    expect(screen.getByTestId(`${PREFIX}-pad`)).toBeInTheDocument();
    expect(screen.queryByTestId(`${PREFIX}-exact`)).toBeNull();
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
        bundle={{ current: { pDirected: 0.9, pInterest: 0.25 }, severance: { records: 3 } }}
        testIdPrefix={PREFIX}
      />,
      { store: signedInStore(), stanceData: data },
    );
    await settle();
    expect(control()).toHaveTextContent("Love this");
    expect(data.pendingFlags).toEqual([]);
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
});
