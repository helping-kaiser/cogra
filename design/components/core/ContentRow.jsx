import React from "react";
import { Icon } from "../navigation/Icon.jsx";
import { MonogramAvatar } from "../people/ActorChip.jsx";
import { PendingMarker } from "../honesty/PendingMarker.jsx";
import { StanceValue } from "../stance/StanceReadout.jsx";

/* THE IDENTITY ROW — the card-lite line every list in this product is built
   from: a 40px disc saying who or what, two lines of words saying which and
   when, and whatever the list keeps on its trailing edge.

   ONE MASTER, because the wallet's history, the campaigns list, the campaigns
   door and the chronicle were four copies of one row, and four copies drift in
   four directions — the door's glyph had grown 2px, the chronicle's inner gaps
   had grown 1px and 2px, and nobody had decided any of it. The variants below
   are the differences that are DESIGNED; everything else is now one value.

   THE DISC LEADS, and what fills it is an order of precedence, not a choice:
   a picture if there is one, else a monogram for a name, else a stance face,
   else the glyph for the kind. It always sits in a 40px box that can carry a
   badge, whether or not this row wants one — a badge that moved the words when
   it appeared would make the same list two rhythms.

   THE SECOND LINE IS ONE LINE, in every variant, ellipsized. A row in a list is
   scanned, not read: the moment one row can be two lines tall, the reader loses
   the vertical rhythm that lets them skim past nine of them to find the tenth.
   Where the whole snippet matters, the row's destination is where it belongs. */

const VARIANTS = {
  /* The wallet's history. Its trailing edge is money, which is body-sized
     because a figure is read, not glanced at, and quiet while it is pending. */
  ledger: { second: "label-small", trailing: "body-medium", loud: true, disc: "container" },
  /* A campaign in a list. The disc is the campaign's cover — a TILE, because a
     campaign is a thing with a face, not somebody with one. */
  campaign: { second: "label-small", trailing: "body-medium", loud: true, disc: "container", image: "tile" },
  /* A doorway into a section. The filled disc is deliberate: it is the one row
     in the wallet that is an entrance rather than an entry, and the fill is what
     says so without a word of chrome. */
  door: { second: "label-small", trailing: "body-medium", loud: true, disc: "primary" },
  /* A record in the chronicle. Its second line is the act's own words, so it
     takes body type rather than the label type a context line wears — and its
     trailing edge is a TIME, which is a quiet fact rather than the row's point,
     so it is the one variant whose trailing edge is not `loud`. */
  chronicle: { second: "body-medium", trailing: "label-small", loud: false, disc: "container" },
};

const TYPE = {
  "label-small": {
    fontSize: "var(--text-label-small)",
    lineHeight: "var(--text-label-small--line-height)",
  },
  "body-medium": {
    fontSize: "var(--text-body-medium)",
    lineHeight: "var(--text-body-medium--line-height)",
  },
};

const TONES = {
  container: { background: "var(--surface-container-high)", color: "var(--text-secondary)" },
  primary: { background: "var(--primary)", color: "var(--on-primary)" },
};

function Disc({ image, imageShape, name, face, glyph, tone }) {
  if (image) {
    return (
      <img
        src={image}
        alt=""
        style={{
          width: "40px",
          height: "40px",
          borderRadius: imageShape === "tile" ? "var(--radius-small)" : "var(--radius-full)",
          objectFit: "cover",
          display: "block",
        }}
      />
    );
  }
  if (name) return <MonogramAvatar name={name} size={40} />;
  return (
    <span
      style={{
        width: "40px",
        height: "40px",
        borderRadius: "var(--radius-full)",
        ...TONES[tone] ?? TONES.container,
        display: "grid",
        placeItems: "center",
      }}
    >
      {face ? (
        <StanceValue pDirected={face.pDirected} pInterest={face.pInterest} showPair={false} />
      ) : (
        <Icon name={glyph ?? "wallet"} size={20} />
      )}
    </span>
  );
}

export function ContentRow({
  variant = "ledger",
  title,
  titleAside,
  second,
  trailing,
  pending = false,
  image,
  name,
  face,
  glyph,
  direction,
  chevron = true,
  inert = false,
  onOpen,
}) {
  const shape = VARIANTS[variant] ?? VARIANTS.ledger;
  /* A row is a control unless it is declared not to be. `inert` is the
     chronicle's case: a record of something that happened, which has no
     destination — the same card, with nothing to press. */
  const Tag = inert ? "div" : "button";
  const ellipsis = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
  const heading = (
    <span
      style={{
        fontSize: "var(--text-label-large)",
        lineHeight: "var(--text-label-large--line-height)",
        fontWeight: "var(--text-label-large--font-weight)",
        ...ellipsis,
      }}
    >
      {title}
    </span>
  );
  return (
    <Tag
      type={inert ? undefined : "button"}
      onClick={inert ? undefined : onOpen}
      className={inert ? undefined : "cg-state cg-focus"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        width: "100%",
        border: 0,
        borderRadius: "var(--radius-medium)",
        background: "var(--surface-card)",
        padding: "var(--space-3)",
        cursor: onOpen ? "pointer" : "default",
        fontFamily: "var(--font-sans)",
        color: "var(--on-surface)",
        textAlign: "left",
        boxSizing: "border-box",
      }}
    >
      <span style={{ position: "relative", flex: "none", width: "40px", height: "40px" }}>
        <Disc image={image} imageShape={shape.image} name={name} face={face} glyph={glyph} tone={shape.disc} />
        {direction && (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              right: "-3px",
              bottom: "-3px",
              width: "18px",
              height: "18px",
              borderRadius: "var(--radius-full)",
              background: "var(--primary)",
              color: "var(--on-primary)",
              display: "grid",
              placeItems: "center",
              border: "2px solid var(--surface)",
              boxSizing: "content-box",
              transform: direction === "in" ? "rotate(180deg)" : undefined,
            }}
          >
            <Icon name="arrow_outward" size={11} />
          </span>
        )}
      </span>
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "1px" }}>
        {/* The aside is a word riding the title's baseline — the chronicle's
            "· 2 acts". It only wraps the heading when it is there, so a row
            without one keeps the plain line. */}
        {titleAside ? (
          <span style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)", minWidth: 0 }}>
            {heading}
            <span
              style={{ ...TYPE["label-small"], color: "var(--text-secondary)", flex: "none" }}
            >
              {titleAside}
            </span>
          </span>
        ) : (
          heading
        )}
        {second && (
          <span style={{ ...TYPE[shape.second], color: "var(--text-secondary)", ...ellipsis }}>{second}</span>
        )}
      </span>
      {(trailing || pending) && (
        <span style={{ flex: "none", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
          <span
            style={{
              ...TYPE[shape.trailing],
              color: pending || !shape.loud ? "var(--text-secondary)" : "var(--on-surface)",
            }}
          >
            {trailing}
          </span>
          {pending && <PendingMarker />}
        </span>
      )}
      {chevron && (
        <span style={{ flex: "none", display: "inline-flex", color: "var(--text-secondary)" }} aria-hidden="true">
          <Icon name="chevron_right" size={18} />
        </span>
      )}
    </Tag>
  );
}
