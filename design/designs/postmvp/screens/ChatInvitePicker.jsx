/* ADD PEOPLE · picking who to invite — what the details' `Add people` opens
   (round B2 of the chats work, the governance round; jakob 2026-09-23).

   `ChatPickerGroup`'S GRAMMAR, POINTED AT A CHAT THAT EXISTS. The same list of
   people with the add mark on each row's edge, a tap staging rather than
   opening; whoever is staged stands above the list as a `StagedReference` row
   with its ×; `Next` at the foot, `WizardFooter`'s, carries them to the seal
   (`ChatInviteSeal`). Only the title and the way back change with the job.

   ONLY PEOPLE WHO ARE NOT IN THE CHAT. Its members are not candidates, and
   neither is anyone whose invitation already stands — Ada, invited on 20
   September and not yet joined, is listed on the details as `Invited — hasn't
   joined yet`, and a second invitation would say nothing the first does not.
   The quiet line under the list says why a list can be this short: most of the
   reader's people are already here.

   ANY MEMBER MAY DO THIS. An Invitation is the inviter's own public vouch
   (chats.md §4), never a chat decision, so nothing about it waits for anyone:
   no pending card, no count. What stays owed is the invitee's own Participant
   — they join only if they accept. */
export function Screen() {
  return (
    <>
      <PageHeader title="Add people" backHref="#" backLabel="Back to chat details" />
      <div style={{ flex: "none" }}>
        <SearchBar placeholder="Search people" />
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 16px 8px" }}>
          <StagedReference kind="person" name="Wren Aliyev" sub="@wren" onRemove={() => {}} />
          <StagedReference kind="person" name="Nadia Rask" sub="@nadia" onRemove={() => {}} />
        </div>
      </div>
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: 8 }}>
        <div>
          <PeopleRows people={[{ name: "Sal Torres", handle: "saltorres" }]} add />
        </div>
        <div style={{ padding: "0 24px" }}>
          <QuietNote>People already in the chat, or already invited, aren't listed.</QuietNote>
        </div>
      </div>
      <WizardFooter label="Next" />
    </>
  );
}
