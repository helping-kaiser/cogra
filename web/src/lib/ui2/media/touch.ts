"use client";

// Whether the device has a touch to pinch with — the crops' how-to line names
// the gestures a device actually offers (copy-voice, *The crops' how-to line*):
// a phone reads "Drag to move, pinch to zoom.", a desktop browser "Drag or use
// the arrow keys to move, the slider to zoom.".
//
// `any-pointer: coarse` is the platform's own answer: true when ANY input is a
// finger, which is what makes a pinch possible at all
// (https://developer.mozilla.org/en-US/docs/Web/CSS/@media/any-pointer). It is
// read live, so a laptop that gains a touchscreen answers on the next change.

import { useSyncExternalStore } from "react";

const QUERY = "(any-pointer: coarse)";

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const list = window.matchMedia(QUERY);
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
}

function snapshot(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  return window.matchMedia(QUERY).matches;
}

/** True where a touch can pinch. The server render assumes the phone, the product's first device. */
export function useCanPinch(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => true);
}
