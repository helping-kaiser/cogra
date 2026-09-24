/* RECORDING A VOICE NOTE, LOCKED — hands-free, after sliding up onto the lock
   or a plain tap on the mic (round B3 of the chats work, the integration
   round's fix pass; jakob 2026-09-24: the locked state is drawn, not
   docblocked — WhatsApp's full anatomy, minus nothing).

   THE FOOT (`ChatFootLocked`): the live mark and the running length, with
   `Describe` at the line's end; under them DELETE, the E2E LOCK, PAUSE and
   the explicit SEND ARROW. Nothing here needs a finger held down, which is why
   this state is also the non-drag route into a voice note (readme §10).

   THE LOCK IS VISIBLE AND FLIPPABLE (the ruling: the foot's sticky lock
   governs a voice message like any message — set before, flippable until
   send). The toggle holds Coast walkers' sticky choice, plaintext, and the
   reader can flip it now; the arrow seals the note by whatever it says when
   pressed. A held-and-released note keeps the sticky state it started with.

   THE THREAD ABOVE IS THE ORDINARY ONE, readable while the note records. */
export function Screen() {
  return (
    <>
      <ChatThreadHeader name="Coast walkers" image="post-photo.jpg" />
      <CoastWalkersThread />
      <ChatFootLocked length="0:14" />
    </>
  );
}
