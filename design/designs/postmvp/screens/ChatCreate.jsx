/* NEW CHAT · the founding — a group chat, from the list's `New chat`
   (would-like #3; jakob's rulings 2026-09-23).

   MINIMAL ON PURPOSE. A name, a picture and a description — every one of them
   optional and changeable later — and the one choice that cannot wait: who
   can join. `ProfileEdit`'s anatomy, because it is the same task (a face, a
   name, a few words about it): the picture's row with its outline button, the
   fields marked `Optional` in their corners, the forward action at the foot.
   No caps are drawn — the contract sets them, and the late counter says
   nothing until a writer nears one anyway.

   GOVERNANCE SHIPS ITS DEFAULT SILENTLY (jakob). A chat's rules — who decides
   a request, who may change the chat — ride the governance map, and the map's
   default is what every new chat starts with. Nothing on this screen names it,
   hints at it or offers to change it; the join rows' own lines are careful to
   say only what a joiner meets, never who lets them in.

   WHO CAN JOIN IS THREE CHOICE ROWS, NOT A PILL. jakob dislikes the segmented
   pill, and a three-way pill is exactly the one `TabBar`'s charter already
   ruled out. The house idiom for "one of a few, each needing a line of
   explanation" is `SettingsRow`'s choice variant inside a `SettingsGroup` —
   settings' `Giving an opinion`, where each of three rows carries the dot and
   a one-line status saying what choosing it does. That is this question's
   exact shape, so it is drawn with that exact anatomy. `Open` is the row drawn
   chosen.

   `Next` LEADS TO THE FOUNDING'S SEAL. Founding a chat is a signed act, and
   every signed act other than a message reads back what it signs first — the
   profile's `Save` reaches `ProfileEditSeal` the same way. That seal is not
   drawn this round (graph: a gap). */
export function Screen() {
  return (
    <>
      <PageHeader title="New chat" backHref="#" backLabel="Back to your chats" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, padding: "8px 24px 24px", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span
            aria-hidden="true"
            style={{ flex: "none", width: 64, height: 64, display: "grid", placeItems: "center", borderRadius: "var(--radius-full)", background: "var(--surface-container-high)", color: "var(--text-secondary)" }}
          >
            <Icon name="forum" size={28} />
          </span>
          <Button variant="outline" size="sm">Choose a picture</Button>
        </div>
        <TextField label="Name" corner="Optional" value="Low-tide walks" />
        <TextField label="Description" corner="Optional" rows={3} value="Who is out on the flats, and when the crust holds." />
        <SettingsGroup label="Who can join">
          <SettingsRow name="chat-join" selected label="Open" status="Anyone can join straight away." />
          <SettingsRow name="chat-join" selected={false} label="On request" status="Anyone can ask to join." />
          <SettingsRow name="chat-join" selected={false} label="Invite only" status="Only people who are invited can join." />
        </SettingsGroup>
        <div style={{ flex: 1 }} />
        <Button style={{ width: "100%" }}>Next</Button>
      </div>
    </>
  );
}
