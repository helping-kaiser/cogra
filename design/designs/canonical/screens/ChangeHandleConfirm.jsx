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

   WORDING BLESSED (jakob 2026-10-05; copy-voice, *The settings subpages*).

   THE WAIT IS `Change it`'s (jakob 2026-10-05, the final brief; the severance
   dialog's precedent): the change is sent from the dialog, so the dialog stays
   up until it answers, `Change it` reads `Changing handle…` once the wait
   passes 200ms, and `Keep it`, the scrim and Back are locked meanwhile —
   locked, never dimmed. Only a well-formed handle reaches this dialog: one
   that breaks the field's rules is answered by the field's own line on
   `Change handle`'s press, and the dialog never opens.

   THE PAGE BENEATH is `ChangeHandleBody` with the new handle typed, inert
   under the scrim and wired on `ChangeHandle`.

   REGISTERED under the `changeHandle` prefix (design ⇄ impl seam 082): a
   dialog belongs to the surface it is raised over, so the page beneath keeps
   its `ChangeHandle` names and the dialog is `dialog`, its two answers
   `change` and `keep`. */
export const NODE = "changeHandle";
export function Screen() {
  return (
    <>
      <ChangeHandleBody value="solferreira" />
      <DialogSurface
        node="dialog"
        onScrimPress={() => {}}
        title="Change your handle to @solferreira?"
        body="Links to @sol stop working the moment it changes, and anyone can claim @sol afterwards."
        actions={
          <>
            <Button variant="text" node="change">Change it</Button>
            <Button node="keep">Keep it</Button>
          </>
        }
      />
    </>
  );
}
