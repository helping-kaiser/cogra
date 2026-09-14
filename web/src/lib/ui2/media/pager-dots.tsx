// THE PAGER'S POSITION MARKER, windowed (design/backlog.md item 67, ruled
// 2026-09-14; drawn as `PagerDots` in
// `design/components/media/MediaAttachment.jsx:296-394`).
//
// ONE ROW SERVES BOTH PAGERS. The card and the viewer page the same set with
// the same gesture, "so a marker that windowed in one and ran long in the other
// would be two vocabularies for one position" (`:300-302`). The master keeps
// the machinery in `MediaAttachment.jsx` only because the viewer already
// imports from there and the reverse import would be a cycle; on this side
// there is no cycle to dodge, so the row gets its own module and both pagers
// import it.
//
// A ROW THAT GROWS WITH THE SET STOPS BEING A POSITION MARKER (`:307-311`).
// "Ten dots at 12px of pitch is a ruler, and a reader counting rungs is doing
// the work the marker exists to save." So the row has a CEILING of seven slots
// and past it is a WINDOW onto the set rather than a picture of it.
//
// THE WINDOW SLIDES, CENTRED ON WHERE THE READER IS (`:313-316`): its start is
// the current index less half the window, clamped to the set's two ends, so the
// active dot travels to the middle and stays there while the row moves under
// it, and at either end the window parks so the last dot can be reached.
//
// AN EDGE DOT WITH MORE BEYOND IT IS SMALLER (`:318-324`) — "a shrunk dot at
// the edge reads as 'the set keeps going this way', where a full one reads as
// 'this is the end'". One smaller size and not a ladder of them, and THE ACTIVE
// DOT IS NEVER THE SHRUNK ONE: the clamp keeps it off an overflowing edge.
//
// EVERY SLOT KEEPS ITS PITCH (`:326-328`). The dot is centred in a slot the
// size of a full dot, so shrinking one moves nothing beside it.
//
// THE COUNT IS NOT DRAWN (`:330-332`): the plain "Picture n of m" stays in the
// accessible name.

/** The ceiling — seven slots, "the same bound the pattern this copies uses"
 * (`MediaAttachment.jsx:338` — `const DOT_WINDOW = 7`). */
export const DOT_WINDOW = 7;

/** `const DOT_FULL = 6` (`:339`). It is the slot's size as well as the dot's,
 * which is what keeps the pitch at 12px whatever a dot inside it does. */
export const DOT_FULL = 6;

/** `const DOT_EDGE = 4` (`:340`) — the one smaller size. */
export const DOT_EDGE = 4;

/**
 * TWO TONES, ONE ROW (`MediaAttachment.jsx:334-337`).
 *
 * On a card the dots are the page's own ink — `primary` for here, the hairline
 * for the rest, and no filter. Over the viewer's black there is no surface to
 * borrow from, so they are white and carry a drop shadow, "because a 6px dot on
 * an unknown photograph needs one to stay visible".
 */
const TONES = {
  card: { on: "var(--primary)", off: "var(--border-hairline)", filter: "none" },
  viewer: {
    on: "#fff",
    off: "rgba(255,255,255,0.42)",
    filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))",
  },
} as const;

export type DotTone = keyof typeof TONES;

/**
 * Which slots the window shows, given where the reader is.
 *
 * Exported because it is the whole of the ruling that can be asserted without a
 * renderer: the clamp is what keeps the active dot off an overflowing edge, and
 * that is the claim worth pinning.
 */
export function dotWindow(
  count: number,
  current: number,
): { start: number; window: number; moreBefore: boolean; moreAfter: boolean } {
  const window = Math.min(count, DOT_WINDOW);
  // `window >> 1` is the master's own half (`MediaAttachment.jsx:351`): three
  // for a seven-slot row, so the active dot sits in the middle slot.
  const start = Math.max(0, Math.min(current - (window >> 1), count - window));
  return { start, window, moreBefore: start > 0, moreAfter: start + window < count };
}

export function PagerDots({
  count,
  current,
  tone = "card",
  testId,
}: {
  count: number;
  current: number;
  tone?: DotTone;
  testId?: string;
}) {
  // "if (count < 2) return null" (`MediaAttachment.jsx:348`): one picture has
  // no position to mark.
  if (count < 2) return null;

  const palette = TONES[tone];
  const { start, window, moreBefore, moreAfter } = dotWindow(count, current);

  return (
    <div
      data-testid={testId}
      // Live, so a swipe says where it landed to a reader who cannot see the
      // dots move — the row is the only readout either pager draws.
      aria-live="polite"
      aria-label={`Picture ${current + 1} of ${count}`}
      className="flex items-center justify-center"
      style={{ gap: `${DOT_FULL}px`, filter: palette.filter }}
    >
      {Array.from({ length: window }, (_, offset) => {
        const index = start + offset;
        const edge = (offset === 0 && moreBefore) || (offset === window - 1 && moreAfter);
        const size = edge ? DOT_EDGE : DOT_FULL;
        return (
          <span
            key={index}
            aria-hidden="true"
            data-testid={testId ? `${testId}-slot-${index}` : undefined}
            // THE SLOT, always a full dot wide: shrinking the dot inside it
            // moves nothing beside it.
            className="grid place-items-center"
            style={{ width: `${DOT_FULL}px`, height: `${DOT_FULL}px` }}
          >
            <span
              data-testid={testId ? `${testId}-dot-${index}` : undefined}
              data-active={index === current ? "true" : undefined}
              className="rounded-full"
              style={{
                width: `${size}px`,
                height: `${size}px`,
                background: index === current ? palette.on : palette.off,
              }}
            />
          </span>
        );
      })}
    </div>
  );
}
