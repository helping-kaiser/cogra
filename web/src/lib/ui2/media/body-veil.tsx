"use client";

// The sensitive veil — ONE state over the whole body.
//
// GRANULARITY (D12, jakob 2026-08-28): the body region blurs as a unit — the
// media, the text body, and the description together — and the TITLE STAYS
// OUTSIDE IT, so choosing to look is an informed choice rather than a blind
// one. This deliberately reverses the earlier per-field/per-attachment reading
// in design/readme.md §12 and moderation.md, which had one image in a gallery
// veiling alone: that was ruled out as "ui hell". The doc write-back is lane
// E's; this component is the ruled behaviour.
//
// So this is a WRAPPER a screen puts around its body region, not a property of
// a tile. One reveal answers for everything inside, because the reader has
// already made the decision and asking again per item turns one decision into
// five.
//
// The content stays MOUNTED under the veil and keeps its exact space, so
// revealing moves nothing on screen. That is also why text is blurred in place
// rather than replaced.
//
// No `error` colouring and no warning glyph: a neutral wash of the standard
// scrim and a plain `visibility` chip. A veiled post is not a failure.

import { createContext, useContext, useState, type CSSProperties, type ReactNode } from "react";

/**
 * Whether the nearest enclosing `BodyVeil` currently veils this subtree.
 *
 * The content stays MOUNTED under the blur (see above), so a media surface
 * inside it needs its own signal to know it must not claim the playback
 * stage or draw its sound disc behind the veil — not being unmounted is not
 * the same as being allowed to play (design/readme.md, backlog item 103:
 * "a veiled clip sits fully out of the stage rotation — no playback, no
 * sound-disc presence — because the veil is the reader's declared
 * not-yet"). Read via `useVeiled()`; consumers outside any `BodyVeil` see
 * `false`, the unveiled default.
 */
export const VeilContext = createContext(false);

/**
 * WHOSE MARK THIS IS (`SensitiveVeil.jsx` `SOURCES`, Q47): the author's own
 * warning and the platform's verdict are two independent states that read back
 * as the same veil, so every face says which one a reader met — unconditionally,
 * because an unnamed source would read as the other one.
 */
export type VeilSource = "author" | "platform" | "both";

export const VEIL_SOURCES: Readonly<Record<Exclude<VeilSource, "both">, string>> = {
  author: "The author's warning",
  platform: "The platform's verdict",
};

/**
 * BOTH MARKS NAME BOTH (round 27, seam 253; `SensitiveVeil.jsx`
 * `sensitiveSourceLine`): the two states are independent and the veil is
 * their OR, so where both stand the line reads the author's warning first,
 * with its reason, then the verdict in the edit's blessed words, its own
 * reason after an em dash — `The author's warning — A dead seabird in the
 * second frame. Also veiled by the platform's verdict`. The wire does not
 * name the case yet (the `sensitiveSource` + `verdictReason` ask, contract
 * bite B-C1), so `veilSource` never answers `both` today: a client reads the
 * author's line alone until it does.
 */
export const ALSO_VEILED_BY_THE_VERDICT = "Also veiled by the platform's verdict";

/** The face's second line: the source, and the reason after it where there is one. */
export function veilSourceLine(source: VeilSource, reason?: string | null, verdictReason?: string | null): string {
  if (source === "both") {
    const own = reason ? `${VEIL_SOURCES.author} — ${reason}` : VEIL_SOURCES.author;
    const stop = /[.!?]$/.test(own) ? "" : ".";
    return `${own}${stop} ${ALSO_VEILED_BY_THE_VERDICT}${verdictReason ? ` — ${verdictReason}` : ""}`;
  }
  return reason ? `${VEIL_SOURCES[source]} — ${reason}` : VEIL_SOURCES[source];
}

/** The nearest enclosing `BodyVeil`'s state, or `false` outside one. */
export function useVeiled(): boolean {
  return useContext(VeilContext);
}

/** Which face the veil wears (`SensitiveVeil.jsx` `kind`). */
export type VeilFace = "media" | "text" | "compact";

/** The wash every veil face wears: the standard covering scrim at half strength, never an error colour. */
const WASH = "color-mix(in oklab, var(--scrim-dialog) 55%, transparent)";

export function BodyVeil({
  children,
  face = "media",
  source = "author",
  // The author's own reason, when they gave one. It follows the source on the
  // veil so the reader's choice is informed.
  reason,
  named = true,
  label = "Sensitive — tap to view",
  revealLabel = "Show",
  revealed: controlled,
  onReveal,
  radius = "var(--radius-medium)",
  testId = "body-veil",
}: {
  children: ReactNode;
  /**
   * THE FACE (`SensitiveVeil.jsx`): `media` lies over a post's pictures or
   * clip, the words centred on the wash; `compact` is a comment's one block,
   * words and pictures together, in the theme's type; `text` blurs words in
   * place with their `Show`.
   */
  face?: VeilFace;
  /** Whose mark this is (`veilSource`). */
  source?: VeilSource;
  reason?: string | null;
  /**
   * A text veil names its source only where it is the post's ONLY face — a
   * words-only post (FeedWordsSensitive.md); words under a veiled clip leave
   * the line to that clip's face, once per post (LadderStates.md). The media
   * and compact faces always name it (Q47: unconditional).
   */
  named?: boolean;
  label?: string;
  revealLabel?: string;
  // A screen that remembers the decision across a navigation drives it; a lone
  // body governs itself.
  revealed?: boolean;
  onReveal?: () => void;
  radius?: string;
  testId?: string;
}) {
  const [local, setLocal] = useState(false);
  const revealed = controlled ?? local;

  const reveal = (event: { preventDefault: () => void; stopPropagation: () => void }) => {
    // The veil is a decision, not a route: tapping it must not also open the
    // post it sits in.
    event.preventDefault();
    event.stopPropagation();
    if (onReveal) onReveal();
    else setLocal(true);
  };

  // THE SOURCE LINE (Q47; LadderStates.md, round 26: "on every veil that
  // stands"): whose mark, the reason after it where there is one.
  const sourceLine = veilSourceLine(source, reason);
  const body = <VeilContext.Provider value={!revealed}>{children}</VeilContext.Provider>;

  // REVEALING MOVES NOTHING — NOT EVEN IN THE TREE. The body stands at one
  // place in the tree veiled or not: revealed, the wrappers stay but draw
  // no box of their own (`display: contents` — "the element itself does not
  // generate any boxes, but its children … generate boxes as normal",
  // https://developer.mozilla.org/en-US/docs/Web/CSS/display#contents), so the
  // body lays out exactly as if it stood bare. A body that moved in the tree
  // would REMOUNT on the reveal: a clip under the veil would come back as a
  // new element — its preloaded frame dropped, its place on the stage given up
  // and asked for again — where "the unveil is an eligibility change, not a
  // suspension lift" and preloading under the veil "makes the unveil instant"
  // (design/readme.md §13, the stage law). Every face keeps one shape for
  // that: its wrappers, then the body's own wrapper, then the body.

  if (face === "text") {
    // TEXT IS BLURRED IN PLACE (`SensitiveVeil kind="text"`): the words keep
    // their own height, so nothing below moves on the reveal, and the shape of
    // the sentence stays visible — the reader can see there is one, only not
    // read it. `Show` stands beside the words; the source line, where this is
    // the post's only face, stands under them (FeedWordsSensitive.md).
    return (
      <div
        data-testid={revealed ? undefined : testId}
        style={revealed ? CONTENTS : undefined}
        className={revealed ? undefined : "flex min-w-0 flex-col gap-1"}
      >
        <div style={revealed ? CONTENTS : undefined} className={revealed ? undefined : "flex min-w-0 items-baseline gap-2"}>
          <div
            aria-hidden={revealed ? undefined : "true"}
            style={revealed ? CONTENTS : { filter: "blur(6px)", opacity: 0.75 }}
            className={revealed ? undefined : "min-w-0 flex-1 select-none"}
          >
            {body}
          </div>
          {!revealed && (
            <button
              type="button"
              data-testid={`${testId}-reveal`}
              onClick={reveal}
              className="cg-state cg-focus cg-hit flex-none cursor-pointer border-0 bg-transparent p-0 font-sans text-[length:var(--text-label-small)] [font-weight:400] [line-height:normal] text-on-surface-variant underline"
            >
              {revealLabel}
            </button>
          )}
        </div>
        {!revealed && named && (
          <span data-testid={`${testId}-source`} className="text-label-small text-on-surface-variant [text-wrap:pretty]">
            {sourceLine}
          </span>
        )}
      </div>
    );
  }

  if (face === "compact") {
    // THE COMMENT-SCALE FACE (`SensitiveVeil kind="compact"`): a comment is
    // words first and its pictures join them, so ONE block stands in the
    // body's place rather than a wash the height of two lines over one thing
    // and a second over the other. The type is the THEME's: the block lies
    // over the card, which is light in the light theme. The body stays mounted
    // beneath it, out of view, so the reveal is an eligibility change.
    return (
      <div data-testid={revealed ? undefined : testId} style={revealed ? CONTENTS : undefined} className={revealed ? undefined : "min-w-0"}>
        <div aria-hidden={revealed ? undefined : "true"} style={revealed ? CONTENTS : { display: "none" }}>
          {body}
        </div>
        {!revealed && (
          <button
            type="button"
            data-testid={`${testId}-reveal`}
            onClick={reveal}
            aria-label={`${label}. ${sourceLine}`}
            style={{ background: WASH }}
            className="cg-state cg-focus flex w-full cursor-pointer flex-col items-start gap-1 rounded-[var(--radius-medium)] border-0 p-3 text-left font-sans text-on-surface"
          >
            <span className="flex items-center gap-2">
              <VisibilityGlyph size={18} />
              <span className="text-label-medium">{label}</span>
            </span>
            <span data-testid={`${testId}-source`} className="text-body-small [text-wrap:pretty]">
              {sourceLine}
            </span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      data-testid={revealed ? undefined : testId}
      style={revealed ? CONTENTS : { borderRadius: radius }}
      className={revealed ? undefined : "relative flex min-w-0 overflow-hidden"}
    >
      {/* The content still renders and still reserves its exact space — the
          veil is OVER it, not instead of it. `scale` hides the transparent edge
          a blur leaves at the bounds, and the wrapper clips it so the scaled
          halo never paints into the title above. */}
      <div
        aria-hidden={revealed ? undefined : "true"}
        style={revealed ? CONTENTS : { filter: "blur(24px)", transform: "scale(1.06)" }}
        className={revealed ? undefined : "min-w-0 flex-1 overflow-hidden select-none"}
      >
        {body}
      </div>
      {!revealed && (
        <button
          type="button"
          data-testid={`${testId}-reveal`}
          onClick={reveal}
          aria-label={`${label}. ${sourceLine}`}
          style={{
            borderRadius: radius,
            // A neutral wash, not a warning: the same scrim every covering
            // surface in this system uses, at a little over half strength.
            background: WASH,
          }}
          className="cg-focus absolute inset-0 grid cursor-pointer place-items-center border-0 p-0"
        >
          <span
            // Fixed white, deliberately theme-independent: the wash is dark in
            // both themes, so a role here would go invisible in one of them.
            style={{ color: "#ffffff" }}
            className="flex flex-col items-center gap-2 px-6 text-center"
          >
            <VisibilityGlyph />
            <span className="text-label-large">{label}</span>
            <span data-testid={`${testId}-source`} className="text-body-small opacity-85 [text-wrap:pretty]">
              {sourceLine}
            </span>
          </span>
        </button>
      )}
    </div>
  );
}

/** A wrapper that draws no box: its children lay out as if it were not there. */
const CONTENTS: CSSProperties = { display: "contents" };

// Material's `visibility`, the filled 24px cut the product already inlines.
export function VisibilityGlyph({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17a5 5 0 110-10 5 5 0 010 10zm0-8a3 3 0 100 6 3 3 0 000-6z" />
    </svg>
  );
}
