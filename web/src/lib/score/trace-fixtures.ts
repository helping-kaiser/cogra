// The trace's test cast — the boards' own (`_shared.jsx` SCORE_PATHS): why
// @ada's post reached @sol at 15.20, through six paths that add up to it.
// Shared by the model's unit tests and the trace view's behaviour tests, so
// both read the same answer the boards draw.

import type { Named, TraceAnswer, TraceHop, TracePath, TracePerson, TraceRecord } from "./trace-model";

export const SOL: TracePerson = { id: "u-sol", handle: "sol", displayName: "Sol Navarro" };
export const ADA: TracePerson = { id: "u-ada", handle: "ada", displayName: "Ada Lindqvist" };
export const TOBIAS: TracePerson = { id: "u-tobias", handle: "tobias", displayName: "Tobias Brandt" };
export const MIRA: TracePerson = { id: "u-mira", handle: "mira", displayName: "Mira Okafor" };
export const KEL: TracePerson = { id: "u-kel", handle: "kel", displayName: "Kel Moreau" };
export const WREN: TracePerson = { id: "u-wren", handle: "wren", displayName: "Wren Aliyev" };
export const NADIA: TracePerson = { id: "u-nadia", handle: "nadia", displayName: "Nadia Rask" };
export const JUNO: TracePerson = { id: "u-juno", handle: "juno", displayName: "Juno Baptiste" };

export const POST_ID = "p-long-way";
export const POST_CREATED = "2026-10-28T08:00:00.000Z";
/** The board's clock: the post two hours old, the records eight days and a date. */
export const NOW = Date.parse("2026-10-28T10:00:00.000Z");
const DAY = 86_400_000;

const person = (p: TracePerson) => ({ graphId: `prof:${p.id}`, id: p.id, kind: "USER" as const });
const target = { graphId: `mint:act:${ADA.id}:1:publish`, id: POST_ID, kind: "POST" as const };

function record(
  id: string,
  author: TracePerson,
  family: TraceRecord["family"],
  pair: [number, number],
  landedAt: string,
  to: string,
): TraceRecord {
  return {
    id,
    family,
    author,
    landedAt,
    legs: [
      {
        role: "A",
        sourceId: `addr:${author.id}`,
        targetId: to,
        pDirected: pair[0],
        pInterest: pair[1],
        censusUnknown: false,
      },
    ],
  };
}

function opinion(from: TracePerson, to: TracePerson, pairs: [number, number][], ages: number[]): TraceHop {
  const records = pairs.map((pair, index) =>
    record(
      `act:${from.id}:${index}:opinion:${to.id}`,
      from,
      "OPINION",
      pair,
      new Date(NOW - ages[index]! * DAY).toISOString(),
      `prof:${to.id}`,
    ),
  );
  const sum = (axis: 0 | 1) => Math.max(-1, Math.min(1, pairs.reduce((s, p) => s + p[axis], 0)));
  return { pDirected: sum(0), pInterest: sum(1), records };
}

function publish(author: TracePerson): TraceHop {
  return {
    pDirected: 0.1,
    pInterest: 0.1,
    records: [record(`act:${author.id}:1:publish`, author, "PUBLISH", [0.1, 0.1], POST_CREATED, target.graphId)],
  };
}

function opinionOfPost(author: TracePerson): TraceHop {
  return {
    pDirected: 0.5,
    pInterest: 0.3,
    records: [
      record(`act:${author.id}:9:opinion:post`, author, "OPINION", [0.5, 0.3], new Date(NOW - 2 * DAY).toISOString(), target.graphId),
    ],
  };
}

function path(people: TracePerson[], contribution: number, firstPairs: [number, number][] = [[0.3, 0.1]]): TracePath {
  const hops: TraceHop[] = [];
  for (let at = 0; at + 1 < people.length; at += 1) {
    hops.push(opinion(people[at]!, people[at + 1]!, at === 0 ? firstPairs : [[0.4, 0.2]], at === 0 ? [8, 40] : [3]));
  }
  const last = people[people.length - 1]!;
  // The author reaches her post by publishing it; anyone else by an opinion of it.
  hops.push(last.id === ADA.id ? publish(last) : opinionOfPost(last));
  return {
    nodes: [...people.map(person), target],
    sign: contribution < 0 ? -1 : 1,
    contribution,
    hops,
  };
}

/** The board's six paths in the reader's own view: 6.80 + 4.20 + 2.60 + 1.10 + (0.30 + 0.20) = 15.20. */
export function ownAnswer(score = 15.2): TraceAnswer {
  return {
    score,
    paths: [
      path([SOL, ADA], 6.8, [
        [0.45, 0.1],
        [0.1, 0.1],
      ]),
      path([SOL, TOBIAS], 4.2),
      path([SOL, MIRA], 2.6),
      path([SOL, KEL, WREN], 1.1),
      path([SOL, NADIA], 0.3),
      path([SOL, JUNO], 0.2),
    ],
  };
}

/** The same set walked from @mira's opinions (FeedEntry `view` borrowed). */
export function borrowedAnswer(): TraceAnswer {
  return {
    score: 15.2,
    paths: [
      path([MIRA, ADA], 6.8, [
        [0.45, 0.1],
        [0.1, 0.1],
      ]),
      path([MIRA, TOBIAS], 4.2),
      path([MIRA, SOL], 2.6),
      path([MIRA, KEL, WREN], 1.1),
      path([MIRA, NADIA], 0.5),
    ],
  };
}

/** A step whose records add up past the limit (RankHop.md:13). */
export function clippedAnswer(): TraceAnswer {
  return {
    score: 2,
    paths: [
      path([SOL, ADA], 2, [
        [0.8, 0.2],
        [0.7, 0.1],
      ]),
    ],
  };
}

export const NAMED: ReadonlyMap<string, Named> = new Map<string, Named>([
  ...[SOL, ADA, TOBIAS, MIRA, KEL, WREN, NADIA, JUNO].map(
    (p) => [p.id, { kind: "person", person: p }] as [string, Named],
  ),
  [POST_ID, { kind: "post", id: POST_ID, title: "The long way home", authorHandle: "ada", createdAt: POST_CREATED }],
]);
