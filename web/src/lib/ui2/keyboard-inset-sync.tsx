"use client";

// KEEPS `--keyboard-inset` IN STEP WITH THE ON-SCREEN KEYBOARD for the whole
// app (`keyboard-inset.ts`). Mounted once, in the root layout. It renders
// nothing.

import { useEffect } from "react";

import { watchKeyboardInset } from "./keyboard-inset";

export function KeyboardInsetSync() {
  useEffect(() => watchKeyboardInset(window), []);
  return null;
}
