/* Recovery code — the key ceremony's write-it-down step (readme §13,
   entry): reached from KeyConfirm's "Show my code". No back affordance by
   design (RecoveryCode.prompt.md) — the empty PageHeader keeps the header
   band's height without offering a way out; the typed-back confirmation is
   the only exit. */
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
