/* THE DETAILS STAGE, ARRIVED AT WITH A REFERENCE STAGED (readme §13, the menus
   round). Where a cite that began at a menu row surfaces: the wizard walked
   from its pick stage with the reference riding along unseen, and this is the
   step that finally shows it. Nothing else is written yet, which is the honest
   picture of that moment — the citation is the given, the words are what is
   missing.

   THE WIZARD'S OWN HEADER, because the wizard is how this is reached: the arrow
   steps one stage back to the words, the X leaves the flow with the draft kept.
   Nothing teleports here, so nothing needs an exit of its own.

   CITATIONS ARE DECLARED AT CREATION, structured inputs only (roadmap.md) —
   there is no attaching one to a post that already landed. So the menu row does
   not mark the post it was opened from; it opens a new post that will point at
   it.

   ONE ROW, EITHER WORD. A cite stages a post, a mention stages a person, and
   the block cannot tell them apart because there is nothing to tell apart — a
   Reference edge is a Reference edge, and only the far end differs. */
export function Screen() {
  return (
    <>
      <WizardHeader title="Details" leaveLabel="Leave — your draft is kept" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14, padding: "12px 24px 16px", overflow: "hidden" }}>
        <TextField label="Title" corner="Optional" value="" />

        <TextField label="Description" corner="Optional" rows={3} value="" />

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>Topics</FieldLabel>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button variant="outline" size="sm">Add a topic</Button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>References</FieldLabel>
          <StagedReference
            kind="post"
            name="The long way home — @ada"
            sub="Post"
            src="post-photo.jpg"
            value="+0.10 / +0.10"
          />
          <Button variant="text" size="sm" selfStart>+ Cite something</Button>
        </div>

        <div style={{ flex: 1 }} />

        <Button selfStart={false}>Next</Button>
      </div>
    </>
  );
}
