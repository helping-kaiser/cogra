/* A CHAT, READ FROM OUTSIDE — the thread a non-member opens from the explorer
   (would-like #3; jakob 2026-09-23).

   CHATS ARE PUBLIC READS, SO THE THREAD IS THE THREAD. The header, the
   bubbles, the clock and the day dividers are exactly what a member sees —
   the header still the door to the chat's detail surface, which is public too.
   What differs is what the reader can open and what they can do.

   MOST ENCRYPTED MESSAGES ARE NOTICES HERE. A non-member holds no key, so every
   encrypted message wears the no-key notice with its lock (`ChatSealedNotice`)
   — two of the four in this fixture — while plaintext reads in full. The
   notice's `Show the encrypted text` works here as it does for a member.

   THE FOOT IS THE JOIN (`ChatJoinFoot`), worded by the chat's policy: this one
   takes requests, so `Ask to join`; an open chat reads `Join`; an invite-only
   chat has nothing to press and says so in one quiet line. No field, no lock,
   no arrow — a non-member's message would never enter the transcript.

   A GUEST GETS THIS SAME FACE. Reading needs no account, so a guest arriving
   through the explorer reads this thread as drawn — ranked for them from the
   borrowed vantage every guest surface uses (the guest-feed rulings) — and the
   join is where the guest gate meets them. One board, both readers.

   THE TRANSCRIPT IS `HarbourOfficeThread`, shared with the requester's two
   later moments (`ChatThreadRequested`, `ChatThreadApproved`, the chats
   governance round). */
export function Screen() {
  return (
    <>
      <ChatThreadHeader name="Harbour office" backLabel="Back to all chats" />
      <HarbourOfficeThread />
      <ChatJoinFoot policy="request" />
    </>
  );
}
