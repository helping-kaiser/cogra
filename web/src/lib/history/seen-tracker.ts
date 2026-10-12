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
// WHAT H1 DOES NOT COUNT, ON PURPOSE (the packet's excluded branches):
//
// - A CARD TALLER THAN THE VIEWPORT never reaches ratio 1, so it never fires
//   here. The ruled rule — "seen once both its top and its bottom edge have been
//   on screen, not necessarily at once" (History.md:13) — needs per-card edge
//   memory and lands with its own slice.
// - PAGE RENDERINGS — an opened post, a profile's or a topic's header
//   (History.md:11) — are not list cards and are not tracked here.
//
// WHEN IT IS SENT: batched, and flushed at the natural checkpoints
// (feed-ranking.md §9.4; architecture.md "Render"): the scroller coming to
// rest, the list leaving the screen (navigation), and the page being hidden.
// A refused or failed batch stays queued, in order, for the next checkpoint —
// seeing has no surface, so nothing is ever shown for it (the packet's
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
import { seenQueue, SeenQueue, type SendSeen } from "./seen-queue";

export { SEEN_BATCH_MAX, SeenQueue, type SendSeen } from "./seen-queue";

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
  queue = seenQueue,
}: {
  /** The scrolling element the list lives in; null means the viewport. */
  root: RefObject<HTMLElement | null> | null;
  /** The element holding the tracked cards. */
  list: RefObject<HTMLElement | null>;
  /** The ids the list renders, in order. */
  ids: readonly string[];
  /** Test injection. */
  queue?: SeenQueue;
}): void {
  const client = useApolloClient();
  const guard = useAuthGuard();
  const account = useActiveAccountId();

  // The send, current at every checkpoint without re-subscribing anything.
  const send = useRef<SendSeen>(async () => false);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);
  useMeasureEffect(() => {
    send.current = async (batch) =>
      (await guard.run(() => markSeen(client, batch))).kind === "success";
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
    if (account === null || holder === null) return;
    const observer = new IntersectionObserver(
      (entries) => {
        let queued = false;
        for (const entry of entries) {
          if (entry.intersectionRatio < 1) continue;
          const id = entry.target.getAttribute(SEEN_ATTRIBUTE);
          observer.unobserve(entry.target);
          if (id !== null && queue.see(id)) queued = true;
        }
        if (!queued) return;
        // A card can come wholly into view with no scroll at all — the first
        // page under a short header — so a seeing arms the rest timer too.
        if (idle.current !== null) clearTimeout(idle.current);
        idle.current = setTimeout(() => {
          idle.current = null;
          void queue.flush((batch) => send.current(batch));
        }, SCROLL_IDLE_MS);
      },
      { root: scrollElementOf(root), threshold: 1 },
    );
    for (const card of holder.querySelectorAll(`[${SEEN_ATTRIBUTE}]`)) {
      const id = card.getAttribute(SEEN_ATTRIBUTE);
      if (id !== null && !queue.hasSeen(id)) observer.observe(card);
    }
    return () => observer.disconnect();
  }, [root, list, ids, account, queue]);
}
