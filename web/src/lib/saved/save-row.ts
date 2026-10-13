"use client";

// THE SAVE ROW, STATED ONCE (saved-surface packet, "The save action") for
// every menu that carries it — the post menu on the feed and the detail, the
// comment menus, the profile menus. Each host brings its own snackbar; the
// behaviour is this one:
//
// - the row reads `Save` while the thing is not kept and `Unsave` while it is,
//   from the server's `viewerBookmarkedAt` with the reader's own acts laid over
//   it — the row carries the state because nothing else does (no saved mark
//   anywhere outside the menu, ReaderPostMenu.md);
// - `Save` keeps it at the tap and the host's snackbar reads `Saved.`;
// - `Unsave` drops it at the tap and the snackbar reads `Removed from Saved.`
//   with `Undo` (design digest item 48), which keeps it again at the time it
//   was kept, so a Saved list read afterwards has it back in its place;
// - a guest is asked to join, and nothing is sent (GuestGate.md:5);
// - a failure reverts, and the target's row says so — never this snackbar,
//   which the host clears if it still stands (`useHostSnack`).

import { useCallback, useEffect, useState } from "react";

import type { SnackbarAction } from "@/lib/ui/snackbar";
import type { DataNode } from "@/lib/ui/data-node";
import type { MenuItem } from "@/lib/ui2/overflow-menu";
import { useSavedWrites } from "./provider";
import type { Kept, SavedWrites } from "./saved-writes";

/** The snackbar a save confirms with (copy-voice "Saved, History and hiding"). */
export const SAVED = "Saved.";
/** The snackbar an unsave answers with, anywhere it is made. */
export const REMOVED_FROM_SAVED = "Removed from Saved.";
export const UNDO = "Undo";

/** A host's snackbar: the words, its one action, and the node whose comfort raised it. */
export type HostSnack = {
  readonly message: string;
  readonly action?: SnackbarAction;
  /** The node a comfort was made on; its revert clears this snackbar (SG-9). */
  readonly cause?: string;
  /** Moves with every raise, so a renewed snackbar restarts its 4s. */
  readonly token: number;
};

export type Notify = (message: string, action?: SnackbarAction, cause?: string) => void;

let tokens = 0;

/**
 * A host's one snackbar, which clears itself when the comfort that raised it
 * reverts: an unsave that did not go through must not stand announcing a
 * removal that never happened (Saved.md, SG-9).
 */
export function useHostSnack(): {
  snack: HostSnack | null;
  notify: Notify;
  dismiss: () => void;
} {
  const writes = useSavedWrites();
  const [snack, setSnack] = useState<HostSnack | null>(null);
  useEffect(
    () => writes.onRevert((node) => setSnack((current) => (current?.cause === node ? null : current))),
    [writes],
  );
  const notify = useCallback<Notify>((message, action, cause) => {
    tokens += 1;
    setSnack({ message, action, cause, token: tokens });
  }, []);
  const dismiss = useCallback(() => setSnack(null), []);
  return { snack, notify, dismiss };
}

/** Keeps or drops `node` as the row's tap asks, and says so on the host. */
export function toggleSaved(
  writes: SavedWrites,
  node: string,
  server: Kept,
  notify: Notify,
): void {
  const kept = writes.kept(node, server);
  if (kept === null) {
    writes.keep(node, server);
    notify(SAVED, undefined, node);
    return;
  }
  writes.drop(node, server);
  notify(
    REMOVED_FROM_SAVED,
    { label: UNDO, onAction: () => writes.keep(node, null, kept, "restore") },
    node,
  );
}

/**
 * The menu's first row: `Save` or `Unsave`.
 *
 * `onGuest` is the host's join prompt; null means the reader is signed in.
 */
export function saveRow({
  writes,
  node,
  server,
  notify,
  onGuest,
  testId,
  rowNode,
}: {
  writes: SavedWrites;
  node: string;
  /** `viewerBookmarkedAt` as the host's read served it. */
  server: Kept;
  notify: Notify;
  onGuest: (() => void) | null;
  testId: string;
  rowNode?: DataNode;
}): MenuItem {
  const kept = writes.kept(node, server) !== null;
  return {
    label: kept ? "Unsave" : "Save",
    onSelect: () => (onGuest !== null ? onGuest() : toggleSaved(writes, node, server, notify)),
    testId,
    node: rowNode,
  };
}
