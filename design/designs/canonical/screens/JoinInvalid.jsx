/* Join · unusable link — InviteEntry's own answer to a link that no longer
   works (readme §13, entry). The board is the entry step with the failure
   said out loud in the heading and the paragraph: the field, Continue, and
   the two ways out are unchanged, because the way forward is another link in
   the same box. It says the account survives, so a returning applicant does
   not start over. */
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
          This invite can't be used anymore
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
          It may have expired or already been used. Ask the person who invited you for a fresh link — if you already made an
          account, it is untouched, and a fresh link picks your application back up.
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
