import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LEGACY_CLICK_WINDOW_MS, swallowRestOfGesture } from "./outside-press";

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
