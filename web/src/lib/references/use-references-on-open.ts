"use client";

// A CARD'S CITATIONS ARE READ WHEN THE SURFACE THAT SHOWS THEM OPENS
// (api-spec.md "Query budgets"; jakob 2026-11-23). A card carries the count it
// prints (`referenceCount`) and nothing more, because the list is a fold priced
// at fifty rows a card; the rows the count counts are read by id the moment the
// sheet rises (`fetchNodeReferences`), and every rise reads afresh.
//
// Two cases need no read at all: a caller that already holds the list (the
// detail's own post, whose read carries it) hands it through, and a count of
// zero is an empty list already.

import { useCallback, useEffect, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import { fetchNodeReferences } from "@/lib/api/references-api";
import type { ReferenceClaimNode } from "./claims";

export type ReferencesOnOpen = {
  /** The rows; null while their read is out (or before the surface opened). */
  readonly references: readonly ReferenceClaimNode[] | null;
  /** The read got no answer. */
  readonly failed: boolean;
  readonly retry: () => void;
};

type Read = { readonly rows: readonly ReferenceClaimNode[] | null; readonly failed: boolean };

const OUT: Read = { rows: null, failed: false };

export function useReferencesOnOpen({
  open,
  node,
  count,
  held,
}: {
  /** The surface that shows the rows is up. */
  open: boolean;
  node: { readonly kind: "Post" | "Comment"; readonly id: string };
  /** The card's `referenceCount`. */
  count: number;
  /** The list, where the caller's own read already carries it. */
  held?: readonly ReferenceClaimNode[];
}): ReferencesOnOpen {
  const client = useApolloClient();
  const [attempt, setAttempt] = useState(0);
  // EVERY RISE IS ITS OWN READ: the rise is counted as it happens (React,
  // "adjusting some state when a prop changes"), and an answer is kept under
  // the rise and attempt that asked for it, so a second rise never shows the
  // first one's rows while its own read is out.
  const [rise, setRise] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setRise((n) => n + 1);
  }
  const [read, setRead] = useState<(Read & { readonly key: string }) | null>(null);
  const needed = open && held === undefined && count > 0;
  const { kind, id } = node;
  const key = `${kind}:${id}:${rise}:${attempt}`;

  useEffect(() => {
    if (!needed) return;
    let cancelled = false;
    void fetchNodeReferences(client, { kind, id }).then((outcome) => {
      if (cancelled) return;
      // A node gone since the card was drawn has nothing left to list.
      setRead(
        outcome.kind === "success"
          ? { key, rows: outcome.value ?? [], failed: false }
          : { key, rows: null, failed: true },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [needed, client, kind, id, key]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  if (held !== undefined) return { references: held, failed: false, retry };
  if (count === 0) return { references: [], failed: false, retry };
  const answer = needed && read !== null && read.key === key ? read : OUT;
  return { references: answer.rows, failed: answer.failed, retry };
}
