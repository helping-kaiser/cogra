/* CHANGE YOUR EMAIL — the request (readme §13, the settings round; jakob's
   review 2026-09-09). What the Credentials group's Email row opens —
   `Settings/13`, the gap that named two confirmations and drew neither.

   IT IS TWO BOARDS BECAUSE IT IS TWO STATES. The code field does not exist
   until the mails have gone, so a single board carrying both phases would draw
   a screen the product never shows — and a board's frame is the state it draws.
   The split is `SettingsBackup`'s, for the same reason: two halves, each
   drawable, instead of one composite that is neither.

   THE PASSWORD IS RE-ASKED HERE, and unlike the handle that is the server's
   own rule: `requestEmailChange` re-authenticates, because the address is the
   account's sole login-recovery channel and a hijacker holding a live session
   is exactly who this stops.

   THE LAST LINE IS THE MECHANISM, NAMED. Two-sided proof is unusual enough that
   a reader who is not told will read the unchanged row afterwards as a failure.
   It names the current address, because "your current address" is a phrase and
   `sol@solferreira.art` is a place to go and look. */
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
          Change your email
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
          Your email signs you in, and it is the only way back if you lose your password — so a
          change is proved from both ends.
        </p>

        <div style={{ marginTop: 32 }}>
          <TextField id="new-email" label="New email" type="email" autoComplete="email" value="" />
        </div>

        <div style={{ marginTop: 24 }}>
          <PasswordField id="email-current-password" label="Current password" autoComplete="current-password" value="" />
        </div>

        <div style={{ marginTop: 24 }}>
          <Button style={{ width: "100%" }}>Change email</Button>
        </div>

        <div style={{ marginTop: 24 }}>
          <QuietNote>
            A code goes to sol@solferreira.art and a link to the new address. Your email is unchanged
            until both have been answered.
          </QuietNote>
        </div>
      </div>
    </>
  );
}
