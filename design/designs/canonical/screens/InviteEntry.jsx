/* Enter your invite — the door itself (readme §13, entry). CoGra is
   invite-only, so a stranger's first screen is a field for the link and the
   three ways out of it: sign in, browse as a guest, or go back. The link
   stack below Continue keeps SignIn's idiom — plain text rows flush with the
   screen's own gutter, not a second row of pills. */
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
          Enter your invite
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
          CoGra is invite-only. Paste your invite link to get started.
        </p>

        <div style={{ marginTop: 32 }}>
          <TextField id="invite-link" label="Invite link" value="" />
        </div>

        <div style={{ marginTop: 24 }}>
          <Button style={{ width: "100%" }}>Continue</Button>
        </div>

        <div style={{ marginTop: 24, display: "flex", flexDirection: "column" }}>
          <Button variant="text" style={{ width: "100%", justifyContent: "flex-start", padding: 0 }}>
            Already have an account? Sign in
          </Button>
          <Button variant="text" style={{ width: "100%", justifyContent: "flex-start", padding: 0 }}>
            Just looking? Browse the feed →
          </Button>
        </div>
      </div>
    </>
  );
}
