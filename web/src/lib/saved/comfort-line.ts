"use client";

// Which row line a target's row carries for the reader's own comforts on it —
// today a save, unsave or Undo that did not go through. The row line is the
// master's (`RowLine`); this only says whether it stands, and what its Retry
// asks again.

import type { RowLineState } from "@/lib/ui/row-line";
import { useSavedWrites } from "./provider";

export function useComfortLine(node: string): RowLineState | null {
  const failure = useSavedWrites().failure(node);
  return failure === null ? null : { kind: "didntGoThrough", onRetry: failure.retry };
}
