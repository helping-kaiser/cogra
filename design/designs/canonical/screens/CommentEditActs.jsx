/* Edit comment · the acts (comment-media round, 2026-08-31): the footer's
   "This creates 2 signed actions" opened — an M3 modal bottom sheet, the
   EditActs pattern at comment scale, rendered with ActsCard (the sheet title
   carries the count, so the card carries rows and the all-or-nothing note).
   The sheet is the peek-from-a-composer pattern; ceremony screens keep the
   inline ActsCard — two patterns, one component. */

export function Screen() {
  return (
    <>
      <WizardHeader title="Edit comment" help="Editing" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14, padding: "12px 24px 16px", overflow: "hidden" }}>
        <QuietNote>Your comment on "The long way home".</QuietNote>

        <TextField label="Words" rows={3} value="The glovebox camera earns its keep — this is the print from 2019 that almost catches it." />

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>Pictures</FieldLabel>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <MediaThumb src="comment-camera.jpg" alt="A person holding a film camera" size={56} fit="contain" onRemove={() => {}} />
            <Button variant="text" size="sm">+ Add · 1 of 4</Button>
          </div>
          <DescribeCounter described={1} total={1} onDescribe={() => {}} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>Topics</FieldLabel>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <TopicRemovable topic="glovebox" />
            <Button variant="outline" size="sm">Add a topic</Button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <FieldLabel>References</FieldLabel>
          <InlineAction size="sm" selfStart>+ Cite something</InlineAction>
        </div>

        <FactRow
          label="License"
          value="Public domain"
          action={
            <span style={{ color: "var(--text-secondary)", display: "inline-flex" }} aria-label="The license never changes">
              <Icon name="lock" size={16} />
            </span>
          }
          last
        />

        <div style={{ flex: 1 }} />

        <ActsFooter count={2} />
        <Button style={{ width: "100%" }}>Sign the edit</Button>
      </div>

      <BottomSheet open ariaLabel="What the edit signs">
        <SheetTitle>2 signed actions</SheetTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "0 24px 16px" }}>
          <ActsCard
            rows={[
              { label: "Edit", value: "The glovebox camera earns its keep — this is the print…", count: "1 action" },
              { label: "Topic added", value: "#glovebox", count: "1 action" },
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
