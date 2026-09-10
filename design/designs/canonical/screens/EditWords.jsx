/* EDIT A POST WHOSE BODY IS WORDS (the edit body round, 2026-09-10) — the
   `EditCompose` anatomy with `WordsBody` where the picked row stands.

   IT IS ONE BOARD FOR TWO ARRIVALS, because they are one state. A words post
   opened for editing lands here (an entry, the way `EditComposeVideo` is one
   for a clip); so does a media post whose LAST picture was just removed in
   the manager, which is the flip the ruling allows — the field arrives empty
   in that case and everything else about the surface is identical. Drawing
   the second as a board of its own would be drawing this one twice.

   THE POST IS THE SAME POST the picture edit carries, after the flip: same
   title, same tags, same withdrawn tag, same locked licence, the same three
   acts in the foot. That is what makes the pair legible side by side on the
   canvas — one post, two bodies — and it is why the acts sheet both boards
   open (`EditActs`) still counts the truth.

   THERE IS NO DESCRIPTION FIELD. A description is how words stand BESIDE
   pictures (readme §13, the compose flow); with the body already words it has
   no job, and a second prose field beside the first would only ask the author
   which one the post is. The title stays: it names a post of either kind.

   THE ADD CONTROL IS THE WAY BACK to a media body, and the line under it is
   the same blessed sentence the picture edit carries — read from this side it
   says what taking pictures would cost: the words are the body until media
   replaces them. */
export function Screen() {
  return (
    <>
      <WizardHeader title="Edit post" leaveLabel="Leave — your draft is kept" help="Editing" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14, padding: "12px 24px 16px", overflow: "hidden" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, minHeight: 0 }}>
          <FieldLabel>What do you want to publish?</FieldLabel>
          <WordsBody
            paragraphs={[
              "Three weekends of walking the same stretch at low tide, tracing where the salt crust draws its lines.",
              "If you ever drive it, stop at the third headland and look down for once.",
            ]}
          />
          <InlineAction size="sm" selfStart>+ Add pictures or a video</InlineAction>
          <QuietNote>A post&apos;s body is words or media, never both.</QuietNote>
        </div>

        <TextField label="Title" corner="Optional" value="Salt maps of the coast road" />

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>Tags</FieldLabel>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <TopicRemovable topic="fieldnotes" onEdit={() => {}} />
            <TopicRemovable topic="saltmaps" onEdit={() => {}} />
          </div>
          <InlineAction size="sm" selfStart>+ Add a tag</InlineAction>
          <QuietNote>Withdrawn: #coastroad</QuietNote>
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

        <ActsFooter count={3} />
        <Button style={{ width: "100%" }}>Sign the edit</Button>
      </div>
    </>
  );
}
