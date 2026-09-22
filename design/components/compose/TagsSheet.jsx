import React from "react";
import { BottomSheet, SheetTitle } from "../core/BottomSheet.jsx";
import { Button } from "../core/Button.jsx";
import { TopicRemovable } from "./TopicRemovable.jsx";

/* The staged tags, managed (backlog item 95; jakob's ruling, the batch-rulings
   round): the sheet the seal's Tags row opens once it counts instead of naming.
   Two short tags read back as themselves on the seal; three or more read back
   as "N tags", and this is where the N is.

   IT IS `CitedSheet`'S ARGUMENT, WORD FOR WORD, WITH TAGS IN PLACE OF
   CITATIONS. Both rows on that seal are read-backs that fold when their names
   stop fitting, both doors promise a list behind a count, and a count with
   nothing behind it is a number the reader cannot check. The two sheets are
   deliberately the same shape so the seal has one grammar and not two.

   THE PILLS ARE `TopicRemovable`, WHOLE, IN THE COMPOSER'S OWN WRAPPING ROW.
   The details stage already draws a staged tag — the name, the pair signed on
   the act, the × that takes it back out, and the name that opens the pair — and
   a sheet that drew its own version of that would be the second drawing of one
   fact. `CitedSheet` reaches for `StagedReference` for exactly this reason; the
   masters differ because the staged things differ, not because the sheets do.
   The row wraps rather than stacking one tag per line: a tag is a pill wherever
   the composer shows it, and a sheet that turned it into a full-width row would
   be inventing a third drawing of a topic.

   IT ADDS NOTHING. No "+ Add a tag" here: a post's seal carries no add-rows by
   design, and a door out of it that grew one would hand the seal a stage's job.
   Tags are staged where they are staged — the details step, the reply's own
   card — which is also why this sheet's arrival does not move them. */
export function TagsSheet({ open = false, onClose, items = [], onDone, inline = false }) {
  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel={`Tags · ${items.length}`} inline={inline} maxHeight="88%">
      <SheetTitle>Tags · {items.length}</SheetTitle>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "var(--space-2) var(--space-6) 0" }}>
        {items.map((item, index) => (
          <TopicRemovable key={item.topic ?? index} {...item} />
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
