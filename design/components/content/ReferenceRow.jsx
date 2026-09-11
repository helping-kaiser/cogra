import React from "react";
import { Icon, NODE_GLYPHS } from "../navigation/Icon.jsx";
import { MonogramAvatar } from "../people/ActorChip.jsx";
import { PendingMarker } from "../honesty/PendingMarker.jsx";
import { formatStancePair, formatTagPair, nearestTagAnchor, SR_ONLY } from "../stance/StanceReadout.jsx";

/* One row of the topics-and-references sheet (readme §13, 2026-08-28), and the
   result-row shape search reuses: EVERY row is leading mark · name · value, so
   a heterogeneous list reads as one list.

   THE LEADING MARK SAYS THE KIND, without a word beside it. A person keeps
   their avatar — people are circles everywhere in this system. Every other
   kind is a 32px tile at the small rung: a media post wears its cover, a text
   post the letter T (a tile, not a glyph — no icon set has "text post"), and
   the rest carry their node-type glyph — proposal `how_to_vote`, item
   `inventory_2`, campaign `campaign`, offer `sell`, chat `forum`, comment
   `chat_bubble`. A topic's tile is the same # its chip wears. Silhouettes are
   deliberately distinct: an item is a box, an offer the price tag.

   THE VALUE is the pair the author signed on this act — set at compose (a
   changeable default), shown here for any reader: a signed act is public
   record. Right-aligned, `body-small`, never coloured.

   THE PAIR ARRIVES AS NUMBERS AND THE ROW FORMATS IT (backlog item 53). Which
   family it belongs to is the row's own `kind`: a topic's pair is a tag's —
   `formatTagPair`, and the nearest of the thirteen `TAG_ANCHORS` beside it —
   and every other kind's is a citation's, both axes signed. One value in, so a
   glyph and its numbers cannot disagree. `value` is the other edge entirely:
   a plain string the row prints as given — an age, a date — and geek mode
   never touches it, because an age is not a signal number.

   THE NUMBERS ARE THE GEEK READING (readme §13). The rank's `graph` glyph and
   a topic's tag glyph carry the row by default; the digits ride `cg-exact`
   spans that paint only when the screen root says `data-geek="on"`. The
   button's accessible name is the same in both modes — every hidden number has
   a screen-reader-only twin, because the mode is a drawing setting and nothing
   spoken may depend on it.

   AN ACT STILL SETTLING SAYS SO HERE, AND ONLY HERE (jakob's ruling,
   2026-09-10). A chip on a card shows nothing pending — a tag's word is the tag's
   word whether or not the record has been ordered yet — so this sheet is the one
   surface that admits a staged-not-yet-landed tag or citation, in the same words
   every other unsettled record wears (`PendingMarker`).

   IT RIDES THE PAIR, NOT THE NAME. What has not landed is the ACT, not the node
   it points at: the post is there, the citation of it is the thing still finding
   its place in the order. So the marker stacks under the pair at the row's edge —
   the attachment `TaggedRow` already makes, where the marker sits with the
   claim's numbers and not with the content they describe. */

/** A node kind's mark, on any surface: avatar, cover, T, #, or the kind's
 *  glyph from the ONE semantic assignment (`NODE_GLYPHS`, the glyph atoms). */
export function NodeMark({ kind, name, src }) {
  if (kind === "person") return <MonogramAvatar name={name} src={src} size="md" />;
  const tile = {
    height: "32px",
    width: "32px",
    flex: "none",
    display: "grid",
    placeItems: "center",
    borderRadius: "var(--radius-small)",
    background: "var(--surface-container-highest)",
    color: "var(--text-secondary)",
    overflow: "hidden",
  };
  if (kind === "post" && src) {
    return (
      <span style={tile} aria-hidden="true">
        <img src={src} alt="" style={{ height: "100%", width: "100%", objectFit: "cover" }} />
      </span>
    );
  }
  const letter = kind === "topic" ? "#" : kind === "post" ? "T" : null;
  return (
    <span style={{ ...tile, fontFamily: "var(--font-sans)", fontSize: "var(--text-title-medium)", fontWeight: "var(--text-title-medium--font-weight)" }} aria-hidden="true">
      {letter ?? <Icon name={NODE_GLYPHS[kind]} size={18} />}
    </span>
  );
}

/* `sub` is the INDIRECT-HIT line (readme §13, the search rulings): a scoped
   query that matched through an act's target says both halves — the comment
   row reads "on <post title>", the offer row "on <item name>". Without it an
   indirect hit is indistinguishable from a mishit. The row's right edge is one
   of three: `pair` (the signed pair, as numbers), `rank` (the viewer-relative
   rank), or `value` (a plain string — the age past the seam). */
export function ReferenceRow({ kind = "post", name, sub, src, pair, value, rank, trailing, pending = false, onOpen }) {
  const tagFamily = kind === "topic";
  const exact = pair ? (tagFamily ? formatTagPair(pair) : formatStancePair(pair)) : null;
  const anchor = pair && tagFamily ? nearestTagAnchor(pair) : null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="cg-state cg-focus"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        minHeight: "var(--touch-target-min)",
        width: "100%",
        border: 0,
        background: "none",
        padding: "var(--space-1) var(--space-6)",
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
        color: "var(--on-surface)",
        textAlign: "left",
      }}
    >
      <NodeMark kind={kind} name={name} src={src} />
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <span
          style={{
            fontSize: "var(--text-body-medium)",
            lineHeight: "var(--text-body-medium--line-height)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {name}
        </span>
        {sub && (
          <span
            style={{
              fontSize: "var(--text-body-small)",
              lineHeight: "var(--text-body-small--line-height)",
              color: "var(--text-secondary)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {sub}
          </span>
        )}
      </span>
      {/* A RANK wears the score's own glyph, so the number is recognized before
          it is read — the same graph mark the post card's affordance row
          carries. A plain `value` (the signed pair, an age) stays bare. A
          `trailing` node wins over both: the PICKER's edge is the action (the
          add mark), because there the whole row's tap picks — ranking still
          orders the list, the number just yields the edge to the act. */}
      {trailing ? (
        <span aria-hidden="true" style={{ flex: "none", display: "inline-flex", color: "var(--text-secondary)" }}>{trailing}</span>
      ) : rank ? (
        <>
          <span
            aria-hidden="true"
            style={{
              flex: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "var(--text-body-small)",
              lineHeight: "var(--text-body-small--line-height)",
              color: "var(--text-secondary)",
              whiteSpace: "nowrap",
            }}
          >
            <Icon name="graph" size={14} />
            <span className="cg-exact">{rank}</span>
          </span>
          <span style={SR_ONLY}>{rank}</span>
        </>
      ) : (
        (value || exact || pending) && (
          <span
            style={{
              flex: "none",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              fontSize: "var(--text-body-small)",
              lineHeight: "var(--text-body-small--line-height)",
              color: "var(--text-secondary)",
              whiteSpace: "nowrap",
            }}
          >
            {value}
            {!value && exact && (
              <>
                <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  {anchor && <span style={{ fontSize: "var(--text-body-medium)", lineHeight: 1 }}>{anchor.emoji}</span>}
                  <span className="cg-exact">{exact}</span>
                </span>
                <span style={SR_ONLY}>{anchor ? `${anchor.label}, ${exact}` : exact}</span>
              </>
            )}
            {pending && <PendingMarker inline />}
          </span>
        )
      )}
    </button>
  );
}
