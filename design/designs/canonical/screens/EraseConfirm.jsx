/* ERASE EVERYTHING FROM THIS BROWSER? — the think-twice dialog in front of
   the wipe (jakob 2026-10-13: "Settings needs the wipe everything from this
   device yes. ofcourse with warnings and stuff"; the settings round). Raised
   by the Clearing data group's one row.

   WHY IT ASKS. Erasing is irreversible (readme §11, Dialogs): the key goes,
   and with it — unless a recovery code exists — the account, for good. That
   is the rule's think-twice case, so the row raises this dialog and erases
   nothing until an answer.

   WHAT IT SAYS. The Clearing data footnote's family, said once more where
   the act happens: the key first, the account gone for good, then what else
   goes — the draft, any kept picks, the choices kept on this device — and
   that the reader is signed out. With a code made, the seen list's return
   closes it; without one, there is nothing to come back to, so the dialog
   stops at what is lost.

   WHAT IT OFFERS, BY THE BACKUP CHIP. The dialog is drawn once per backup
   state, one shown at a time, because the safe answer differs:
     none  `Make a recovery code` leads, filled — the way out of the loss,
           as `SignOutConfirm` leads with it — and the erase stays one press
           away as a quiet answer.
     made  the destructive dialog's own shape (readme §11): `Erase everything
           and sign out` quiet on the left, `Cancel` filled on the right.
   The scrim and system Back take the safe answer in both: the dialog closes
   and nothing is erased. The erase takes no `error` colour — a deliberate
   act, not a failure.

   WHERE IT ENDS. The erase clears this browser's key, draft, kept picks,
   the choices kept on this device and the seen cache, ends the session, and
   lands on the sign-in screen with no account offered — nothing on this
   device remembers one. No snackbar: the dialog already said what happens,
   and `Erase them and sign out` lands the same way.

   THE PAGE BENEATH is `SettingsBody`, scrolled to the row that was pressed,
   its readings following the chip (the three holes `SettingsBody` takes), so
   the page under the scrim never disagrees with the dialog. It is inactive
   under the scrim and wired on `Settings`.

   REGISTERED under the `settings` prefix, as `SignOutConfirm` is: the dialog
   is `dialog`, its answers `recovery` and `erase` (the names that dialog
   already gives the same answers) and `cancel`. Each answer sits in its
   chip's copy and is keyed by the chip's value. */
export const NODE = "settings";
export const PROPS = { backup: { editor: "enum", options: ["none", "made"], default: "none" } };
export const VALS = `eraseBody: this.props.backup === "made" ? "Your key is erased with everything else, and only your recovery code can bring it back — without the code, your account is gone for good. Your draft, any kept picks and the choices kept on this device go too, and you're signed out. What you've seen comes back when you sign in." : "This browser holds the only copy of your key, and it has no recovery code. Erase everything and your account is gone for good — no one, including CoGra, can bring it back. Your draft, any kept picks and the choices kept on this device go too, and you're signed out.", recoveryStatus: this.props.backup === "made" ? "Last created 12.08.2026" : "Not made yet", backupFootnote: this.props.backup === "made" ? "Your key signs everything you publish and lives only in this browser. Your recovery code is the only way back." : "Your key signs everything you publish and lives only in this browser. Until you make a recovery code, it can't be brought back.", clearingFootnote: this.props.backup === "made" ? "Your key lives only in this browser. Clear CoGra's data here and the key is erased with it — without your recovery code, your account is gone for good. Your draft, any kept picks and the choices kept on this device go too, and you're signed out. What you've seen comes back when you sign in." : "Your key lives only in this browser, and it has no recovery code yet. Clear CoGra's data here and the key is erased with it — your account is gone for good. Your draft, any kept picks and the choices kept on this device go too, and you're signed out. What you've seen comes back when you sign in.", noneShown: this.props.backup === "made" ? "none" : "contents", madeShown: this.props.backup === "made" ? "contents" : "none"`;

export function Screen() {
  return (
    <>
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: -1120, display: "flex", flexDirection: "column" }}>
          <SettingsBody
            backup="none"
            recoveryStatus="{{recoveryStatus}}"
            backupFootnote="{{backupFootnote}}"
            clearingFootnote="{{clearingFootnote}}"
          />
        </div>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, background: "var(--surface)" }}>
          <PageHeader title="Settings" backHref="/profile" backLabel="Back to your profile" />
        </div>
      </div>
      <DialogSurface
        node="dialog"
        onScrimPress={() => {}}
        title="Erase everything from this browser?"
        body="{{eraseBody}}"
        actions={
          <>
            <div style={{ display: "{{noneShown}}" }} data-node-chip="backup" data-node-key="none">
              <Button node="recovery">Make a recovery code</Button>
              <Button variant="text" node="erase">Erase everything and sign out</Button>
              <Button variant="text" node="cancel">Cancel</Button>
            </div>
            <div style={{ display: "{{madeShown}}" }} data-node-chip="backup" data-node-key="made">
              <Button variant="text" node="erase">Erase everything and sign out</Button>
              <Button node="cancel">Cancel</Button>
            </div>
          </>
        }
      />
    </>
  );
}
