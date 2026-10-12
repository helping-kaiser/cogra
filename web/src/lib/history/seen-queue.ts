// THE SESSION'S SEEN QUEUE — module memory the seen tracker writes into
// (`seen-tracker.ts` says what counts as seen and when it is sent). Kept apart
// from the hook, with no React, Apollo or session import, so the test setup
// can reset it without pulling the app's runtime graph in ahead of each test
// file's own mocks.

/**
 * The most ids one call carries — the page budget, pinned to
 * `client-constants.json` `paging.maxPageSize` in the test.
 */
export const SEEN_BATCH_MAX = 100;

/** Sends one batch; answers whether the server took it. */
export type SendSeen = (ids: readonly string[]) => Promise<boolean>;

/** An edge of a card taller than the viewport (History.md:13). */
export type CardEdge = "top" | "bottom";

/**
 * The session's seen queue: what has been reported, and what is still to
 * send. One per tab, keyed by the account it belongs to, so one account's
 * seeing never rides another's session.
 */
export class SeenQueue {
  private account: string | null = null;
  private reported = new Set<string>();
  private pending: string[] = [];
  // A tall card's one edge already on screen, until the other one arrives.
  private edges = new Map<string, CardEdge>();
  // Bumped whenever the queue changes hands, so a batch that was in flight
  // across the change cannot splice the new account's queue.
  private era = 0;
  private flushing: Promise<void> | null = null;

  /** Keys the queue to `account`; a different account starts empty. */
  belongTo(account: string | null): void {
    if (account === this.account) return;
    this.account = account;
    this.reported = new Set();
    this.pending = [];
    this.edges = new Map();
    this.era += 1;
  }

  /** The account the queue belongs to; null tracks nothing. */
  get owner(): string | null {
    return this.account;
  }

  /** Queues a first seeing; false when it was already reported or no one is signed in. */
  see(id: string): boolean {
    if (this.account === null || this.reported.has(id)) return false;
    this.reported.add(id);
    this.pending.push(id);
    return true;
  }

  /**
   * A card taller than the viewport had `edge` on screen. Its first edge is
   * remembered; the other one, in any later frame, queues the card as a first
   * seeing — "once both its top and its bottom edge have been on screen, not
   * necessarily at once" (History.md:13). The memory is the session's, kept
   * with the rest of the queue: a change of account forgets it whole.
   * Answers true when this edge queued the card.
   */
  seeEdge(id: string, edge: CardEdge): boolean {
    if (this.account === null || this.reported.has(id)) return false;
    const earlier = this.edges.get(id);
    if (earlier === undefined || earlier === edge) {
      this.edges.set(id, edge);
      return false;
    }
    this.edges.delete(id);
    return this.see(id);
  }

  /** Whether `id` has been reported this session. */
  hasSeen(id: string): boolean {
    return this.reported.has(id);
  }

  /** What is still to send, in seen order. */
  get queued(): readonly string[] {
    return this.pending;
  }

  /**
   * Sends the queue a page at a time, in seen order. A batch the server did
   * not take stays at the head of the queue for the next checkpoint. One
   * flush runs at a time; a checkpoint during one joins it.
   */
  flush(send: SendSeen): Promise<void> {
    if (this.flushing !== null) return this.flushing;
    this.flushing = (async () => {
      try {
        while (this.pending.length > 0) {
          const era = this.era;
          const batch = this.pending.slice(0, SEEN_BATCH_MAX);
          let taken = false;
          try {
            taken = await send(batch);
          } catch {
            taken = false;
          }
          if (era !== this.era || !taken) return;
          this.pending.splice(0, batch.length);
        }
      } finally {
        this.flushing = null;
      }
    })();
    return this.flushing;
  }
}

/** The tab's one queue. */
export let seenQueue = new SeenQueue();

/** A fresh queue — module state must not carry from one test to the next. */
export function resetSeenQueueForTests(): void {
  seenQueue = new SeenQueue();
}
