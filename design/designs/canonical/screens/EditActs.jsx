/* EDIT A POST · THE ACTIONS (legacy conversion, lane C): the footer's "This
   creates 3 signed actions" opened. An M3 modal bottom sheet, the count in its
   title and the acts themselves in `ActsCard` — the same pattern
   `CommentEditActs` draws at comment scale, from the same two components.

   THE EDIT BENEATH IS THE EDIT — `EditComposeBody`, the same body
   `EditCompose` draws. What a sheet covers is inert, not shortened.

   THE ACTS ARE THE POST'S THREE: the edit itself, the topic added, the topic
   withdrawn. Withdrawing is an act like adding — nothing is deleted, a later
   layer says the topic no longer stands — which is why the card counts it. */
export function Screen() {
  return (
    <>
      <EditComposeBody />

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
