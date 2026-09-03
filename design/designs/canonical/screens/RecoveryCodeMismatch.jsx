/* Recovery code · the mismatch — the input-error round (readme §13, entry):
   the confirm field, typed back wrong, wearing the error the RecoveryCode
   master's new `error` pass-through carries (mirroring TextField's own
   anatomy — the RecoveryCode component draws its own text field rather
   than composing TextField, so the state needed a way in). */
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
              error="That doesn't match the code above."
            />
          </Card>
        </div>
      </div>
    </>
  );
}
