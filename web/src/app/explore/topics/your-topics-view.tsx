"use client";

// YOUR TOPICS — every topic the reader holds, in one place (YourTopics.md;
// design/designs/canonical/screens/YourTopics.jsx; api-spec.md
// `User.heldTopics`).
//
// HELD IS THE ONLY PREDICATE, AND THE SERVER STATES IT. A topic is on this page
// while the reader's netted Affinity toward it is not (0, 0); the read serves
// exactly that set, so the page draws every row it is served and filters
// nothing — a topic held against stands like any other, with no mark of its
// own, and a walk-back that lands takes its topic off the next read.
//
// STRONGEST FIRST, AS SERVED: association descending, past nothing into the
// topics held against. The order is the server's (keyset on `(pDirected,
// name)`); the client never re-sorts.
//
// EACH ROW IS `ReferenceRow` kind `topic` WITH AN AFFINITY'S PAIR: the `#` tile,
// the name, the face the pair reads as, its digits in geek mode, the settling
// mark while an act is in flight. NO PER-ROW REMOVAL — the row opens the
// topic's page, where the one control stands — and the word "follow" nowhere.
//
// A SUBPAGE OF EXPLORE WITH NO BOTTOM BAR (TagPage's arrangement; the shell
// draws none here). Two surfaces reach it — Explore's door and the feed
// filter's `All your topics` — so the arrow names its origin by the table:
// `Back to feed` from the feed, `Back to Explore` from Explore and from a cold
// entry, the state the board draws.
//
// UNREGISTERED: nodes.json carries no `YourTopics`; the screen wears its
// evident prefix, `yourTopics`, as the Android screen does.

import { useCallback, useEffect, useRef, useState } from "react";
import { useApolloClient } from "@apollo/client/react";

import { fetchHeldTopicsPage, type HeldTopic } from "@/lib/api/held-topics-api";
import { appendDeduped } from "@/lib/api/pagination";
import { topicHref, yourTopicsBack } from "@/lib/topics/your-topics";
import { useAuthGuard } from "@/lib/session/runtime";
import { Button } from "@/lib/ui/button";
import type { DataNode } from "@/lib/ui/data-node";
import { tailIndexOf, useApproachingTail } from "@/lib/ui/infinite-list";
import { PageHeader } from "@/lib/ui/page-header";
import { useScrollHost } from "@/lib/ui/scroll-host";
import { TransportError } from "@/lib/ui/transport-error";
import { ReferenceRow } from "@/lib/ui2/reference-row";

/** The page title (copy-voice, *The list is `Your topics`*). */
export const YOUR_TOPICS_TITLE = "Your topics";

/** The empty list (copy-voice, *The empty list*), verbatim. */
export const NO_TOPICS_YET = "No topics yet — say how you feel about one from its page.";

/** The load-more fault (design digest item 57). */
export const COULDNT_LOAD_MORE = "Couldn't load more";

const NODE: DataNode = { path: "yourTopics" };

type Row = HeldTopic & { readonly name: string };

/** A redacted name has nothing to draw or open (named as a design gap). */
function rowsOf(items: readonly HeldTopic[]): Row[] {
  return items.filter((item): item is Row => item.name !== null);
}

export function YourTopicsView({ from = null }: { from?: string | null }) {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const host = useScrollHost();

  const [rows, setRows] = useState<readonly Row[]>([]);
  const [endCursor, setEndCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  // Which first read is live: a Retry fires a new one, and an older one — or
  // a next page — resolving afterwards must not overwrite it.
  const request = useRef(0);

  const read = useCallback(() => {
    const mine = (request.current += 1);
    void guard.run(() => fetchHeldTopicsPage(client, null)).then((outcome) => {
      if (mine !== request.current) return;
      setLoading(false);
      if (outcome.kind !== "success") {
        setFailed(true);
        return;
      }
      setFailed(false);
      setMoreFailed(false);
      setRows(rowsOf(outcome.value.items));
      setEndCursor(outcome.value.endCursor);
      setHasNextPage(outcome.value.hasNextPage);
    });
  }, [client, guard]);

  useEffect(() => {
    read();
    return () => {
      request.current += 1;
    };
  }, [read]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasNextPage || endCursor === null) return;
    const mine = request.current;
    setLoadingMore(true);
    setMoreFailed(false);
    const outcome = await guard.run(() => fetchHeldTopicsPage(client, endCursor));
    setLoadingMore(false);
    if (mine !== request.current) return;
    if (outcome.kind !== "success") {
      // The rows on screen stay, and the fault ends the list.
      setMoreFailed(true);
      return;
    }
    setRows((current) => appendDeduped(current, rowsOf(outcome.value.items)));
    setEndCursor(outcome.value.endCursor);
    setHasNextPage(outcome.value.hasNextPage);
  }, [client, guard, loadingMore, hasNextPage, endCursor]);

  const tailRef = useApproachingTail({ root: host, onReach: loadMore, enabled: hasNextPage && !moreFailed });
  const tailIndex = tailIndexOf(rows.length);

  const back = yourTopicsBack(from);
  const empty = !loading && !failed && rows.length === 0 && !hasNextPage;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col">
      <PageHeader
        title={YOUR_TOPICS_TITLE}
        backHref={back.href}
        backLabel={back.label}
        backScroll={false}
        backTestId="your-topics-back"
        node={{ path: "yourTopics.header" }}
      />
      {loading && rows.length === 0 && (
        <p role="status" aria-live="polite" data-testid="your-topics-loading" className="px-6 pt-2">
          Loading…
        </p>
      )}
      {failed && rows.length === 0 && !loading && (
        <div className="flex items-center gap-3 px-6 pt-2">
          <TransportError testId="your-topics-transport-error" />
          <Button
            testId="your-topics-retry"
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
        // Words only — calm, and naming where the gesture lives (copy-voice).
        <p data-testid="yourTopics.empty" className="m-0 px-6 py-2 text-body-medium text-on-surface-variant">
          {NO_TOPICS_YET}
        </p>
      )}
      {rows.length > 0 && (
        // The list starts 4px under the header (YourTopics.jsx).
        <div className="flex flex-col pt-1" data-testid="your-topics-list">
          {rows.map((row, index) => (
            <div key={row.id} ref={index === tailIndex ? tailRef : undefined}>
              <ReferenceRow
                kind="topic"
                name={`#${row.name}`}
                pair={{ pDirected: row.pDirected, pInterest: row.pInterest }}
                pairFamily="stance"
                pending={row.pending}
                href={topicHref(row.name)}
                node={{ path: `${NODE.path}.row`, key: row.name }}
                testId={`your-topics-row-${row.name}`}
              />
            </div>
          ))}
        </div>
      )}
      {moreFailed && (
        <div className="flex items-center gap-3 px-6 pt-3" role="alert">
          <span className="text-body-medium text-error" data-testid="your-topics-more-failed">
            {COULDNT_LOAD_MORE}
          </span>
          <Button testId="your-topics-more-retry" variant="text" size="sm" onClick={() => void loadMore()}>
            Retry
          </Button>
        </div>
      )}
      {loadingMore && (
        <p role="status" aria-live="polite" data-testid="your-topics-loading-more" className="px-6 pt-3">
          Loading…
        </p>
      )}
    </main>
  );
}
