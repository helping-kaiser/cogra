// The keyboard's height as one CSS variable (`keyboard-inset.ts`). jsdom has
// no keyboard and no visual viewport, so the viewport is a stand-in whose
// numbers are the ones measured in Chrome 133 on the Pixel 6 emulator
// (layout 786, visual 474.3 with the keyboard up).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { KEYBOARD_INSET_VAR, keyboardInset, watchKeyboardInset } from "./keyboard-inset";

describe("keyboardInset", () => {
  it("is_0_without_a_keyboard", () => {
    expect(keyboardInset(786, { height: 786.3, offsetTop: 0, scale: 1 })).toBe(0);
  });

  it("is_the_covered_band_with_the_keyboard_up", () => {
    expect(keyboardInset(786, { height: 474.3, offsetTop: 0, scale: 1 })).toBe(312);
  });

  it("reads_0_under_a_pinch_zoom", () => {
    // Zoomed 2x: the visual viewport shows half the layout height, no keyboard.
    expect(keyboardInset(786, { height: 393, offsetTop: 0, scale: 2 })).toBe(0);
  });

  it("does_not_lift_what_the_browser_already_panned_into_view", () => {
    // Chrome panned the visual viewport by 312 to show a sheet's field.
    expect(keyboardInset(786, { height: 474.3, offsetTop: 312, scale: 1 })).toBe(0);
  });
});

class FakeViewport extends EventTarget {
  height = 786;
  offsetTop = 0;
  scale = 1;
}

describe("watchKeyboardInset", () => {
  let viewport: FakeViewport;
  let frames: Map<number, FrameRequestCallback>;
  let next: number;
  const flush = () => {
    const pending = [...frames.values()];
    frames.clear();
    for (const callback of pending) callback(0);
  };
  const root = () => document.documentElement.style.getPropertyValue(KEYBOARD_INSET_VAR);

  beforeEach(() => {
    viewport = new FakeViewport();
    frames = new Map();
    next = 1;
    Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 786 });
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      const id = next++;
      frames.set(id, callback);
      return id;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
      frames.delete(id);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.style.removeProperty(KEYBOARD_INSET_VAR);
    Object.defineProperty(window, "visualViewport", { configurable: true, value: undefined });
  });

  it("without_a_keyboard_writes_0px", () => {
    const stop = watchKeyboardInset(window);
    flush();
    expect(root()).toBe("0px");
    stop();
  });

  it("follows_the_keyboard_up_and_down", () => {
    const stop = watchKeyboardInset(window);
    flush();
    viewport.height = 474.3;
    viewport.dispatchEvent(new Event("resize"));
    flush();
    expect(root()).toBe("312px");
    viewport.height = 786;
    viewport.dispatchEvent(new Event("resize"));
    flush();
    expect(root()).toBe("0px");
    stop();
  });

  it("coalesces_a_burst_of_events_into_one_write_per_frame", () => {
    const stop = watchKeyboardInset(window);
    flush();
    const set = vi.spyOn(document.documentElement.style, "setProperty");
    viewport.height = 474.3;
    for (let i = 0; i < 5; i++) {
      viewport.dispatchEvent(new Event("resize"));
      viewport.dispatchEvent(new Event("scroll"));
    }
    expect(frames.size).toBe(1);
    flush();
    expect(set).toHaveBeenCalledTimes(1);
    // An unchanged value is not written again.
    viewport.dispatchEvent(new Event("scroll"));
    flush();
    expect(set).toHaveBeenCalledTimes(1);
    stop();
  });

  it("stops_listening_cancels_its_frame_and_clears_the_variable", () => {
    const stop = watchKeyboardInset(window);
    flush();
    viewport.height = 474.3;
    viewport.dispatchEvent(new Event("resize"));
    expect(frames.size).toBe(1);
    stop();
    expect(frames.size).toBe(0);
    expect(root()).toBe("");
    viewport.dispatchEvent(new Event("resize"));
    expect(frames.size).toBe(0);
  });

  it("does_nothing_without_a_visual_viewport", () => {
    Object.defineProperty(window, "visualViewport", { configurable: true, value: null });
    const stop = watchKeyboardInset(window);
    expect(frames.size).toBe(0);
    expect(root()).toBe("");
    expect(() => stop()).not.toThrow();
  });
});
