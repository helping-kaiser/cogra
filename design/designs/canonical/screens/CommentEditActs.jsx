/* Edit comment · the acts (comment-media round, 2026-08-31): the footer's
   "You're signing 5 things" opened — an M3 modal bottom sheet, the EditActs
   pattern at comment scale, rendered with ActsCard (the sheet title carries
   the count, so the card carries rows and the all-or-nothing note). The sheet
   is the peek-from-a-composer pattern; ceremony screens keep the inline
   ActsCard — two patterns, one component.

   THE EDIT BENEATH IS THE EDIT — `CommentEditBody`, the same body
   `CommentEdit` draws. What a sheet covers is inert, not shortened.

   THE KINDS ARE THE COMPLETE SET, COUNTED IN RECORDS (backlog 126, jakob
   2026-10-02: the post edit's package "same semantics at comment scale").
   `EditActs` names the set — `Edit`, `Tags added`, `Tags withdrawn`, `Tags
   revised`, `Citations added`, `Citations revised`, `Citations withdrawn`,
   `Cover changed` — a row per kind in the batch. A tag withdrawal is one
   record; a citation's withdrawal is `ReferenceClaim.withdrawalCost`
   records, and the one withdrawn here was revised past 1, so its row reads
   `2`, heard as `2 things`. The title, the footer and the rows add up to the
   same five, and Sign is the confirmation: no dialog asks again. */

export function Screen() {
  return (
    <>
      <CommentEditBody />

      <BottomSheet open ariaLabel="What the edit signs">
        <SheetTitle>5 things, signed together</SheetTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "0 24px 16px" }}>
          <ActsCard
            rows={[
              { label: "Edit", value: "The glovebox camera earns its keep — this is the print…", count: "1", countNoun: "edit" },
              { label: "Tags added", value: "#glovebox", count: "1", countNoun: "tag" },
              { label: "Tags withdrawn", value: "#coastroad", count: "1", countNoun: "tag" },
              { label: "Citations withdrawn", value: "Tide tables and the third headland — @juno", count: "2", countNoun: "thing" },
            ]}
            note="They land together, or none does."
          />
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button variant="text">Done</Button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
