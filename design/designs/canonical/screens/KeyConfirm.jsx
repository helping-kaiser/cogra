/* Ready to record? — the last stop before the code is shown (readme §13,
   entry). The code appears ONCE, so the ask exists to make the reader ready
   rather than surprised: it says how long the code is, that it is shown once,
   and that the next screen holds them until it is confirmed. Show my code is
   the committing action and wears the filled button; Cancel returns to the
   ceremony with nothing spent. */
export function Screen() {
  return (
    <>
      <KeyPledge />
      <DialogSurface ariaLabel="Ready to record your code?">
        <h2
          style={{
            margin: 0,
            fontSize: "var(--text-headline-small)",
            lineHeight: "var(--text-headline-small--line-height)",
            fontWeight: "var(--text-headline-small--font-weight)",
          }}
        >
          Ready to record your code?
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
          The next screen shows your recovery code — 26 characters, shown once, meant only for your eyes. Have somewhere
          safe ready to keep it, and you stay on that screen until the code is confirmed.
        </p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 24 }}>
          <Button variant="text" size="sm">
            Cancel
          </Button>
          <Button size="sm">Show my code</Button>
        </div>
      </DialogSurface>
    </>
  );
}
