"use client";

// NOTIFICATIONS — the second surfacing channel, reached from the bell on a
// root band (Notifications.md, NotificationsEmpty.md;
// design/designs/canonical/screens/Notifications.jsx).
//
// ONE FLAT LIST, NEWEST FIRST, NO GROUPING: every row is one actor doing one
// thing at one moment, written as a sentence over ContentRow's chronicle
// variant. There is no mark-all control and no pull — freshness comes from
// opening the list again.
//
// READ STATE IS TWO LEVELS. Opening the list clears the bell's dot at once
// and moves the server's seen pointer to the newest row this read holds, so a
// row that arrives after the read still lights the bell at the next root
// load. Every row not yet opened keeps its own dot until it is tapped. Both
// marks go silently through the marks queue (`marks.ts`): seeing has no
// surface, and a mark that does not go through is sent again, never shown.
//
// A HIDDEN ACCOUNT'S ROWS LEAVE AT ONCE (PR-11). The server drops them from
// every read, and the rows this list holds are laid under the reader's own
// hidden set (`useHiddenSet`, the one store the feed filters by) — so a hide
// made anywhere takes that person's rows out the moment it is made, and an
// unhide brings them back in place.

import { useCallback, useEffect, useRef, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import { fetchNotificationsPage, type Notification } from "@/lib/api/notifications-api";
import { useHiddenSet } from "@/lib/hidden/provider";
import { appendDeduped } from "@/lib/api/pagination";
import { clearBell } from "@/lib/notifications/bell";
import { flushMarks, markRead, markSeenThrough } from "@/lib/notifications/marks";
import { notificationsOrigin } from "@/lib/notifications/origin";
import { NOTIFICATIONS_EMPTY, notificationRow, ROOTS } from "@/lib/notifications/row-content";
import { useAuthGuard } from "@/lib/session/runtime";
import { Button } from "@/lib/ui/button";
import { CollapsingTop } from "@/lib/ui/collapsing-top";
import { instance, part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { EmptyState } from "@/lib/ui/empty-state";
import { tailIndexOf, useApproachingTail } from "@/lib/ui/infinite-list";
import { PageHeader } from "@/lib/ui/page-header";
import { useScrollHost } from "@/lib/ui/scroll-host";
import { ladderAge } from "@/lib/ui/timestamp";
import { TransportError } from "@/lib/ui/transport-error";
import { ContentRow } from "@/lib/ui2/content-row";
import { InlineAction } from "@/lib/ui2/inline-action";

/** The chronicle's load-more fault (design digest item 57; copy-voice). */
export const COULDNT_LOAD_MORE = "Couldn't load more";
/** The first read with no answer: the house line's noun form (copy-voice *Faults by code*, round 25). */
export const NOTIFICATIONS_FAULT = "Can't reach the server — notifications can't load right now.";

const LIST: DataNode = { path: "notifications.list" };

export function NotificationsScreen({ from }: { from: string | null }) {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const host = useScrollHost();
  const hidden = useHiddenSet();
  const root = ROOTS[notificationsOrigin(from)];

  const [rows, setRows] = useState<readonly Notification[]>([]);
  const [endCursor, setEndCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  // The rows opened on this visit: their dots go at the tap, before the
  // server's mark comes back.
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set());
  const request = useRef(0);

  // OPENING CLEARS THE BELL (Notifications.md:29; NotificationsEmpty.md:7),
  // locally and at once; and whatever an earlier visit still owes is sent.
  useEffect(() => {
    clearBell();
    void flushMarks(client, guard);
  }, [client, guard]);

  const read = useCallback(() => {
    const asked = (request.current += 1);
    void (async () => {
      const outcome = await guard.run(() => fetchNotificationsPage(client, null));
      if (asked !== request.current) return;
      setLoading(false);
      if (outcome.kind !== "success") {
        setFailed(true);
        return;
      }
      setFailed(false);
      setMoreFailed(false);
      setRows(outcome.value.items);
      setEndCursor(outcome.value.endCursor);
      setHasNextPage(outcome.value.hasNextPage);
      // Everything this read holds is seen; an empty list sends nothing.
      const newest = outcome.value.items[0];
      if (newest !== undefined) void markSeenThrough(client, guard, newest.createdAt);
    })();
  }, [client, guard]);

  useEffect(() => {
    read();
    return () => {
      request.current += 1;
    };
  }, [read]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasNextPage || endCursor === null) return;
    setLoadingMore(true);
    setMoreFailed(false);
    const outcome = await guard.run(() => fetchNotificationsPage(client, endCursor));
    setLoadingMore(false);
    if (outcome.kind !== "success") {
      // THE ROWS ON SCREEN STAY, and the fault ends the list.
      setMoreFailed(true);
      return;
    }
    setRows((current) => appendDeduped(current, outcome.value.items));
    setEndCursor(outcome.value.endCursor);
    setHasNextPage(outcome.value.hasNextPage);
  }, [client, guard, loadingMore, hasNextPage, endCursor]);

  const visible = rows.filter((row) => !hidden.has(row.actor.id));

  // The watch is rebuilt only when `loadMore` changes — a page landed, a fresh
  // cursor — never on a render that changed nothing (`infinite-list.ts`).
  const tailRef = useApproachingTail({
    root: host,
    onReach: loadMore,
    enabled: hasNextPage && !moreFailed,
  });
  const tailIndex = tailIndexOf(visible.length);

  const open = (row: Notification) => {
    setOpened((current) => new Set(current).add(row.id));
    if (row.readAt === null) void markRead(client, guard, row.id);
  };

  const empty = !loading && !failed && visible.length === 0 && !hasNextPage;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col">
      <CollapsingTop flush>
        <PageHeader
          title="Notifications"
          backHref={root.href}
          backLabel={root.backLabel}
          backScroll={false}
          backTestId="notifications-back"
          node={{ path: "notifications.header" }}
        />
      </CollapsingTop>
      {empty && (
        // NOTIFICATIONSEMPTY: the kinds named in words — no action button,
        // no error colour; the list fills when somebody else acts. The shared
        // EmptyState master carries the line (`notifications.empty`).
        <div className="px-6 pt-2">
          <EmptyState
            title={NOTIFICATIONS_EMPTY}
            testId="notifications.empty"
            node={{ path: "notifications.empty" }}
          />
        </div>
      )}
      {!empty && (
        // THE LIST (`ChronicleList`: 8px 16px 0, the rows 8 apart) holds the
        // read's other moments in its own place — the `load` chip (round 24).
        <div {...testAttributes(LIST)} className="flex flex-col gap-2 px-4 pt-2">
          {/* Notifications.md:57 — the first read in flight: `Loading…` in the
              list's place, no skeleton and no spinner. */}
          {loading && rows.length === 0 && (
            <div {...testAttributes(part(LIST, "loading"))}>
              <p role="status" aria-live="polite" className="m-0 text-body-medium text-on-surface-variant">
                Loading…
              </p>
            </div>
          )}
          {/* Notifications.md:59 — the first read with no answer: the house
              line's noun form over an outlined Retry, never the error dialog. */}
          {failed && rows.length === 0 && !loading && (
            <div className="flex flex-col items-start gap-3 p-2" {...testAttributes(part(LIST, "fault"))}>
              <TransportError testId="notifications-transport-error" message={NOTIFICATIONS_FAULT} />
              <Button
                testId="notifications-retry"
                variant="outline"
                size="sm"
                node={part(part(LIST, "fault"), "retry")}
                onClick={() => {
                  // Notifications.md:61 — Loading… stands until the list arrives.
                  setFailed(false);
                  setLoading(true);
                  read();
                }}
              >
                Retry
              </Button>
            </div>
          )}
          {visible.length > 0 && (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {visible.map((row, index) => {
                const content = notificationRow(row);
                // Keyed by place in the list, newest first (the board's key rule).
                const node = instance(LIST, "notification", String(index + 1));
                return (
                  <li key={row.id} ref={index === tailIndex ? tailRef : undefined} data-notification-id={row.id}>
                    <ContentRow
                      variant="chronicle"
                      title={content.title}
                      sentence={content.deleted}
                      second={content.second}
                      trailing={ladderAge(row.createdAt)}
                      disc={content.disc}
                      unread={row.readAt === null && !opened.has(row.id)}
                      href={content.href ?? undefined}
                      onOpen={() => open(row)}
                      node={node}
                      testId={`notification-${row.id}`}
                    />
                  </li>
                );
              })}
            </ul>
          )}
          {/* Notifications.md:63 — the next page that did not come while rows
              stand: `Couldn't load more — Retry` ending the list in its quiet
              register (`ProfileMoreFailed`'s row), never the error colour. */}
          {moreFailed && (
            <p
              role="alert"
              className="m-0 px-1 pb-4 pt-2 text-body-medium text-on-surface-variant"
              {...testAttributes(part(LIST, "moreFault"))}
            >
              {COULDNT_LOAD_MORE} <span aria-hidden="true">—</span>{" "}
              <InlineAction size="sm" onClick={() => void loadMore()} node={part(part(LIST, "moreFault"), "retry")}>
                Retry
              </InlineAction>
            </p>
          )}
          {loadingMore && (
            <p role="status" aria-live="polite" data-testid="notifications-loading-more" className="m-0 pt-1 text-body-medium text-on-surface-variant">
              Loading…
            </p>
          )}
        </div>
      )}
    </main>
  );
}
