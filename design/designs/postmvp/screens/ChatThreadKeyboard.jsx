/* A CHAT WITH THE KEYBOARD UP — the foot while the reader writes (would-like
   #3; readme §13, *The keyboard's own mechanism*).

   THE FOOT RISES WITH THE KEYBOARD; NOTHING ELSE MOVES ON ITS OWN. The foot is
   a bottom-anchored surface that holds a field, so the platform's own
   mechanism lifts it to sit on the keyboard's top edge — Android's ime insets,
   the web's own resize — and the thread above gives up the room, its newest
   message staying in view directly over the foot and its older ones leaving
   at the top. The header stays pinned. No custom panning, no choreography
   beyond the platform's own keyboard transition.

   THE LOCK IS ON here — the reader flipped it for this chat, and it stays
   flipped for the next message until they flip it back (sticky per chat) —
   so this board also draws the toggle's filled state. The draft is typed, so
   the arrow is ready.

   THE KEYBOARD IS A SLAB, NOT A DRAWING. It is the platform's, and no board in
   either tree had drawn one; a board about the keyboard-up state still has to
   show where it is, so it stands as a plain block at a typical phone
   keyboard's height on the dialog rung, named in quiet words rather than drawn
   key by key — a painted keyboard would be a design of something CoGra does
   not design. Decoration, hidden from the ear. */
function KeyboardSlab() {
  return (
    <div
      aria-hidden="true"
      style={{ flex: "none", height: 272, display: "grid", placeItems: "center", background: "var(--surface-container-high)", borderTop: "1px solid var(--border-hairline)", fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", color: "var(--text-secondary)" }}
    >
      The device's own keyboard
    </div>
  );
}

export function Screen() {
  return (
    <>
      <ChatThreadHeader name="Coast walkers" image="post-photo.jpg" />
      <CoastWalkersThread />
      <ChatFoot draft="Bringing a flask and the spare boots." sealed />
      <KeyboardSlab />
    </>
  );
}
