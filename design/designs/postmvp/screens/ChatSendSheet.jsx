/* SEND TO A CHAT — what a post's share opens once chats exist (round B3 of the
   chats work, the integration round; backlog item 23, ruled in 2026-09-24).

   THE SHARE ACT ALWAYS OPENS THIS SHEET (jakob's ruling, the fix pass,
   2026-09-24 — a revision of the reel round's "one tap to the platform's own
   sheet"). Backlog item 23 recorded that sending a post into a chat "likely
   ranks above sharing out of the network entirely" (Instagram's send arrow);
   jakob ruled the two into ONE act: every share glyph, on every card, detail
   and reel, opens `Send to a chat`, and the platform's own share lives INSIDE
   it as `Share outside CoGra`. There is no second symbol: the glyph is the
   SHARE glyph everywhere (`ShareButton`), and the send arrow stays the seal's
   alone — the one on this sheet's foot is the seal that signs the message. The
   sheet's head row is `ChatPicker`'s head-row grammar (`New group chat`
   there).

   A COMPACT CHAT PICKER: the reader's own chats in their list's order, each a
   choice row — the chat's disc, its name — so one pick is one chat. ONE CHAT
   PER SEND, the lane's call, flagged: several would be several signed
   messages, `N things, signed together`, and a multi-pick would need the seal
   the single one does not.

   THE FOOT IS THE CHAT'S OWN FOOT. With a chat picked, the lock, an optional
   field and the send arrow stand at the sheet's foot — the thread's foot
   grammar, so sending here is the same act as sending there: the arrow signs
   one message into the picked chat, citing this post; press and hold it for
   what it signs. The lock is that chat's sticky choice; the quiet line under it
   says, while it is on, that the lock seals the words and never which post
   was sent — a Reference is never encrypted (chats.md §7).

   SIGNED, the sheet goes down over the post and a snackbar says `Sent to
   Coast walkers` with `Open`, the staged-act snackbar's shape — the chat is
   one tap away, not forced on the reader mid-scroll (`ChatThreadSentPost`).

   THE POST BENEATH IS THE REAL DETAIL SURFACE: `DetailHeader` with the post's
   ⋮ and the detail `PostCard`, inert under the sheet.

   THE MIGRATION NOTE: the share glyph lives on canonical's cards, detail and
   reel, where its edge is the OS share sheet today. At migration that edge
   becomes this sheet on every board that draws the glyph. */
export const FRAME = { width: 390, height: 844 };

const SEND_CHATS = [
  { name: "Coast walkers", image: "post-photo.jpg", selected: true },
  { name: "Ada Okonkwo", person: true },
  { name: "Headland honey", image: "gallery-honey.jpg" },
  { name: "Tobias Lindqvist", person: true },
  { name: "Salt-crust rubbings" },
];

function SendChatLabel({ chat }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
      {chat.person ? <MonogramAvatar name={chat.name} size="md" /> : <ChatDisc image={chat.image} size={32} />}
      <span>{chat.name}</span>
    </span>
  );
}

export function Screen() {
  return (
    <>
      <DetailHeader items={OWN_POST_MENU} />
      <DetailColumn>
        <PostCard {...SALT_MAPS_CURRENT} timestamp="12 September" variant="detail" score="9.10" comments={2} opinions={5} license={PUBLIC_DOMAIN} onOpenOpinions={() => {}} />
      </DetailColumn>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
      <BottomSheet open ariaLabel="Send to a chat" maxHeight="88%">
        <SheetTitle>Send to a chat</SheetTitle>
        <SearchBar placeholder="Search your chats" />
        <div style={{ padding: "0 16px 4px" }}>
          <ContentRow variant="door" title="Share outside CoGra" glyph="share" onOpen={() => {}} />
        </div>
        <div style={{ overflow: "hidden" }}>
          <SettingsGroup bare ariaLabel="Your chats">
            {SEND_CHATS.map((chat) => (
              <SettingsRow key={chat.name} name="send-to-chat" selected={chat.selected ?? false} label={<SendChatLabel chat={chat} />} />
            ))}
          </SettingsGroup>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 16px 16px", borderTop: "1px solid var(--border-hairline)" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
            <FieldAligned>
              <LockToggle />
            </FieldAligned>
            <div style={{ flex: 1, minWidth: 0 }}>
              <TextField label="Message" corner="Optional" rows={1} value="For after the walk — the stand's open till noon." />
            </div>
            <FieldAligned>
              <SendSeal />
            </FieldAligned>
          </div>
          <QuietNote>Sends one message into Coast walkers, pointing to this post.</QuietNote>
        </div>
      </BottomSheet>
    </>
  );
}
