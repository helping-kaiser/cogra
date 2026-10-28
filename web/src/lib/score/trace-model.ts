// THE SCORE'S TRACE, READ (score-readout packet §5; FeedEntry.md, RankPath.md,
// RankHop.md, RankRecords.md; copy-voice, *The score drill-down*).
//
// One live `feedTrace` answer, held, and everything the four levels draw read
// off it. NOTHING HERE RANKS: every figure is the ranker's — the score, each
// path's contribution, each step's folded pair, each record's leg — and the
// only arithmetic is the add-up rendering (`figure.ts`) and the records'
// sum checked against the limit, which states what the records are, never a
// second opinion of what the step carries (`RankHop.md:13`). Paths stay in
// extraction order: "strongest first" is the ranker's order, never re-sorted
// here by contribution (SR-G9).
//
// A STEP IS ONE RECORD (RankPath.md:13; SR-G4): a hop crosses one node pair,
// and a record with two legs crosses two hops through the thing it passed —
// a comment it answered, a post it cited from, a topic it tagged — so the
// two hops that share that record read as ONE step naming what it passed
// through, and the trace above shows only people and the reached thing.

import type { NodeKind, RecordFamily, RecordLegRole } from "@/__generated__/graphql";
import { ladderAge } from "@/lib/ui/timestamp";
import { apportionCents, signedOfCents } from "./figure";

/** One node on a path, as the slice names it (`SliceNode`). */
export type TraceNode = {
  readonly graphId: string;
  /** CoGra's row id; null for a node CoGra carries no row for. */
  readonly id: string | null;
  readonly kind: NodeKind | null;
};

export type TraceLeg = {
  readonly role: RecordLegRole;
  readonly sourceId: string;
  readonly targetId: string;
  readonly pDirected: number;
  readonly pInterest: number;
  readonly censusUnknown: boolean;
};

export type TracePerson = {
  readonly id: string;
  readonly handle: string;
  readonly displayName: string | null;
  readonly avatarUrl?: string | null;
};

export type TraceRecord = {
  readonly id: string;
  readonly family: RecordFamily;
  /** Null where no account fronts the author (a system actor). */
  readonly author: TracePerson | null;
  readonly landedAt: string;
  readonly legs: readonly TraceLeg[];
};

export type TraceHop = {
  readonly pDirected: number;
  readonly pInterest: number;
  readonly records: readonly TraceRecord[];
};

export type TracePath = {
  readonly nodes: readonly TraceNode[];
  readonly sign: number;
  readonly contribution: number;
  readonly hops: readonly TraceHop[];
};

/** One `feedTrace` answer. `score` null: no live path reaches the thing. */
export type TraceAnswer = {
  readonly score: number | null;
  readonly paths: readonly TracePath[];
};

/** A hydrated node a step or a trace names (`TraceNodes`). */
export type Named =
  | { readonly kind: "person"; readonly person: TracePerson }
  | {
      readonly kind: "post";
      readonly id: string;
      readonly title: string | null;
      readonly authorHandle: string | null;
      readonly createdAt: string;
    }
  | { readonly kind: "comment"; readonly id: string; readonly authorHandle: string | null; readonly createdAt: string };

/** What the trace reads its words against. */
export type TraceContext = {
  /** Whose view the trace walked from: the reader's own actor, or the lender (CD-5). */
  readonly viewer: string;
  /** The borrowed view: the lender's handle speaks every first person (SR-G3). */
  readonly borrowed: boolean;
  /** The hydrated rows, by CoGra id. */
  readonly named: ReadonlyMap<string, Named>;
  /** The reached thing's own kind, for its mark and for `wrote it`. */
  readonly targetKind: TraceThingKind;
  /** The reached thing's age, where its own publish is a step (RankPath.md:11). */
  readonly targetCreatedAt: string | null;
  readonly now: number;
};

export type TraceThingKind = "post" | "comment" | "person" | "topic";

/** How many paths stand drawn before the quiet row (FeedEntry.jsx: four). */
export const DRAWN_PATHS = 4;

/** The limit an opinion can reach on either axis (api-spec.md `Dimension`). */
const LIMIT = 1;
const LIMIT_EPSILON = 1e-9;

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const ORDINALS = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"];

/** `two` — the boards' own counts are words (`two opinions`, `two steps`). */
export function countWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

function ordinal(n: number): string {
  return ORDINALS[n - 1] ?? `${n}th`;
}

/** Persons fold: an address and its profile are one node (feed-ranking.md §2; RankHop.records). */
function folded(graphId: string): string {
  return graphId.startsWith("addr:") ? `prof:${graphId.slice("addr:".length)}` : graphId;
}

function isPersonNode(node: TraceNode): boolean {
  if (node.kind !== null) return node.kind === "USER";
  return node.graphId.startsWith("prof:") || node.graphId.startsWith("addr:");
}

function isTopicNode(node: TraceNode): boolean {
  return node.kind === "HASHTAG" || (node.kind === null && node.graphId.startsWith("name:"));
}

function personOf(node: TraceNode, context: TraceContext): TracePerson | null {
  if (node.id === null) return null;
  const named = context.named.get(node.id);
  return named?.kind === "person" ? named.person : null;
}

// ── Steps ────────────────────────────────────────────────────────────────

/** One step: a record's crossing, one hop or two. */
export type TraceStep = {
  /** The hops the step crosses, in path order. */
  readonly hops: readonly TraceHop[];
  /** Index of the node the step starts on, and of the one it reaches. */
  readonly from: number;
  readonly to: number;
  /** The things it passed through on the way (the carrier of a two-legged record). */
  readonly through: readonly number[];
};

/**
 * The hop whose fold the step carries: the one reaching what the step names.
 * For a two-legged record that is its terminal leg's (a build reading of
 * X-SR4 for SR-G4's merged step, reported in the PR).
 */
export function carryingHop(step: TraceStep): TraceHop {
  return step.hops[step.hops.length - 1]!;
}

function shareARecord(a: TraceHop, b: TraceHop): boolean {
  const ids = new Set(a.records.map((record) => record.id));
  return b.records.some((record) => ids.has(record.id));
}

/** The path's steps: hops grouped so a two-legged record reads as one. */
export function stepsOf(path: TracePath): TraceStep[] {
  const steps: TraceStep[] = [];
  const last = path.nodes.length - 1;
  let at = 0;
  while (at < path.hops.length) {
    const start = at;
    const through: number[] = [];
    while (
      at + 1 < path.hops.length &&
      at + 1 < last &&
      !isPersonNode(path.nodes[at + 1]!) &&
      shareARecord(path.hops[at]!, path.hops[at + 1]!)
    ) {
      through.push(at + 1);
      at += 1;
    }
    steps.push({ hops: path.hops.slice(start, at + 1), from: start, to: at + 1, through });
    at += 1;
  }
  return steps;
}

// ── Words ────────────────────────────────────────────────────────────────

/** The giver of a step: the author of the records its carrying hop folds. */
function giverOf(step: TraceStep, path: TracePath, context: TraceContext): TracePerson | null {
  const author = carryingHop(step).records[0]?.author ?? step.hops[0]?.records[0]?.author ?? null;
  return author ?? personOf(path.nodes[step.from]!, context);
}

/** Whether the step is the view's own — the reader's in their own view. */
function isOwn(giver: TracePerson | null, context: TraceContext): boolean {
  return giver !== null && giver.id === context.viewer;
}

/** The giver as a subject: `@ada`, or `Deleted account` where none fronts it (SR-G12). */
function subject(giver: TracePerson | null): string {
  return giver === null ? "Deleted account" : `@${giver.handle}`;
}

/**
 * A thing as a step names it (RankPath.md:15): the reached thing `it`, another
 * post by its title, a comment by its author's handle, a person by their
 * handle, a topic by its `#name`. A node CoGra carries no row for is named by
 * what it is (SR-G4's residual, build reading).
 */
function thingName(path: TracePath, index: number, context: TraceContext): string {
  if (index === path.nodes.length - 1) return "it";
  const node = path.nodes[index]!;
  if (isTopicNode(node)) {
    return node.graphId.startsWith("name:") ? `#${node.graphId.slice("name:".length)}` : "a topic";
  }
  const named = node.id === null ? undefined : context.named.get(node.id);
  if (named?.kind === "person") return `@${named.person.handle}`;
  if (named?.kind === "post") {
    if (named.title !== null && named.title !== "") return `"${named.title}"`;
    return named.authorHandle === null ? "a post" : `@${named.authorHandle}'s post`;
  }
  if (named?.kind === "comment") return named.authorHandle === null ? "a comment" : `@${named.authorHandle}`;
  if (node.kind === "POST") return "a post";
  if (node.kind === "COMMENT") return "a comment";
  return isPersonNode(node) ? "someone" : "a thing";
}

function familyOf(step: TraceStep): RecordFamily | null {
  return carryingHop(step).records[0]?.family ?? step.hops[0]?.records[0]?.family ?? null;
}

/**
 * A step's title (RankPath.md:15-31), in the second person for the reader's
 * own steps in their own view and the third person for everyone else's —
 * the lender's included, under a borrowed view.
 */
export function stepTitle(path: TracePath, step: TraceStep, context: TraceContext): string {
  const giver = giverOf(step, path, context);
  const own = isOwn(giver, context) && !context.borrowed;
  const who = own ? "You" : subject(giver);
  const object = thingName(path, step.to, context);
  const carrier = step.through.length > 0 ? thingName(path, step.through[0]!, context) : null;
  switch (familyOf(step)) {
    case "AFFINITY":
      return own ? `How you feel about ${object}` : `How ${who} feels about ${object}`;
    case "PUBLISH":
      return object === "it" && context.targetKind === "comment" ? `${who} wrote it` : `${who} published ${object}`;
    case "REVIEW":
      return `${who} replied to ${object}`;
    case "REFERENCE":
      return carrier === null ? `${who} cited ${object}` : `${who} cited ${object} in ${carrier}`;
    case "TAG":
      return carrier === null ? `${who} tagged ${object}` : `${who} tagged ${object} ${carrier}`;
    default:
      // An opinion — and, as a build reading, any family the boards draw no
      // title for, which reads as the opinion it carries.
      return own ? `Your opinion of ${object}` : `${who}'s opinion of ${object}`;
  }
}

/** The newest landing among `records`, or null with none. */
function newestLanding(records: readonly TraceRecord[]): string | null {
  let best: string | null = null;
  for (const record of records) {
    if (best === null || Date.parse(record.landedAt) > Date.parse(best)) best = record.landedAt;
  }
  return best;
}

function isOwnPublishOfTarget(path: TracePath, step: TraceStep): boolean {
  return familyOf(step) === "PUBLISH" && step.to === path.nodes.length - 1;
}

/**
 * A step's age (RankPath.md:7-11): its newest record's landing on the ladder;
 * an author's publish of the reached thing is aged as the thing itself.
 */
export function stepAge(path: TracePath, step: TraceStep, context: TraceContext): string {
  const at =
    isOwnPublishOfTarget(path, step) && context.targetCreatedAt !== null
      ? context.targetCreatedAt
      : newestLanding(carryingHop(step).records);
  return at === null ? "" : ladderAge(at, context.now);
}

/** A step's `Newest of them`: when the newest of its records landed (RankHop.md:3). */
export function hopNewest(hop: TraceHop, now: number): string {
  const at = newestLanding(hop.records);
  return at === null ? "" : ladderAge(at, now);
}

/** `2 opinions` (RankHop's `Behind it`). */
export function opinionsCount(n: number): string {
  return n === 1 ? "1 opinion" : `${n} opinions`;
}

/**
 * A step's second line (RankPath.jsx): `2 opinions behind it`; an author's
 * publish of the reached thing says whose opinion rides it — by handle where
 * the board's `Her` presumes a pronoun the graph does not hold (reported).
 */
export function stepSecondLine(path: TracePath, step: TraceStep, context: TraceContext): string {
  if (isOwnPublishOfTarget(path, step)) {
    const giver = giverOf(step, path, context);
    const thing = context.targetKind === "comment" ? "the comment" : "the post";
    const whose = isOwn(giver, context) && !context.borrowed ? "Your" : `${subject(giver)}'s`;
    return `${whose} own opinion rides ${thing}`;
  }
  return `${opinionsCount(carryingHop(step).records.length)} behind it`;
}

// ── The path ─────────────────────────────────────────────────────────────

/** The people a path's trace draws, in order — never a thing passed through (RankPath.md:13). */
export function pathPeople(path: TracePath, context: TraceContext): (TracePerson | null)[] {
  return path.nodes
    .slice(0, -1)
    .filter(isPersonNode)
    .map((node) => personOf(node, context));
}

function handleOf(person: TracePerson | null): string {
  return person === null ? "Deleted account" : `@${person.handle}`;
}

/** `and`-joined handles: `@ada`, `@kel and @wren`, `@a, @b and @c`. */
function joined(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * The row's words (`Through @ada`, `Through @kel and @wren`): who the path ran
 * through after the view's own start. A path straight from the view's own
 * opinion names that start (build reading: the boards draw none).
 */
export function throughLine(path: TracePath, context: TraceContext): string {
  const people = pathPeople(path, context);
  const after = people.slice(1).map(handleOf);
  if (after.length > 0) return `Through ${joined(after)}`;
  return context.borrowed ? `Through ${handleOf(people[0] ?? null)}` : "Through you";
}

/**
 * The people one step joins (RankHop's trace): its two ends, where they are
 * people — the reached thing stands as the mark after them.
 */
export function stepPeople(path: TracePath, step: TraceStep, context: TraceContext): (TracePerson | null)[] {
  const last = path.nodes.length - 1;
  return path.nodes
    .slice(step.from, step.to + 1)
    .filter((node, offset) => step.from + offset !== last && isPersonNode(node))
    .map((node) => personOf(node, context));
}

/**
 * The trace's spoken line (PathTrace, copy-voice): `You, then @ada, then what
 * reached you`; two or more people between take `several steps`.
 */
export function spokenTrace(path: TracePath, context: TraceContext): string {
  return spokenPeople(pathPeople(path, context), context);
}

/** A trace of `people` spoken; the lead is the view's own word. */
export function spokenPeople(people: readonly (TracePerson | null)[], context: TraceContext): string {
  const lead = context.borrowed ? handleOf(people[0] ?? null) : "You";
  const between = people.slice(1);
  if (between.length === 0) return `${lead}, then what reached you`;
  const middle = between.length === 1 ? handleOf(between[0]!) : "several steps";
  return `${lead}, then ${middle}, then what reached you`;
}

/** The path's `Newest opinion on it`: its last step's age (RankPath.md:7). */
export function pathNewest(path: TracePath, context: TraceContext): string {
  const steps = stepsOf(path);
  const last = steps[steps.length - 1];
  return last === undefined ? "" : stepAge(path, last, context);
}

// ── Level one ────────────────────────────────────────────────────────────

/** The quiet row: how many more paths, and what they add. */
export type MorePaths = { readonly count: number; readonly value: string };

/**
 * What level one draws: the paths' values in extraction order, the handful
 * standing and the rest riding the quiet row unless `unfolded`.
 *
 * EVERY PATH IS APPORTIONED ON ITS OWN, ONCE, and the quiet row carries the
 * sum of the ones it holds: so the drawn surface adds up to the trace's own
 * figure in either state (FeedEntry.md:15; SR-G8), and a path reads the same
 * value on the list, unfolded, and on its own level.
 */
export function levelOne(
  answer: TraceAnswer,
  unfolded: boolean,
): { readonly drawn: readonly { index: number; value: string }[]; readonly more: MorePaths | null } {
  const cents = apportionCents(
    answer.paths.map((path) => path.contribution),
    answer.score ?? 0,
  );
  const folds = !unfolded && cents.length > DRAWN_PATHS;
  const shown = folds ? cents.slice(0, DRAWN_PATHS) : cents;
  const rest = folds ? cents.slice(DRAWN_PATHS) : [];
  return {
    drawn: shown.map((value, index) => ({ index, value: signedOfCents(value) })),
    more:
      rest.length > 0
        ? { count: rest.length, value: signedOfCents(rest.reduce((sum, value) => sum + value, 0)) }
        : null,
  };
}

/** `2 more paths` / `1 more path`, and its accessible name. */
export function morePathsWords(count: number): { label: string; name: string } {
  const paths = count === 1 ? "1 more path" : `${count} more paths`;
  return { label: paths, name: `Show ${paths}` };
}

/** A path's own value on level two, apportioned exactly as level one drew it. */
export function pathValue(answer: TraceAnswer, index: number): string {
  const { drawn } = levelOne(answer, true);
  return drawn[index]?.value ?? "";
}

/**
 * Level one's note (FeedEntry.md:5-7): the reader's own words, or the
 * lender's handle under a borrowed view.
 */
export function levelOneNote(context: TraceContext, lender: string | null): string {
  return context.borrowed && lender !== null
    ? `Every path here starts with an opinion @${lender} gave.`
    : "Every path here starts with an opinion you gave.";
}

// ── Level three ──────────────────────────────────────────────────────────

/** The leg a member record contributes to the hop `nodes[i] → nodes[i + 1]` (X-SR4). */
export function crossedLeg(record: TraceRecord, from: TraceNode, to: TraceNode): TraceLeg | null {
  const source = folded(from.graphId);
  const target = folded(to.graphId);
  return (
    record.legs.find((leg) => folded(leg.sourceId) === source && folded(leg.targetId) === target) ??
    record.legs.find((leg) => leg.role === "A") ??
    record.legs[0] ??
    null
  );
}

/** The hop index a step carries by, within its path. */
function carryingIndex(step: TraceStep): number {
  return step.to - 1;
}

/** Each member's pair on the leg the step crosses, in the causal order. */
export function memberPairs(
  path: TracePath,
  step: TraceStep,
): { record: TraceRecord; pDirected: number; pInterest: number }[] {
  const at = carryingIndex(step);
  const from = path.nodes[at]!;
  const to = path.nodes[at + 1]!;
  return carryingHop(step).records.map((record) => {
    const leg = crossedLeg(record, from, to);
    return { record, pDirected: leg?.pDirected ?? 0, pInterest: leg?.pInterest ?? 0 };
  });
}

/** The records' unclipped sum, and whether it passes the limit (SR-G6). */
export function memberSum(path: TracePath, step: TraceStep): { pDirected: number; pInterest: number; clipped: boolean } {
  const pairs = memberPairs(path, step);
  const pDirected = pairs.reduce((sum, pair) => sum + pair.pDirected, 0);
  const pInterest = pairs.reduce((sum, pair) => sum + pair.pInterest, 0);
  const clipped = Math.abs(pDirected) > LIMIT + LIMIT_EPSILON || Math.abs(pInterest) > LIMIT + LIMIT_EPSILON;
  return { pDirected, pInterest, clipped };
}

const CLIPPED_FOLD = "Added up, they go past the limit an opinion can reach, so the step carries the limit.";
export const CLIPPED_RECORDS = "Added up, these go past the limit an opinion can reach, so the step carries the limit.";

/** `Your opinion of @ada — the first of this path's two steps.` (RankHop.md:7). */
export function placeNote(title: string, place: number, steps: number): string {
  return steps === 1
    ? `${title} — this path's one step.`
    : `${title} — the ${ordinal(place)} of this path's ${countWord(steps)} steps.`;
}

/**
 * The fold's note (RankHop.md:9-13): the reader's own word with the pad's
 * clause, or the giver's handle without it, closing on the limit when the
 * records pass it.
 */
export function foldNote(path: TracePath, step: TraceStep, context: TraceContext): string {
  const giver = giverOf(step, path, context);
  const own = isOwn(giver, context) && !context.borrowed;
  const object = thingName(path, step.to, context);
  const n = carryingHop(step).records.length;
  const given = own ? `You have given ${object}` : `${subject(giver)} has given ${object}`;
  const pad = own ? " — the same adding up the pad shows you as your current opinion" : "";
  const body =
    n === 1
      ? `${given} one opinion, and that one is what carries${pad}.`
      : `${given} ${countWord(n)} opinions. They add up to one, and that one is what carries${pad}.`;
  return memberSum(path, step).clipped ? `${body} ${CLIPPED_FOLD}` : body;
}

// ── Level four ───────────────────────────────────────────────────────────

/**
 * The floor's opening line (RankRecords.md:3): `The two records behind your
 * opinion of @ada.`, in the third person for a step another gave.
 */
export function recordsNote(title: string, n: number): string {
  const step = title.startsWith("Your ") ? `your ${title.slice("Your ".length)}` : title.startsWith("How you ") ? `how you ${title.slice("How you ".length)}` : title;
  return n === 1 ? `The record behind ${step}.` : `The ${countWord(n)} records behind ${step}.`;
}

/** A record's age: the ladder, a date past thirty days (RankRecords.md:13). */
export function recordAge(record: TraceRecord, now: number): string {
  return ladderAge(record.landedAt, now);
}

export const PUBLIC_SUM_LINE = "These records are public. Anyone can run the same sum and land on the same number.";
