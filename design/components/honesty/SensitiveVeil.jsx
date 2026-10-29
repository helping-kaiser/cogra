import React from "react";
import { Icon } from "../navigation/Icon.jsx";

/* readme §9's two content states. They share only their register — soft, a
   statement of fact, never `error` colouring. WHAT THEY TAKE is opposite, and
   the docs are unambiguous about why: one covers the body and gives it back on a
   tap, the other takes the whole record for good.

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
   the opinion, the opinion you can still give on it. That is not a courtesy, it is
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

   AND IT LASTS THE SESSION (jakob's ruling, the sheets-and-video round). A reveal
   survives every move inside the app — the post unveiled in the feed is still
   unveiled after a walk to a profile and back — because the decision belongs to
   the reader who made it, not to the screen they made it on. It returns when the
   app is fully closed, or the media is otherwise reset from scratch: a session is
   the unit a reader can tell they are still inside of. The scope is the running
   app, never a stored preference, so nothing about a reveal outlives the session
   or follows the reader to another device.

   NOT THE READER'S SETTINGS. The 0–10 severity level is stored and read as a
   single show-sensitive threshold: a veil either exists or does not, and nothing
   here reads a level. The gradient across the range — where a reader accepts one
   category and refuses another — comes after MVP. */

const RevealContext = React.createContext(null);

/** Wrap a post so one reveal answers for all of its sensitive content. A scope
 *  inside a scope would shadow the outer one and split the post's one decision
 *  into two, so a nested SensitiveScope defers to the ambient scope — the post
 *  has exactly one, wherever the outermost wrapper stands. */
export function SensitiveScope({ children }) {
  const ambient = React.useContext(RevealContext);
  const [revealed, setRevealed] = React.useState(false);
  const value = React.useMemo(() => ({ revealed, reveal: () => setRevealed(true) }), [revealed]);
  if (ambient) return children;
  return <RevealContext.Provider value={value}>{children}</RevealContext.Provider>;
}

/* WHOSE MARK THIS IS (Q47). The author's own warning and the platform's verdict
   are two independent states that read back as the same veil, so the face has to
   say which one a reader met — a reason alone cannot, since a verdict may carry
   one too and an author may leave theirs empty. The source line is unconditional
   for that reason: an unnamed source would read as the other one. */
const SOURCES = {
  author: "The author's warning",
  platform: "The platform's verdict",
};

/* BOTH MARKS STAND (round 27, seam 252, item 7). The two states are
   independent (moderation.md, *Two independent states*): neither clears the
   other, and the veil is their OR. Naming only the author's would let the
   verdict hide behind the author's own decision — the collapse Q47 exists to
   prevent — and naming only the verdict would drop the self-owned fact and its
   reason. So the line names both, the author's first, with the author's reason
   where one was given, then the verdict in the edit's blessed words (`Also
   veiled by the platform's verdict`, `ComposeSensitive`), its own reason after
   an em dash where the verdict carries one. One line, read and spoken whole:
   `The author's warning — A dead seabird in the second frame. Also veiled by
   the platform's verdict`. The server names the case (the `sensitiveSource`
   ask, AUTHOR | PLATFORM | BOTH); until it does, a client reads the author's
   line alone. */
const ALSO_VERDICT = "Also veiled by the platform's verdict";
export function sensitiveSourceLine(source = "author", reason, verdictReason) {
  if (source === "both") {
    const own = `${SOURCES.author}${reason ? ` — ${reason}` : ""}`;
    return `${own}${/[.!?]$/.test(own) ? "" : "."} ${ALSO_VERDICT}${verdictReason ? ` — ${verdictReason}` : ""}`;
  }
  return `${SOURCES[source] ?? SOURCES.author}${reason ? ` — ${reason}` : ""}`;
}

/* The wash every veil face wears: the standard covering scrim at half strength,
   never an `error` colour. One expression, so the faces cannot drift apart. */
const WASH = "color-mix(in oklab, var(--scrim-dialog) 55%, transparent)";

/**
 * Veils a body region as one — a post's gallery, its paragraphs, a comment's
 * whole body. `SensitiveScope` makes one tap answer for every veil in a post.
 */
export function SensitiveVeil({
  children,
  kind = "media",
  label = "Sensitive — tap to view",
  reason,
  source = "author",
  /* The verdict's own reason, read only where `source` is `"both"` (the
     author's `reason` leads; this follows the verdict's words). */
  verdictReason,
  revealLabel = "Show",
  radius,
  faceGutter = "var(--space-6)",
  named = false,
  node,
}) {
  /* NAMED AS A LEAF (the data-node join's wrapper rule): `node` names the
     veil's one control — the face over media, the compact block, the text
     veil's `Show` — and never the region it covers, so what it covers keeps
     its paths whether the veil stands or not. */
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

  const sourceLine = sensitiveSourceLine(source, reason, verdictReason);

  if (kind === "compact") {
    /* THE COMMENT-SCALE FACE. A comment is words first and its pictures join
       them, so its body is short and its pictures are an inset attachment —
       covering that in place would put a wash the height of two lines over one
       thing and a second wash over the other. The whole body is replaced by ONE
       block instead: words and pictures together, at the scale of the card it
       sits in. What stays outside it is the comment's answer to the title
       staying readable on a post — the author, the timestamp, and the opinion a
       reader can still give, so choosing to look is informed.

       The wash is the veil's own, but the type is the THEME's rather than the
       media face's fixed white: that white is legible because the wash lies over
       a picture, and here it lies over the card, which is light in the light
       theme. */
    return (
      <button
        type="button"
        onClick={reveal}
        aria-label={`${label}. ${sourceLine}`}
        className="cg-state cg-focus"
        data-node={node}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: "var(--space-1)",
          width: "100%",
          border: 0,
          borderRadius: "var(--radius-medium)",
          background: WASH,
          padding: "var(--space-3)",
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
          color: "var(--text-body)",
          textAlign: "left",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <Icon name="visibility" size={18} />
          <span style={{ fontSize: "var(--text-label-medium)", fontWeight: "var(--text-label-medium--font-weight)" }}>{label}</span>
        </span>
        <span style={{ fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", textWrap: "pretty" }}>{sourceLine}</span>
      </button>
    );
  }

  if (kind === "text") {
    /* Text is blurred IN PLACE rather than replaced, so the line keeps its own
       height and nothing below it moves when the reader reveals it. The shape of
       the sentence stays visible, which is honest: the reader can see there is a
       sentence, only not read it.

       A WORDS-ONLY POST NAMES ITS SOURCE TOO (the check round's Q5, jakob
       2026-10-06). The source line is unconditional (Q47), and where the words
       are the post's whole body there is no media face to carry it — so the
       text veil carries it on its own plate, the quiet line under the blurred
       words and their `Show`, in the same words the media face uses. `named`
       is how a caller says this veil is the post's only face; a caption under
       a veiled picture or clip leaves it off, because the media face already
       names the source and saying it twice would read as two marks. */
    const veil = (
      <span style={{ display: "inline-flex", alignItems: "baseline", gap: "var(--space-2)", maxWidth: "100%" }}>
        <span aria-hidden="true" style={{ filter: "blur(6px)", userSelect: "none", opacity: 0.75, minWidth: 0 }}>
          {children}
        </span>
        <button
          type="button"
          onClick={reveal}
          className="cg-state cg-focus cg-hit"
          data-node={node}
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
    if (!named) return veil;
    return (
      <span style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", maxWidth: "100%" }}>
        {veil}
        <span style={{ fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", color: "var(--text-secondary)", textWrap: "pretty" }}>
          {sourceLine}
        </span>
      </span>
    );
  }

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
        data-node={node}
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          border: 0,
          /* A neutral wash, not a warning. The scrim is the same one every
             covering surface in this system uses, at half strength. */
          background: WASH,
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
            reason after it when there is one. `faceGutter` is the words'
            side clearance: a surface that lays its own chrome over the veil —
            the stream's rail — widens it on both sides alike, so the words keep
            clear of that chrome and the face stays centred. */}
        <span
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "var(--space-2)",
            padding: `0 ${faceGutter}`,
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
    detail: "The words and pictures are gone. The post's place in the thread, and every response, remain.",
  },
  /* A WHOLE ACCOUNT, deleted by the person who had it (erasure §2, the
     account-deletion round). The third mark, and it is the same mechanism at a
     different scale: identity-level redaction empties the Registration
     bundle's payloads, so a profile carries exactly the mark a post carries
     when its payload goes. Naming the person's own choice is the ruling —
     nothing that was here is pretended never to have existed, and a deleted
     account must not read as a moderation verdict or as a dead link. Pass
     `note` for the reading where the content sweep was opted into as well. */
  account: {
    line: "Deleted by the person whose account it was",
    detail: "Their name and profile are gone. What they signed stays on the graph and still credits them.",
  },
  /* A CHAT'S VERSION, REMOVED BY THE CHAT (the chats governance round,
     2026-09-23; chats.md §8). A chat has no author, so no single hand empties
     one of its versions — a passed `decision:redact_version` does. Neither
     neighbour may stand in: `author` would name a person who does not exist,
     and `illegal` would dress the members' own choice as a platform verdict.
     So the fourth mark names the chat as the one who decided. Proposed, not
     yet blessed (copy-voice, the chats governance round). */
  chat: {
    line: "Removed by the chat's decision",
    detail: "Its members decided to take it down. The decision is public.",
  },
};

/* The mark's three lines, each in its whole type role. */
const REDACTED_TYPE = {
  "body-medium": {
    fontSize: "var(--text-body-medium)",
    lineHeight: "var(--text-body-medium--line-height)",
    letterSpacing: "var(--text-body-medium--letter-spacing)",
    fontWeight: "var(--text-body-medium--font-weight)",
  },
  "body-small": {
    fontSize: "var(--text-body-small)",
    lineHeight: "var(--text-body-small--line-height)",
    letterSpacing: "var(--text-body-small--letter-spacing)",
    fontWeight: "var(--text-body-small--font-weight)",
  },
  "label-small": {
    fontSize: "var(--text-label-small)",
    lineHeight: "var(--text-label-small--line-height)",
    letterSpacing: "var(--text-label-small--letter-spacing)",
    fontWeight: "var(--text-label-small--font-weight)",
  },
};

/**
 * Replaces a node's ENTIRE content region: title, body, description, media, all
 * at once. There is no field-level or inline cut, because redaction is
 * record-granular — one illegal attachment takes the whole payload with it.
 *
 * What is left around it is the skeleton, and the skeleton is the point: the
 * author, the timestamp, the thread position, the opinion, the opinion a reader
 * can still give. No record leaves the graph, and no removal is silent.
 *
 * `when` is the redaction's own moment (the contract's `redactedAt`), never
 * the content's age, and it speaks the one age vocabulary every timestamp
 * speaks (ruled 2026-09-09): the minutes/hours/days ladder to 30 days, the
 * date past it.
 */
export function RedactedContent({ reason = "illegal", when, note, node }) {
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
      data-node={node}
    >
      {/* Each line sets its whole role (seam 245, ask 6) — size, leading,
          tracking and weight (§7) — so none of them borrows the page's
          body-large 24px leading and 0.5px tracking. */}
      <span style={{ ...REDACTED_TYPE["body-medium"], color: "var(--text-body)" }} data-node={node && "line"}>
        {copy.line}
      </span>
      <span style={{ ...REDACTED_TYPE["body-small"], color: "var(--text-secondary)", textWrap: "pretty" }} data-node={node && "detail"}>
        {note ?? copy.detail}
      </span>
      {when && (
        <span style={{ ...REDACTED_TYPE["label-small"], color: "var(--text-secondary)" }} data-node={node && "when"}>
          {when}
        </span>
      )}
    </div>
  );
}
