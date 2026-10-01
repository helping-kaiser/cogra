/* EDIT A POST · THE ACTIONS (legacy conversion, lane C): the footer's "This
   signing 5 things" opened. An M3 modal bottom sheet, the count in its
   title and the acts themselves in `ActsCard` — the same pattern
   `CommentEditActs` draws at comment scale, from the same two components.

   THE EDIT BENEATH IS THE EDIT — `EditComposeBody`, the same body
   `EditCompose` draws. What a sheet covers is inert, not shortened.

   THE KINDS ARE THE COMPLETE SET (jakob's ruling, the night batch 2026-10-01
   — audit K5.3). An edit stages more than its words and tags, and every kind
   it stages is a row here, counted in the records it signs:
   · `Edit` — the post's new content state, one record.
   · `Tags added` · `Tags withdrawn` · `Tags revised` — one record per tag:
     a tag is newest-wins, so its un-tag and its new pair are each one record.
   · `Citations added` · `Citations revised` — one record per citation: a
     revision is the one additive record `RefPairEdit` stages.
   · `Citations withdrawn` — `ReferenceClaim.withdrawalCost` records per
     citation, possibly more than one.
   · `Cover changed` — the video edit's new face, one record.
   A row is drawn only when its kind is in the batch; this edit's batch holds
   four of them.

   A ROW'S COUNT IS THE RECORDS IT SIGNS, NEVER "1 PER REMOVAL" (jakob,
   verbatim in the audit record: a bundled connection with a magnitude over 1
   on any dimension needs MULTIPLE counter-acts, and the seal's act count
   reflects the real counter-record count). The citation withdrawn here was
   revised upward past 1, so its one name reads `2` and is heard as `2 things`;
   the title, the footer and the rows all add up to the same five.

   SIGN IS THE CONFIRMATION. Withdrawing is an act like adding — nothing is
   deleted, a later layer says the tag or citation no longer stands — which is
   why the card counts it, and the count said here and on the foot is the
   confirmation api-spec asks for before a multi-record withdrawal is prepared:
   no dialog asks again. */
export function Screen() {
  return (
    <>
      <EditComposeBody />

      <BottomSheet open ariaLabel="What the edit signs">
        <SheetTitle>5 things, signed together</SheetTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "0 24px 16px" }}>
          <ActsCard
            rows={[
              { label: "Edit", value: "Salt maps of the coast road", count: "1", countNoun: "edit" },
              { label: "Tags added", value: "#saltmaps", count: "1", countNoun: "tag" },
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
