"use client";

// SAVED — everything the reader kept, in one list (Saved.md, SavedUndo.md,
// SavedEmpty.md; design/designs/canonical/screens/Saved.jsx). Reached from the
// reader's own profile's ⋮.
//
// ONE MIXED LIST, newest first by when the reader saved each thing, with no
// kind label, filter or heading: the disc says what a row is. Every row
// carries its own Unsave — the filled bookmark, no word on screen, in the
// chevron's slot outboard of the age.
//
// THE LIST IS THE LAST READ WITH THE READER'S OWN ACTS LAID OVER IT
// (`SavedWrites`). That one rule carries three drawn behaviours: an unsave
// here takes the row out at the tap and Undo puts it back in its place (the
// loaded page still holds it); an unsave made inside a page opened from here
// is gone on return, with no snackbar (design digest item 57); and a revert
// brings the row back where it stood.
//
// A comfort that did not go through says so in the row's own slots (design
// digest item 46): the second line carries `That didn't go through.` and
// `Retry`, and the Unsave stays. A failed Undo's row STAYS on screen carrying
// that line (item 47) — the reader asked for it back, and the line says why it
// is not, yet.

import { useCallback, useEffect, useRef, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import { fetchSavedPage, type SavedEntry } from "@/lib/api/saved-api";
import { appendDeduped } from "@/lib/api/pagination";
import { useSavedWrites } from "@/lib/saved/provider";
import { REMOVED_FROM_SAVED, UNDO, useHostSnack } from "@/lib/saved/save-row";
import { savedRow } from "@/lib/saved/row-content";
import { useAuthGuard } from "@/lib/session/runtime";
import { Button } from "@/lib/ui/button";
import { CollapsingTop } from "@/lib/ui/collapsing-top";
import { instance, part, type DataNode } from "@/lib/ui/data-node";
import { Icon } from "@/lib/ui/icons";
import { tailIndexOf, useApproachingTail } from "@/lib/ui/infinite-list";
import { PageHeader } from "@/lib/ui/page-header";
import { usePullToRefresh } from "@/lib/ui/pull-to-refresh";
import { RowLine } from "@/lib/ui/row-line";
import { useScrollHost } from "@/lib/ui/scroll-host";
import { Snackbar } from "@/lib/ui/snackbar";
import { ladderAge } from "@/lib/ui/timestamp";
import { TransportError } from "@/lib/ui/transport-error";
import { ContentRow } from "@/lib/ui2/content-row";

/** SavedEmpty.md:3, verbatim. */
export const SAVED_EMPTY =
  "Nothing saved yet. A post, a comment or a person can be saved from its own menu, and it waits here.";

/** The chronicle's load-more fault (design digest item 57; copy-voice). */
export const COULDNT_LOAD_MORE = "Couldn't load more";

const LIST: DataNode = { path: "saved.list" };

type Entry = SavedEntry & { readonly id: string };

function idOf(entry: SavedEntry): string {
  return entry.node.id;
}

export function SavedScreen() {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const host = useScrollHost();
  const writes = useSavedWrites();
  const { snack, notify, dismiss } = useHostSnack();

  const [entries, setEntries] = useState<readonly Entry[]>([]);
  const [endCursor, setEndCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  // Which read is live: a pull fires a new one, and the old one resolving
  // afterwards must not overwrite it.
  const request = useRef(0);

  const read = useCallback(() => {
    const asked = (request.current += 1);
    void (async () => {
      const outcome = await guard.run(() => fetchSavedPage(client, null));
      if (asked !== request.current) return;
      setLoading(false);
      if (outcome.kind !== "success") {
        setFailed(true);
        return;
      }
      // A FRESH LOAD: the rows' lines go (RowSigning.md:17), and the overlay
      // steps aside for what the read now says.
      writes.settle();
      setFailed(false);
      setMoreFailed(false);
      setEntries(outcome.value.items.map((entry) => ({ ...entry, id: idOf(entry) })));
      setEndCursor(outcome.value.endCursor);
      setHasNextPage(outcome.value.hasNextPage);
    })();
  }, [client, guard, writes]);

  useEffect(() => {
    read();
    return () => {
      request.current += 1;
    };
  }, [read]);

  // Saved pull-down on (design digest item 57): the platform's own refresh,
  // through the same read the first arrival takes.
  const onPull = useCallback(() => {
    setLoading(true);
    read();
  }, [read]);
  usePullToRefresh({ host, onPull });

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasNextPage || endCursor === null) return;
    setLoadingMore(true);
    setMoreFailed(false);
    const outcome = await guard.run(() => fetchSavedPage(client, endCursor));
    setLoadingMore(false);
    if (outcome.kind !== "success") {
      // THE ROWS ON SCREEN STAY, and the fault ends the list (Saved.md).
      setMoreFailed(true);
      return;
    }
    setEntries((current) =>
      appendDeduped(
        current,
        outcome.value.items.map((entry) => ({ ...entry, id: idOf(entry) })),
      ),
    );
    setEndCursor(outcome.value.endCursor);
    setHasNextPage(outcome.value.hasNextPage);
  }, [client, guard, loadingMore, hasNextPage, endCursor]);

  // What stands: what the reader has not dropped, plus a row whose Undo did
  // not go through, which stays carrying its line.
  const visible = entries.filter(
    (entry) =>
      writes.kept(entry.id, entry.bookmarkedAt) !== null ||
      writes.failure(entry.id)?.kind === "restore",
  );

  const tailRef = useApproachingTail({
    root: host,
    onReach: () => void loadMore(),
    enabled: hasNextPage && !moreFailed,
  });
  const tailIndex = tailIndexOf(visible.length);

  // FOCUS AFTER A ROW REMOVES ITSELF (Saved.md; the K13 focus law): the next
  // row, else the previous, else the empty state.
  const rowOpeners = useRef(new Map<string, HTMLElement>());
  const emptyRef = useRef<HTMLParagraphElement>(null);
  const focusAfter = useRef<{ next: string | null; previous: string | null } | null>(null);
  useEffect(() => {
    const after = focusAfter.current;
    if (after === null) return;
    focusAfter.current = null;
    const target =
      (after.next !== null ? rowOpeners.current.get(after.next) : undefined) ??
      (after.previous !== null ? rowOpeners.current.get(after.previous) : undefined) ??
      emptyRef.current;
    target?.focus();
  }, [visible.length]);

  const unsave = (entry: Entry, index: number) => {
    const kept = writes.kept(entry.id, entry.bookmarkedAt);
    focusAfter.current = {
      next: visible[index + 1]?.id ?? null,
      previous: visible[index - 1]?.id ?? null,
    };
    writes.drop(entry.id, entry.bookmarkedAt);
    // UNDO PUTS THE ROW BACK WHERE IT WAS (SavedUndo.md): it keeps the thing
    // again at the time it was first kept, which is its place in the list.
    notify(
      REMOVED_FROM_SAVED,
      { label: UNDO, onAction: () => writes.keep(entry.id, null, kept ?? entry.bookmarkedAt, "restore") },
      entry.id,
    );
  };

  const empty = !loading && !failed && visible.length === 0 && !hasNextPage;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col">
      <CollapsingTop>
        <PageHeader
          title="Saved"
          backHref="/profile"
          backLabel="Back to your profile"
          backScroll={false}
          backTestId="saved-back"
          node={{ path: "saved.header" }}
        />
      </CollapsingTop>
      {loading && entries.length === 0 && (
        <p role="status" aria-live="polite" data-testid="saved-loading" className="px-4 pt-2">
          Loading…
        </p>
      )}
      {failed && entries.length === 0 && !loading && (
        <div className="flex items-center gap-3 px-4 pt-2">
          <TransportError testId="saved-transport-error" />
          <Button
            testId="saved-retry"
            variant="outline"
            size="sm"
            onClick={() => {
              setLoading(true);
              read();
            }}
          >
            Retry
          </Button>
        </div>
      )}
      {empty && (
        // SAVEDEMPTY: words only — no action button, no error colour, and the
        // save named in words, never drawn as its glyph.
        <div className="px-6 pt-2" data-testid="saved.empty">
          <p
            ref={emptyRef}
            tabIndex={-1}
            data-testid="saved.empty.title"
            className="py-2 text-body-medium text-on-surface-variant outline-none"
          >
            {SAVED_EMPTY}
          </p>
        </div>
      )}
      {visible.length > 0 && (
        <ul data-testid="saved.list" className="m-0 flex list-none flex-col gap-2 px-4 pt-2">
          {visible.map((entry, index) => {
            const row = savedRow(entry.node);
            if (row === null) return null;
            const node = instance(LIST, "entry", row.key);
            const failure = writes.failure(entry.id);
            return (
              <li
                key={entry.id}
                ref={index === tailIndex ? tailRef : undefined}
                data-saved-id={entry.id}
              >
                <div
                  ref={(element) => {
                    const opener = element?.querySelector<HTMLElement>("[data-testid$='-open']");
                    if (opener) rowOpeners.current.set(entry.id, opener);
                    else rowOpeners.current.delete(entry.id);
                  }}
                >
                  <ContentRow
                    variant="chronicle"
                    title={row.title}
                    titleQuiet={row.titleQuiet}
                    titleAside={row.aside}
                    // A FAILED COMFORT TAKES THE SECOND LINE'S SLOT (item 46).
                    second={
                      failure !== null ? (
                        <RowLine
                          state={{ kind: "didntGoThrough", onRetry: failure.retry }}
                          testId={`saved-row-line-${entry.id}`}
                        />
                      ) : (
                        row.second
                      )
                    }
                    trailing={ladderAge(entry.bookmarkedAt)}
                    disc={row.disc}
                    href={row.href}
                    node={node}
                    testId={`saved-entry-${entry.id}`}
                    action={
                      <button
                        type="button"
                        aria-label={`Unsave ${row.name}`}
                        onClick={() => unsave(entry, index)}
                        data-testid={part(node, "unsave").path}
                        data-testid-key={node.key}
                        className="cg-state cg-focus grid size-10 place-items-center rounded-full border-0 bg-transparent text-on-surface-variant"
                      >
                        <Icon name="bookmark" size={22} />
                      </button>
                    }
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {moreFailed && (
        <div className="flex items-center gap-3 px-4 pt-3" role="alert">
          <span className="text-body-medium text-error" data-testid="saved-more-failed">
            {COULDNT_LOAD_MORE}
          </span>
          <Button testId="saved-more-retry" variant="text" size="sm" onClick={() => void loadMore()}>
            Retry
          </Button>
        </div>
      )}
      {loadingMore && (
        <p role="status" aria-live="polite" data-testid="saved-loading-more" className="px-4 pt-3">
          Loading…
        </p>
      )}
      <Snackbar
        testId="saved-snackbar"
        node={{ path: "saved.snackbar" }}
        message={snack?.message ?? null}
        action={snack?.action}
        token={snack?.token}
        onDismiss={dismiss}
      />
    </main>
  );
}
