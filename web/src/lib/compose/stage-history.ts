"use client";

// The browser's back and forward, bound to a wizard's stages.
//
// THE LAW: "the header arrow steps ONE STAGE BACK, never out of the flow —
// Details reaches crop with it, the platform back gesture does the same"
// (design/readme.md, the wizard-stage back law), and "on the web the tabs are
// routes: the browser's back and forward own the history" (the re-tap
// ladder). A wizard's stages are not routes — a reload starts the flow over,
// and no URL names a stage — so each stage past the first rides a history
// entry of its own, and a Back press that lands on one is answered with the
// header arrow's own transition. Android reaches the same place through
// `BackHandler` (ComposeWizardScreen.kt).
//
// THE ENTRIES ARE NEXT'S DOCUMENTED NATIVE HISTORY. `window.history.pushState`
// is router-integrated in the App Router
// (node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md,
// "Native History API"): the router copies its own tree into the entry, so
// popping one restores the page the wizard is already on rather than
// reloading it. No URL is passed, so no router navigation runs at all — the
// entry only marks the depth.
//
// THE BROWSER'S POSITION FOLLOWS THE STAGE, NEVER THE REVERSE. The stage is
// React state and the history is reconciled to it after every change: a
// stage reached by the forward action pushes; one left by the arrow, by a
// jump back to the pick, or by a refusal sending the author to the details
// pops (`history.go`). A popstate this hook caused itself is recognised by
// the depth it expected to land on and changes nothing.
//
// AN OPEN SHEET TAKES BACK FIRST (ComposeWizardViewModel.onBack: the sheet,
// then the stage). Every wizard sheet is a modal `<dialog>`, which the
// platform already treats as a close watcher: on Android the back gesture is
// a CLOSE REQUEST that closes the top dialog and never reaches the history
// (https://developer.mozilla.org/en-US/docs/Web/API/CloseWatcher;
// HTML "close requests and close watchers"). Where Back is a plain traversal
// instead — a desktop button, a Safari swipe — the pop is answered the same
// way: the top dialog gets a close request and the stage's entry is put back.
//
// FORWARD RE-ADVANCES. An entry above the stage was made by the forward
// action, so a Forward press onto it is that action again, through the same
// gate — a stage whose gate now refuses is not reached, and the browser is
// taken back to the stage that stands.

import { useEffect, useEffectEvent, useRef, useState } from "react";

/** The key a stage entry carries in `history.state`, beside the router's own. */
const MARK = "cograStage";

type Mark = { surface: string; depth: number };

/**
 * The depth an entry marks for `surface` — 0 for an entry it never marked,
 * which is the entry the surface was opened on.
 */
export function markedDepth(state: unknown, surface: string): number {
  if (typeof state !== "object" || state === null) return 0;
  const mark = (state as Record<string, unknown>)[MARK] as Partial<Mark> | undefined;
  return mark?.surface === surface && typeof mark.depth === "number" ? mark.depth : 0;
}

export type HistoryMove = "none" | "dismiss" | "back" | "forward";

/**
 * What a history step onto the entry at `landed` asks of a surface standing
 * at `level` — the reducer of this file, kept pure so the ordering is
 * tested on its own.
 */
export function historyMove(landed: number, level: number, sheetOpen: boolean): HistoryMove {
  if (landed === level) return "none";
  // Any step with a sheet up is the sheet's: Android's back closes it before
  // anything else, and a sheet left standing over a stage it was not opened
  // on would be a surface nobody asked for.
  if (sheetOpen) return "dismiss";
  return landed < level ? "back" : "forward";
}

/** The dialog on top — the last one open, since a stacked sheet renders after its base. */
function topSheet(): HTMLDialogElement | null {
  const open = document.querySelectorAll<HTMLDialogElement>("dialog[open]");
  return open.length === 0 ? null : (open[open.length - 1] ?? null);
}

/**
 * A close request, as the platform's own back gesture sends one: `cancel`
 * first, which a dialog may refuse, then `close`. `requestClose()` is that
 * request where the browser has it; elsewhere the two steps are dispatched.
 */
function requestClose(dialog: HTMLDialogElement) {
  if (typeof dialog.requestClose === "function") {
    dialog.requestClose();
    return;
  }
  if (dialog.dispatchEvent(new Event("cancel", { cancelable: true }))) dialog.close();
}

function here(): string {
  return window.location.href;
}

function mark(surface: string, depth: number) {
  return { ...(window.history.state as object | null), [MARK]: { surface, depth } };
}

/**
 * Binds `level` — how many entries the surface stands above the one it was
 * opened on — to the browser's history.
 *
 * `onBack` is the header arrow's own handler and `onForward` the stage's own
 * forward action; this hook calls them and never steps a stage itself.
 */
export function useStageHistory({
  surface,
  level,
  onBack,
  onForward,
}: {
  surface: string;
  level: number;
  onBack: () => void;
  onForward: () => void;
}) {
  // The page this surface lives on. A pop onto another URL is the router
  // leaving it, which nothing here may answer.
  const home = useRef<string | null>(null);
  // The depth of the entry the browser is on, as far as this hook knows.
  // Null until the mount has read it.
  const at = useRef<number | null>(null);
  // The depth a traversal this hook started will land on.
  const expected = useRef<number | null>(null);
  const alive = useRef(false);
  // Bumped by every pop, so the reconciliation runs even when the answer to
  // it — a sheet closing, a gate refusing — left the level where it was.
  const [pops, setPops] = useState(0);

  const answer = useEffectEvent((landed: number) => {
    const sheet = topSheet();
    switch (historyMove(landed, level, sheet !== null)) {
      case "dismiss":
        if (sheet !== null) requestClose(sheet);
        return;
      case "back":
        onBack();
        return;
      case "forward":
        onForward();
        return;
      case "none":
        return;
    }
  });

  useEffect(() => {
    alive.current = true;
    home.current = here();
    // An entry this surface marked before — a reload mid-flow keeps
    // `history.state`, and so does coming back to the page from elsewhere —
    // is read as where the browser stands, and the reconciliation below
    // rewinds it to the stage the fresh surface is actually on.
    if (at.current === null) at.current = markedDepth(window.history.state, surface);

    const onPop = (event: PopStateEvent) => {
      if (here() !== home.current) return;
      const landed = markedDepth(event.state, surface);
      const ours = expected.current === landed;
      expected.current = null;
      at.current = landed;
      if (!ours) answer(landed);
      setPops((count) => count + 1);
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      alive.current = false;
      // A surface closed IN PLACE takes its entries with it, or the next Back
      // presses would land on stages that are no longer there. Deferred, so a
      // development double-mount (which remounts at once) keeps them; and
      // only while the browser is still on one of them — a surface that left
      // by navigating has a new page's entry on top, which is not its to pop.
      setTimeout(() => {
        if (alive.current || here() !== home.current) return;
        const depth = markedDepth(window.history.state, surface);
        if (depth > 0) window.history.go(-depth);
      }, 0);
    };
  }, [surface]);

  useEffect(() => {
    const current = at.current;
    if (current === null) return;
    if (level > current) {
      for (let depth = current + 1; depth <= level; depth++) {
        window.history.pushState(mark(surface, depth), "");
      }
      at.current = level;
    } else if (level < current) {
      expected.current = level;
      at.current = level;
      window.history.go(level - current);
    }
  }, [surface, level, pops]);
}
