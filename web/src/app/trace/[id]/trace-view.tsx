"use client";

// THE FEED SCORE'S TRACE — four full screens, one route (readme.md:1427-1434;
// FeedEntry, FeedEntryMoved, RankPath, RankHop, RankRecords; score-readout
// packet SR-1..SR-4). The score on a card or a detail opens it, and it
// answers why the thing reached the reader: the paths, strongest first, each
// stating what it adds, down to the signed records under every step.
//
// ONE LIVE FETCH PER OPEN (PR-39; CD-SR2). The tap opens level one, which
// fetches `feedTrace` once; the deeper levels read that held answer and ask
// nothing. Whatever figure the fetch finds — a number, or no paths at all —
// the reader's cards adopt it (`standing.ts`), and no feed re-orders for it.
//
// A THING STILL SETTLING MAKES NO FETCH (FeedEntryMoved.md:7-9): it has no
// figure by construction, so its trace is the cover, the dash and one line.
//
// THE VIEW SPEAKS ITS OWN PERSON. In the reader's own view the paths start
// with an opinion they gave; under a borrowed view every first person is the
// lender's handle, in the third person (FeedEntry.md:7-9; SR-G3).

import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { useApolloClient } from "@apollo/client/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { fetchBorrowedView } from "@/lib/api/auth-api";
import { success, type Outcome } from "@/lib/api/outcome";
import { fetchFeedTrace, fetchTraceNodes } from "@/lib/api/trace-api";
import { DASH, flagFigure } from "@/lib/score/figure";
import { adoptTrace, heldViewer } from "@/lib/score/standing";
import { useScoreReader } from "@/lib/score/use-standing";
import type { TraceCover } from "@/lib/score/cover";
import {
  CLIPPED_RECORDS,
  PUBLIC_SUM_LINE,
  carryingHop,
  foldNote,
  hopNewest,
  levelOne,
  levelOneNote,
  memberPairs,
  memberSum,
  morePathsWords,
  opinionsCount,
  pathNewest,
  pathPeople,
  pathValue,
  placeNote,
  recordAge,
  recordsNote,
  spokenPeople,
  spokenTrace,
  stepAge,
  stepPeople,
  stepSecondLine,
  stepTitle,
  stepsOf,
  throughLine,
  type TraceContext,
  type TracePath,
  type TraceStep,
  type TraceThingKind,
} from "@/lib/score/trace-model";
import {
  openTrace,
  traceBack,
  traceHref,
  type TraceAddress,
  type TraceLevel,
  type TraceOpen,
  type TraceRead,
} from "@/lib/score/trace-session";
import { formatStancePair } from "@/lib/ui/stance-format";
import { Button } from "@/lib/ui/button";
import { PageHeader } from "@/lib/ui/page-header";
import { part, type DataNode } from "@/lib/ui/data-node";
import { ContentRow } from "@/lib/ui2/content-row";
import { FactRow } from "@/lib/ui2/fact-row";
import { QuietNote } from "@/lib/ui2/quiet-note";
import { SectionLabel } from "@/lib/ui2/section-label";
import { StanceValue } from "@/lib/ui2/stance-value";
import { PathRow, PathTrace, RecordRow, ScoreColumn, ScoreOrigin } from "./trace-parts";

/** The four levels' one prefix (nodes.json, round 7). */
const NODE: DataNode = { path: "feedEntry" };
const at = (tail: string): DataNode => part(NODE, tail);

const MOVED_ON = "The paths that carried it here have moved on.";
const STILL_SETTLING = "Still settling — its paths count once it lands.";
const OFFLINE = "Can't reach the server. Check your connection and try again.";
const FAULT = "That didn't go through. Try again.";

const TITLES = {
  entry: "Why this reached you",
  path: "One path",
  step: "One step",
  records: "What landed",
} as const;

/** The trace's people and words, read against the held answer. */
type Answered = Extract<TraceRead, { kind: "answered" }>;

function contextOf(read: Answered, reader: string | null, kind: TraceThingKind, cover: TraceCover | null, now: number): TraceContext {
  return {
    viewer: read.viewer,
    borrowed: read.viewer !== reader,
    named: read.nodes.named,
    targetKind: kind,
    targetCreatedAt: cover?.createdAt ?? null,
    now,
  };
}

/** The lender's handle under a borrowed view, read off the hydrated rows. */
function lenderOf(read: Answered): string | null {
  const named = read.nodes.named.get(read.viewer);
  return named?.kind === "person" ? named.person.handle : null;
}

/**
 * The open's one fetch: the viewer the figure was computed in (or, arriving
 * cold, the feed's own viewer — the borrowed vantage, else the reader), the
 * live trace, then one batch hydrating its people and things.
 */
async function readTrace(
  client: ReturnType<typeof useApolloClient>,
  open: TraceOpen,
  reader: string | null,
): Promise<Outcome<Answered | null>> {
  let viewer = open.viewer ?? heldViewer(reader);
  if (viewer === null) {
    const borrowed = await fetchBorrowedView(client);
    if (borrowed.kind !== "success") return borrowed;
    viewer = borrowed.value?.id ?? reader;
  }
  if (viewer === null) return success(null);
  const traced = await fetchFeedTrace(client, viewer, open.targetId);
  if (traced.kind !== "success") return traced;
  if (traced.value === null) return success(null);
  const answer = traced.value;
  // WHAT THE FETCH FOUND IS ADOPTED, number or dash (FeedKinds.md:11), on
  // every surface that draws this thing — never moving a row.
  adoptTrace(open.targetId, answer.score);
  const ids = new Set<string>([viewer]);
  if (open.cover === null) ids.add(open.targetId);
  // The held thing is "held, not re-read" (score-readout §7): only a cold
  // arrival, with no cover handed, hydrates it.
  for (const path of answer.paths) {
    for (const node of path.nodes) {
      if (node.id !== null && (node.id !== open.targetId || open.cover === null)) ids.add(node.id);
    }
  }
  const nodes = await fetchTraceNodes(client, [...ids]);
  if (nodes.kind !== "success") return nodes;
  return success({ kind: "answered", viewer, answer, nodes: nodes.value });
}

export function TraceView({ address, level }: { address: TraceAddress; level: TraceLevel }) {
  const client = useApolloClient();
  const router = useRouter();
  const reader = useScoreReader();
  // The open the tap began, or a fresh one for a cold arrival — read once:
  // the levels are one mount, and the held answer outlives it (`trace-session.ts`).
  const [open] = useState(() => openTrace(address.targetId));
  const [read, setRead] = useState<TraceRead>(open.read);
  const [unfolded, setUnfolded] = useState(false);
  const [now] = useState(() => Date.now());

  const run = useCallback(() => {
    open.read = { kind: "loading" };
    setRead(open.read);
    void readTrace(client, open, reader).then((outcome) => {
      open.read =
        outcome.kind === "success"
          ? (outcome.value ?? { kind: "failed", offline: false })
          : // NO ANSWER reads the connection line; an answer that is an error
            // (the relay's INTERNAL — the ranker down) reads the house's
            // "didn't go through" (copy-voice; score-readout §5.6).
            {
              kind: "failed",
              offline: outcome.kind === "failed" && !CombinedGraphQLErrors.is(outcome.cause),
            };
      setRead(open.read);
    });
  }, [client, open, reader]);

  useEffect(() => {
    // NO FETCH FOR A THING STILL SETTLING (FeedEntryMoved.md:9), and none for
    // a level the held answer already serves (CD-SR2).
    if (address.settling || open.read.kind !== "idle") return;
    run();
  }, [address.settling, open, run]);

  const answered = read.kind === "answered" ? read : null;
  const cover = open.cover ?? answered?.nodes.covers.get(address.targetId) ?? null;
  const figure = address.settling ? DASH : answered === null ? undefined : flagFigure(answered.answer.score);
  const context = answered === null ? null : contextOf(answered, reader, address.kind, cover, now);
  const paths = answered?.answer.paths ?? [];
  const href = (next: TraceLevel) => traceHref(address, next);

  // A DEEPER LEVEL NAMES A PATH OR A STEP THE ANSWER HOLDS; one it does not
  // (a stale link) reads as level one.
  const path = level.kind === "entry" ? undefined : paths[level.path - 1];
  const steps = path === undefined ? [] : stepsOf(path);
  const step = level.kind === "step" || level.kind === "records" ? steps[level.step - 1] : undefined;
  const shown: TraceLevel =
    answered === null || path === undefined
      ? { kind: "entry" }
      : (level.kind === "step" || level.kind === "records") && step === undefined
        ? { kind: "path", path: level.path }
        : level;

  const back =
    shown.kind === "entry"
      ? traceBack(address.origin)
      : shown.kind === "path"
        ? { href: href({ kind: "entry" }), label: "Back to the paths" }
        : shown.kind === "step"
          ? { href: href({ kind: "path", path: shown.path }), label: "Back to the path" }
          : { href: href({ kind: "step", path: shown.path, step: shown.step }), label: "Back to the step" };

  const end = { kind: address.kind, src: cover?.markSrc ?? null, name: cover?.title ?? "" };

  return (
    <main className="flex flex-1 flex-col pb-4">
      <PageHeader title={TITLES[shown.kind]} backHref={back.href} backLabel={back.label} node={at("header")} />
      <ScoreColumn>
        <ScoreOrigin cover={cover} figure={figure} node={at("origin")} />
        {address.settling ? (
          <QuietNote node={at("note")}>{STILL_SETTLING}</QuietNote>
        ) : read.kind === "failed" ? (
          // THE FAULT (SR-G16's build reading, §5.6): the house line and its
          // way back, under a cover that stands — never a substituted figure.
          <div className="flex items-center gap-3">
            <p role="alert" data-testid="feedEntry-fault" className="text-body-medium text-error">
              {read.offline ? OFFLINE : FAULT}
            </p>
            <Button testId="feedEntry-retry" variant="outline" size="sm" onClick={run}>
              Retry
            </Button>
          </div>
        ) : answered === null || context === null ? (
          <p role="status" aria-live="polite" className="sr-only">
            Loading…
          </p>
        ) : paths.length === 0 ? (
          // NO PATHS: the moved-on line, no action, no empty state (FeedEntryMoved.md:3, :11).
          <QuietNote node={at("note")}>{MOVED_ON}</QuietNote>
        ) : shown.kind === "entry" ? (
          <EntryLevel
            paths={paths}
            context={context}
            lender={lenderOf(answered)}
            unfolded={unfolded}
            onUnfold={() => setUnfolded(true)}
            levelOneOf={() => levelOne(answered.answer, unfolded)}
            href={href}
            end={end}
          />
        ) : shown.kind === "path" ? (
          <PathLevel
            path={path!}
            index={shown.path}
            value={pathValue(answered.answer, shown.path - 1)}
            context={context}
            href={href}
            end={end}
          />
        ) : shown.kind === "step" ? (
          <StepLevel
            path={path!}
            steps={steps}
            place={shown.step}
            context={context}
            end={end}
            onRecords={() => router.push(href({ kind: "records", path: shown.path, step: shown.step }))}
          />
        ) : (
          <RecordsLevel path={path!} step={step!} context={context} />
        )}
      </ScoreColumn>
    </main>
  );
}

type End = { kind: TraceThingKind; src: string | null; name: string };

function EntryLevel({
  paths,
  context,
  lender,
  unfolded,
  onUnfold,
  levelOneOf,
  href,
  end,
}: {
  paths: readonly TracePath[];
  context: TraceContext;
  lender: string | null;
  unfolded: boolean;
  onUnfold: () => void;
  levelOneOf: () => ReturnType<typeof levelOne>;
  href: (level: TraceLevel) => string;
  end: End;
}) {
  const { drawn, more } = levelOneOf();
  const moreWords = more === null ? null : morePathsWords(more.count);
  return (
    <>
      <QuietNote node={at("note")}>{levelOneNote(context, lender)}</QuietNote>
      <SectionLabel node={at("pathsLabel")}>Strongest first</SectionLabel>
      <div className="flex flex-col gap-2">
        {drawn.map(({ index, value }) => {
          const path = paths[index]!;
          const row: DataNode = { path: "feedEntry.path", key: String(index + 1) };
          return (
            <PathRow
              key={index}
              href={href({ kind: "path", path: index + 1 })}
              node={row}
              through={throughLine(path, context)}
              value={value}
              trace={
                <PathTrace
                  people={pathPeople(path, context)}
                  end={end}
                  spoken={spokenTrace(path, context)}
                  node={part(row, "trace")}
                />
              }
            />
          );
        })}
        {/* THE QUIET ROW: a state change on this screen, not a fifth
            destination — the weakest paths unfold in place, never on a
            second page (FeedEntry.md:17). */}
        {more !== null && moreWords !== null && !unfolded && (
          <button
            type="button"
            aria-label={moreWords.name}
            onClick={onUnfold}
            data-testid="feedEntry.morePaths"
            className="cg-state cg-focus cg-hit flex min-h-12 w-full items-center gap-2 border-0 bg-transparent px-3 text-left text-label-small text-on-surface-variant"
          >
            <span aria-hidden="true" className="flex-1" data-testid="feedEntry.morePaths.label">
              {moreWords.label}
            </span>
            <span
              aria-hidden="true"
              className="flex-none text-body-small text-on-surface [font-weight:500]"
              data-testid="feedEntry.morePaths.value"
            >
              {more.value}
            </span>
          </button>
        )}
      </div>
    </>
  );
}

function PathLevel({
  path,
  index,
  value,
  context,
  href,
  end,
}: {
  path: TracePath;
  index: number;
  value: string;
  context: TraceContext;
  href: (level: TraceLevel) => string;
  end: End;
}) {
  const steps = stepsOf(path);
  return (
    <>
      <div className="flex justify-center py-1">
        <PathTrace
          people={pathPeople(path, context)}
          end={end}
          spoken={spokenTrace(path, context)}
          size={32}
          node={at("trace")}
        />
      </div>
      {/* THE FACTS STAND BEFORE THE STEPS; no step carries a number (RankPath.md:3-5). */}
      <div className="flex flex-col">
        <FactRow label="What it adds" value={value} node={at("adds")} />
        <FactRow label="Newest opinion on it" value={pathNewest(path, context)} last node={at("newest")} />
      </div>
      <SectionLabel node={at("stepsLabel")}>The steps</SectionLabel>
      <div className="flex flex-col gap-2">
        {steps.map((step, place) => {
          const hop = carryingHop(step);
          return (
            <ContentRow
              key={place}
              variant="chronicle"
              disc={{ kind: "face", pDirected: hop.pDirected, pInterest: hop.pInterest }}
              title={stepTitle(path, step, context)}
              second={stepSecondLine(path, step, context)}
              trailing={stepAge(path, step, context)}
              href={href({ kind: "step", path: index, step: place + 1 })}
              node={{ path: "feedEntry.step", key: String(place + 1) }}
              testId={`feedEntry-step-${place + 1}`}
            />
          );
        })}
      </div>
    </>
  );
}

function StepLevel({
  path,
  steps,
  place,
  context,
  end,
  onRecords,
}: {
  path: TracePath;
  steps: readonly TraceStep[];
  place: number;
  context: TraceContext;
  end: End;
  onRecords: () => void;
}) {
  const step = steps[place - 1]!;
  const hop = carryingHop(step);
  const title = stepTitle(path, step, context);
  const people = stepPeople(path, step, context);
  return (
    <>
      <div className="flex justify-center py-1">
        <PathTrace
          people={people}
          end={end}
          spoken={spokenPeople(people, context)}
          size={32}
          node={at("trace")}
        />
      </div>
      <QuietNote node={at("note")}>{placeNote(title, place, steps.length)}</QuietNote>
      <div className="flex flex-col">
        <FactRow
          label="What carries it"
          value={<StanceValue pDirected={hop.pDirected} pInterest={hop.pInterest} node={at("carries.value")} />}
          node={at("carries")}
        />
        <FactRow
          label="Behind it"
          value={opinionsCount(hop.records.length)}
          action="Show them"
          onAction={onRecords}
          node={at("behind")}
        />
        <FactRow label="Newest of them" value={hopNewest(hop, context.now)} last node={at("newest")} />
      </div>
      <QuietNote node={at("foldNote")}>{foldNote(path, step, context)}</QuietNote>
    </>
  );
}

function RecordsLevel({ path, step, context }: { path: TracePath; step: TraceStep; context: TraceContext }) {
  const hop = carryingHop(step);
  const title = stepTitle(path, step, context);
  const pairs = memberPairs(path, step);
  const sum = memberSum(path, step);
  return (
    <>
      <QuietNote node={at("note")}>{recordsNote(title, pairs.length)}</QuietNote>
      <div className="flex flex-col gap-2">
        {pairs.map(({ record, pDirected, pInterest }) => (
          <RecordRow
            key={record.id}
            record={record}
            // A RECORD SAYS WHAT IT IS IN ITS STEP'S OWN TITLE (RankRecords.md:11).
            what={title}
            when={recordAge(record, context.now)}
            pair={{ pDirected, pInterest }}
            node={at("record")}
          />
        ))}
      </div>
      {sum.clipped && (
        <>
          <QuietNote testId="feedEntry-clipped">{CLIPPED_RECORDS}</QuietNote>
          {/* THE UNCLIPPED SUM BESIDE THE STEP'S PAIR, in exact values only
              (RankRecords.md:9): a `cg-exact` line, spoken in both modes. */}
          <p className="m-0 text-label-small text-on-surface-variant" data-testid="feedEntry-unclippedSum">
            <span aria-hidden="true" className="cg-exact">
              {formatStancePair({ pDirected: sum.pDirected, pInterest: sum.pInterest })} →{" "}
              {formatStancePair({ pDirected: hop.pDirected, pInterest: hop.pInterest })}
            </span>
            <span className="sr-only">
              The records add up to {formatStancePair({ pDirected: sum.pDirected, pInterest: sum.pInterest })}; the
              step carries {formatStancePair({ pDirected: hop.pDirected, pInterest: hop.pInterest })}.
            </span>
          </p>
        </>
      )}
      <QuietNote node={at("closingNote")}>{PUBLIC_SUM_LINE}</QuietNote>
    </>
  );
}
