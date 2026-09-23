/* CHAT DETAILS · read from outside — the same surface for a reader who is
   not a member, reached from `ChatThreadReader`'s header (round B1 of the
   chats work; jakob's rulings 2026-09-23).

   CHATS ARE PUBLIC, SO THE DETAILS ARE THE DETAILS (jakob). The face, the
   name, the words, the members and their roles, the edit history, the media
   and the search are all public records or public reads (chats.md §1), so a
   non-member meets the member's page in the member's order. Open decisions
   are public too — a chat's decisions to act are visible facts even when
   their content rides encrypted (§7, *What encryption does not hide*) — so
   the section stands here, empty in this fixture as on the member's board.

   WHAT A NON-MEMBER CANNOT DO IS SIMPLY ABSENT. No `Edit chat` (the map's
   eligibility is its active members), no `Add people` (an invitation is a
   member's vouch), no mute (there is nothing of theirs to silence) and no
   leave (there is nothing to leave). Absent, not disabled: a greyed row is a
   promise the reader cannot keep.

   THE JOIN TAKES EDIT'S PLACE ON THE ACTIONS ROW, worded by the chat's
   policy — the same words as the thread's foot (`ChatJoinFoot`) and the
   explorer's row: this chat takes requests, so `Ask to join`; an open chat
   reads `Join`. It is the page's one committing act, so it is the filled
   button, sized by its word beside the wide opinion anchor. An INVITE-ONLY
   chat has nothing a stranger can press: the row keeps the anchor alone and
   the thread foot's quiet line — `Invite only — a member can invite you.` —
   stands under it (stated, not drawn).

   THE OPINION IS ANYONE'S. An Opinion → Chat is the space's own sentiment
   (chats.md §4) and needs no membership, so the anchor is live here exactly
   as on the member's page.

   A GUEST GETS THIS SAME FACE (jakob: chats are public reads, and reading
   needs no account). The join and the opinion anchor are where the guest gate
   meets them — the ordinary join prompt, canonical's — and everything else on
   the page reads as drawn. One board, both readers.

   THE FIXTURE IS `ChatThreadReader`'s chat: Harbour office, no picture, on
   request, four members. */
export const FRAME = { width: 390, height: 900 };

const HARBOUR_OFFICE_MEMBERS = [
  { name: "Tobias Lindqvist", handle: "tobias", role: "admin" },
  { name: "Mira Voss", handle: "mira", src: "inviter.jpg", role: "chat_mod" },
  { name: "Juno Baptiste", handle: "juno", role: "member" },
  { name: "Kel Moreau", handle: "kel", role: "member" },
];

export function Screen() {
  return (
    <>
      <PageHeader title="Chat details" backHref="#" backLabel="Back to the chat" />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", paddingBottom: 24 }}>
        <ChatIdentity name="Harbour office" policy="request" description="Opening hours, the lost-and-found, and whatever the tide brings in to the harbour office.">
          <Button style={{ flex: "none" }}>Ask to join</Button>
        </ChatIdentity>
        <DetailsGroup ariaLabel="In this chat">
          <SettingsRow label="Media in this chat" onOpen={() => {}} />
          <SettingsRow label="Search in this chat" onOpen={() => {}} />
        </DetailsGroup>
        <OpenDecisionsEmpty />
        <MembersSection members={HARBOUR_OFFICE_MEMBERS} />
        <DetailsGroup ariaLabel="This chat">
          <SettingsRow label="Edit history" onOpen={() => {}} />
        </DetailsGroup>
      </div>
    </>
  );
}
