import React from "react";
import { Icon } from "../navigation/Icon.jsx";
import { MonogramAvatar } from "../people/ActorChip.jsx";

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
   record. Right-aligned, `body-small`, never coloured. */

const KIND_GLYPHS = {
  comment: "chat_bubble",
  proposal: "how_to_vote",
  item: "inventory_2",
  campaign: "campaign",
  offer: "sell",
  chat: "forum",
};

function LeadingMark({ kind, name, src }) {
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
      {letter ?? <Icon name={KIND_GLYPHS[kind]} size={18} />}
    </span>
  );
}

/* `sub` is the INDIRECT-HIT line (readme §13, the search rulings): a scoped
   query that matched through an act's target says both halves — the comment
   row reads "on <post title>", the offer row "on <item name>". Without it an
   indirect hit is indistinguishable from a mishit. `value` is the row's right
   edge: the signed pair in the references sheet, the viewer-relative rank in
   ranked search results, the age past the seam. (`pair` remains as its old
   name.) */
export function ReferenceRow({ kind = "post", name, sub, src, pair, value, onOpen }) {
  const edge = value ?? pair;
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
      <LeadingMark kind={kind} name={name} src={src} />
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
      {edge && (
        <span
          style={{
            flex: "none",
            fontSize: "var(--text-body-small)",
            lineHeight: "var(--text-body-small--line-height)",
            color: "var(--text-secondary)",
            whiteSpace: "nowrap",
          }}
        >
          {edge}
        </span>
      )}
    </button>
  );
}
