/* Decline backup — what Not now actually costs (readme §13, entry). The
   dialog states the loss plainly and then states the two things that soften
   it: the sign-in survives, and a code can still be made later while the key
   exists. THE SAFE ACTION IS THE FILLED ONE, as on every think-twice dialog:
   Go back wears the filled button, and accepting the risk stays a text button
   the reader has to mean.

   THE SCRIM AND BACK TAKE THE SAFE ANSWER (the key-loss round): a press
   outside, or the system's Back, is Go back — nothing is made.

   ACCEPTING SAYS SO. The task card the reader came from completes and leaves
   the feed, so a silent close would read as nothing having happened; the
   snackbar names what did — `Key made — no backup yet. You can make a code in
   settings.` — which is also where `SettingsBackupNone` waits.

   THE PLATFORM NOUN IS THE `wording` CHIP (jakob 2026-10-05, E13), as on
   `KeyElsewhere` and `Restore`: the pledge says `on this browser` or `in this app`. The app renderings are blessed
   (jakob 2026-10-05; copy-voice, *The collected rulings' entry lines*). */
export const PROPS = { wording: { editor: "enum", options: ["browser", "app"], default: "browser" } };
export const VALS = KEY_PLEDGE_VALS;

export function Screen() {
  return (
    <>
      <KeyPledge />
      <DialogSurface
        onScrimPress={() => {}}
        title="Continue without a backup?"
        body="Without a recovery code, losing this device means losing your key. Your sign-in survives, but no one — including CoGra — can bring the key back. You can still create a code later, from settings, while the key exists."
        actions={
          <>
            <Button variant="text">I accept the risk</Button>
            <Button>Go back</Button>
          </>
        }
      />
    </>
  );
}
