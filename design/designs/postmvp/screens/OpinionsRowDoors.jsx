/* THE OPINIONS SHEET WITH ITS ROWS SPLIT — where a value stops being only a
   reading and becomes a door (jakob's door rule, 2026-09-22).

   THE DOOR RULE, DRAWN. Authoring doors are faces and fields: the stance face
   under a post opens the pad on a tap and signs a gentle positive on a hold,
   and that face is fully spent — it can never also open a history. HISTORY
   DOORS ARE READOUTS, so the door is the value at the row's end, which is a
   reading and nothing else today.

   THE ROW SPLITS RATHER THAN GROWING A CONTROL. A person area that opens the
   person (the standing 2026-09-01 ruling) and a value that opens that pair's
   timeline are two destinations, and a control inside a control is not markup —
   so the row becomes two targets side by side, exactly as `ContentRow` splits
   around its own `action`. Nothing about the row's ink changes: same face, same
   pair, same 56px rhythm.

   THE MASTER LEARNS AN OPTIONAL PROP AND NOTHING ELSE. `StanceRow` handed no
   history is byte-for-byte the row canonical has always drawn, which is what
   keeps this an excerpt rather than an edit to the MVP baseline. */
export function Screen() {
  return (
    <>
      <OpinionPostDetail />
      <BottomSheet open ariaLabel="Opinions on this post" maxHeight="88%">
        <SheetTitle>Opinions on this post</SheetTitle>
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {POST_OPINION_HOLDERS.map((holder) => (
            <StanceRow key={holder.handle} {...holder} onOpen={() => {}} onOpenHistory={() => {}} />
          ))}
        </div>
      </BottomSheet>
    </>
  );
}
