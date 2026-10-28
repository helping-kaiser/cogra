"use client";

// THE TAG PICKER — what `+ Add a tag` opens (TagPicker, TagPickerTyping,
// TagPickerRefused; behavior/TagPicker*.md; readme §13, the tag round).
//
// THE FIRST ROW IS THE TYPED NAME, ALWAYS (jakob 2026-09-30, K14.1): the
// canonicalized form of what is typed, `Signs as #name` on its second line,
// and the field's action key stages it — the same pick as a tap. It names a
// Type that already exists; there is no "Create" row and never can be
// (hashtag.md §2). The rows under it are the index's: names in use that start
// with what is typed (`fetchTagNames`), the typed name never listed twice.
//
// A PICK STAGES AND THE PICKER STAYS OPEN (jakob 2026-10-01): the row moves
// into the staged section above the list with its ×, and the move is spoken.
// The query stays as typed, so the list being picked from does not move under
// the reader. A tag the composer already holds stands in the staged section
// the moment the picker opens — the staged section IS the composer's tags.
//
// A NAME OUTSIDE THE ATOM IS REFUSED AT THE FIELD (TagPickerRefused): the
// error ring, the refusal in the rule line's place (spoken by its own
// `role="alert"`, never by the status message), no first row, and an empty
// list without a message.
//
// `Done` AND THE HEADER BACK ARE ONE LEAVE: both return to the composer with
// every staged tag kept, and neither stages the typed name.
//
// THE SCREEN IS UNREGISTERED (nodes.json has no `TagPicker`): its parts carry
// the board's evident paths under `tagPicker`, pending design's registration.

import { useEffect, useRef, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import { fetchTagNames } from "@/lib/api/topics-api";
import { newTagDraft, type TagDraft } from "@/lib/topics/draft";
import { TAG_BATCH_CAP } from "@/lib/topics/normalize";
import {
  PICK_ADDED,
  PICK_REMOVED,
  readTagName,
  signsAs,
  TAG_NAME_RULE,
  TAG_PICKER_FOOTNOTE,
} from "@/lib/topics/picker";
import { instance, part, testAttributes, type DataNode } from "@/lib/ui/data-node";

import { HelpDialog, HELP_TOPICS } from "../help-dialog";
import { SearchBar } from "../search-bar";
import {
  PickerFrame,
  PickerRow,
  PickerStagedRow,
  StagedSection,
  type PickerOrigin,
} from "./picker-rows";

/** How long the index waits for typing to settle before it asks. */
export const TAG_INDEX_DEBOUNCE_MS = 250;

const NODE: DataNode = { path: "tagPicker" };
const REFUSAL_ID = "tag-picker-refusal";

export function TagPicker({
  tags,
  onTags,
  onDone,
  origin = "post",
  cap = TAG_BATCH_CAP,
  debounceMs = TAG_INDEX_DEBOUNCE_MS,
}: {
  /** The composer's staged tags — the staged section shows exactly these. */
  tags: readonly TagDraft[];
  /** Every stage and un-stage, applied to the composer the moment it is made. */
  onTags: (next: readonly TagDraft[]) => void;
  /** Done and the header back. */
  onDone: () => void;
  /** Which composer opened it — the arrow names it. */
  origin?: PickerOrigin;
  /** The creation batch's cap; null where tags are not one batch. */
  cap?: number | null;
  /** Test injection — a zero wait makes the index deterministic. */
  debounceMs?: number;
}) {
  const client = useApolloClient();
  const [query, setQuery] = useState("");
  const [said, setSaid] = useState("");
  const [help, setHelp] = useState(false);
  // The index's last answer, TAGGED with the name it answered, so a stale
  // answer never reads as the rows for what is typed now (and nothing has to
  // be reset as the reader types).
  const [index, setIndex] = useState<{ name: string; names: readonly string[] } | null>(null);
  const field = useRef<HTMLInputElement | null>(null);

  // TagPicker.md: WHEN the picker opens -> the name field takes focus AND the
  // keyboard rises.
  useEffect(() => {
    field.current?.focus();
  }, []);

  const reading = readTagName(query);
  const canonical = reading.kind === "legal" ? reading.canonical : null;

  useEffect(() => {
    if (canonical === null) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void fetchTagNames(client, canonical).then((outcome) => {
        // A miss or a fault leaves the first row alone to carry the pick —
        // the index only ever adds names, it never gates one.
        if (!cancelled) setIndex({ name: canonical, names: outcome.kind === "success" ? outcome.value : [] });
      });
    }, debounceMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [client, canonical, debounceMs]);

  const staged = new Set(tags.map((tag) => tag.name));
  const atCap = cap !== null && tags.length >= cap;
  // ALWAYS a staged tag stands only in the staged section above the list.
  const first = canonical !== null && !staged.has(canonical) ? canonical : null;
  const indexed =
    canonical !== null && index !== null && index.name === canonical
      ? index.names.filter((name) => name !== canonical && !staged.has(name))
      : [];

  const stage = (name: string) => {
    if (staged.has(name) || atCap) return;
    onTags([...tags, newTagDraft(name)]);
    setSaid(PICK_ADDED);
  };
  const unstage = (name: string) => {
    onTags(tags.filter((tag) => tag.name !== name));
    setSaid(PICK_REMOVED);
  };

  return (
    <>
      <PickerFrame
        title="Add a tag"
        origin={origin}
        helpLabel="Tagging"
        onHelp={() => setHelp(true)}
        onLeave={onDone}
        node={NODE}
        said={said}
        head={
          <>
            <SearchBar
              query={query}
              onChange={(next) => {
                setQuery(next);
                // The status message speaks a move, never the typing: a
                // refusal arriving is the alert's to say (TagPickerRefused.md).
                setSaid("");
              }}
              placeholder="Name a tag"
              ariaLabel="Name a tag"
              onAction={() => {
                // The action key stages the first row — and nothing while
                // the name is refused or empty.
                if (first !== null) stage(first);
              }}
              error={reading.kind === "refused"}
              describedBy={reading.kind === "refused" ? REFUSAL_ID : undefined}
              inputRef={field}
              node={part(NODE, "nameField")}
            />
            <div className="flex flex-col gap-0.5 px-6 pb-2">
              {reading.kind === "refused" ? (
                <p
                  id={REFUSAL_ID}
                  role="alert"
                  className="m-0 text-body-small text-error"
                  {...testAttributes(part(NODE, "refusal"))}
                >
                  {reading.refusal}
                </p>
              ) : (
                <p className="m-0 text-body-small text-on-surface-variant" {...testAttributes(part(NODE, "rule"))}>
                  {TAG_NAME_RULE}
                </p>
              )}
            </div>
          </>
        }
        staged={
          tags.length > 0 && (
            <StagedSection node={part(NODE, "staged")}>
              {tags.map((tag) => (
                <PickerStagedRow
                  key={tag.name}
                  kind="topic"
                  name={tag.name}
                  onRemove={() => unstage(tag.name)}
                  node={instance(part(NODE, "staged"), "tag", tag.name)}
                />
              ))}
            </StagedSection>
          )
        }
        list={
          <>
            {first !== null && (
              <PickerRow
                kind="topic"
                name={first}
                sub={signsAs(first)}
                onPick={() => stage(first)}
                disabled={atCap}
                node={instance(NODE, "row", first)}
              />
            )}
            {indexed.map((name) => (
              <PickerRow
                key={name}
                kind="topic"
                name={name}
                onPick={() => stage(name)}
                disabled={atCap}
                node={instance(NODE, "row", name)}
              />
            ))}
            <div className="flex-1" />
            {atCap && (
              <p className="m-0 px-6 pb-2 text-body-small text-on-surface-variant" {...testAttributes(part(NODE, "cap"))}>
                Up to {cap} tags per {origin}.
              </p>
            )}
            <p
              className="m-0 px-6 pb-4 pt-2 text-body-small text-on-surface-variant"
              {...testAttributes(part(NODE, "footnote"))}
            >
              {TAG_PICKER_FOOTNOTE}
            </p>
          </>
        }
      />
      <HelpDialog open={help} onClose={() => setHelp(false)} topic={HELP_TOPICS.tagging} testId="tag-picker-help" />
    </>
  );
}
