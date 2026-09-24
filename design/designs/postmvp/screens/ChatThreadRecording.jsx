/* RECORDING A VOICE NOTE — what a tap on the mic opens (round B3 of the chats
   work, the integration round; jakob 2026-09-24: voice notes join as a
   chat-scale media kind, and — the final micro-fix — TAP TO RECORD, ONE STATE).

   ONE STATE, ALL OF IT VISIBLE (`ChatFootRecording`). The live mark and the
   running length, with `Describe` at the line's end; under them DELETE, the
   E2E LOCK, PAUSE and the explicit SEND ARROW. There is no hold, no slide to
   cancel or to lock, and no release that sends: hidden gestures fight the
   visible-controls honesty, and a release that signed would sign by accident,
   against the sign-step ruling. The arrow is the only way a note is signed.
   With nothing held down, the state is its own non-drag route (readme §10).

   THE LOCK IS VISIBLE AND FLIPPABLE (jakob's ruling: the foot's sticky lock
   governs a voice message like any message — set before, flippable until
   send). The toggle holds Coast walkers' sticky choice, plaintext, and the
   reader can flip it now; the arrow seals the note by whatever it says when
   pressed.

   PAUSE flips the middle control to PLAY, `Keep recording`, which extends the
   same note (`ChatThreadRecordingPaused`).

   THE THREAD ABOVE IS THE ORDINARY ONE, readable while the note records. */
export function Screen() {
  return (
    <>
      <ChatThreadHeader name="Coast walkers" image="post-photo.jpg" />
      <CoastWalkersThread />
      <ChatFootRecording length="0:14" />
    </>
  );
}
