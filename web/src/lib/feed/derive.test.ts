// The device derive (ranked-feed packet §4.12, §14.3): placement by the pod's
// indices, cuts that delete and never re-order, and the commutation the
// whole design leans on. Test names are the packet's, shared with Android.

import { describe, expect, it } from "vitest";

import {
  admitsMark,
  compose,
  cut,
  derive,
  NOTHING_SEEN,
  partition,
  type DerivedFeed,
  type DeviceCuts,
  type FeedOrder,
  type FeedPeopleSign,
  type HeldAnswer,
  type HeldEntry,
  type HeldSettling,
  type PeopleMark,
} from "./derive";

const EVERYONE: DeviceCuts = {
  order: "ranked",
  showSeen: false,
  showSettling: true,
  people: "everyone",
  peopleSign: "either",
};

function entry(targetId: string, newestIndex: number, mark: PeopleMark | null = null, score = 1): HeldEntry {
  return { targetId, kind: "POST", score, mark, newestIndex };
}

function settling(
  targetId: string,
  rankedPosition: number,
  newestPosition: number,
  mark: PeopleMark | null = null,
): HeldSettling {
  return { targetId, kind: "POST", mark, rankedPosition, newestPosition };
}

function answer(entries: HeldEntry[], settlingRows: HeldSettling[] = []): HeldAnswer {
  return { asOfEpoch: 7, entries, settling: settlingRows };
}

/** The ids of a composed list, or of a derived one top to bottom — above the seen line, then under it. */
const ids = (rows: readonly { targetId: string }[] | DerivedFeed) =>
  ("head" in rows ? [...rows.head, ...rows.tail] : rows).map((row) => row.targetId);
const seenOf = (...seen: string[]) => new Set(seen);

describe("the device derive: order (CD-7)", () => {
  // The fixture's scores rise down the array while `newestIndex` says the
  // opposite of what any score or id comparison would: the device follows the
  // pod's indices and nothing else.
  it("the_client_applies_the_pods_permutations_and_never_compares", () => {
    const held = answer([
      entry("a", 2, null, 0.1),
      entry("b", 0, null, 0.9),
      entry("c", 1, null, 0.5),
    ]);
    expect(ids(compose(held, "ranked"))).toEqual(["a", "b", "c"]);
    expect(ids(compose(held, "newest"))).toEqual(["b", "c", "a"]);
  });

  it("ranked_and_newest_compose_from_one_answer", () => {
    const held = answer([entry("a", 1), entry("b", 0)], [settling("s", 1, 0)]);
    expect(ids(compose(held, "ranked"))).toEqual(["a", "s", "b"]);
    expect(ids(compose(held, "newest"))).toEqual(["s", "b", "a"]);
  });

  it("keeps a malformed index's row rather than losing it", () => {
    const held = answer([entry("a", 0), entry("b", 0), entry("c", 9)]);
    expect(ids(compose(held, "newest"))).toEqual(["a", "b", "c"]);
  });
});

describe("the device derive: Still settling (CD-8)", () => {
  it("settling_rows_stand_at_their_woven_positions", () => {
    const held = answer(
      [entry("a", 2), entry("b", 1), entry("c", 0)],
      [settling("s0", 0, 1), settling("s3", 4, 0)],
    );
    expect(ids(compose(held, "ranked"))).toEqual(["s0", "a", "b", "c", "s3"]);
    expect(ids(compose(held, "newest"))).toEqual(["s3", "s0", "c", "b", "a"]);
  });

  it("a_settling_row_wears_a_bare_score_slot", () => {
    const rows = compose(answer([entry("a", 0, null, 0.4)], [settling("s", 0, 0)]), "ranked");
    expect(rows.map((row) => [row.targetId, row.score, row.settling])).toEqual([
      ["s", null, true],
      ["a", 0.4, false],
    ]);
  });

  // W-1: deleting every settling row leaves the landed rows exactly in their
  // own order, under either order.
  it("still_settling_off_drops_settling_rows_locally_without_a_fetch", () => {
    const held = answer(
      [entry("a", 1), entry("b", 0)],
      [settling("s", 1, 0), settling("t", 3, 3)],
    );
    const off = { ...EVERYONE, showSettling: false };
    expect(ids(derive(held, off, NOTHING_SEEN))).toEqual(["a", "b"]);
    expect(ids(derive(held, { ...off, order: "newest" }, NOTHING_SEEN))).toEqual(["b", "a"]);
  });
});

describe("the device derive: seen (CD-10, PR-80's seen tail)", () => {
  it("the_seen_partition_reads_the_devices_record_fresh_at_every_derive", () => {
    const held = answer([entry("a", 0), entry("b", 1), entry("c", 2)]);
    const record = seenOf();
    expect(ids(derive(held, EVERYONE, record))).toEqual(["a", "b", "c"]);
    record.add("b");
    const derived = derive(held, EVERYONE, record);
    expect(ids(derived.head)).toEqual(["a", "c"]);
    expect(ids(derived.tail)).toEqual(["b"]);
  });

  it("a_row_seen_while_held_stays_until_the_next_derive", () => {
    const held = answer([entry("a", 0), entry("b", 1)]);
    const record = seenOf();
    const onScreen = derive(held, EVERYONE, record);
    record.add("a");
    // The derived list the reader is looking at is a value, not a view: the
    // row seen on screen does not move, nor does the line (FeedSeenTail.md).
    expect(ids(onScreen)).toEqual(["a", "b"]);
    expect(onScreen.tail).toEqual([]);
    expect(ids(derive(held, EVERYONE, record))).toEqual(["b", "a"]);
  });

  // PR-80's named device test (FeedSeenTail.md): the seen rows leave the
  // unseen run for the tail under the separator, and each side keeps the
  // feed's own order — ranked under Ranked, by time under Newest.
  it("the_seen_tail_keeps_the_feeds_own_order_below_the_separator", () => {
    const held = answer(
      [entry("a", 1), entry("b", 2), entry("c", 0)],
      [settling("s", 1, 0), settling("t", 4, 2)],
    );
    // RANKED a s b c t; NEWEST s c t a b.
    const record = seenOf("a", "s", "b");
    const ranked = derive(held, EVERYONE, record);
    expect(ids(ranked.head)).toEqual(["c", "t"]);
    expect(ids(ranked.tail)).toEqual(["a", "s", "b"]);
    const newest = derive(held, { ...EVERYONE, order: "newest" }, record);
    expect(ids(newest.head)).toEqual(["c", "t"]);
    expect(ids(newest.tail)).toEqual(["s", "a", "b"]);
  });

  it("the_filter_cuts_the_tail_exactly_as_it_cuts_the_rows_above_it", () => {
    const held = answer([entry("f", 0, "FOR"), entry("n", 1, null)], [settling("s", 2, 2, "FOR")]);
    const record = seenOf("f", "n", "s");
    const forOnly: DeviceCuts = { ...EVERYONE, people: "yourPeople", peopleSign: "for" };
    expect(ids(derive(held, forOnly, record).tail)).toEqual(["f", "s"]);
    expect(ids(derive(held, { ...EVERYONE, showSettling: false }, record).tail)).toEqual(["f", "n"]);
  });

  it("nothing_unseen_leaves_every_admitted_row_in_the_tail", () => {
    const held = answer([entry("a", 0), entry("b", 1)]);
    const derived = derive(held, EVERYONE, seenOf("a", "b"));
    expect(derived.head).toEqual([]);
    expect(ids(derived.tail)).toEqual(["a", "b"]);
  });

  it("show_seen_on_stands_one_list_with_the_seen_rows_ranked_in_and_no_tail", () => {
    const held = answer([entry("a", 0), entry("b", 1)], [settling("s", 0, 0)]);
    const record = seenOf("a", "s");
    const on = derive(held, { ...EVERYONE, showSeen: true }, record);
    expect(ids(on.head)).toEqual(["s", "a", "b"]);
    expect(on.tail).toEqual([]);
    const off = derive(held, EVERYONE, record);
    expect(ids(off.head)).toEqual(["b"]);
    expect(ids(off.tail)).toEqual(["s", "a"]);
  });

  it("a_session_less_reader_cuts_nothing_for_seen", () => {
    const held = answer([entry("a", 0), entry("b", 1)]);
    const derived = derive(held, EVERYONE, NOTHING_SEEN);
    expect(ids(derived)).toEqual(["a", "b"]);
    expect(derived.tail).toEqual([]);
  });
});

describe("the device derive: people (CD-11)", () => {
  const marked = answer(
    [
      entry("for", 0, "FOR"),
      entry("against", 1, "AGAINST"),
      entry("signless", 2, "SIGNLESS"),
      entry("none", 3, null),
      { targetId: "tag", kind: "HASHTAG", score: 1, mark: null, newestIndex: 4 },
    ],
    [settling("s-for", 1, 5, "FOR")],
  );
  const people = (sign: FeedPeopleSign): DeviceCuts => ({
    ...EVERYONE,
    people: "yourPeople",
    peopleSign: sign,
  });

  it("everyone_admits_every_row_marked_or_not", () => {
    expect(ids(derive(marked, EVERYONE, NOTHING_SEEN))).toEqual([
      "for",
      "s-for",
      "against",
      "signless",
      "none",
      "tag",
    ]);
  });

  it("for_admits_only_for_marks", () => {
    expect(ids(derive(marked, people("for"), NOTHING_SEEN))).toEqual(["for", "s-for"]);
  });

  it("against_admits_only_against_marks", () => {
    expect(ids(derive(marked, people("against"), NOTHING_SEEN))).toEqual(["against"]);
  });

  it("either_admits_for_against_and_signless_marks", () => {
    expect(ids(derive(marked, people("either"), NOTHING_SEEN))).toEqual([
      "for",
      "s-for",
      "against",
      "signless",
    ]);
  });

  it("your_people_never_admits_an_unmarked_row", () => {
    for (const sign of ["for", "against", "either"] as const) {
      expect(admitsMark(sign, null)).toBe(false);
      const kept = ids(derive(marked, people(sign), NOTHING_SEEN));
      expect(kept).not.toContain("none");
      expect(kept).not.toContain("tag");
    }
  });

  // PR-54's vantage law (ranked-feed packet §5.4): a ranking's marks are
  // the vantage's whoever reads it, so the Your-people cut keys on the marks
  // that arrive with or without a session — no record, no session test in the
  // cut. The server half is `a_session_less_rankings_marks_are_the_vantages`.
  it("a_session_less_derives_people_cut_keys_on_the_vantages_marks", () => {
    expect(ids(derive(marked, people("for"), NOTHING_SEEN))).toEqual(["for", "s-for"]);
    expect(ids(derive(marked, people("either"), NOTHING_SEEN))).toEqual([
      "for",
      "s-for",
      "against",
      "signless",
    ]);
  });

  it("a_device_cut_never_reorders_the_derived_list", () => {
    for (const order of ["ranked", "newest"] as const) {
      const whole = ids(compose(marked, order));
      const kept = ids(derive(marked, { ...people("either"), order }, seenOf("against")).head);
      expect(kept).toEqual(whole.filter((id) => kept.includes(id)));
    }
  });
});

/** A seeded PRNG, so a failing case is a case that can be replayed. */
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

const MARKS: (PeopleMark | null)[] = ["FOR", "AGAINST", "SIGNLESS", null];

/** A random well-formed answer: a permutation per order, distinct positions. */
function randomAnswer(random: () => number): HeldAnswer {
  const landed = Math.floor(random() * 12);
  const pending = Math.floor(random() * 5);
  const size = landed + pending;
  const newest = shuffled([...Array(landed).keys()], random);
  const rankedSlots = shuffled([...Array(size).keys()], random).slice(0, pending);
  const newestSlots = shuffled([...Array(size).keys()], random).slice(0, pending);
  const pick = () => MARKS[Math.floor(random() * MARKS.length)]!;
  return answer(
    newest.map((index, i) => entry(`e${i}`, index, pick())),
    rankedSlots.map((at, i) => settling(`s${i}`, at, newestSlots[i]!, pick())),
  );
}

/**
 * The answer as if the pod had woven over only the rows a cut keeps: the
 * surviving rows keep their relative order, which is all a position carries.
 */
function cutAnswer(held: HeldAnswer, keep: (id: string) => boolean, order: FeedOrder): HeldAnswer {
  const composed = compose(held, order);
  const kept = composed.filter((row) => keep(row.targetId));
  const landedKept = held.entries.filter((e) => keep(e.targetId));
  const newestOrder = compose(held, "newest")
    .filter((row) => !row.settling && keep(row.targetId))
    .map((row) => row.targetId);
  return answer(
    landedKept.map((e) => ({ ...e, newestIndex: newestOrder.indexOf(e.targetId) })),
    held.settling
      .filter((s) => keep(s.targetId))
      .map((s) => {
        const at = kept.findIndex((row) => row.targetId === s.targetId);
        return { ...s, rankedPosition: at, newestPosition: at };
      }),
  );
}

describe("the device derive: commutation", () => {
  // FP-1's argument (§4.10 W-2): deleting rows from the composed list equals
  // composing over the answer with those rows already gone — for every
  // combination of the people, seen and settling axes, under both orders. The
  // seen axis splits rather than deletes (PR-80), so the property holds on
  // each side of the separator: the head is the composition of the unseen
  // survivors, the tail the composition of the seen ones.
  it("cut_then_compose_equals_compose_then_cut", () => {
    const random = mulberry32(20261013);
    const signs: FeedPeopleSign[] = ["for", "against", "either"];
    for (let round = 0; round < 300; round += 1) {
      const held = randomAnswer(random);
      const every = [...held.entries.map((e) => e.targetId), ...held.settling.map((s) => s.targetId)];
      const seen = new Set(every.filter(() => random() < 0.3));
      for (const order of ["ranked", "newest"] as const) {
        for (const showSeen of [false, true]) {
          for (const showSettling of [false, true]) {
            for (const people of ["everyone", "yourPeople"] as const) {
              for (const peopleSign of signs) {
                const cuts: DeviceCuts = { order, showSeen, showSettling, people, peopleSign };
                const split = partition(cut(compose(held, order), cuts), cuts, seen);
                for (const side of [split.head, split.tail]) {
                  const composedThenCut = ids(side);
                  const survivors = new Set(composedThenCut);
                  const cutThenComposed = ids(
                    compose(cutAnswer(held, (id) => survivors.has(id), order), order),
                  );
                  expect(cutThenComposed).toEqual(composedThenCut);
                }
              }
            }
          }
        }
      }
    }
  });
});
