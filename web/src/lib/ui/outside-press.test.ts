import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  LEGACY_CLICK_WINDOW_MS,
  SHIELD_AFTER_LIFT_MS,
  SHIELD_TEST_ID,
  swallowRestOfGesture,
} from "./outside-press";

// The primitive alone: which of the gesture's later events it keeps, and the
// moments it stands down so it never eats a press it does not own.
describe("swallowRestOfGesture", () => {
  let beneath: HTMLButtonElement;
  let heard: string[];
  const hear = (event: Event) => {
    heard.push(event.type);
  };

  beforeEach(() => {
    heard = [];
    beneath = document.createElement("button");
    for (const type of ["pointerup", "click", "contextmenu", "auxclick"]) beneath.addEventListener(type, hear);
    document.body.appendChild(beneath);
  });
  afterEach(() => {
    // Ends any listener a case left standing.
    window.dispatchEvent(new KeyboardEvent("keydown"));
    beneath.remove();
    vi.useRealTimers();
  });

  /** A pointer event, or a click / context menu naming its pointer, as Pointer Events 3 dispatches them. */
  const pointer = (type: string, pointerId: number) =>
    new PointerEvent(type, { bubbles: true, cancelable: true, pointerId });
  /** A click that names no pointer: a keyboard's, a script's, or an older engine's MouseEvent. */
  const plainClick = () => new MouseEvent("click", { bubbles: true, cancelable: true });

  it("keeps the dismissing pointer's lift and click from what lies beneath", () => {
    swallowRestOfGesture({ pointerId: 1 });
    beneath.dispatchEvent(pointer("pointerup", 1));
    beneath.dispatchEvent(pointer("click", 1));
    expect(heard).toEqual([]);
  });

  it("cancels the long press's context menu as well as hiding it", () => {
    swallowRestOfGesture({ pointerId: 1 });
    const menu = pointer("contextmenu", 1);
    beneath.dispatchEvent(menu);
    expect(menu.defaultPrevented).toBe(true);
    expect(heard).toEqual([]);
  });

  it("stands down once the gesture's click is spent", () => {
    swallowRestOfGesture({ pointerId: 1 });
    beneath.dispatchEvent(pointer("click", 1));
    beneath.dispatchEvent(pointer("click", 1));
    expect(heard).toEqual(["click"]);
  });

  it("never takes another finger's lift or click", () => {
    swallowRestOfGesture({ pointerId: 1 });
    beneath.dispatchEvent(pointer("pointerup", 2));
    beneath.dispatchEvent(pointer("click", 2));
    expect(heard).toEqual(["pointerup", "click"]);
  });

  it("lets a click that names no pointer through while the press is still down — a script's or a key's", () => {
    swallowRestOfGesture({ pointerId: 1 });
    beneath.dispatchEvent(plainClick());
    beneath.dispatchEvent(pointer("pointerup", 1));
    beneath.dispatchEvent(plainClick());
    expect(heard).toEqual(["click", "pointerup", "click"]);
  });

  it("takes an older engine's plain click right after the lift, and no later", () => {
    vi.useFakeTimers();
    swallowRestOfGesture({ pointerId: 1 });
    beneath.dispatchEvent(pointer("pointerup", 1));
    beneath.dispatchEvent(plainClick());
    expect(heard).toEqual([]);

    swallowRestOfGesture({ pointerId: 1 });
    beneath.dispatchEvent(pointer("pointerup", 1));
    vi.advanceTimersByTime(LEGACY_CLICK_WINDOW_MS);
    beneath.dispatchEvent(plainClick());
    expect(heard).toEqual(["click"]);
  });

  it("stands down when the browser takes the pointer for a pan", () => {
    swallowRestOfGesture({ pointerId: 1 });
    beneath.dispatchEvent(pointer("pointercancel", 1));
    beneath.dispatchEvent(pointer("pointerup", 1));
    expect(heard).toEqual(["pointerup"]);
  });

  it("stands down when the next press begins — a drag ended with no click", () => {
    swallowRestOfGesture({ pointerId: 1 });
    beneath.dispatchEvent(pointer("pointerup", 1));
    beneath.dispatchEvent(pointer("pointerdown", 2));
    beneath.dispatchEvent(pointer("pointerup", 2));
    beneath.dispatchEvent(pointer("click", 2));
    expect(heard).toEqual(["pointerup", "click"]);
  });

  it("stands down when a key is pressed, so a keyboard's click is its own", () => {
    swallowRestOfGesture({ pointerId: 1 });
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    beneath.dispatchEvent(pointer("click", 1));
    expect(heard).toEqual(["click"]);
  });
});

// THE WASH'S PLACE IS HELD UNTIL THE GESTURE ENDS (jakob's hand test,
// 2026-11-23: the control beneath an outside press lit and stayed lit). A
// touch tap's `:hover` goes to whatever the browser hit-tests at the tap, so
// what must not be beneath the finger is the control: a shield stands where
// the wash stood. jsdom does no hit-testing, so these pin the shield's place
// and lifetime; the lit state itself is measured in the harness probe.
describe("the shield over the wash's place", () => {
  let host: HTMLDivElement;
  let wash: HTMLDivElement;
  const shield = () => document.querySelector<HTMLElement>(`[data-testid="${SHIELD_TEST_ID}"]`);
  const pointer = (type: string, pointerId: number) =>
    new PointerEvent(type, { bubbles: true, cancelable: true, pointerId });

  beforeEach(() => {
    host = document.createElement("div");
    wash = document.createElement("div");
    wash.style.position = "fixed";
    wash.style.zIndex = "40";
    host.appendChild(wash);
    document.body.appendChild(host);
  });
  afterEach(() => {
    window.dispatchEvent(new KeyboardEvent("keydown"));
    host.remove();
    vi.useRealTimers();
  });

  /** The press lands on the wash, which its surface then removes at once. */
  const dismiss = (pointerId = 1) => {
    swallowRestOfGesture({ pointerId, target: wash });
    wash.remove();
  };

  it("stands where the wash stood, covering the screen at the wash's level, once the wash is gone", () => {
    dismiss();
    const raised = shield();
    expect(raised).not.toBeNull();
    // Same parent: the same stacking context, and inside the same modal
    // dialog when the wash stands in one (the comments sheet's stance pads).
    expect(raised?.parentElement).toBe(host);
    expect(raised?.style.position).toBe("fixed");
    expect(raised?.style.inset).toBe("0px");
    expect(raised?.style.zIndex).toBe("40");
    expect(raised?.style.touchAction).toBe("none");
    expect(raised?.getAttribute("aria-hidden")).toBe("true");
  });

  it("goes with the gesture's click", () => {
    dismiss();
    window.dispatchEvent(pointer("pointerup", 1));
    expect(shield()).not.toBeNull();
    document.body.dispatchEvent(pointer("click", 1));
    expect(shield()).toBeNull();
  });

  it("outlives a long press's context menu until the lift", () => {
    vi.useFakeTimers();
    dismiss();
    document.body.dispatchEvent(pointer("contextmenu", 1));
    expect(shield()).not.toBeNull();
    window.dispatchEvent(pointer("pointerup", 1));
    vi.advanceTimersByTime(SHIELD_AFTER_LIFT_MS);
    expect(shield()).toBeNull();
  });

  it("goes shortly after a lift no click follows — a drag", () => {
    vi.useFakeTimers();
    dismiss();
    window.dispatchEvent(pointer("pointerup", 1));
    vi.advanceTimersByTime(SHIELD_AFTER_LIFT_MS - 1);
    expect(shield()).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(shield()).toBeNull();
  });

  it("goes when the browser takes the pointer for a pan", () => {
    dismiss();
    window.dispatchEvent(pointer("pointercancel", 1));
    expect(shield()).toBeNull();
  });

  it("goes when the next press begins or a key is pressed", () => {
    dismiss();
    window.dispatchEvent(pointer("pointerdown", 2));
    expect(shield()).toBeNull();
    host.appendChild(wash);
    dismiss();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
    expect(shield()).toBeNull();
  });

  it("ignores another finger's lift and a script's click while the press is down", () => {
    vi.useFakeTimers();
    dismiss();
    window.dispatchEvent(pointer("pointerup", 2));
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    vi.advanceTimersByTime(SHIELD_AFTER_LIFT_MS * 2);
    expect(shield()).not.toBeNull();
  });
});
