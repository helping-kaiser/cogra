import React from "react";
import { Icon } from "../navigation/Icon.jsx";
import { MonogramAvatar } from "../people/ActorChip.jsx";
import { StanceControl } from "../stance/StanceControl.jsx";
import { ExplainableNumber } from "../proposed/ExplainableNumber.jsx";

/* THE STREAM'S RAIL (readme §13, the reel round) — the post card's action row
   turned on its side and laid over the clip.

   THE ORDER IS RULED, top to bottom: author · stance · comments · share · the
   score. People lead, the way they lead on a card (§1) — the author is the one
   thing here that is not an act. Then the acts in the card's own order, with
   share arriving after them. THE SCORE SITS LAST because it is the door out of
   the stream: a thumb reaching for the stance never passes over the exit.
   Topics, the reference count and the reader's ⋮ are deliberately absent —
   they belong to the detail view the score opens.

   IT READS OVER ANY FRAME. Every glyph is white at 28px with a soft shadow, and
   counts ride beneath their glyph. A token colour on photography is not a quiet
   control but an invisible one, which is why nothing here takes `onSurface`;
   the shadow does the work a plate would otherwise do, because a column of five
   plates is a wall of chrome down the frame.

   THE STANCE IS THE SYSTEM'S OWN CONTROL, in its media dress (`overMedia`): the
   unset state is a line face at the rail's weight rather than the card's muted
   emoji, and the pad it blooms is the same pad, over the paused clip, seal and
   all. */

const RAIL_SHADOW = "drop-shadow(0 1px 4px rgba(0,0,0,0.55))";

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
      <StanceControl targetLabel="this post" overMedia />
      {comments !== undefined && (
        <ReelRailItem
          label={comments === 1 ? "1 comment" : `${comments} comments`}
          glyph="chat_bubble"
          count={comments}
          onClick={onOpenComments}
        />
      )}
      <ReelRailItem label="Share this post" glyph="share" onClick={onShare} />
      {score !== undefined && (
        <ExplainableNumber glyph="graph" label="Post Score" value={score} onOpenDetail={onOpenScore ?? (() => {})} overMedia />
      )}
    </div>
  );
}
