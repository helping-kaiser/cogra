import React from "react";
import { Icon } from "../navigation/Icon.jsx";

/* design.md §9's two content states. They share only their register — soft, a
   statement of fact, never `error` colouring. Their GRANULARITY is opposite, and
   the docs are unambiguous about why.

   SENSITIVE COVERS THE BODY, AS ONE. Media, words and description veil together;
   the title and topics stay outside it and readable, so choosing to look is
   informed. A gallery veils whole, never one picture of it — the set carries one
   state. Veiling a field at a time would ask the reader the same question five
   times over, and what it left showing would describe what it covers.

   REDACTED IS THE WHOLE RECORD. An `illegal` verdict removes the payload of the
   record carrying the content: "granularity is the record, whole — the binding
   content commitment forbids partial rewrite, so there is no per-field
   redaction." One illegal attachment and the payload is gone, which means every
   authored field goes with it. There is no such thing as a redacted title beside
   a surviving body, and no such thing as a redaction inside a sentence.

   So `RedactedContent` replaces a node's ENTIRE content region, and it is the
   only shape it has. What remains is the skeleton: the structural record, its
   witness, and everything it does on L1 — author, timestamp, thread position,
   standing, the stance you can still take on it. That is not a courtesy, it is
   the invariant: no record ever leaves the graph, and every redaction leaves a
   visible mark, so that no reader is left wondering whether something was quietly
   deleted.

   WHO SEES IT. A redacted node is not feed material. It is reached by direct
   link, by following structure that still points at it, or by a reader whose
   filter admits it. The design follows from that: someone here arrived on
   purpose, so the placeholder owes them what happened and nothing more.

   REVEAL IS PER POST, for sensitive content only. Tapping to reveal one veiled
   image reveals every veiled thing in that post: the reader answered the question
   once, and asking again per item turns one decision into five. `SensitiveScope`
   is what makes that true; a veil with no scope governs only itself, the safe
   default for a lone tile.

   NOT THE READER'S SETTINGS. The 0–10 severity level is stored, but the product
   today asks only "show sensitive content or not" — the range is for a future
   where a reader accepts one category and refuses another. Nothing here reads a
   level; a veil either exists or does not. */

const RevealContext = React.createContext(null);

/** Wrap a post so one reveal answers for all of its sensitive content. */
export function SensitiveScope({ children }) {
  const [revealed, setRevealed] = React.useState(false);
  const value = React.useMemo(() => ({ revealed, reveal: () => setRevealed(true) }), [revealed]);
  return <RevealContext.Provider value={value}>{children}</RevealContext.Provider>;
}

/**
 * Veils a body region as one — a post's gallery, its paragraphs, a comment's
 * whole body. `SensitiveScope` makes one tap answer for every veil in a post.
 */
/* WHOSE MARK THIS IS (Q47). The author's own warning and the platform's verdict
   are two independent states that read back as the same veil, so the face has to
   say which one a reader met — a reason alone cannot, since a verdict may carry
   one too and an author may leave theirs empty. The source line is unconditional
   for that reason: an unnamed source would read as the other one. */
const SOURCES = {
  author: "The author's warning",
  platform: "The platform's verdict",
};

export function SensitiveVeil({
  children,
  kind = "media",
  label = "Sensitive — tap to view",
  reason,
  source = "author",
  revealLabel = "Show",
  radius,
}) {
  const scope = React.useContext(RevealContext);
  const [local, setLocal] = React.useState(false);
  const revealed = scope ? scope.revealed : local;
  /* THE VEIL'S RADIUS IS AUTHORITATIVE, and it has to reach the child. The scrim
     sits on top of the content, so styling only the scrim leaves the tile
     underneath at its own default — which in a flush gallery means one rounded
     tile beside a square one, and it breaks the full-bleed rule that media meets
     the card's straight sides and never its corners. Forwarding it here fixes
     every caller instead of asking each one to pass the value twice. */
  const veiled = radius !== undefined && React.isValidElement(children) ? React.cloneElement(children, { radius }) : children;
  const reveal = (event) => {
    // The veil is a decision, not a route: it must not also open the post it
    // sits in.
    event.preventDefault();
    event.stopPropagation();
    if (scope) scope.reveal();
    else setLocal(true);
  };

  if (revealed) return veiled;

  if (kind === "text") {
    /* Text is blurred IN PLACE rather than replaced, so the line keeps its own
       height and nothing below it moves when the reader reveals it. The shape of
       the sentence stays visible, which is honest: the reader can see there is a
       sentence, only not read it. */
    return (
      <span style={{ display: "inline-flex", alignItems: "baseline", gap: "var(--space-2)", maxWidth: "100%" }}>
        <span aria-hidden="true" style={{ filter: "blur(6px)", userSelect: "none", opacity: 0.75, minWidth: 0 }}>
          {children}
        </span>
        <button
          type="button"
          onClick={reveal}
          className="cg-state cg-focus cg-hit"
          style={{
            flex: "none",
            border: 0,
            background: "none",
            padding: 0,
            cursor: "pointer",
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-label-small)",
            color: "var(--text-secondary)",
            textDecoration: "underline",
          }}
        >
          {revealLabel}
        </button>
      </span>
    );
  }

  const sourceLine = `${SOURCES[source] ?? SOURCES.author}${reason ? ` — ${reason}` : ""}`;

  return (
    <div style={{ position: "relative", display: "flex", minWidth: 0, overflow: "hidden", borderRadius: radius ?? 0 }}>
      {/* The content still renders and still reserves its exact space — the veil
          is over it, not instead of it, so revealing moves nothing. `scale` hides
          the transparent edge a blur leaves at the bounds — and the WRAPPER clips
          it: the scaled halo must never paint outside the tile's own box, into
          the title above or the caption below. */}
      <div aria-hidden="true" style={{ filter: "blur(24px)", transform: "scale(1.06)", flex: 1, minWidth: 0, overflow: "hidden" }}>
        {veiled}
      </div>
      <button
        type="button"
        onClick={reveal}
        aria-label={`${label}. ${sourceLine}`}
        className="cg-focus"
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          border: 0,
          /* A neutral wash, not a warning. The scrim is the same one every
             covering surface in this system uses, at half strength. */
          background: "color-mix(in oklab, var(--scrim-dialog) 55%, transparent)",
          borderRadius: radius ?? 0,
          cursor: "pointer",
          padding: 0,
        }}
      >
        {/* No surface of its own — the wash IS the surface, and the words sit
            directly on it, centred: the pattern every large product uses for
            this exact moment, so the reader has met it before. Fixed white,
            deliberately theme-independent: the wash is dark in both themes.
            The second, smaller line names whose mark this is, and carries the
            reason after it when there is one. */}
        <span
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "var(--space-2)",
            padding: "0 var(--space-6)",
            color: "#fff",
            fontFamily: "var(--font-sans)",
            textAlign: "center",
          }}
        >
          <Icon name="visibility" size={24} />
          <span style={{ fontSize: "var(--text-label-large)", fontWeight: "var(--text-label-large--font-weight)" }}>{label}</span>
          <span style={{ fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", opacity: 0.85, textWrap: "pretty" }}>
            {sourceLine}
          </span>
        </span>
      </button>
    </div>
  );
}

const REASONS = {
  /* Removed for cause, by a passing proposal. Says what happened in the reader's
     words — "found illegal" is the verdict, not an accusation of the author, and
     the vote is what makes it a public fact rather than a moderator's opinion. */
  illegal: {
    line: "Removed under the platform's rules",
    detail: "A passed proposal removed it. The decision is public.",
  },
  /* Removed by choice (erasure §1). The docs are explicit that this must read
     differently from removed-for-cause — collapsing the two would let a
     moderation verdict hide behind an author's own decision, or the reverse.
     Both texts are the decided marks of guidelines/copy-voice.md. */
  author: {
    line: "Removed by its author",
    detail: "The post's place in the thread, and every response, remain.",
  },
};

/**
 * Replaces a node's ENTIRE content region: title, body, description, media, all
 * at once. There is no field-level or inline cut, because redaction is
 * record-granular — one illegal attachment takes the whole payload with it.
 *
 * What is left around it is the skeleton, and the skeleton is the point: the
 * author, the timestamp, the thread position, the standing, the stance a reader
 * can still take. No record leaves the graph, and no removal is silent.
 */
export function RedactedContent({ reason = "illegal", when, note }) {
  const copy = REASONS[reason] ?? REASONS.illegal;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-1)",
        borderRadius: "var(--radius-medium)",
        /* The same reserved surface an unloaded media tile uses, and the same
           reason: this is a space kept, not a space lost. */
        background: "var(--surface-container-high)",
        padding: "var(--space-4)",
      }}
    >
      <span style={{ fontSize: "var(--text-body-medium)", color: "var(--text-body)" }}>{copy.line}</span>
      <span style={{ fontSize: "var(--text-body-small)", color: "var(--text-secondary)", textWrap: "pretty" }}>
        {note ?? copy.detail}
      </span>
      {when && <span style={{ fontSize: "var(--text-label-small)", color: "var(--text-secondary)" }}>{when}</span>}
    </div>
  );
}
