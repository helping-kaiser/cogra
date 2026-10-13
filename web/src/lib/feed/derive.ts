// THE DEVICE DERIVE (ranked-feed packet §4.12; PR-49): what the device does
// with one held `feedRanking` answer. The pod ranks, weaves and orders; the
// device PLACES by the pod's indices and CUTS by what it holds. It never
// scores, never compares a key and never sorts (CD-7: "the device applies the
// pod's permutations, never its own comparisons") — the PR-9/PR-10 line that
// keeps every piece of ranking math in the ranker.
//
// In order (§4.12):
// 1. COMPOSE both woven lists from the answer. RANKED: each settling row at
//    its `rankedPosition`, `entries` filling the remaining slots in array
//    order. NEWEST: each settling row at its `newestPosition`, `entries`
//    filling the remaining slots in `newestIndex` order.
// 2. PICK the list for the sheet's order.
// 3. CUT — delete rows, never re-order them: Still settling off (W-1, CD-8),
//    Show what you've already seen off (the device's record as it stands NOW,
//    CD-10), Your people (by the pod's `mark`, CD-11). Deleting commutes with
//    the weave and with each other (FP-1's argument, §4.10 W-2), which the
//    property test pins.
// 4. Hydration (CD-2) is the caller's; it windows the list this returns.
//
// The held answer itself is never cut: it stays the off-feed lookup source
// (CD-9), so nothing here mutates it.

import type { NodeKind, PeopleMark } from "@/__generated__/graphql";

export type { PeopleMark };

/** One landed target, as the answer carries it (`FeedEntry`). */
export type HeldEntry = {
  readonly targetId: string;
  readonly kind: NodeKind;
  readonly score: number;
  readonly mark: PeopleMark | null;
  readonly newestIndex: number;
};

/** One settling row, as the answer carries it (`SettlingEntry`). */
export type HeldSettling = {
  readonly targetId: string;
  readonly kind: NodeKind;
  readonly mark: PeopleMark | null;
  readonly rankedPosition: number;
  readonly newestPosition: number;
};

/** One `feedRanking` answer, held whole: the snapshot and the lookup source. */
export type HeldAnswer = {
  readonly asOfEpoch: number;
  readonly entries: readonly HeldEntry[];
  readonly settling: readonly HeldSettling[];
};

/** A row of a composed list. A settling row has no score (FeedSheet.md:49). */
export type FeedRow = {
  readonly targetId: string;
  readonly kind: NodeKind;
  readonly mark: PeopleMark | null;
  readonly score: number | null;
  readonly settling: boolean;
};

export type FeedOrder = "ranked" | "newest";
export type FeedPeople = "everyone" | "yourPeople";
export type FeedPeopleSign = "for" | "against" | "either";

/** The sheet's device-side axes — everything a derive needs that the pod does not. */
export type DeviceCuts = {
  readonly order: FeedOrder;
  /** Show what you've already seen: on keeps seen rows. */
  readonly showSeen: boolean;
  /** Also show: Still settling. Off is W-1's landed-only cut. */
  readonly showSettling: boolean;
  readonly people: FeedPeople;
  readonly peopleSign: FeedPeopleSign;
};

/** What a derive asks of the device's seen record. */
export type SeenLookup = { has(id: string): boolean };

/** Nothing seen — the session-less reader's record (§4.3). */
export const NOTHING_SEEN: SeenLookup = { has: () => false };

function landedRow(entry: HeldEntry): FeedRow {
  return {
    targetId: entry.targetId,
    kind: entry.kind,
    mark: entry.mark,
    score: entry.score,
    settling: false,
  };
}

function settlingRow(row: HeldSettling): FeedRow {
  return { targetId: row.targetId, kind: row.kind, mark: row.mark, score: null, settling: true };
}

/**
 * Lays `items` out by the index each one carries. Placement only: an item
 * whose index is out of range or already taken — an answer the relay should
 * have refused as malformed (§4.2 step 5) — is kept rather than lost, after
 * the placed ones, in the order it came.
 */
function placeByIndex<T>(items: readonly T[], size: number, indexOf: (item: T) => number): {
  slots: (T | undefined)[];
  stray: T[];
} {
  const slots: (T | undefined)[] = new Array<T | undefined>(size).fill(undefined);
  const stray: T[] = [];
  for (const item of items) {
    const at = indexOf(item);
    if (Number.isInteger(at) && at >= 0 && at < size && slots[at] === undefined) {
      slots[at] = item;
    } else {
      stray.push(item);
    }
  }
  return { slots, stray };
}

/**
 * The landed entries in `order`: RANKED is the array order; NEWEST applies
 * the pod's `newestIndex` permutation.
 */
function landedIn(answer: HeldAnswer, order: FeedOrder): HeldEntry[] {
  if (order === "ranked") return [...answer.entries];
  const { slots, stray } = placeByIndex(answer.entries, answer.entries.length, (e) => e.newestIndex);
  return [...slots.filter((e): e is HeldEntry => e !== undefined), ...stray];
}

/**
 * Step 1 + 2: the woven list for `order`. Each settling row stands at its
 * position for that order; the landed entries fill the remaining slots in
 * their own order (W-1: landed rows never move relative to each other).
 */
export function compose(answer: HeldAnswer, order: FeedOrder): FeedRow[] {
  const landed = landedIn(answer, order);
  const size = landed.length + answer.settling.length;
  const { slots, stray } = placeByIndex(answer.settling, size, (s) =>
    order === "ranked" ? s.rankedPosition : s.newestPosition,
  );
  const rows: FeedRow[] = [];
  let next = 0;
  for (const slot of slots) {
    if (slot !== undefined) {
      rows.push(settlingRow(slot));
    } else if (next < landed.length) {
      rows.push(landedRow(landed[next]!));
      next += 1;
    }
  }
  for (; next < landed.length; next += 1) rows.push(landedRow(landed[next]!));
  for (const row of stray) rows.push(settlingRow(row));
  return rows;
}

/**
 * Whether Your people under `sign` admits a row marked `mark` (OS-18 S1,
 * CD-11): For admits FOR, Against admits AGAINST, Either admits any held
 * opinion — the sign-less one included. An unmarked row (no opinion held, or a
 * Tags row, which belongs to no one — PR-44) is never admitted.
 */
export function admitsMark(sign: FeedPeopleSign, mark: PeopleMark | null): boolean {
  if (mark === null) return false;
  switch (sign) {
    case "for":
      return mark === "FOR";
    case "against":
      return mark === "AGAINST";
    case "either":
      return true;
  }
}

/** Step 3: the device's cuts. Deletes rows, never re-orders them. */
export function cut(rows: readonly FeedRow[], cuts: DeviceCuts, seen: SeenLookup): FeedRow[] {
  return rows.filter(
    (row) =>
      (cuts.showSettling || !row.settling) &&
      (cuts.showSeen || !seen.has(row.targetId)) &&
      (cuts.people === "everyone" || admitsMark(cuts.peopleSign, row.mark)),
  );
}

/**
 * The derived list: compose for the sheet's order, then cut. `seen` is read
 * as it stands at this call — "fresh at every derive, frozen between derives"
 * (§4.3): the caller holds the result, so a row seen while it is on screen
 * leaves only at the next derive (W-6).
 */
export function derive(answer: HeldAnswer, cuts: DeviceCuts, seen: SeenLookup): FeedRow[] {
  return cut(compose(answer, cuts.order), cuts, seen);
}
