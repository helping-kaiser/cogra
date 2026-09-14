import React from "react";
import { BottomSheet, SheetTitle } from "../core/BottomSheet.jsx";
import { Button } from "../core/Button.jsx";
import { StagedReference } from "./StagedReference.jsx";

/* The staged citations, managed (jakob's ruling 2026-09-14, backlog item 70):
   the sheet the seal's References row opens once it counts instead of naming.
   One staged citation reads back as itself on the seal; two or more read back
   as "N cited", and this is where the N is.

   IT IS `PickedSheet`'S SHAPE, for the reason that sheet has its shape: a
   collection staged by an author, managed in one place rather than in as many
   places as the collection appears. Rows, then the word that closes the sheet —
   no scrim button, no second way out.

   THE ROWS ARE `StagedReference`, whole. The composer already draws a staged
   citation — the kind's mark, what it points at, the pair signed on the act,
   the × that takes it back out, and the name that opens the pair — and a sheet
   that drew its own version of that row would be the second drawing of one
   fact. Each control names its own citation ("Remove <name>", "<name> — set how
   it relates"), which is the master's own rule and the reason a block of these
   is readable at all.

   IT ADDS NOTHING. `PickedSheet` manages what was picked and never offers
   another pick; the same holds here. A post's seal carries no add-rows by
   design (`ReplySeal`'s note says so from the other side), and a door out of it
   that grew a "+ Cite something" would hand the seal a stage's job. Citations
   are staged where they are staged — the details step, the reply's own card. */

export function CitedSheet({ open = false, onClose, items = [], onDone, inline = false }) {
  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel={`Cited · ${items.length}`} inline={inline} maxHeight="88%">
      <SheetTitle>Cited · {items.length}</SheetTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "var(--space-2) var(--space-6) 0" }}>
        {items.map((item, index) => (
          <StagedReference key={item.name ?? index} {...item} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "var(--space-2) var(--space-4) var(--space-2)" }}>
        <Button variant="text" onClick={onDone ?? onClose}>
          Done
        </Button>
      </div>
    </BottomSheet>
  );
}
