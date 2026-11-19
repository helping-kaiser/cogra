import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { swallowRestOfGesture } from "./outside-press";

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
  });

  const pointer = (type: string, pointerId: number) =>
    new PointerEvent(type, { bubbles: true, cancelable: true, pointerId });

  it("keeps the dismissing pointer's lift and click from what lies beneath", () => {
    swallowRestOfGesture({ pointerId: 1 });
    beneath.dispatchEvent(pointer("pointerup", 1));
    beneath.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(heard).toEqual([]);
  });

  it("cancels the long press's context menu as well as hiding it", () => {
    swallowRestOfGesture({ pointerId: 1 });
    const menu = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    beneath.dispatchEvent(menu);
    expect(menu.defaultPrevented).toBe(true);
    expect(heard).toEqual([]);
  });

  it("stands down once the gesture's click is spent", () => {
    swallowRestOfGesture({ pointerId: 1 });
    beneath.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    beneath.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(heard).toEqual(["click"]);
  });

  it("never takes another finger's lift", () => {
    swallowRestOfGesture({ pointerId: 1 });
    beneath.dispatchEvent(pointer("pointerup", 2));
    expect(heard).toEqual(["pointerup"]);
  });

  it("stands down when the next press begins — a drag ended with no click", () => {
    swallowRestOfGesture({ pointerId: 1 });
    beneath.dispatchEvent(pointer("pointerup", 1));
    beneath.dispatchEvent(pointer("pointerdown", 2));
    beneath.dispatchEvent(pointer("pointerup", 2));
    beneath.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(heard).toEqual(["pointerup", "click"]);
  });

  it("stands down when a key is pressed, so a keyboard's click is its own", () => {
    swallowRestOfGesture({ pointerId: 1 });
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    beneath.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(heard).toEqual(["click"]);
  });
});
