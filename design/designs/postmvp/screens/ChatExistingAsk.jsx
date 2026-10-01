/* NEW CHAT · you already share a 1:1 — the question the picker asks before
   starting a second (would-like #3; jakob 2026-09-23).

   MORE THAN ONE 1:1 WITH ONE PERSON IS LEGAL, SO THIS ASKS AND NEVER REFUSES.
   The substrate keeps no uniqueness over member pairs — two people may run any
   number of chats side by side, and a frontend may hint but never force a
   single thread (chats.md §9, whose own example is this very question). Most
   readers who tap a person they already talk to mean the chat they already
   have; a few mean a fresh room. The dialog serves both in one step.

   THE LIKELY ANSWER CARRIES THE WEIGHT: `Open that chat` is filled, `Start a
   new chat` is the quiet text button beside it — the house weighting, where
   the heavier control goes to the answer that costs nothing (`DiscardConfirm`).
   Starting a new chat is not destructive, only rarer.

   THE PICKER BENEATH IS THE REAL ONE, inert under the scrim (`HelpDialog`'s
   rule). */
export function Screen() {
  return (
    <>
      <ChatPickerBody />
      <DialogSurface
        onScrimPress={() => {}}
        title="You already have a chat with Ada Okonkwo"
        body="Carry on where you left off, or start a separate chat — you can have more than one with the same person."
        actions={
          <>
            <Button variant="text">Start a new chat</Button>
            <Button>Open that chat</Button>
          </>
        }
      />
    </>
  );
}
