"use client";

// THE SEEN TRACKER — how a thing joins History without the reader acting for
// it ("WHEN a content is fully in the viewport for the first time -> it joins
// History AND NEVER the reader has to act for it", HistoryEmpty.md:9).
//
// WHAT COUNTS AS SEEN (History.md:5-17; H1 of tmp_dev packet
// `history-surface.md`):
//
// - A LIST CARD, ONCE IT IS WHOLLY INSIDE THE SCROLLER'S BOX. The observer asks
//   for threshold 1 — "fully visible" in the Intersection Observer API's own
//   terms (MDN, "Intersection Observer API", Thresholds) — and the gate reads
//   the ratio, not `isIntersecting`, which a sliver already satisfies.
// - TOP LAYER ONLY. The card reports its own node and nothing inside it: never
//   its author, its tags or its citations (History.md:7), and a comment thread
//   raised over the list adds no one (History.md:9).
// - FIRST SEEING ONLY. An id is queued once per account per session; the server
//   holds the same law by construction (re-seeing writes nothing), so this is
//   traffic economy, not correctness.
//
// - A CARD TALLER THAN THE VIEWPORT, ONCE BOTH ITS EDGES HAVE BEEN ON SCREEN,
//   not necessarily at once (History.md:13). Such a card never reaches ratio 1,
//   so a second pass reads its edges: an observer at threshold 0 says which
//   cards stand in the scroller at all, and for those the card's bounding rect
//   is read against the root's box — at every observation and every scroll,
//   because an observer only speaks at a threshold crossing and an edge can
//   pass through the screen between two of them (MDN, "Intersection Observer
//   API": thresholds; `getBoundingClientRect` for the geometry itself). An
//   edge is on screen when its own pixel row is inside the box; the queue
//   remembers the first edge for the session and queues the card when the
//   other arrives (`SeenQueue.seeEdge`). A card that fits is the whole-card
//   rule's alone: its edges are never recorded, so two halves seen apart never
//   add up to a seeing.
// - AN OPENED PROFILE (History.md:11): a page event, not geometry —
//   `useSeenOnOpen` reports the profile the moment the page shows it; its
//   posts join only through the list rule, never through the opening.
//
// WHAT IS NOT COUNTED HERE: an opened post's detail and a topic's header
// carry no ruled seeing of their own and are not tracked.
//
// WHEN IT IS SENT: batched, and flushed at the natural checkpoints
// (feed-ranking.md §9.4; architecture.md "Render"): the scroller coming to
// rest, the list leaving the screen (navigation), and the page being hidden.
// A batch that could not be delivered — offline, RATE_LIMITED, any refusal not
// known to be final — stays queued, in order, for the next checkpoint. A batch
// the server refuses for good (BAD_INPUT) is halved and sent again down to the
// one id at fault, which alone is dropped for the session and logged
// (`SeenQueue.flush`): a session never stalls on a batch that cannot succeed.
// Seeing has no surface, so nothing is ever shown for either (the packet's
// rate-limiter row). With no session there is no seen-list, so nothing is
// tracked at all (packet F6).
//
// WHY LAYOUT EFFECTS (web law L14): every listener here writes MODULE memory
// — the one queue the whole session shares — from scroller and observer
// callbacks. A passive effect subscribes after paint, so a scroll or an
// observation in that gap writes into a queue that the previous mount already
// tore down or the next one has not keyed yet. `useMeasureEffect` subscribes
// before the paint, closing the gap.

import { useRef, type RefObject } from "react";
import { useApolloClient } from "@apollo/client/react";

import { markSeen } from "@/lib/api/history-api";
import { useActiveAccountId } from "@/lib/session/provider";
import { useAuthGuard } from "@/lib/session/runtime";
import { useMeasureEffect } from "@/lib/ui/measure-effect";
import { scrollElementOf } from "@/lib/ui/scroll-host";
import {
  seenAnswerOf,
  seenQueue,
  SeenQueue,
  type CardEdge,
  type SendSeen,
} from "./seen-queue";

export {
  SEEN_BATCH_MAX,
  SeenQueue,
  type CardEdge,
  type SeenAnswer,
  type SendSeen,
} from "./seen-queue";

/** How long the scroller must rest before the queue is sent. */
export const SCROLL_IDLE_MS = 600;

/** The attribute a list item carries to be tracked: its own node id. */
export const SEEN_ATTRIBUTE = "data-seen-id";

/**
 * Track a list's cards: every descendant of `list` carrying
 * {@link SEEN_ATTRIBUTE} is reported the first time it stands wholly inside
 * the scroller. `ids` is what the list renders — a new list re-reads the
 * cards.
 */
export function useSeenTracker({
  root,
  list,
  ids,
  suspended = false,
  queue = seenQueue,
}: {
  /** The scrolling element the list lives in; null means the viewport. */
  root: RefObject<HTMLElement | null> | null;
  /** The element holding the tracked cards. */
  list: RefObject<HTMLElement | null>;
  /** The ids the list renders, in order. */
  ids: readonly string[];
  /**
   * True while a sheet covers the list: a card under it is not on screen, so
   * nothing is reported until it drops — and the fresh observer it drops to
   * re-reads every card that stood whole all along.
   */
  suspended?: boolean;
  /** Test injection. */
  queue?: SeenQueue;
}): void {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const account = useActiveAccountId();

  // The send, current at every checkpoint without re-subscribing anything.
  const send = useRef<SendSeen>(async () => "retry");
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);
  useMeasureEffect(() => {
    send.current = async (batch) => seenAnswerOf(await guard.run(() => markSeen(client, batch)));
  }, [client, guard]);

  // Whose queue it is — before anything below can write to it.
  useMeasureEffect(() => {
    queue.belongTo(account);
  }, [queue, account]);

  // The checkpoints: rest, the page hidden, and the list leaving.
  useMeasureEffect(() => {
    if (account === null) return;
    const flush = () => {
      if (idle.current !== null) clearTimeout(idle.current);
      idle.current = null;
      void queue.flush((batch) => send.current(batch));
    };
    const rearm = () => {
      if (queue.queued.length === 0) return;
      if (idle.current !== null) clearTimeout(idle.current);
      idle.current = setTimeout(flush, SCROLL_IDLE_MS);
    };
    const scroller: HTMLElement | Window = scrollElementOf(root) ?? window;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    scroller.addEventListener("scroll", rearm, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      scroller.removeEventListener("scroll", rearm);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [root, account, queue]);

  // The cards themselves.
  useMeasureEffect(() => {
    const holder = list.current;
    if (account === null || holder === null || suspended) return;
    const observer = new IntersectionObserver(
      (entries) => {
        let queued = false;
        for (const entry of entries) {
          if (entry.intersectionRatio < 1) continue;
          const id = entry.target.getAttribute(SEEN_ATTRIBUTE);
          observer.unobserve(entry.target);
          if (id !== null && queue.see(id)) queued = true;
        }
        if (queued) restThenFlush(idle, queue, send);
      },
      { root: scrollElementOf(root), threshold: 1 },
    );
    for (const card of holder.querySelectorAll(`[${SEEN_ATTRIBUTE}]`)) {
      const id = card.getAttribute(SEEN_ATTRIBUTE);
      if (id !== null && !queue.hasSeen(id)) observer.observe(card);
    }
    return () => observer.disconnect();
  }, [root, list, ids, account, queue, suspended]);

  // The tall cards' edges (History.md:13): which cards stand in the scroller
  // at all, and for those, which of their edges is on screen right now.
  useMeasureEffect(() => {
    const holder = list.current;
    if (account === null || holder === null || suspended) return;
    const scroller = scrollElementOf(root);
    const inView = new Set<Element>();
    const read = () => {
      if (inView.size === 0) return;
      const box = viewBoxOf(scroller);
      let queued = false;
      for (const card of inView) {
        const id = card.getAttribute(SEEN_ATTRIBUTE);
        if (id === null) continue;
        for (const edge of edgesOnScreen(card.getBoundingClientRect(), box)) {
          if (queue.seeEdge(id, edge)) queued = true;
        }
        if (queue.hasSeen(id)) {
          inView.delete(card);
          observer.unobserve(card);
        }
      }
      if (queued) restThenFlush(idle, queue, send);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) inView.add(entry.target);
          else inView.delete(entry.target);
        }
        read();
      },
      { root: scroller, threshold: 0 },
    );
    for (const card of holder.querySelectorAll(`[${SEEN_ATTRIBUTE}]`)) {
      const id = card.getAttribute(SEEN_ATTRIBUTE);
      if (id !== null && !queue.hasSeen(id)) observer.observe(card);
    }
    const target: HTMLElement | Window = scroller ?? window;
    target.addEventListener("scroll", read, { passive: true });
    window.addEventListener("resize", read);
    return () => {
      observer.disconnect();
      target.removeEventListener("scroll", read);
      window.removeEventListener("resize", read);
    };
  }, [root, list, ids, account, queue, suspended]);
}

/**
 * A card can join with no scroll at all — the first page under a short
 * header — so a seeing arms the rest timer itself.
 */
function restThenFlush(
  idle: RefObject<ReturnType<typeof setTimeout> | null>,
  queue: SeenQueue,
  send: RefObject<SendSeen>,
): void {
  if (idle.current !== null) clearTimeout(idle.current);
  idle.current = setTimeout(() => {
    idle.current = null;
    void queue.flush((batch) => send.current(batch));
  }, SCROLL_IDLE_MS);
}

/** A vertical span in viewport coordinates. */
export type Span = { readonly top: number; readonly bottom: number };

/**
 * The box the observer measures against, in viewport coordinates: the
 * scroller's padding area — the root intersection rectangle of an element
 * with a content clip (W3C Intersection Observer, "root intersection
 * rectangle") — or the window's height when the window scrolls, the same
 * reading `viewportHeightOf` gives a screenful.
 */
function viewBoxOf(scroller: HTMLElement | null): Span {
  if (scroller === null) return { top: 0, bottom: window.innerHeight };
  const top = scroller.getBoundingClientRect().top + scroller.clientTop;
  return { top, bottom: top + scroller.clientHeight };
}

/**
 * The edges of `card` on screen in `view`, for a card TALLER than the view
 * only — a card that fits is seen whole or not at all (History.md:5), so it
 * has no edges to record. An edge is on screen when its own pixel row lies
 * inside the view: the top row starts at `top`, the bottom row ends at
 * `bottom`.
 */
export function edgesOnScreen(card: Span, view: Span): CardEdge[] {
  if (card.bottom - card.top <= view.bottom - view.top) return [];
  const edges: CardEdge[] = [];
  if (card.top >= view.top && card.top < view.bottom) edges.push("top");
  if (card.bottom > view.top && card.bottom <= view.bottom) edges.push("bottom");
  return edges;
}

/**
 * A page's own thing joins History the moment the page shows it — today, an
 * opened profile ("WHEN a profile opens -> the profile joins History",
 * History.md:11). `id` is null until the page knows what it shows, and stays
 * null for a page that must not report (the reader's own profile). The
 * opening is itself the checkpoint: no list may be mounted to flush later,
 * so the queue is sent at once. No session, no seeing.
 */
export function useSeenOnOpen(id: string | null, queue: SeenQueue = seenQueue): void {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const account = useActiveAccountId();
  useMeasureEffect(() => {
    queue.belongTo(account);
    if (id === null || !queue.see(id)) return;
    void queue.flush(async (batch) =>
      seenAnswerOf(await guard.run(() => markSeen(client, batch))),
    );
  }, [id, account, queue, client, guard]);
}
