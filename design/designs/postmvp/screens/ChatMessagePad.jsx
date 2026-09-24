/* YOUR OPINION ON A MESSAGE — the pad over the thread, what the message menu's
   `Give your opinion` opens (round B3 of the chats work, the integration
   round's fix pass; jakob 2026-09-24: both undrawn destinations of the
   message menu, drawn on real masters).

   THE PAD GRAMMAR AT MESSAGE SCALE. The pad is `StanceControl`'s own parked
   pad, whole — the face and pair it would sign, the field, `Cancel` and
   `Set`, the `?` — bloomed over the thread with the wash beneath it, exactly
   the arrangement `PadHistoryDoor` and canonical's pad boards draw over a
   post. `Set` signs one Opinion → Message (chats.md §1: a message is
   first-class content), and the message's trace gains the reader's face.

   THE CONTROL'S ANCHOR IS NOT DRAWN, AND THAT IS ROUND A'S RULING KEPT: a
   bubble wears content, time and the lock and nothing else, so there is no
   face on the bubble to tap — the menu row is the door, and the pad blooms
   from it. The master is mounted with its anchor held out of view; what the
   reader meets is the master's pad, not a copy.

   THE MESSAGE HELD IS JUNO'S, the one the menu board holds — the pad names it
   `Juno Baptiste's message`. The thread beneath is `ChatThread`'s, inert. */
export function Screen() {
  return (
    <>
      <ChatThreadBody />
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--scrim-dialog)" }} />
      <div style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
        <StanceControl targetLabel="Juno Baptiste's message" defaultOpen defaultPick={{ pDirected: 0.55, pInterest: 0.2 }} onCommit={() => {}} />
      </div>
    </>
  );
}
