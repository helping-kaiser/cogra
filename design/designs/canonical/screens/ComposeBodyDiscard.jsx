/* DISCARD THE WORDS? (jakob 2026-10-02, the fix-fix round's ruling 14) — the
   ask the body fork raises. A post's body is words or pictures, never both, so
   switching halves with something in the body discards it; pass C ruled that
   the switch asks first when the body holds something and switches silently
   when it is empty.

   ONE DIALOG FOR BOTH DIRECTIONS, `DiscardConfirm`'s master pattern: drawn
   here over the words stage, where `Add pictures instead` raises it, and
   raised the same way by `Write words instead` over a pick stage holding
   pictures, where its title reads `Discard the pictures?`. The body names
   only what goes: `The rest of the draft stays.` — the title, the tags and
   the citations ride on, so the reader loses exactly the half they are
   leaving. A clip's own title, and its keep word, wait for a ruling
   (backlog 12X-fixfix-whatsnew).

   THE SAFE ACTION IS THE FILLED ONE — `DiscardConfirm`'s weighting and §11's
   rule: `Keep them` closes onto the stage as it was, and the quiet `Discard`
   switches the body. No `error` colour: a reader switching halves is doing
   what they meant to. The scrim is the third answer, Keep's.

   THE STAGE BENEATH IS `ComposeWordsBody`, the same body `ComposeWords`
   draws, so the dialog sits over the real screen — and every control under
   the wash is wired on that board. */
export function Screen() {
  return (
    <>
      <ComposeWordsBody />
      <DialogSurface
        onScrimPress={() => {}}
        title="Discard the words?"
        body="The rest of the draft stays."
        actions={
          <>
            <Button variant="text">Discard</Button>
            <Button>Keep them</Button>
          </>
        }
      />
    </>
  );
}
