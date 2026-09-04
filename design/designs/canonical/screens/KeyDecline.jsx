/* Decline backup — what Not now actually costs (readme §13, entry). The
   dialog states the loss plainly and then states the two things that soften
   it: the sign-in survives, and a code can still be made later while the key
   exists. THE SAFE ACTION IS THE FILLED ONE, as on every think-twice dialog:
   Go back wears the filled button, and accepting the risk stays a text button
   the reader has to mean. */
export function Screen() {
  return (
    <>
      <KeyPledge />
      <DialogSurface ariaLabel="Continue without a backup?">
        <h2
          style={{
            margin: 0,
            fontSize: "var(--text-headline-small)",
            lineHeight: "var(--text-headline-small--line-height)",
            fontWeight: "var(--text-headline-small--font-weight)",
          }}
        >
          Continue without a backup?
        </h2>
        <p
          style={{
            margin: "8px 0 0",
            fontSize: "var(--text-body-medium)",
            lineHeight: "var(--text-body-medium--line-height)",
            letterSpacing: "var(--text-body-medium--letter-spacing)",
            color: "var(--text-secondary)",
          }}
        >
          Without a recovery code, losing this device means losing your key. Your sign-in survives, but no one — including
          CoGra — can bring the key back. You can still create a code later, from settings, while the key exists.
        </p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 24 }}>
          <Button variant="text" size="sm">
            I accept the risk
          </Button>
          <Button size="sm">Go back</Button>
        </div>
      </DialogSurface>
    </>
  );
}
