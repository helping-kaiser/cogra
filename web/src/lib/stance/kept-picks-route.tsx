"use client";

// WHERE THE KEPT PICKS' REVIEW LIVES, AND HOW IT IS REACHED (KeptPicksReview.md,
// PadPendingReview.md, Settings.md:81, Restore.md). Three doors open it — a
// kept pick's anchor once the key is back, the Key backup group's row, and a
// restore that finds picks waiting — and every way out of it returns WHERE IT
// WAS OPENED FROM. The origin rides the URL (`from`), as the back labels'
// origins do (`back-origin.ts`), so a reload keeps it.
//
// THE ANCHOR'S DOOR IS A CONTEXT, not a router call: a stance control renders
// on every read surface, inside and outside the app router (and in every
// surface test), so it asks for "open the review" and the shell answers with
// the router. Outside a shell it falls back to a plain navigation.

import { createContext, useCallback, useContext, type ReactNode } from "react";

export const KEPT_PICKS_PATH = "/kept-picks";

/** Where the review returns when nothing better is known: the reader's home. */
export const KEPT_PICKS_HOME = "/feed";

/**
 * The origin the review returns to, kept to this app's own paths: a value
 * that is not a same-origin path (`//evil`, `https://…`) is never followed.
 */
export function keptPicksOrigin(raw: string | null | undefined): string {
  if (raw === null || raw === undefined) return KEPT_PICKS_HOME;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return KEPT_PICKS_HOME;
  if (raw === KEPT_PICKS_PATH || raw.startsWith(`${KEPT_PICKS_PATH}?`)) return KEPT_PICKS_HOME;
  return raw;
}

/** The review's address, opened from `from`. */
export function keptPicksHref(from: string): string {
  return `${KEPT_PICKS_PATH}?from=${encodeURIComponent(keptPicksOrigin(from))}`;
}

const Navigate = createContext<(href: string) => void>((href) => {
  window.location.assign(href);
});

/** The shell's navigation, handed to every kept pick's anchor. */
export function KeptPicksNavigation({
  navigate,
  children,
}: {
  navigate: (href: string) => void;
  children: ReactNode;
}) {
  return <Navigate.Provider value={navigate}>{children}</Navigate.Provider>;
}

/** Opens the review from wherever the reader stands now. */
export function useOpenKeptPicks(): () => void {
  const navigate = useContext(Navigate);
  return useCallback(() => {
    const here = `${window.location.pathname}${window.location.search}`;
    navigate(keptPicksHref(here));
  }, [navigate]);
}
