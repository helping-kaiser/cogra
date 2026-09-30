/* Recovery code — the key ceremony's write-it-down step (readme §13,
   entry): reached from KeyConfirm's "Show my code". No back affordance by
   design (RecoveryCode.prompt.md) — the empty PageHeader keeps the header
   band's height without offering a way out; the typed-back confirmation is
   the only exit.

   ANDROID'S BACK IS ANSWERED, NOT SWALLOWED SILENTLY (the key-loss round): a
   snackbar says what the way out is — `Type the code back to finish` — and
   the screen stays. A tab closed or an app killed here is not a way out
   either: nothing this screen would make exists until the code confirms
   (`KeyCeremony`'s mint moment; on a re-key, the new backup uploads only
   then, so the old code keeps working until the new one is confirmed).

   IT RETURNS WHERE IT WAS OPENED FROM. The ceremony's code goes back to the
   feed it began on; a code made or replaced from settings goes back to
   `Settings`, whose snackbar confirms it — `Your key is backed up with the
   new code.` — because the screen that asked for it has done its job.

   NO `FLAG_SECURE` HERE, DELIBERATELY (jakob, the key-loss round, overruling
   the audit). The key EXPORT keeps it (`YourKey`, per auth.md): that window
   shows the key itself. This one shows a code a reader is meant to take away,
   and readers new to keys will take it away as a screenshot — a black
   screenshot would punish exactly them, on the one screen where losing what
   they took means losing the key. Storing the code in a screenshot is not
   recommended; blocking it is not how this screen says so. The asymmetry is
   the ruling — not a gap for a later pass to close. */
export function Screen() {
  return (
    <>
      <PageHeader />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "8px 24px 32px", overflow: "hidden" }}>
        <h1
          style={{
            margin: 0,
            fontSize: "var(--text-headline-small)",
            lineHeight: "var(--text-headline-small--line-height)",
            fontWeight: "var(--text-headline-small--font-weight)",
          }}
        >
          Your recovery code
        </h1>

        <div style={{ marginTop: 24 }}>
          <Card>
            <RecoveryCode
              code="7Q3ZD-XK9P2-M4TVE-0RH8N-1WYB6C"
              explainer="This is the only way to restore your key. It is shown once and never stored — keep it offline, written down, somewhere safe."
            />
          </Card>
        </div>
      </div>
    </>
  );
}
