/* RECORDING A VOICE NOTE — the foot while the mic is held (round B3 of the
   chats work, the integration round; jakob 2026-09-24: voice notes join as a
   chat-scale media kind, hold to record with WhatsApp's slide-to-lock).

   THE FOOT GIVES ITS ROW TO THE RECORDING (`ChatFootRecording`): the running
   length beside a small `primary` mic on the left — the live mark, calm where
   WhatsApp's is a red dot, because nothing here is an alarm — `Slide left to
   cancel` in the middle, and under the thumb the held mic grown to 56px. The
   LOCK LANE stands over the held mic: slide up onto its lock and the
   recording goes hands-free.

   THREE WAYS OUT, and only release signs. Release — the note is signed and
   sent, so the mic is a seal exactly as the arrow is. Slide left — the
   recording is let go and nothing is signed. Slide up — the LOCKED state
   (`ChatThreadRecordingLocked`): delete, the lock, pause and the send arrow as
   buttons, which is also where a plain tap on the mic starts (the non-drag
   equivalent every drag gesture owes, readme §10).

   THE QUIET LINE SAYS WHETHER THE NOTE WILL BE ENCRYPTED, because the lock
   toggle leaves the row while the finger is down and the chat's sticky choice
   still decides a released note (jakob's ruling, the fix pass). Coast walkers
   sits at plaintext, the fresh chat's default.

   THE THREAD ABOVE IS THE ORDINARY ONE, inert under the finger. */
export function Screen() {
  return (
    <>
      <ChatThreadHeader name="Coast walkers" image="post-photo.jpg" />
      <CoastWalkersThread />
      <ChatFootRecording length="0:07" />
    </>
  );
}
