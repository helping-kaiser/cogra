/* THE COMPOSER, OPENED ABOUT SOMETHING (readme §13, the menus round). Where
   Cite in a new post and Mention in a new post both land: the composer fresh,
   nothing written yet, and the reference already in the references block.

   CITATIONS ARE DECLARED AT CREATION, structured inputs only (roadmap.md) —
   there is no attaching one to a post that already landed. So the menu row does
   not mark the post it was opened from; it starts a new one that points at it,
   and the staging is what the reader sees first. Everything else on this stage
   is still empty, which is the honest picture: the citation is the given, the
   words are what is missing.

   ONE ROW, EITHER WORD. A cite stages a post, a mention stages a person, and
   the block cannot tell them apart because there is nothing to tell apart — a
   Reference edge is a Reference edge, and only the far end differs. */
export function Screen() {
  return (
    <>
      <WizardHeader title="Details" leaveLabel="Leave — your draft is kept" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14, padding: "12px 24px 16px", overflow: "hidden" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <ComposeFieldLabel note="Optional">Title</ComposeFieldLabel>
          <TextField label="" value="" />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <ComposeFieldLabel note="Optional">Description</ComposeFieldLabel>
          <TextField label="" rows={3} value="" />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <ComposeFieldLabel>Topics</ComposeFieldLabel>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button variant="outline" size="sm">Add a topic</Button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <ComposeFieldLabel>References</ComposeFieldLabel>
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
