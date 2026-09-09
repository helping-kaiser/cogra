/* Recovery code · the mismatch — the input-error round (readme §13, entry):
   the confirm field carrying a typed-back prefix that has diverged from the
   code, wearing the line the master raises for it. The field holds a real
   diverged prefix rather than nothing: the line answers the typing, so a board
   drawing the line with an empty field would draw a state the surface cannot
   reach. The words come from the board through the master's `error` prop, the
   moment from the master. */
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
              defaultTypedBack="7Q3ZD-XK9PZ"
              error="That doesn't match the code above."
            />
          </Card>
        </div>
      </div>
    </>
  );
}
