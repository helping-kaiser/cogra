"use client";

// The reference finder (D20): the picker an author opens to choose what
// to reference. DELIBERATELY PLAIN — jakob is designing the real
// interface, so 2.4 ships the STRUCTURE: a stable picker surface bound
// once to a stable lookup, which slice 2.7 replaces underneath without
// touching this component.
//
// Exact-match resolution only today. An empty or unresolvable query
// answers with an empty list rather than an error, because a finder runs
// on every keystroke and most of what it is asked is a prefix of
// something still being typed — so a miss is silent, never an error line.
// What POPULATES the finder by default is part of jakob's pending
// design; today an empty query shows nothing.
//
// A native <dialog>, like the multi-action confirm and the severance
// confirm: focus trapping, Esc, and the backdrop come from the platform.

import { useEffect, useRef, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import { fetchReferenceCandidates } from "@/lib/api/references-api";
import type { ReferenceDraft } from "@/lib/references/draft";
import { isQueryable, targetKindWord } from "@/lib/references/normalize";
import { buttonClassName } from "@/lib/ui/button";

/** How long the finder waits for typing to settle before it asks. */
export const FINDER_DEBOUNCE_MS = 250;

export function ReferenceFinder({
  onPick,
  onClose,
  alreadyDrafted = [],
  testIdPrefix,
  debounceMs = FINDER_DEBOUNCE_MS,
}: {
  onPick: (candidate: ReferenceDraft) => void;
  onClose: () => void;
  /**
   * Target ids the section already holds. Referencing the same target
   * twice is REFUSED rather than deduplicated, so the finder marks them
   * instead of handing back a refusal.
   */
  alreadyDrafted?: readonly string[];
  testIdPrefix: string;
  /** Test injection — a zero wait makes the lookup deterministic. */
  debounceMs?: number;
}) {
  const client = useApolloClient();
  const ref = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  // The last lookup that came back, TAGGED with the query it answered.
  // Everything the list renders is derived from it, so nothing has to be
  // reset as the reader types — React's own "you might not need an
  // effect" shape, and the reason this effect never sets state in its
  // body, only in the callback that resolves.
  const [answer, setAnswer] = useState<{
    query: string;
    candidates: readonly ReferenceDraft[];
    failed: boolean;
  } | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog !== null && !dialog.open) dialog.showModal();
  }, []);

  const trimmed = query.trim();
  const queryable = isQueryable(query);

  useEffect(() => {
    if (!queryable) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void fetchReferenceCandidates(client, trimmed).then((outcome) => {
        if (cancelled) return;
        setAnswer(
          outcome.kind === "success"
            ? { query: trimmed, candidates: outcome.value, failed: false }
            : { query: trimmed, candidates: [], failed: true },
        );
      });
    }, debounceMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [client, trimmed, queryable, debounceMs]);

  // An answer counts only for the query currently typed, so a stale one
  // never reads as "nothing matches" for what is being typed now.
  const answered = queryable && answer !== null && answer.query === trimmed;
  const looking = queryable && !answered;
  const candidates = answered ? answer.candidates : [];
  const failed = answered && answer.failed;

  const drafted = new Set(alreadyDrafted);

  return (
    <dialog
      ref={ref}
      data-testid={`${testIdPrefix}-finder`}
      onClose={onClose}
      className="m-auto w-[min(90vw,26rem)] rounded-extra-large bg-surface-container-high p-6 text-left text-on-surface backdrop:bg-scrim/50"
    >
      <h2 className="text-headline-small">Add a reference</h2>
      {/* D21: a topic is tagged, never referenced — the finder offers
          people, posts and comments only. */}
      <label htmlFor={`${testIdPrefix}-finder-query`} className="mt-4 block text-label-large">
        Find a person, post, or comment
      </label>
      <input
        id={`${testIdPrefix}-finder-query`}
        data-testid={`${testIdPrefix}-finder-query`}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="@handle or an id"
        autoComplete="off"
        className="mt-1 w-full rounded-extra-small border border-outline bg-transparent px-3 py-2"
      />
      {/* Live, so a screen reader hears the list change as it is typed
          rather than only on focusing it. */}
      <div role="status" aria-live="polite" className="mt-3 flex flex-col gap-2">
        {!queryable && (
          <p
            data-testid={`${testIdPrefix}-finder-hint`}
            className="text-body-small text-on-surface-variant"
          >
            Type a handle or an id to find something to reference.
          </p>
        )}
        {looking && (
          <p data-testid={`${testIdPrefix}-finder-looking`} className="text-body-small">
            Looking…
          </p>
        )}
        {failed && (
          <p
            role="alert"
            data-testid={`${testIdPrefix}-finder-failed`}
            className="text-body-small text-error"
          >
            Can&apos;t reach the server — the finder can&apos;t look right now.
          </p>
        )}
        {answered && !looking && !failed && candidates.length === 0 && (
          <p
            data-testid={`${testIdPrefix}-finder-empty`}
            className="text-body-small text-on-surface-variant"
          >
            Nothing matches that yet.
          </p>
        )}
        {candidates.length > 0 && (
          <ul className="flex flex-col gap-1" data-testid={`${testIdPrefix}-finder-results`}>
            {candidates.map((candidate) => {
              const already = drafted.has(candidate.targetId);
              return (
                <li key={candidate.targetId}>
                  <button
                    type="button"
                    disabled={already}
                    data-testid={`${testIdPrefix}-finder-candidate-${candidate.targetId}`}
                    onClick={() => onPick(candidate)}
                    className="flex w-full flex-col items-start rounded-extra-small px-2 py-2 text-left disabled:opacity-50"
                  >
                    <span className="text-body-medium">{candidate.target.label}</span>
                    <span className="text-label-small text-on-surface-variant">
                      {already
                        ? `already referenced · ${targetKindWord(candidate.target.kind)}`
                        : targetKindWord(candidate.target.kind)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          data-testid={`${testIdPrefix}-finder-close`}
          onClick={onClose}
          className={buttonClassName({ variant: "text", size: "sm" })}
        >
          Done
        </button>
      </div>
    </dialog>
  );
}
