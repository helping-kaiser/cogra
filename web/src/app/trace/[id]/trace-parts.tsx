// THE TRACE'S GLUE PARTS (`_shared.jsx`: ScoreOrigin, PathTrace, PathRow,
// PathSummary, StepSummary, ActionLog, ScoreColumn). They are not masters —
// the score readout builds them inside its own feature, never in the shared
// library (score-readout §6) — and every row that IS a master stays one:
// QuotedRow, ContentRow, FactRow, StanceValue.
//
// THE REGISTER IS GRAPH, PATHS, CONNECTIONS — never statistics: faces and
// rows, a trace of avatars for a path's shape, ages on the ladder. No bar, no
// meter, no percentage and no trend anywhere here (FeedEntry.md:19).

import Link from "next/link";
import type { ReactNode } from "react";

import { NodeMark } from "@/lib/ui/node-mark";
import { Icon } from "@/lib/ui/icons";
import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { MonogramAvatar } from "@/lib/ui2/monogram-avatar";
import { QuotedRow } from "@/lib/ui2/quoted-row";
import { StanceValue } from "@/lib/ui2/stance-value";
import type { TraceCover } from "@/lib/score/cover";
import type { TracePerson, TraceRecord, TraceThingKind } from "@/lib/score/trace-model";

/** The drill-down's column: the read surface's own gutter (`ScoreColumn`). */
export function ScoreColumn({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 flex-col gap-3 px-4 pt-2">{children}</div>;
}

/**
 * THE THING THE SCORE BELONGS TO, carried on all four levels (`ScoreOrigin`):
 * the flag — the `graph` glyph and the signed figure, spoken `Feed score` —
 * hung on the held thing's top-left as one entity. Plain text, never a door:
 * the reader is standing inside the explanation. `figure` undefined draws the
 * flag bare (the fetch has not answered, or it failed — no figure is ever
 * substituted, score-readout §5.6).
 */
export function ScoreOrigin({ cover, figure, node }: { cover: TraceCover | null; figure?: string; node: DataNode }) {
  const quote = part(node, "quote");
  return (
    <div className="flex flex-col" {...testAttributes(node)}>
      <span
        className="inline-flex items-center gap-1.5 self-start rounded-t-small bg-surface-container-high px-2.5 py-0.5 text-body-small text-on-surface-variant"
        {...testAttributes(part(node, "flag"))}
      >
        <Icon name="graph" size={16} />
        <span className="sr-only">Feed score</span>
        {figure !== undefined && (
          <span className="text-on-surface [font-weight:500]" {...testAttributes(part(node, "flag.value"))}>
            {figure}
          </span>
        )}
      </span>
      {cover === null ? (
        <div className="min-h-14 rounded-small rounded-tl-none bg-surface-container-highest" />
      ) : (
        <QuotedRow
          attach
          title={cover.title}
          snippet={cover.snippet}
          name={cover.disc?.name}
          src={cover.disc?.src}
          mark={cover.disc === null ? <NodeMark kind="topic" onCard node={part(quote, "disc")} /> : undefined}
          node={quote}
        />
      )}
    </div>
  );
}

/** The reached thing in its own mark: a post's tile, a comment's glyph, a person's circle, a tag's `#`. */
function EndMark({
  kind,
  src,
  name,
  size,
  onCard,
}: {
  kind: TraceThingKind;
  src: string | null;
  name: string;
  size: number;
  onCard: boolean;
}) {
  if (kind === "person") return <MonogramAvatar name={name} src={src} size={size} />;
  const mark = kind === "topic" ? "topic" : kind === "comment" ? "comment" : "post";
  return <NodeMark kind={mark} src={src} size={size} onCard={onCard} />;
}

function Hairline() {
  return <span aria-hidden="true" className="h-px w-3.5 flex-none bg-outline-variant" />;
}

/**
 * A PATH'S SHAPE (`PathTrace`): the people it runs through, in order, ending
 * on the thing it reached. The faces are decorative; the trace speaks its
 * own line (`spoken`), kind-neutral, ending `then what reached you`.
 */
export function PathTrace({
  people,
  end,
  spoken,
  size = 24,
  onCard = false,
  node,
}: {
  /** On a path row's card ground the end tile takes the darker tone (`NodeMark`'s `onCard`). */
  onCard?: boolean;
  people: readonly (TracePerson | null)[];
  end: { kind: TraceThingKind; src: string | null; name: string };
  spoken: string;
  size?: number;
  node?: DataNode;
}) {
  return (
    <span className="inline-flex items-center" {...testAttributes(node)}>
      {people.map((person, index) => (
        <span key={`${person?.id ?? "gone"}-${index}`} aria-hidden="true" className="inline-flex items-center">
          {index > 0 && <Hairline />}
          {person === null ? (
            <MonogramAvatar name="" redacted size={size} />
          ) : (
            <MonogramAvatar name={person.displayName ?? person.handle} src={person.avatarUrl} size={size} />
          )}
        </span>
      ))}
      <span aria-hidden="true" className="inline-flex items-center">
        <Hairline />
        <EndMark {...end} size={size} onCard={onCard} />
      </span>
      <span className="sr-only">{spoken}</span>
    </span>
  );
}

/**
 * One path on the list (`PathRow`): `ContentRow`'s geometry with the trace
 * where the disc would be — the card ground, the medium corner, the 12px
 * padding, the chevron that says this opens another surface.
 */
export function PathRow({
  href,
  trace,
  through,
  value,
  node,
}: {
  href: string;
  trace: ReactNode;
  through: string;
  value: string;
  node: DataNode;
}) {
  return (
    <Link
      href={href}
      {...testAttributes(node)}
      className="cg-state cg-focus flex w-full items-center gap-3 rounded-medium bg-surface-container-highest p-3 text-left text-on-surface"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        {trace}
        <span
          className="overflow-hidden text-ellipsis whitespace-nowrap text-label-small text-on-surface-variant"
          {...testAttributes(part(node, "through"))}
        >
          {through}
        </span>
      </span>
      <span className="flex-none text-body-small [font-weight:500]" {...testAttributes(part(node, "value"))}>
        {value}
      </span>
      <span aria-hidden="true" className="inline-flex flex-none text-on-surface-variant" {...testAttributes(part(node, "chevron"))}>
        <Icon name="chevron_right" size={18} />
      </span>
    </Link>
  );
}

/** One record behind a step (`ActionLog`): inert, its key in mono with no copy control. */
export function RecordRow({
  record,
  what,
  when,
  pair,
  node,
}: {
  record: TraceRecord;
  what: string;
  when: string;
  pair: { pDirected: number; pInterest: number };
  node: DataNode;
}) {
  // KEYED BY THE KEY IT PRINTS (nodes.json: "the record's key, as the row prints it").
  const self: DataNode = { path: node.path, key: record.id };
  return (
    <div className="flex flex-col gap-1 rounded-medium bg-surface-container-highest p-3" {...testAttributes(self)}>
      <span className="flex items-baseline gap-2">
        <span
          className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-label-large"
          {...testAttributes(part(self, "what"))}
        >
          {what}
        </span>
        <span className="flex-none text-label-small text-on-surface-variant" {...testAttributes(part(self, "when"))}>
          {when}
        </span>
      </span>
      <span className="flex items-center gap-2">
        <span className="flex-none">
          <StanceValue pDirected={pair.pDirected} pInterest={pair.pInterest} node={part(self, "pair")} />
        </span>
        <span
          className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-right font-mono text-label-small text-on-surface-variant"
          {...testAttributes(part(self, "key"))}
        >
          {record.id}
        </span>
      </span>
    </div>
  );
}
