/* Ready to record? — the last stop before the code is shown (readme §13,
   entry). The code appears ONCE, so the ask exists to make the reader ready
   rather than surprised: it says how long the code is, that it is shown once,
   and that the next screen holds them until it is confirmed. Show my code is
   the committing action and wears the filled button; Cancel returns to the
   ceremony with nothing spent.

   THE SCRIM AND BACK TAKE THE SAFE ANSWER (the key-loss round), as on every
   other think-twice dialog in the family: a press outside, or the system's
   Back, is Cancel — the ceremony again, nothing made. */
export function Screen() {
  return (
    <>
      <KeyPledge />
      <DialogSurface
        onScrimPress={() => {}}
        title="Ready to record your code?"
        body="The next screen shows your recovery code — 26 characters, shown once, meant only for your eyes. Have somewhere safe ready to keep it, and you stay on that screen until the code is confirmed."
        actions={
          <>
            <Button variant="text">Cancel</Button>
            <Button>Show my code</Button>
          </>
        }
      />
    </>
  );
}
