/* THE DETAILS STAGE ON THE PICTURE PATH (readme §13, the menus round): the
   body is already picked, and this is where it gets its words. The twin of
   `ComposeCited` — same wizard header, same fields, same References block —
   with the media summary on top that the words path has nothing to show.

   THE ROW IS THE AFFORDANCE. `PickedRow` opens Show all and carries no Crop or
   Edit links of its own (jakob 2026-08-31, "none"); the crop step is one Back
   away, and a second entrance to the same stage is the two-menus pattern the
   system refuses elsewhere.

   ONE STAGED REFERENCE, THE SYSTEM'S OWN. The block is `StagedReference` — node
   mark, name, kind, the pair, and the remove × — because a citation staged on
   the picture path is the same citation staged anywhere else, and a board that
   draws its own version of it drifts from the one that doesn't. */
export function Screen() {
  return (
    <>
      <WizardHeader title="Details" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14, padding: "12px 24px 16px", overflow: "hidden" }}>
        <PickedRow
          items={[{ src: "post-photo.jpg" }, { src: "inviter.jpg" }]}
          caption="2 pictures — the body"
          onManage={() => {}}
        />
        <DescribeCounter described={0} total={2} onDescribe={() => {}} />

        <TextField label="Title" corner="Optional" value="Salt maps of the coast road" />

        <TextField label="Description" corner="Optional" rows={3} value="Rubbings from three weekends at low tide — paper against the salt crust." />

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>Topics</FieldLabel>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <TopicRemovable topic="fieldnotes" />
            <TopicRemovable topic="coastroad" />
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
          <InlineAction size="sm" selfStart>+ Cite something</InlineAction>
        </div>

        <div style={{ flex: 1 }} />

        <Button selfStart={false}>Next</Button>
      </div>
    </>
  );
}
