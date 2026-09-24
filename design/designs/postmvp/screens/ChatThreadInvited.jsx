/* A CHAT YOU ARE INVITED TO — the invitee's read of the thread (round B2 of
   the chats work, the governance round; jakob 2026-09-23).

   IT IS THE READER'S THREAD FROM OUTSIDE (`ChatThreadReader`), because that is
   what the invitee still is: an Invitation is a vouch, never participation
   (chats.md §4), so until the reader signs their own join they read the chat
   the way anyone can — plaintext in full, every sealed message a notice, since
   a non-member holds no key.

   THE FOOT SAYS WHO INVITED THEM AND OFFERS THE JOIN (`ChatJoinFoot`'s
   `invited` state): `Mira Voss invited you.` in one quiet line, and `Join`
   filled under it — the page's one committing act. JOINING SIGNS THE READER'S
   OWN PARTICIPANT, and the join opens its seal (`ChatJoinSeal`): one record,
   theirs, read back before it is signed.

   THERE IS NO DECLINE. An invitation is a proposal, and ignoring a proposal
   requires no graph action (layer1-interface.md §9.8), so a refusal button
   would promise an act that does not exist. The reader declines by leaving.

   EVERY ROUTE LANDS HERE. The invitation's notification row is round B3's —
   the kind does not exist yet — and it will open this face; the explorer's
   row for an invite-only chat the reader has been invited to opens it too. The
   way back is therefore the plain `Back`, since where it returns depends on
   the door. The explorer row's own word for an invited reader (it says
   `Invite only` to everyone today) is owed with B3.

   THE CHAT IS NIGHT FISHING CREW — the explorer's invite-only row, its last
   message Tobias's and sealed — and Mira, one of its members, invited the
   reader. */
export function Screen() {
  return <ChatThreadInvitedBody />;
}
