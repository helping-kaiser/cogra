/* CHANGE YOUR HANDLE? — the think-twice dialog in front of a handle change
   (jakob 2026-10-05, the collected brief's D5: "yes a confirmation (pop up?)
   for sure so that people dont accidentally drop all their links and their
   handle that could be taken by anyone else"). §11 already lists the act —
   a freed handle is claimable and its links die — and this is the dialog
   that list promised.

   THE BODY NAMES THE COST, BOTH HALVES, with the handle that pays it: links
   to the old handle stop working, and anyone can claim it. The page beneath
   says the same thing in its last line, but a reader can press past a line;
   the dialog is the moment the press asks first, so the cost is said again
   here, at the act. It names the new handle in the title, so the reader sees
   what they typed before it is theirs.

   THE SAFE ANSWER IS THE FILLED ONE — `Keep it`, in the right-hand slot,
   `RejectConfirm`'s and `RemoveDialog`'s order; `Change it` stays a text
   button on the left. No `error` colour: renaming yourself is not a fault
   (§11). The scrim, Escape and Back take `Keep it`.

   WORDING FLAGGED for blessing (copy-voice, *The settings subpages*).

   THE PAGE BENEATH is `ChangeHandleBody` with the new handle typed, inert
   under the scrim and wired on `ChangeHandle`. */
export function Screen() {
  return (
    <>
      <ChangeHandleBody value="solferreira" />
      <DialogSurface
        onScrimPress={() => {}}
        title="Change your handle to @solferreira?"
        body="Links to @sol stop working the moment it changes, and anyone can claim @sol afterwards."
        actions={
          <>
            <Button variant="text">Change it</Button>
            <Button>Keep it</Button>
          </>
        }
      />
    </>
  );
}
