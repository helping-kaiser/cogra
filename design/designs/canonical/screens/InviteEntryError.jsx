/* Enter your invite · that isn't a link — the malformed-input state (readme
   §13, the audit states; jakob 2026-09-09, item 19).

   THE FAILURE BEFORE THE FAILURE. `JoinInvalid` answers a link the product
   read and refused; this answers something the product could not read as a
   link at all. Two different facts, so two different boards: one says the
   invite is spent, the other says nothing was pasted that could be one.
   Both apps invented an answer here and the two disagree word for word.

   IT IS `InviteEntry`, ERRORED, and nothing else moves. The input-error
   round's rules apply as written: M3's own error state on the field, the
   message in the supporting slot, the heading and the intro untouched
   because neither of them is what was wrong. The three ways out stay,
   because the way forward is another paste into the same box.

   THE LINE TAKES THE REGISTER'S EXISTING SHAPE. `That doesn't look like an
   email address.` is already the wording for a local format failure on an
   entry field, and this is the same failure on the next field along. It
   names the link because the field asks for a link — the web app's added
   "or its code" describes a field this design does not draw. */
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
          <TextField id="invite-link" label="Invite link" value="cogra" error="That doesn't look like an invite link." />
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
