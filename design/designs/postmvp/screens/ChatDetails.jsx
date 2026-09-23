/* CHAT DETAILS · the member's view — what the thread's header and the row
   menu's `Chat details` open (round B1 of the chats work; jakob's rulings
   2026-09-23). The chats round left this one destination undrawn on purpose,
   and five gap edges pointed at it: the four thread headers and the row menu.
   This board resolves them.

   THE ORDER IS WHATSAPP'S GROUP INFO, FILTERED THROUGH COGRA'S GRAMMAR — the
   lane's call, flagged for review. From the top:
   · THE IDENTITY — the chat's face, its name, the policy in one line, its
     words. `ProfileHeader`'s compact shape, because it is the same job.
   · THE ACTIONS ROW — the chat's opinion control wide (the profile header's
     stance-anchor precedent, jakob), and `Edit chat` sized by its word beside
     it where the profile's `Message` stands. WhatsApp puts a group's edit in
     the header's corner; CoGra's own profile puts `Edit profile` on this row
     instead, and the chat follows the profile.
   · MEDIA — the door into what was shown, first, as WhatsApp puts it first.
     SEARCH IS NOT HERE (jakob, the fix pass): it rides the thread's header as
     a glyph beside the details door (`ChatThreadHeader`), one tap from the
     thread being searched.
   · OPEN DECISIONS — beside media (jakob), drawn empty: `Nothing is being
     decided.`
   · MEMBERS — `Add people` heading the list, then the rows, each wearing its
     role. One member is a Collective; one invited person has not joined yet.
     EACH ROLE WORD IS A DOOR (jakob, the fix pass) to the role-change flow —
     `decision:change_role`'s multi-voice face, round B2's, an intended gap.
     The stance row's split grammar (`RoleDoor`): the person area opens the
     person, the underlined word opens the role. The invitee has neither.
   · THE CHAT'S OWN SETTINGS — mute, and the door to its edit history.
   · LEAVE — last, alone in its group, quiet at rest (the account deletion's
     rule: the weight of an act lives in the dialog it opens, not in a red row).

   EDIT CHAT FOLLOWS THE GOVERNANCE MAP, NOT A ROLE. Whether a reader may
   propose a change to the chat's name, picture and words is
   `decision:set:metadata`'s eligibility — under the default map every active
   member (chats.md §5) — so the button shows wherever the map makes the
   reader eligible and is absent wherever it does not. This fixture's reader
   is the founder and admin, for whom it is drawn present. Whether their voice
   alone carries the change is the map's tally, answered at the seal
   (`ChatEditSeal`).

   ADD PEOPLE IS THE INVITATION FLOW INTO AN EXISTING CHAT, and that is round
   B2's: the door is drawn here and the graph carries it as an intended gap.
   Any member may invite (an Invitation is a member's public vouch, chats.md
   §4), so every member sees it.

   MUTE STANDS HERE AND ON THE ROW MENU (jakob) — one per-chat setting, two
   switches onto it. It silences the device push and nothing else: messages
   never write bell rows, so there is no tray share to silence. The chat keeps
   its place and its unread dot on the list.

   THE PENDING INVITE. The reader invited Ada on 20 September (the edit
   history's newest row) and she has not pointed back, so her row says `Invited — hasn't joined yet` and carries no role
   (`MemberRows`). The thread carries the same fact as a quiet line — a state
   of the drawn thread (`ChatThread`), not redrawn here.

   NO PRESENCE, ANYWHERE ON THE PAGE (jakob). A member row is a name, a handle
   and a role: who is in the chat and in what capacity, which are public
   records. Online, last seen and typing are not records and are never drawn.

   WHAT IS DEFERRED. Disavowing a message and everything else moderation-
   flavoured is the moderation slice's (jakob) — no row for it here, and none
   on a member's row. The governance map is not shown and not editable here:
   it ships its default silently, as at the founding.

   THE FRAME IS TALLER THAN A PHONE so the whole page reads at once, down to
   the leave — the page scrolls in the product, and its bottom is the part a
   review most needs to see. */
export const FRAME = { width: 390, height: 1112 };

export function Screen() {
  return <ChatDetailsBody />;
}
