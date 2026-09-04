/* Reset your password — the sign-in side of recovery (readme §13, entry).
   THE ANSWER IS THE SAME EITHER WAY: the status line confirms whether or not
   that email has an account, so the screen never enumerates accounts. The
   quiet note under it draws the line the whole entry round rests on — this
   restores the SIGN-IN, never the key; the key comes back with its recovery
   code, on its own screen. */
export function Screen() {
  return (
    <>
      <PageHeader backHref="#" backLabel="Back" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "8px 24px 32px", overflow: "hidden" }}>
        <h1
          style={{
            margin: 0,
            fontSize: "var(--text-headline-small)",
            lineHeight: "var(--text-headline-small--line-height)",
            fontWeight: "var(--text-headline-small--font-weight)",
          }}
        >
          Reset your password
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
          Enter the email you signed up with and we send a reset link. Resetting the password signs out every device.
        </p>

        <div style={{ marginTop: 32 }}>
          <TextField id="reset-email" label="Email" type="email" autoComplete="email" value="" />
        </div>

        <div style={{ marginTop: 24 }}>
          <Button style={{ width: "100%" }}>Send reset link</Button>
        </div>

        <p
          role="status"
          style={{
            margin: "24px 0 0",
            fontSize: "var(--text-body-medium)",
            lineHeight: "var(--text-body-medium--line-height)",
            letterSpacing: "var(--text-body-medium--letter-spacing)",
            color: "var(--text-secondary)",
          }}
        >
          If that email has an account, a reset link is on its way. The link works once and expires after 15 minutes.
        </p>

        <div style={{ marginTop: 16 }}>
          <QuietNote>
            This restores your sign-in only. Your key stays wherever it is — restoring the key is its own step, with your
            recovery code.
          </QuietNote>
        </div>
      </div>
    </>
  );
}
