/* EDIT A POST (legacy conversion, lane C): one screen, one batch. Everything
   the edit changes — the words, the topics added and withdrawn, the citations
   — signs together, and `ActsFooter` says how much before the button does it.

   IT IS `EditComposeVideo`'s TEXT-AND-PICTURES TWIN, and `CommentEdit` at post
   scale: same header with its one "?", same fields, same topics and references
   blocks, same locked license, same foot. The picture body arrives as
   `PickedRow` — the whole row opens Show all, the way the compose wizard's
   details stage does — because a post being edited is a post being composed
   with its answers already filled in.

   THE LICENSE IS LOCKED, and the lock is a mark rather than an action: a
   licence is published with the post and never changes, so the row shows what
   was declared and says why nothing can be done about it.

   THE WITHDRAWN LINE IS A NOTE, not a control. A topic taken off is still an
   act in the batch — the acts sheet counts it — but there is nothing to press
   on the word itself, so it reads as the small true line it is. */
export function Screen() {
  return (
    <>
      <WizardHeader title="Edit post" leaveLabel="Leave — your draft is kept" help="Editing" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14, padding: "12px 24px 16px", overflow: "hidden" }}>
        <PickedRow
          items={[{ src: "post-photo.jpg" }, { src: "inviter.jpg" }]}
          caption="2 pictures — the body"
          onManage={() => {}}
        />

        <TextField label="Title" corner="Optional" value="Salt maps of the coast road" />

        <TextField
          label="Description"
          corner="Optional"
          rows={2}
          value="Rubbings from three weekends at low tide — paper against the salt crust."
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>Topics</FieldLabel>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <TopicRemovable topic="fieldnotes" />
            <TopicRemovable topic="saltmaps" />
            <Button variant="outline" size="sm">Add a topic</Button>
          </div>
          <QuietNote>Withdrawn: #coastroad</QuietNote>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>References</FieldLabel>
          <StagedReference kind="post" name="The long way home — @ada" src="post-photo.jpg" />
          <InlineAction size="sm" selfStart>+ Cite something</InlineAction>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <FactRow
            label="License"
            value="Public domain"
            action={
              <span style={{ color: "var(--text-secondary)", display: "inline-flex" }} aria-label="The license never changes">
                <Icon name="lock" size={16} />
              </span>
            }
          />
          <FactRow label="Sensitive" value="Not marked" action="Mark" last />
        </div>

        <div style={{ flex: 1 }} />

        <ActsFooter count={3} />
        <Button style={{ width: "100%" }}>Sign the edit</Button>
      </div>
    </>
  );
}
