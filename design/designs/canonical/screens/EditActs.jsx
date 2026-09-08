/* EDIT A POST · THE ACTIONS (legacy conversion, lane C): the footer's "This
   creates 3 signed actions" opened. An M3 modal bottom sheet, the count in its
   title and the acts themselves in `ActsCard` — the same pattern
   `CommentEditActs` draws at comment scale, from the same two components.

   THE EDIT BENEATH IS DRAWN SHORT, as the hand board drew it: the body, the
   title and the staged topics, and the sign button. What the sheet covers is
   inert, so the boards under these overlays abbreviate the surface they sit on
   rather than repeating it whole — a drawing question the round leaves open,
   preserved here exactly as it was found.

   THE ACTS ARE THE POST'S THREE: the edit itself, the topic added, the topic
   withdrawn. Withdrawing is an act like adding — nothing is deleted, a later
   layer says the topic no longer stands — which is why the card counts it. */
export function Screen() {
  return (
    <>
      <WizardHeader title="Edit post" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14, padding: "12px 24px 16px", overflow: "hidden" }}>
        <PickedRow items={[{ src: "post-photo.jpg" }, { src: "inviter.jpg" }]} caption="2 pictures — the body" />

        <TextField label="Title" value="Salt maps of the coast road" />

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <TopicRemovable topic="fieldnotes" />
          <TopicRemovable topic="saltmaps" />
        </div>

        <div style={{ flex: 1 }} />

        <Button style={{ width: "100%" }}>Sign the edit</Button>
      </div>

      <BottomSheet open ariaLabel="What the edit signs">
        <SheetTitle>3 signed actions</SheetTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "0 24px 16px" }}>
          <ActsCard
            rows={[
              { label: "Edit", value: "Salt maps of the coast road", count: "1 action" },
              { label: "Topics added", value: "#saltmaps", count: "1 action" },
              { label: "Topics withdrawn", value: "#coastroad", count: "1 action" },
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
