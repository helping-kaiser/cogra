import React from "react";
import { Icon } from "../navigation/Icon.jsx";
import { MonogramAvatar } from "../people/ActorChip.jsx";
import { StanceControl } from "../stance/StanceControl.jsx";
import { ExplainableNumber } from "../proposed/ExplainableNumber.jsx";

/* THE STREAM'S RAIL (readme §13, the reel round) — the post card's action row
   turned on its side and laid over the clip.

   THE ORDER IS RULED, top to bottom: author · opinion · comments · share · the
   score. People lead, the way they lead on a card (§1) — the author is the one
   thing here that is not an act. Then the acts in the card's own order, with
   share arriving after them. THE SCORE SITS LAST because it is the door out of
   the stream: a thumb reaching for the opinion never passes over the exit.
   Topics, the reference count and the reader's ⋮ are deliberately absent —
   they belong to the detail view the score opens.

   IT READS OVER ANY FRAME. Every glyph is white at 28px with a soft shadow, and
   counts ride beneath their glyph. A token colour on photography is not a quiet
   control but an invisible one, which is why nothing here takes `onSurface`;
   the shadow does the work a plate would otherwise do, because a column of five
   plates is a wall of chrome down the frame.

   THE LOOK IS RULED, AND ITS CONTRAST IS MEASURED (the K13 round; jakob
   accepted white-with-shadow over a token pair). Against the lightest fixture
   photograph — `04-square-1x1.jpg`, the honey jars (`gallery-honey.jpg`),
   mean relative luminance 0.555 — bare white reads 1.73:1 on the photo's
   mean and 1.04:1 on its near-white right-hand strip, where the rail stands.
   THE SHADOW'S CORE IS DEEPENED (jakob 2026-10-05, the final brief): 75 %
   black at a 6px blur, from 55 % at 4px — still a shadow, never a plate or a
   gradient. Re-measured the same two ways:
   · modelled, the core's alpha over the luminance (the K13 method): on the
     strip 3.6:1 (was 2.4:1), on the mean 5.6:1 (was 3.9:1);
   · rendered — the stream drawn over the honey frame at 2×, every ground
     pixel within 1–1.5px of a glyph's white sampled: median 2.4:1 (was
     2.2:1), and 31 % of those pixels reach 3:1 (was 20 %). On the stream's
     own clip (`clip-lakeside.jpg`) the same edge reads a median 6.0:1.
   So at the shadow's core the rail clears WCAG's 3:1 for controls on the
   brightest fixture, and at the glyph's rendered edge it does not — accepted
   with these numbers (jakob 2026-10-05). Method: relative luminance per
   WCAG 2.x; the strip is the right fifth of the lower two-thirds.

   THE STANCE IS THE SYSTEM'S OWN CONTROL, in its media dress (`overMedia`): the
   unset state is a line face at the rail's weight rather than the card's muted
   emoji, and the pad it blooms is the same pad, over the paused clip, seal and
   all. */

const RAIL_SHADOW = "drop-shadow(0 1px 6px rgba(0,0,0,0.75))";

/* THE STREAM'S PLATE (jakob 2026-10-12, the slice-3 round: RL-G4, RL-G8,
   RL-G13). A line the stream owes the reader — a hold that did not sign, the
   load that did not come, the last clip — has no row to stand on over a clip,
   so it stands on the wash's own black, a pill at 60 %, the one surface a word
   can be read on over any frame. It is a line and not a snackbar: it stands
   until it is answered and never fades on a timer (the row line's law). The
   words keep their own registers — the failure ink, the quiet secondary, the
   bare `Retry` — the plate only gives them ground. */
export function ReelPlate({ children, role = "status" }) {
  return (
    <p
      role={role}
      style={{
        margin: 0,
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-2)",
        padding: "4px 10px",
        borderRadius: "var(--radius-full)",
        background: "rgba(0,0,0,0.6)",
        color: "#fff",
        fontSize: "var(--text-label-medium)",
        lineHeight: "var(--text-label-medium--line-height)",
        fontWeight: "var(--text-label-medium--font-weight)",
        whiteSpace: "nowrap",
        textShadow: "none",
      }}
    >
      {children}
    </p>
  );
}

/* THE RAIL'S SCORE DOOR, in its three faces (jakob 2026-10-12: RL-G7 and the
   moved-on vocabulary). The figure the reader's own last feed fetch computed —
   the same the card wore. Still settling, the glyph stands BARE with the
   pending mark under it, and the door stays: the score is the stream's only
   way into the post, and a settling clip has a post like any other. A dash
   where the trace's fetch found no paths — no computed figure — and the door
   stays then too. The bare slot is settling's alone; zero is severance's. */
export function ReelRailScore({ score, settling = false, onOpen }) {
  const door = (
    <ExplainableNumber glyph="graph" label="Feed score" value={settling ? undefined : score} onOpenDetail={onOpen ?? (() => {})} overMedia />
  );
  if (!settling) return door;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      {door}
      <span
        style={{
          maxWidth: 56,
          textAlign: "center",
          fontSize: "var(--text-label-small)",
          lineHeight: "var(--text-label-small--line-height)",
          fontWeight: "var(--text-label-small--font-weight)",
          color: "#fff",
        }}
      >
        Still settling
      </span>
    </div>
  );
}

export function ReelRailItem({ label, glyph, count, onClick }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick ?? (() => {})}
      className="cg-state cg-focus"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        width: 56,
        border: 0,
        background: "none",
        borderRadius: "var(--radius-full)",
        padding: "6px 0",
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-label-small)",
        lineHeight: "var(--text-label-small--line-height)",
        fontWeight: "var(--text-label-small--font-weight)",
        color: "#fff",
      }}
    >
      <Icon name={glyph} size={28} />
      {count !== undefined && <span aria-hidden="true">{count}</span>}
    </button>
  );
}

export function ReelRail({
  author,
  score,
  settling = false,
  scoreSlot,
  stanceLine,
  comments,
  bottom = 168,
  onOpenProfile,
  onOpenComments,
  onShare,
  onOpenScore,
}) {
  return (
    <div
      style={{
        position: "absolute",
        right: 4,
        bottom: `${bottom}px`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        zIndex: 3,
        filter: RAIL_SHADOW,
      }}
    >
      {author && (
        <a
          href={`/u/${author.handle}`}
          aria-label={author.displayName}
          onClick={onOpenProfile}
          style={{ display: "block", textDecoration: "none" }}
        >
          <MonogramAvatar name={author.displayName} size={44} src={author.src} />
        </a>
      )}
      {/* The face's row line has no row to stand under here, so it stands
          beside the face, on the stream's plate, reading leftward. */}
      <div style={{ position: "relative" }}>
        <StanceControl targetLabel="this post" overMedia />
        {stanceLine && (
          <div style={{ position: "absolute", right: "calc(100% + 8px)", top: "50%", transform: "translateY(-50%)" }}>
            {stanceLine}
          </div>
        )}
      </div>
      {comments !== undefined && (
        <ReelRailItem
          label={comments === 1 ? "1 comment" : `${comments} comments`}
          glyph="chat_bubble"
          count={comments}
          onClick={onOpenComments}
        />
      )}
      <ReelRailItem label="Share this post" glyph="share" onClick={onShare} />
      {scoreSlot ?? ((score !== undefined || settling) && <ReelRailScore score={score} settling={settling} onOpen={onOpenScore} />)}
    </div>
  );
}
