"use client";

// HIDDEN ACCOUNTS (design/designs/canonical/screens/SettingsHidden.jsx;
// behavior/SettingsHidden.md; hidden-actors packet §5.4, §6). Everyone the
// reader has hidden, most recently hidden first, over settings, and the way
// back: `Unhide` on each row, no confirm. The rows are the hidden set's own —
// the sheet reads the store and fetches nothing.
//
// A ROW IS INERT APART FROM ITS UNHIDE (SettingsHidden.md:19-21): a person's
// profile is one tap away from anywhere, and a row that both navigated and
// carried a button would be two targets fighting for one thumb.
//
// A DELETED ACCOUNT'S ROW (design digest item 56) wears the reserved disc and
// `Deleted account`, and is its own node, `redactedAccount`, keyed by the
// actor's id — there is no handle to key by.
//
// A FAILURE TAKES THE ROW'S OWN SLOTS (design digest item 55): the second line
// reads `That didn't go through.` and `Retry` stands where `Unhide` stood. An
// Undo of an unhide that did not go through puts the row back in its place
// carrying that line, until Retry or the next fresh read.

import { useEffect, useRef } from "react";

import { unhidePerson } from "@/lib/hidden/hide-row";
import type { HiddenEntry, HiddenSet } from "@/lib/hidden/hidden-set";
import type { Notify } from "@/lib/saved/save-row";
import { instance, part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { DIDNT_GO_THROUGH_ROW } from "@/lib/ui/row-line";
import { ladderAge } from "@/lib/ui/timestamp";
import { BottomSheet, SHEET_RAISED } from "@/lib/ui2/bottom-sheet";
import { ContentRow, type ContentRowDisc } from "@/lib/ui2/content-row";
import { InlineAction } from "@/lib/ui2/inline-action";

const SHEET: DataNode = { path: "settings.hiddenSheet" };
const LIST = part(SHEET, "list");

/** The row's node: `account` by handle, `redactedAccount` by actor id. */
function rowNode(entry: HiddenEntry): DataNode {
  return entry.redacted || entry.handle === null
    ? instance(LIST, "redactedAccount", entry.id)
    : instance(LIST, "account", entry.handle);
}

function discOf(entry: HiddenEntry): ContentRowDisc {
  if (entry.redacted) return { kind: "redacted" };
  const name = entry.displayName ?? entry.handle ?? "";
  return entry.avatarUrl !== null
    ? { kind: "picture", src: entry.avatarUrl, name }
    : { kind: "monogram", name };
}

/**
 * The rows the sheet stands: the hidden set, plus any row whose Undo of an
 * unhide did not go through — it comes back in its place, carrying the line.
 */
export function hiddenRows(set: HiddenSet): HiddenEntry[] {
  const rows = set.list();
  for (const failure of set.failed().values()) {
    if (failure.kind === "undoUnhide" && !rows.some((row) => row.id === failure.person.id)) {
      rows.push(failure.person);
    }
  }
  return rows.sort((a, b) => Date.parse(b.hiddenAt) - Date.parse(a.hiddenAt) || (a.id < b.id ? 1 : -1));
}

export function SettingsHiddenSheet({
  open,
  set,
  notify,
  onClose,
}: {
  open: boolean;
  set: HiddenSet;
  /** The settings page's snackbar, which carries the unhide's aftermath. */
  notify: Notify;
  /** Closes onto settings; focus returns to the Hidden accounts row. */
  onClose: () => void;
}) {
  const rows = hiddenRows(set);
  // FOCUS AFTER A ROW REMOVES ITSELF (SettingsHidden.md:23; readme's focus
  // law): the next row's Unhide, else the previous one's.
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const focusAfter = useRef<{ next: string | null; previous: string | null } | null>(null);
  useEffect(() => {
    const after = focusAfter.current;
    if (after === null) return;
    focusAfter.current = null;
    const target =
      (after.next !== null ? buttons.current.get(after.next) : undefined) ??
      (after.previous !== null ? buttons.current.get(after.previous) : undefined);
    target?.focus();
  });

  // THE LAST ROW GONE CLOSES THE SHEET (SettingsHidden.md:27): never an empty
  // sheet; the settings row reads `None` and takes the focus.
  const empty = open && rows.length === 0;
  useEffect(() => {
    if (empty) onClose();
  }, [empty, onClose]);

  return (
    <BottomSheet open={open && rows.length > 0} onClose={onClose} title="Hidden accounts" node={SHEET} focusTitle rows maxHeight={SHEET_RAISED}>
      <div className="flex flex-col gap-2 px-6" {...testAttributes(LIST)}>
        {rows.map((entry, index) => {
          const node = rowNode(entry);
          const failure = set.failure(entry.id);
          const name = entry.redacted ? "" : (entry.displayName ?? `@${entry.handle}`);
          const titleId = `settings-hidden-${entry.id}-title`;
          return (
            <ContentRow
              key={entry.id}
              variant="chronicle"
              title={name}
              titleAside={entry.displayName !== null && entry.handle !== null ? `@${entry.handle}` : undefined}
              disc={discOf(entry)}
              second={
                failure !== null ? (
                  <span className="text-error">{DIDNT_GO_THROUGH_ROW}</span>
                ) : (
                  `Hidden ${ladderAge(entry.hiddenAt)}`
                )
              }
              node={node}
              testId={`settings-hidden-${entry.id}`}
              action={
                <span {...testAttributes(part(node, "trailing"))}>
                  {failure !== null ? (
                    <InlineAction onClick={failure.retry} testId={`settings-hidden-${entry.id}-retry`}>
                      Retry
                    </InlineAction>
                  ) : (
                    // `Unhide` keeps its visible name and is described by its
                    // row's title (design digest item 57, F2).
                    <InlineAction
                      onClick={() => {
                        focusAfter.current = {
                          next: rows[index + 1]?.id ?? null,
                          previous: rows[index - 1]?.id ?? null,
                        };
                        unhidePerson(set, entry, notify);
                      }}
                      node={part(node, "trailing.unhide")}
                      buttonRef={(element) => {
                        if (element === null) buttons.current.delete(entry.id);
                        else buttons.current.set(entry.id, element);
                      }}
                      describedBy={titleId}
                    >
                      Unhide
                    </InlineAction>
                  )}
                </span>
              }
              titleId={titleId}
            />
          );
        })}
      </div>
    </BottomSheet>
  );
}
