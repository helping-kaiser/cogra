"use client";

// THE CHOICES THAT STAY ON THIS DEVICE (Settings.md: the theme, and the exact
// values; jakob's ruling, backlog item 53 — "like the theme, never an L2
// preference"). Each is a rendering preference with nothing private in it,
// so it lives in `localStorage` beside the stance input mode
// (`lib/stance/input-mode.ts`, the same construction): no account key, no
// server round-trip, and every mounted reader re-renders when it changes, in
// this tab or another, through `useSyncExternalStore`.

import { useCallback, useSyncExternalStore } from "react";

import { THEME_STORAGE_KEY } from "./theme-boot";

type Preference<T extends string> = {
  read(): T;
  write(value: T): void;
  use(): [T, (next: T) => void];
};

/** A device-local preference over a closed set of string values. */
export function devicePreference<T extends string>(
  storageKey: string,
  values: readonly T[],
  fallback: T,
): Preference<T> {
  const listeners = new Set<() => void>();
  const isValue = (raw: string | null): raw is T =>
    raw !== null && (values as readonly string[]).includes(raw);

  function read(): T {
    if (typeof window === "undefined") return fallback;
    const stored = window.localStorage.getItem(storageKey);
    return isValue(stored) ? stored : fallback;
  }

  function write(value: T): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, value);
    // `storage` fires in OTHER tabs only, so this tab is told directly.
    for (const listener of listeners) listener();
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    window.addEventListener("storage", listener);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", listener);
    };
  }

  function use(): [T, (next: T) => void] {
    const value = useSyncExternalStore(subscribe, read, () => fallback);
    const set = useCallback((next: T) => write(next), []);
    return [value, set];
  }

  return { read, write, use };
}

/** Light, Dark, or the device's own setting (Settings.md: Theme). */
export type ThemeChoice = "light" | "dark" | "auto";
export const THEME_CHOICES: readonly ThemeChoice[] = ["light", "dark", "auto"];
export const themePreference = devicePreference<ThemeChoice>(
  THEME_STORAGE_KEY,
  THEME_CHOICES,
  "auto",
);

/**
 * Show exact values (Settings.md: Reading) — off by default, because
 * glyph-first is the product's default. The stance and feed surfaces read it.
 */
export const exactValuesPreference = devicePreference<"on" | "off">(
  "cogra.exactValues",
  ["on", "off"],
  "off",
);

/**
 * The theme as the document carries it: `data-theme` names a chosen theme,
 * and its absence is Auto, where the stylesheet's media query follows the
 * device (`globals.css`).
 */
export function applyTheme(choice: ThemeChoice, root: HTMLElement = document.documentElement) {
  if (choice === "auto") delete root.dataset.theme;
  else root.dataset.theme = choice;
}
