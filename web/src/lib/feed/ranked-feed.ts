// THE RANKED FEED'S HELD STATE (ranked-feed packet §4.12, CD-1..CD-11): one
// held `feedRanking` answer, the filter applied to it, the list derived from
// both, and the rows already hydrated.
//
// WHEN THE SERVER IS ASKED (CD-1). One ranking per feed-open, per explicit
// refresh, and per Done that changed the ranker's arguments (`kinds`,
// `topic`). Everything else — order, people and sign, seen, Still settling —
// is a LOCAL RE-DERIVE from the answer already held: no ranking call, no new
// pin, the same off-feed lookup source. The windows a derived list needs are
// hydrated through `feed`, a read that ranks nothing, and a row hydrated once
// is not asked for again while its answer is held.
//
// WHAT IS NEVER DONE HERE: scoring, comparing or sorting (PR-9/PR-10, CD-7).
// The derive places by the pod's indices and cuts; this file only decides when
// to derive and what to hydrate.
//
// Framework-free on purpose: the feed screen holds one of these across
// navigations (`feed-memory.ts`) and hands it the reads it needs per call, so
// nothing here outlives the client it was built with.

import { failed, success, type Outcome } from "@/lib/api/outcome";
import type { NodeKind } from "@/__generated__/graphql";
import type { FeedItemView } from "@/lib/api/feed-api";
import {
  derive,
  NOTHING_DERIVED,
  type DerivedFeed,
  type FeedRow,
  type HeldAnswer,
  type HeldEntry,
  type SeenLookup,
} from "./derive";
import {
  deviceCutsOf,
  doneEffectOf,
  FEED_FILTER_DEFAULT,
  rankArgumentsOf,
  type DoneEffect,
  type FeedFilterValue,
  type RankArguments,
} from "./feed-filter";
import { admitsItem } from "./feed-predicates";

/**
 * How many rows one hydration window carries: the listing's own page, well
 * inside `feed`'s cap of 100 ids (CD-2) and priced like the listing it
 * replaces.
 */
export const FEED_WINDOW = 20;

/** The reads a feed needs, handed in per call. */
export type FeedIo = {
  /**
   * Whose view to rank: the borrowed vantage, else the reader's own actor
   * (CD-5); null when there is neither.
   */
  resolveViewer(): Promise<Outcome<string | null>>;
  rank(viewer: string, args: RankArguments): Promise<Outcome<HeldAnswer | null>>;
  /** Hydrates `ids`, `kinds` naming each one's kind as the ranking did. */
  hydrate(ids: readonly string[], kinds: readonly NodeKind[]): Promise<Outcome<readonly FeedItemView[]>>;
  /** The READER's seen record, loaded, as it stands now (CD-10). */
  seen(): Promise<SeenLookup>;
  /**
   * Whether the asker still wants the answer. A ranking that lands after its
   * screen left is not adopted, so the held answer never runs ahead of the
   * pages remembered beside it. Absent means always.
   */
  wanted?(): boolean;
  /**
   * Whether the reader has hidden this post's author (hidden-actors packet
   * §4.4): a post-rank view filter the screen applies at render, so a window
   * still carries the hidden rows — Undo puts them back where they stood —
   * but only a visible row ends the fill. Absent hides nobody.
   */
  hides?(item: FeedItemView): boolean;
  /**
   * A hydrated row as the client knows it NOW — a removal taken since it was
   * hydrated reached the cache, not this feed's rows (`withCachedRemoval`) —
   * so the Removed cut reads the mark at every derive. Absent reads the row
   * as hydrated.
   */
  current?(item: FeedItemView): FeedItemView;
};

/** A hydrated stretch of the derived list. */
export type FeedWindow = {
  readonly items: readonly FeedItemView[];
  /** Where the next window starts in the derived list. */
  readonly next: number;
  readonly hasMore: boolean;
  /**
   * The ids under `feed.seenSeparator` in the list this window was cut from
   * (FeedSeenTail.md): they stand after every unseen row, and reading them
   * records nothing.
   */
  readonly seenTail: ReadonlySet<string>;
};

/** What every kind switched off answers, without asking (FeedNothing.md:3-5). */
const NOTHING_RANKED: HeldAnswer = { asOfEpoch: 0, entries: [], settling: [] };

/** The kinds a feed card is drawn for (FeedKinds.md). */
function isCard(item: FeedItemView | null | undefined): item is FeedItemView {
  return (
    item?.__typename === "Post" ||
    item?.__typename === "Comment" ||
    item?.__typename === "User" ||
    item?.__typename === "Hashtag"
  );
}

export class RankedFeed {
  private applied: FeedFilterValue;
  private held: HeldAnswer | null = null;
  private split: DerivedFeed = NOTHING_DERIVED;
  // Head then tail: the one list hydration windows over.
  private rows: readonly FeedRow[] = [];
  private tailIds: ReadonlySet<string> = new Set();
  // Null: asked for, and the server could not hydrate it (skipped, §4.4).
  private hydrated = new Map<string, FeedItemView | null>();

  constructor(
    /** The signed-in reader whose seen record cuts this feed; null signed out. */
    readonly reader: string | null,
    filter: FeedFilterValue = FEED_FILTER_DEFAULT,
  ) {
    this.applied = filter;
  }

  /** The filter the derived list was made under. */
  get filter(): FeedFilterValue {
    return this.applied;
  }

  /** The held answer, uncut — null before the first ranking or for no viewer. */
  get answer(): HeldAnswer | null {
    return this.held;
  }

  /** The derived list, as of the last derive: above the seen line, then under it. */
  get derived(): DerivedFeed {
    return this.split;
  }

  /** The ids under `feed.seenSeparator`, as of the last derive. */
  get seenTail(): ReadonlySet<string> {
    return this.tailIds;
  }

  private adopt(split: DerivedFeed): void {
    this.split = split;
    this.rows = [...split.head, ...split.tail];
    this.tailIds = new Set(split.tail.map((row) => row.targetId));
  }

  /**
   * The off-feed lookup (CD-9, PR-40 1a): an entry of the UNCUT held answer,
   * so a thing cut as seen or out of the reader's people still hits. A
   * settling thing is never looked up — it has no figure.
   */
  lookup(targetId: string): HeldEntry | undefined {
    return this.held?.entries.find((entry) => entry.targetId === targetId);
  }

  /**
   * One ranking under the applied filter, then the derive. A fault leaves
   * the held answer, its derived list and its hydrated rows exactly as they
   * were (a failed refresh keeps the held snapshot).
   */
  async refresh(io: FeedIo): Promise<Outcome<void>> {
    const args = rankArgumentsOf(this.applied);
    let answer: HeldAnswer | null;
    if (args.kinds.length === 0) {
      answer = NOTHING_RANKED;
    } else {
      const viewer = await io.resolveViewer();
      if (viewer.kind !== "success") return viewer;
      if (viewer.value === null) {
        answer = null;
      } else {
        const ranked = await io.rank(viewer.value, args);
        if (ranked.kind !== "success") return ranked;
        answer = ranked.value;
      }
    }
    const seen = await io.seen();
    if (io.wanted?.() === false) return failed(new Error("the ranking landed after its screen left"));
    this.held = answer;
    this.hydrated = new Map();
    this.adopt(answer === null ? NOTHING_DERIVED : derive(answer, deviceCutsOf(this.applied), seen));
    return success(undefined);
  }

  /** The derive again, from the held answer and the record as it stands now. */
  private async rederive(io: FeedIo): Promise<void> {
    const seen = await io.seen();
    this.adopt(this.held === null ? NOTHING_DERIVED : derive(this.held, deviceCutsOf(this.applied), seen));
  }

  /**
   * A Done with `staged` (CD-1). A ranking Done that fails keeps the filter
   * it was applied over, so the trigger never speaks a filter the list on
   * screen was not made under.
   */
  async done(staged: FeedFilterValue, io: FeedIo): Promise<Outcome<DoneEffect>> {
    const effect = doneEffectOf(this.applied, staged);
    if (effect === "nothing") return success(effect);
    const before = this.applied;
    this.applied = staged;
    if (effect === "rederive") {
      await this.rederive(io);
      return success(effect);
    }
    const ranked = await this.refresh(io);
    if (ranked.kind !== "success") {
      this.applied = before;
      return ranked;
    }
    return success(effect);
  }

  /**
   * Hydrates the derived list from `from` on, a window at a time, until a
   * window carries a row a card draws, the filter admits and the reader has
   * not hidden, or the list ends — the shared fill rule (§5.1; hidden-actors
   * §4.4 "over-fetch to fill"). Rows already hydrated for this answer are not
   * asked again.
   *
   * THE POST-RANK PREDICATES CUT HERE (CD-4): forms, Sensitive and Removed
   * read the hydrated row, so they are the derive's last step — a row they
   * cut is never handed to the screen, and a Done or a refresh is what
   * re-applies them. A hidden row is handed over (Undo puts it back where it
   * stood) but never ends the fill.
   */
  async window(from: number, io: FeedIo): Promise<Outcome<FeedWindow>> {
    let at = Math.max(0, from);
    const items: FeedItemView[] = [];
    const visible = (item: FeedItemView) => io.hides?.(item) !== true;
    while (at < this.rows.length && !items.some(visible)) {
      const rows = this.rows.slice(at, at + FEED_WINDOW);
      const ids = rows.map((row) => row.targetId);
      const missingRows = rows.filter((row) => !this.hydrated.has(row.targetId));
      const missing = missingRows.map((row) => row.targetId);
      if (missing.length > 0) {
        const fetched = await io.hydrate(missing, missingRows.map((row) => row.kind));
        if (fetched.kind !== "success") return fetched;
        const answered = new Map(fetched.value.map((item) => [item.id, item]));
        for (const id of missing) this.hydrated.set(id, answered.get(id) ?? null);
      }
      for (const id of ids) {
        const hydrated = this.hydrated.get(id);
        if (!isCard(hydrated)) continue;
        const item = io.current?.(hydrated) ?? hydrated;
        if (admitsItem(this.applied, item)) items.push(item);
      }
      at += ids.length;
    }
    return success({ items, next: at, hasMore: at < this.rows.length, seenTail: this.tailIds });
  }
}
