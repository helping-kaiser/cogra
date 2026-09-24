/* SAVED — with a chat message in it, the fourth saveable kind (round B3 of the
   chats work, the integration round; canonical's `Saved` docblock: "its row
   shape lands with the chat round and joins this same list rather than
   starting a second one").

   THE SAME LIST, ONE ROW SHAPE MORE. A saved message is a `ContentRow` like
   its neighbours, read the comment's way — a comment is the nearest kind, it
   too lives inside another surface: the disc is the kind's glyph
   (`NODE_GLYPHS`' `send`, the message's one mark), the title is the message's
   own words, ellipsized, the sender's handle beside them where a post's author
   stands, and the second line says where it lives, `in Coast walkers` — the
   comment row's `on {post}`, the search row's indirect-hit words. The edge is
   when the reader saved it, and the row carries its own `Unsave`.

   AN ENCRYPTED MESSAGE THE READER HOLDS THE KEY FOR is saved with its words
   shown, the preview rule; saving never decrypts anything for anyone else,
   because Saved is private. One whose key the reader has lost (a device
   without it) reads `An encrypted message` with the lock — stated, not drawn.

   A TAP OPENS THE THREAD SCROLLED TO THE MESSAGE — its own surface, the way a
   saved comment opens its post's thread.

   THE MIGRATION NOTE: Saved is canonical's. At migration the message row joins
   canonical's list and this excerpt goes; the other two rows stand for
   canonical's rows so the new one is drawn in place. */
const Unsave = () => (
  <button
    type="button"
    aria-label="Unsave"
    className="cg-state cg-focus cg-hit"
    style={{ display: "grid", placeItems: "center", height: "40px", width: "40px", border: 0, background: "none", borderRadius: "var(--radius-full)", color: "var(--text-secondary)", cursor: "pointer", padding: 0 }}
  >
    <Icon name="bookmark" size={22} />
  </button>
);

export function Screen() {
  return (
    <>
      <PageHeader title="Saved" backHref="#" backLabel="Back to your profile" />
      <ChronicleList>
        <ContentRow
          variant="chronicle"
          chevron={false}
          glyph="send"
          title="Six it is. Meet at the harbour office."
          titleAside="@mira"
          second="in Coast walkers"
          trailing="1d"
          action={<Unsave />}
          onOpen={() => {}}
        />
        <ContentRow
          variant="chronicle"
          chevron={false}
          glyph="dynamic_feed"
          title="Salt maps of the coast road"
          titleAside="@sol"
          second="Rubbings from three weekends at low tide."
          trailing="2d"
          action={<Unsave />}
          onOpen={() => {}}
        />
        <ContentRow
          variant="chronicle"
          chevron={false}
          glyph="chat_bubble"
          title="The third headland light is real"
          titleAside="@tobias"
          second="on The long way home"
          trailing="3d"
          action={<Unsave />}
          onOpen={() => {}}
        />
      </ChronicleList>
      <BottomNav active={null} slots={ALL_SLOTS} inline />
    </>
  );
}
