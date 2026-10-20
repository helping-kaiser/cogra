"use client";

// Which row line a target's row carries for the reader's own comforts on it —
// a save, unsave or Undo, or a hide or its Undo made from this row, that did
// not go through. The row line is the master's (`RowLine`); this only says
// whether it stands, and what its Retry asks again.

import { useHiddenSet } from "@/lib/hidden/provider";
import type { RowLineState } from "@/lib/ui/row-line";
import { useSavedWrites } from "./provider";

export function useComfortLine(node: string): RowLineState | null {
  const saved = useSavedWrites().failure(node);
  const hidden = useHiddenSet().failure(node);
  const failure = saved ?? hidden;
  return failure === null ? null : { kind: "didntGoThrough", onRetry: failure.retry };
}
