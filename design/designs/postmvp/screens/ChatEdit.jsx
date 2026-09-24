/* EDIT CHAT — `Edit chat` on the details (round B1 of the chats work; jakob's
   rulings 2026-09-23).

   `ProfileEdit`'S ANATOMY, BECAUSE IT IS THE SAME TASK — and the founding's,
   which already borrowed it (`ChatCreate`): the picture's own row with its
   outline button, the fields marked `Optional` in their corners, `Save` at
   the foot. The fields open holding the current version whole, and the
   reader changes what they mean to. Drawn: the words have been added to.

   THREE FIELDS AND NO MORE. The name, the picture and the description are
   what a reader recognises as the chat's own metadata. Who can join, and the
   rest of the rules, ride the same founding payload — but they are the
   governance map, which ships silently and changes through its own amendment
   rule (chats.md §5); editing them is not this screen, and nothing here hints
   at it.

   NO CAPS ARE DRAWN — the founding's rule: the contract sets them, and the
   late counter says nothing until a writer nears one.

   EVERY CHANGE IS A NEW VERSION, NEVER AN OVERWRITE. On L1 an edit is a
   succession — a new lineage head whose founding payload carries the whole
   new state (chats.md §8) — and the old one stays published. So `Save` leads
   to the seal (`ChatEditSeal`), the profile's own path: every change to what
   a chat is called is a signed act.

   WHO MAY OPEN THIS follows the governance map (`ChatDetails`), and the
   picture's door is the platform's picker, then canonical's avatar crop at
   chat scale — not drawn here, as at the founding. */
export function Screen() {
  return (
    <>
      <PageHeader title="Edit chat" backHref="#" backLabel="Back to chat details" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, padding: "8px 24px 24px", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <ChatDisc image="post-photo.jpg" size={64} />
          <Button variant="outline" size="sm">Change picture</Button>
        </div>
        <TextField label="Name" corner="Optional" value="Coast walkers" />
        <TextField
          label="Description"
          corner="Optional"
          rows={3}
          value="Who is out on the flats, and when the crust holds. Walks leave from the harbour office an hour before low tide."
        />
        <div style={{ flex: 1 }} />
        <Button style={{ width: "100%" }}>Save</Button>
      </div>
    </>
  );
}
