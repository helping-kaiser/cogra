import React from "react";
import { Icon } from "../navigation/Icon.jsx";
import { MoneyFigure } from "../core/MoneyFigure.jsx";
import { MonogramAvatar } from "../people/ActorChip.jsx";
import { PendingMarker } from "../honesty/PendingMarker.jsx";

/* One line of the wallet's history (item 12 round 2): an IDENTITY ROW, not a
   ledger line — the leading disc is who or what the money moved with (the
   tipper's face, the paying campaign's cover, a glyph for the rest), wearing
   a small DIRECTION BADGE (arrow out as drawn, in = rotated). The words
   carry what happened and what paid it — every amount traceable (`onOpen`
   opens the source) — and direction stays the sign and the words: the badge
   is an arrow, the amount is never coloured.

   One stream, newest first. A payout not yet landed is `pending`: the figure
   goes quiet and the row wears the product's own Still settling. */

function Disc({ image, name, glyph }) {
  if (image) {
    return <img src={image} alt="" style={{ width: "40px", height: "40px", borderRadius: "var(--radius-full)", objectFit: "cover", display: "block" }} />;
  }
  if (name) {
    return <MonogramAvatar name={name} size={40} />;
  }
  return (
    <span
      style={{
        width: "40px",
        height: "40px",
        borderRadius: "var(--radius-full)",
        background: "var(--surface-container-high)",
        color: "var(--text-secondary)",
        display: "grid",
        placeItems: "center",
      }}
    >
      <Icon name={glyph ?? "wallet"} size={20} />
    </span>
  );
}

export function LedgerRow({
  words,
  context,
  when,
  amount,
  signed = true,
  pending = false,
  image,
  name,
  glyph,
  direction,
  onOpen,
}) {
  const dir = direction ?? (amount < 0 ? "out" : "in");
  return (
    <button
      type="button"
      onClick={onOpen}
      className="cg-state cg-focus"
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
        <Disc image={image} name={name} glyph={glyph} />
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
            transform: dir === "in" ? "rotate(180deg)" : undefined,
          }}
        >
          <Icon name="arrow_outward" size={11} />
        </span>
      </span>
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "1px" }}>
        <span
          style={{
            fontSize: "var(--text-label-large)",
            lineHeight: "var(--text-label-large--line-height)",
            fontWeight: "var(--text-label-large--font-weight)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {words}
        </span>
        {(context || when) && (
          <span
            style={{
              fontSize: "var(--text-label-small)",
              lineHeight: "var(--text-label-small--line-height)",
              color: "var(--text-secondary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {context}
            {context && when ? " · " : ""}
            {when}
          </span>
        )}
      </span>
      <span style={{ flex: "none", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
        <span style={{ fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", color: pending ? "var(--text-secondary)" : "var(--on-surface)" }}>
          <MoneyFigure amount={amount} signed={signed} />
        </span>
        {pending && <PendingMarker />}
      </span>
      <span style={{ flex: "none", display: "inline-flex", color: "var(--text-secondary)" }} aria-hidden="true">
        <Icon name="chevron_right" size={18} />
      </span>
    </button>
  );
}
