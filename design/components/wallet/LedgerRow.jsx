import React from "react";
import { ContentRow } from "../core/ContentRow.jsx";
import { MoneyFigure } from "../core/MoneyFigure.jsx";

/* One line of the wallet's history (item 12 round 2): an IDENTITY ROW, not a
   ledger line — the leading disc is who or what the money moved with (the
   tipper's face, the paying campaign's cover, a glyph for the rest), wearing
   a small DIRECTION BADGE (arrow out as drawn, in = rotated). The words
   carry what happened and what paid it — every amount traceable (`onOpen`
   opens the source) — and direction stays the sign and the words: the badge
   is an arrow, the amount is never coloured.

   One stream, newest first. A payout not yet landed is `pending`: the figure
   goes quiet and the row wears the product's own Still settling.

   THE SHAPE IS `ContentRow`'s, and this file is what the wallet calls it. The
   row itself — disc, two lines, trailing edge, chevron — is the master every
   list in the product draws; what belongs here is the wallet's vocabulary:
   `words` and `context`, an amount rather than a trailing node, and direction
   read off the sign when nobody says otherwise. */

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
    <ContentRow
      variant="ledger"
      title={words}
      second={
        context || when ? (
          <>
            {context}
            {context && when ? " · " : ""}
            {when}
          </>
        ) : undefined
      }
      trailing={<MoneyFigure amount={amount} signed={signed} />}
      pending={pending}
      image={image}
      name={name}
      glyph={glyph}
      direction={dir}
      onOpen={onOpen}
    />
  );
}
