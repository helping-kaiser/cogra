/* MAKE A RECOVERY CODE — the backup made late, for a reader who declined it
   at the ceremony (the key-loss round; auth.md, "declining is not final").
   Reached from the settings page's Recovery code row, which reads
   `Not made yet` for this reader.

   IT IS ITS OWN SCREEN BECAUSE IT IS A DIFFERENT ACT. Replacing a code
   destroys a backup and mails a notice; this destroys nothing and mails
   nothing — there is no old code to keep working and none to ask for. So it
   takes `SettingsBackup`'s column and none of its proof: heading, the
   consequence, the commitment, the thing to know last.

   THE CONSEQUENCE IS `KeyDecline`'S, word for word, because it is the same
   fact read from the other side: the dialog said what going without costs,
   and this screen is where that cost stops. The commitment is the ceremony's
   own `Create my recovery code`, leading to the ceremony's own code screen,
   trap and all.

   NO FIELD. While no backup exists the browser still keeps the seed beside
   the key (web.md), so enabling is one step — seal, upload, wipe — and there
   is no current code to prove. ON ANDROID the commitment raises the phone's
   own unlock, as every act that shows a secret does, a cancelled prompt
   leaves the screen as it was, and a phone with no screen lock is warned
   first (`NoScreenLock`). */
export function Screen() {
  return (
    <>
      <PageHeader backHref="/settings" backLabel="Back to settings" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "8px 24px 32px", overflow: "hidden" }}>
        <h1
          style={{
            margin: 0,
            fontSize: "var(--text-headline-small)",
            lineHeight: "var(--text-headline-small--line-height)",
            fontWeight: "var(--text-headline-small--font-weight)",
          }}
        >
          Make a recovery code
        </h1>
        <p
          style={{
            margin: "8px 0 0",
            fontSize: "var(--text-body-medium)",
            lineHeight: "var(--text-body-medium--line-height)",
            letterSpacing: "var(--text-body-medium--letter-spacing)",
            color: "var(--text-secondary)",
          }}
        >
          Without a recovery code, losing this device means losing your key. Your sign-in survives, but no one —
          including CoGra — can bring the key back.
        </p>

        <div style={{ marginTop: 32 }}>
          <Button style={{ width: "100%" }}>Create my recovery code</Button>
        </div>

        <p
          style={{
            margin: "24px 0 0",
            fontSize: "var(--text-body-small)",
            lineHeight: "var(--text-body-small--line-height)",
            letterSpacing: "var(--text-body-small--letter-spacing)",
            color: "var(--text-secondary)",
          }}
        >
          The code is shown once and never stored. Have somewhere to write it down before you go on.
        </p>
      </div>
    </>
  );
}
