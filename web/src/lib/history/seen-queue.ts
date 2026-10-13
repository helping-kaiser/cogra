// THE SESSION'S SEEN QUEUE — module memory the seen tracker writes into
// (`seen-tracker.ts` says what counts as seen and when it is sent). Every first
// seeing it takes is also written through to the device's durable record
// (`seen-record.ts`), which the ranked feed's seen cut reads. Kept apart
// from the hook, with no React, Apollo or session import, so the test setup
// can reset it without pulling the app's runtime graph in ahead of each test
// file's own mocks.

import type { ErrorCode } from "@/__generated__/graphql";
import type { Outcome } from "@/lib/api/outcome";
import { seenRecord } from "./seen-record";

/** Where a first seeing is recorded on the device, besides the queue. */
export type RecordSeeing = (account: string, id: string) => void;

/**
 * Write-through to the device's durable record (`seen-record.ts`, PR-51): the
 * ranked feed's seen cut reads it, so a seeing counts there the moment it is
 * queued, not once the server has taken it. A write that fails costs the
 * durability of one id, never the session.
 */
const writeThrough: RecordSeeing = (account, id) => {
  void seenRecord.add(account, [id]).catch(() => undefined);
};

/**
 * The most ids one call carries — the page budget, pinned to
 * `client-constants.json` `paging.maxPageSize` in the test.
 */
export const SEEN_BATCH_MAX = 100;

/**
 * What a send came to: the server `taken` the batch; it could not be
 * delivered now and may be later (`retry`: transport, RATE_LIMITED,
 * UNAUTHENTICATED, any refusal not named below); or it `refused` the batch
 * for good, which no resending can change.
 */
export type SeenAnswer = "taken" | "retry" | "refused";

/** Sends one batch; answers what became of it. */
export type SendSeen = (ids: readonly string[]) => Promise<SeenAnswer>;

/**
 * The refusal codes that end a batch for good. An allow-list: a code not
 * named here (a future one included) is a retry, so an id is only ever
 * dropped for a code someone decided is permanent. `markSeen` answers
 * BAD_INPUT for a list the server will not take (api-spec.md `markSeen`).
 */
const PERMANENT_REFUSALS: ReadonlySet<ErrorCode> = new Set<ErrorCode>(["BAD_INPUT"]);

/** Reads an API outcome as a {@link SeenAnswer}. */
export function seenAnswerOf(outcome: Outcome<unknown>): SeenAnswer {
  if (outcome.kind === "success") return "taken";
  if (outcome.kind === "refused" && outcome.errors.some((e) => PERMANENT_REFUSALS.has(e.code))) {
    return "refused";
  }
  return "retry";
}

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
  // The most ids the next batch carries: a page, until the server refuses a
  // batch for good and the queue halves it to find the id that is the cause.
  private batchLimit = SEEN_BATCH_MAX;
  // Ids the server refused alone, for good. They stay in `reported`, so
  // nothing queues them again this session.
  private gone: string[] = [];

  constructor(private readonly record: RecordSeeing = writeThrough) {}

  /** Keys the queue to `account`; a different account starts empty. */
  belongTo(account: string | null): void {
    if (account === this.account) return;
    this.account = account;
    this.reported = new Set();
    this.pending = [];
    this.edges = new Map();
    this.batchLimit = SEEN_BATCH_MAX;
    this.gone = [];
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
    this.record(this.account, id);
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

  /** Ids given up on this session: refused alone, for good. */
  get dropped(): readonly string[] {
    return this.gone;
  }

  /**
   * Sends the queue a page at a time, in seen order. A batch that could not
   * be delivered now (`retry`: offline, rate-limited, any refusal not known
   * to be final) stays at the head of the queue for the next checkpoint,
   * however often that comes. A batch the server refused for good is halved
   * and the head sent again, down to the one id that is the cause: that id
   * alone is dropped, so a single bad id costs its batch-mates nothing and
   * the queue never stalls on it. The halving survives a retry in between.
   * One flush runs at a time; a checkpoint during one joins it.
   */
  flush(send: SendSeen): Promise<void> {
    if (this.flushing !== null) return this.flushing;
    this.flushing = (async () => {
      try {
        while (this.pending.length > 0) {
          const era = this.era;
          const batch = this.pending.slice(0, this.batchLimit);
          let answer: SeenAnswer;
          try {
            answer = await send(batch);
          } catch {
            answer = "retry";
          }
          if (era !== this.era || answer === "retry") return;
          if (answer === "refused" && batch.length > 1) {
            this.batchLimit = Math.ceil(batch.length / 2);
            continue;
          }
          this.pending.splice(0, batch.length);
          if (this.pending.length === 0) this.batchLimit = SEEN_BATCH_MAX;
          if (answer === "refused") {
            this.batchLimit = SEEN_BATCH_MAX;
            this.gone.push(...batch);
            console.warn(
              `seen tracker: the server refused ${batch.join(", ")} for good; dropped, not retried`,
            );
          }
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
