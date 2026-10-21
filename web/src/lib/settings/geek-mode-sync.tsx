"use client";

// KEEPS THE DOCUMENT'S `data-geek` IN STEP WITH Show exact values
// (design/readme.md §13, Settings.md: Reading). The head script paints the
// first frame right (`theme-boot.ts`); this follows every later change — the
// switch in Settings, and the same switch flipped in another tab, which the
// preference store hears through `storage`. It renders nothing.

import { useEffect } from "react";

import { applyExactValues, exactValuesPreference } from "./device-preference";

export function GeekModeSync() {
  const [exactValues] = exactValuesPreference.use();
  useEffect(() => {
    applyExactValues(exactValues);
  }, [exactValues]);
  return null;
}
