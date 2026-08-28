// The list row — ONE row shape across every node kind.
//
// The reference row of the details screen, the topics-and-references sheet, and
// (later) search's results are the same drawing: a LEADING MARK, a name, and
// what the row carries at its end. Keeping them one component is the point —
// the moment a row appears on a second surface, a copy is never the answer.
//
// THE LEADING MARK SAYS THE KIND, without a word beside it: a person keeps
// their avatar, a media post its cover, a text post the letter T as a tile, a
// topic its #, and the rest carry their node-type glyphs. The mark is
// `aria-hidden` and the kind is carried in text instead — a glyph alone is not
// a label.

import type { ReactNode } from "react";

export function ListRow({
  mark,
  title,
  // The kind, in words. Read by everyone; it is also what makes the leading
  // mark decorative rather than load-bearing.
  kind,
  trailing,
  testId,
  onOpen,
  onDismiss,
  dismissLabel,
}: {
  mark: ReactNode;
  title: string;
  kind: string;
  trailing?: ReactNode;
  testId?: string;
  onOpen?: () => void;
  onDismiss?: () => void;
  dismissLabel?: string;
}) {
  const body = (
    <>
      <span aria-hidden="true" className="flex-none">
        {mark}
      </span>
      <span className="flex min-w-0 flex-1 flex-col text-left">
        <span className="truncate text-body-medium text-on-surface">{title}</span>
        <span className="text-body-small text-on-surface-variant">{kind}</span>
      </span>
      {trailing}
    </>
  );

  return (
    <div
      data-testid={testId}
      className="flex min-h-12 items-center gap-2 rounded-small bg-surface-container-highest px-3 py-2"
    >
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="cg-state cg-focus flex min-w-0 flex-1 items-center gap-2 rounded-small text-left"
        >
          {body}
        </button>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-2">{body}</span>
      )}
      {onDismiss && (
        <button
          type="button"
          data-testid={testId ? `${testId}-dismiss` : undefined}
          aria-label={dismissLabel ?? `Remove ${title}`}
          onClick={onDismiss}
          className="cg-state cg-focus cg-hit relative flex-none rounded-full text-on-surface-variant"
        >
          <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" aria-hidden="true">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>
      )}
    </div>
  );
}

// The stance pair a row carries at its end, as the canvas draws it: the face,
// then the numbers. The face is `aria-hidden` and the pair is spelled for
// assistive technology — an emoji's own accessible name is "slightly smiling
// face", which says nothing about a stance, and colour or glyph alone may never
// carry the meaning.
export function StancePair({
  face,
  reading,
  forAgainst,
  reaches,
}: {
  face: string;
  // The anchor's words, e.g. "Like this".
  reading: string;
  forAgainst: number;
  reaches: number;
}) {
  const signed = (value: number) => `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(2)}`;
  return (
    <span className="flex flex-none items-baseline gap-1">
      <span aria-hidden="true" className="text-body-medium">
        {face}
      </span>
      <span aria-hidden="true" className="text-body-small whitespace-nowrap text-on-surface-variant">
        {signed(forAgainst)} / {signed(reaches)}
      </span>
      <span className="sr-only">
        {reading}, For or against {signed(forAgainst)}, How much reaches you {signed(reaches)}
      </span>
    </span>
  );
}
