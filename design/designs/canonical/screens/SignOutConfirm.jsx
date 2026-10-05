/* SIGN OUT WITHOUT A BACKUP? — the one sign-out that asks first (the
   key-loss round; readme §11, Dialogs — the undo-vs-confirm rule).

   WHEN IT ASKS. Signing out is an auth act, not an identity act: the key
   stays on the device (auth.md, Sessions), so an ordinary sign-out asks
   nothing. The exception is the `Don't remember this account on this device`
   opt-in, made for shared and public devices, which clears the key with the
   session. With a recovery code that costs nothing a restore cannot give
   back, so it still asks nothing. Without one, this device holds the only
   copy of the key, and clearing it is irreversible — the rule's
   think-twice case, so the Sign out row raises this dialog instead of
   signing out.

   WHAT IT SAYS, AND WHAT IT OFFERS. It names all three things the opt-in
   would clear — the key, the draft, and any picks kept pending (jakob's
   ruling on the review) — because a reader deciding what to lose must see
   everything that goes. None is erased by default: signing out leaves them
   on this device, sealed with the key — unusable by
   anyone until this account signs in here again, online, with its current
   credentials. That is the same fate the key meets when the session is ended
   from somewhere else (below), so the two paths never disagree about what
   happens to it. The erase stays one press away, because the opt-in exists
   for the shared device, and a shared device needs a clean exit. And the way
   out of the dilemma leads: `Make a recovery code`, the safe answer, filled.

   THE REMOTE PATH HAS NO MOMENT TO ASK (jakob's ruling on the remote purge,
   confirmed by the implementation side's security check). A session ended
   from elsewhere — `Sign out everywhere else` on another device, a password
   changed or reset there, a reused token caught — on an account set to
   forget this device keeps an unbacked key and any picks kept pending,
   sealed exactly as above, instead of purging them. This bends only the
   don't-remember opt-in; for every other account nothing was ever purged.
   An invalidation ends the session; it is not a remote wipe.

   THE PAGE BENEATH is `SettingsBody` for this reader — no backup, the switch
   on — scrolled to the row that was pressed, its header pinned the way a
   settings page pins it. It is inactive under the scrim and wired on
   `Settings`. */
export function Screen() {
  return (
    <>
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column" }}>
          <SettingsBody backup="none" forget />
        </div>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, background: "var(--surface)" }}>
          <PageHeader title="Settings" backHref="/profile" backLabel="Back to your profile" />
        </div>
      </div>
      <DialogSurface
        onScrimPress={() => {}}
        title="Sign out without a backup?"
        body="This browser holds the only copy of your key. Signing out leaves your key, your draft and any opinions you kept pending here, locked until you sign in on this browser again. Erase them instead, and no one — including CoGra — can bring them back."
        actions={
          <>
            <Button>Make a recovery code</Button>
            <Button variant="text">Sign out, keep them locked</Button>
            <Button variant="text">Erase them and sign out</Button>
          </>
        }
      />
    </>
  );
}
