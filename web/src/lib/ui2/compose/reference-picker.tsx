"use client";

// THE CITATION PICKER — what `+ Cite something` opens (ReferencePicker;
// behavior/ReferencePicker.md; readme §13). The reference explorer wearing the
// search UI: the same bar, the same worded trigger, the same rows, and the
// rows' edge is the ADD mark, because the whole row's tap picks.
//
// IT RIDES THE ONE SEARCH MATCHER (api-spec.md "Search": "the reference finder
// all run the one matcher"), through `referenceCandidates` — the matcher
// narrowed to what `prepareReference` accepts, so the picker never offers a
// target the signing would refuse: a person, a post or a comment (the V1.0
// scope cut), never a topic and never a keyless account.
//
// A PICK STAGES AND THE PICKER STAYS OPEN (jakob 2026-10-01): the row moves
// into the staged section above the results with its ×, and the move is
// spoken. `Done` AND THE HEADER BACK ARE ONE LEAVE, every staged citation kept.
//
// THE FILTER (the trigger reads `Everything`) holds the three citable kinds —
// Posts, Comments, Profiles — that combine, staged in its sheet and committed
// by `Done`, the search filter's law (ExploreFilter.md).
//
// THE `state` CHIP (rounds 24-25): at the batch's ten, `Up to 10 citations
// per post.` stands above the results, which dim and take no tap; a read with
// no answer says `Can't reach the server — results can't load right now.` over
// `Retry` where the results were, the field keeping the query.
//
// REGISTERED (nodes.json ReferencePicker, round 23): a result is
// `referencePicker.result` and a staged row `referencePicker.staged.stagedReference`,
// each keyed by its place from 1. Its filter sheet is the board's `filter` state,
// `referencePicker.filterSheet` (round 24).

import { useEffect, useRef, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import type { NodeKind } from "@/__generated__/graphql";
import { CANDIDATE_LIMIT, fetchReferenceCandidates } from "@/lib/api/references-api";
import type { ReferenceDraft, ReferenceTargetView } from "@/lib/references/draft";
import { isQueryable, REFERENCE_BATCH_CAP } from "@/lib/references/normalize";
import { PICK_ADDED, PICK_REMOVED } from "@/lib/topics/picker";
import { instance, part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { shortTimestamp } from "@/lib/ui/timestamp";

import { BottomSheet } from "../bottom-sheet";
import { Chip } from "../chip";
import { FilterFoot, FilterSection } from "../filter-sheet";
import { HelpDialog, HELP_TOPICS } from "../help-dialog";
import { SearchBar } from "../search-bar";
import {
  PickerFault,
  PickerFrame,
  PickerNote,
  PickerRow,
  PickerRows,
  PickerStagedRow,
  StagedSection,
  type PickerKind,
  type PickerOrigin,
} from "./picker-rows";

/** How long the picker waits for typing to settle before it asks. */
export const PICKER_DEBOUNCE_MS = 250;

const NODE: DataNode = { path: "referencePicker" };
const FILTER_SHEET = part(NODE, "filterSheet");

/** The kinds section's words (ReferencePicker.jsx, the search filter's own). */
const KINDS_HINT = "Combine as many as you like. All, until you narrow it.";

/** The three citable kinds, as the search filter names them (`FEED_KINDS`). */
export const CITABLE_KINDS = [
  { value: "posts", label: "Posts", kind: "POST" },
  { value: "comments", label: "Comments", kind: "COMMENT" },
  { value: "profiles", label: "Profiles", kind: "USER" },
] as const satisfies readonly { value: string; label: string; kind: NodeKind }[];

export type CitableKind = (typeof CITABLE_KINDS)[number]["value"];

/**
 * The trigger's reading: `Everything` at the default — no kind narrowed —
 * one kind's name, `All kinds` when every chip is on, else `N kinds`
 * (`feedFilterSummary`'s kinds head, with search's own `Everything`).
 */
export function kindsReading(kinds: readonly CitableKind[]): string {
  if (kinds.length === 0) return "Everything";
  if (kinds.length === CITABLE_KINDS.length) return "All kinds";
  if (kinds.length === 1) return CITABLE_KINDS.find((entry) => entry.value === kinds[0])!.label;
  return `${kinds.length} kinds`;
}

/** The trigger's accessible name: its reading, then its purpose (`triggerName`). */
export function triggerName(reading: string): string {
  return `${reading}, what the search shows`;
}

/** What a citation's row draws: its mark, its name, and its second line. */
export function pickerRowOf(target: ReferenceTargetView): {
  kind: PickerKind;
  name: string;
  sub?: string;
  src?: string | null;
} {
  const age = target.createdAt === undefined ? null : shortTimestamp(target.createdAt);
  const byline = (author: string | undefined) =>
    [author === undefined ? null : `@${author}`, age].filter((piece) => piece !== null && piece !== "").join(" · ") ||
    undefined;
  switch (target.kind) {
    case "User":
      // A person is their name over their handle (`ExplorePerson`'s row).
      return target.displayName
        ? { kind: "person", name: target.displayName, sub: target.label }
        : { kind: "person", name: target.label };
    case "Post":
      return { kind: "post", name: target.name ?? target.label, sub: byline(target.author), src: target.cover ?? null };
    case "Comment":
      return { kind: "comment", name: target.name ?? target.label, sub: byline(target.author) };
    default:
      return { kind: "post", name: target.label };
  }
}

export function ReferencePicker({
  references,
  onReferences,
  onDone,
  origin = "post",
  cap = REFERENCE_BATCH_CAP,
  debounceMs = PICKER_DEBOUNCE_MS,
}: {
  /** The composer's staged citations — the staged section shows exactly these. */
  references: readonly ReferenceDraft[];
  /** Every stage and un-stage, applied to the composer the moment it is made. */
  onReferences: (next: readonly ReferenceDraft[]) => void;
  /** Done and the header back. */
  onDone: () => void;
  origin?: PickerOrigin;
  /** The creation batch's cap; null where citations are not one batch. */
  cap?: number | null;
  /** Test injection — a zero wait makes the lookup deterministic. */
  debounceMs?: number;
}) {
  const client = useApolloClient();
  const [query, setQuery] = useState("");
  const [said, setSaid] = useState("");
  const [help, setHelp] = useState(false);
  const [kinds, setKinds] = useState<readonly CitableKind[]>([]);
  const [staging, setStaging] = useState<readonly CitableKind[] | null>(null);
  const [answer, setAnswer] = useState<{
    query: string;
    narrowing: string;
    candidates: readonly ReferenceDraft[];
    failed: boolean;
  } | null>(null);
  // Retry's count: a press reads the results again for the query as it stands.
  const [attempt, setAttempt] = useState(0);
  const field = useRef<HTMLInputElement | null>(null);

  // ReferencePicker.md: WHEN the picker opens -> the search field takes focus
  // AND the keyboard rises.
  useEffect(() => {
    field.current?.focus();
  }, []);

  const trimmed = query.trim();
  const queryable = isQueryable(query);
  // THE FILTER NARROWS ON THE SERVER (references.graphql: `kinds` subtract;
  // null narrows nothing), so a narrowed answer is a whole answer of its
  // kinds, never a 10-row answer trimmed here. The committed kinds key the
  // lookup as the query does: an answer stands only for what it was asked.
  const narrowing = CITABLE_KINDS.filter((entry) => kinds.includes(entry.value))
    .map((entry) => entry.kind)
    .join(",");

  useEffect(() => {
    if (!queryable) return;
    let cancelled = false;
    const wire = narrowing === "" ? null : (narrowing.split(",") as NodeKind[]);
    const timer = setTimeout(() => {
      void fetchReferenceCandidates(client, trimmed, CANDIDATE_LIMIT, wire).then((outcome) => {
        if (cancelled) return;
        setAnswer(
          outcome.kind === "success"
            ? { query: trimmed, narrowing, candidates: outcome.value, failed: false }
            : { query: trimmed, narrowing, candidates: [], failed: true },
        );
      });
    }, debounceMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [client, trimmed, queryable, narrowing, debounceMs, attempt]);

  const stagedIds = new Set(references.map((reference) => reference.targetId));
  const atCap = cap !== null && references.length >= cap;
  // ALWAYS a staged reference stands only in the staged section above the results.
  const answered =
    queryable && answer !== null && answer.query === trimmed && answer.narrowing === narrowing ? answer : null;
  const results = answered === null ? [] : answered.candidates.filter((candidate) => !stagedIds.has(candidate.targetId));
  // ReferencePicker.md: the fault stands only where no result loaded for the
  // query; a read in flight and an empty answer say nothing.
  const fault = answered?.failed === true;

  const stage = (candidate: ReferenceDraft) => {
    if (stagedIds.has(candidate.targetId) || atCap) return;
    onReferences([...references, candidate]);
    setSaid(PICK_ADDED);
  };
  const unstage = (targetId: string) => {
    onReferences(references.filter((reference) => reference.targetId !== targetId));
    setSaid(PICK_REMOVED);
  };

  const reading = kindsReading(kinds);
  const toggle = (value: CitableKind) =>
    setStaging((current) => {
      const list = current ?? kinds;
      return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
    });

  return (
    <>
      <PickerFrame
        title="Cite something"
        origin={origin}
        helpLabel="Citing"
        onHelp={() => setHelp(true)}
        onLeave={onDone}
        node={NODE}
        said={said}
        footSpaced
        head={
          <>
            <SearchBar
              query={query}
              onChange={(next) => {
                setQuery(next);
                setSaid("");
              }}
              ariaLabel="Cite something"
              inputRef={field}
              node={part(NODE, "searchField")}
            />
            <div className="flex items-center px-4 pb-2">
              <button
                type="button"
                aria-expanded={staging !== null}
                aria-label={triggerName(reading)}
                onClick={() => setStaging(kinds)}
                {...testAttributes(part(NODE, "filterTrigger"))}
                className="cg-state cg-focus cg-hit relative inline-flex h-8 min-w-0 max-w-56 cursor-pointer items-center truncate whitespace-nowrap rounded-full border border-outline bg-transparent px-3 text-label-large [line-height:normal] text-on-surface"
              >
                {reading}
              </button>
            </div>
          </>
        }
        staged={
          references.length > 0 && (
            <StagedSection node={part(NODE, "staged")}>
              {references.map((reference, index) => {
                const row = pickerRowOf(reference.target);
                return (
                  <PickerStagedRow
                    key={reference.targetId}
                    {...row}
                    onRemove={() => unstage(reference.targetId)}
                    node={instance(part(NODE, "staged"), "stagedReference", String(index + 1))}
                  />
                );
              })}
            </StagedSection>
          )
        }
        list={
          <>
            {/* THE CAP (ReferencePicker.md): its line above the results, every
                result dimmed and taking no tap; the staged ×s stay live. */}
            {atCap && (
              <PickerNote node={part(NODE, "cap")}>
                Up to {cap} citations per {origin}.
              </PickerNote>
            )}
            {/* THE FAULT, where the results were; the field keeps the query. */}
            {fault && (
              <PickerFault
                message="Can't reach the server — results can't load right now."
                onRetry={() => {
                  // The read in flight says nothing, so the line goes with the press.
                  setAnswer(null);
                  setAttempt((n) => n + 1);
                }}
                node={part(NODE, "fault")}
              />
            )}
            <PickerRows dimmed={atCap}>
              {results.map((candidate, index) => (
                <PickerRow
                  key={candidate.targetId}
                  {...pickerRowOf(candidate.target)}
                  onPick={() => stage(candidate)}
                  disabled={atCap}
                  node={instance(NODE, "result", String(index + 1))}
                />
              ))}
            </PickerRows>
          </>
        }
      />
      {/* THE FILTER SHEET IS THE SEARCH FILTER'S ANATOMY (ReferencePicker.jsx:
          `SheetTitle`, `FilterSection` Kinds, `FilterFoot`): a sheet of rows,
          each section carrying its own 24px gutter, the foot ending the
          content rather than pinned under a scroll — Explore's own sheet. */}
      <BottomSheet
        open={staging !== null}
        // The scrim, a swipe down, system Back and Escape drop what was staged.
        onClose={() => setStaging(null)}
        title="What the search shows"
        node={FILTER_SHEET}
        rows
      >
        <FilterSection label="Kinds" hint={KINDS_HINT} node={part(FILTER_SHEET, "kinds")}>
          {CITABLE_KINDS.map((entry) => (
            <Chip
              key={entry.value}
              testId={`reference-picker-filter-${entry.value}`}
              node={part(FILTER_SHEET, `kinds.${entry.value}Chip`)}
              selected={(staging ?? kinds).includes(entry.value)}
              onClick={() => toggle(entry.value)}
            >
              {entry.label}
            </Chip>
          ))}
        </FilterSection>
        <FilterFoot
          node={part(FILTER_SHEET, "foot")}
          testId="reference-picker-filter"
          onReset={() => setStaging([])}
          onDone={() => {
            // Done commits the staged kinds: the results narrow once.
            if (staging !== null) setKinds(staging);
            setStaging(null);
          }}
        />
      </BottomSheet>
      <HelpDialog open={help} onClose={() => setHelp(false)} topic={HELP_TOPICS.citing} testId="reference-picker-help" />
    </>
  );
}
