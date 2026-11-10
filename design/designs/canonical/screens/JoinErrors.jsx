/* Join · the errors in place — the input-error round (readme §13, entry):
   Join with two errors demonstrated at once, the server answer on Handle
   and a local format failure on Password. M3's error supporting line
   replaces each errored field's own helper span; Email is untouched.

   REGISTERED under the `join` prefix (round 28): `Join`'s names. The live
   commit is `WaitingCommit` with nothing to wait for, so it keeps `Join`'s
   `commit.action`. */
export const NODE = "join";
export function Screen() {
  return (
    <>
      <PageHeader backHref="#" backLabel="Back" node="header" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "8px 24px 32px", overflow: "hidden" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <MonogramAvatar name="Mira Voss" size={64} src="inviter.jpg" node="avatar" />
          <h1
            style={{
              margin: "16px 0 0",
              fontSize: "var(--text-headline-small)",
              letterSpacing: "var(--text-headline-small--letter-spacing)",
              lineHeight: "var(--text-headline-small--line-height)",
              fontWeight: "var(--text-headline-small--font-weight)",
            }}
            data-node="title"
          >
            Mira invited you
          </h1>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: "var(--text-body-medium)",
              fontWeight: "var(--text-body-medium--font-weight)",
              lineHeight: "var(--text-body-medium--line-height)",
              letterSpacing: "var(--text-body-medium--letter-spacing)",
              color: "var(--text-secondary)",
            }}
            data-node="body"
          >
            CoGra is invite-only — a member vouches for you, and @mira's approval brings you in.
          </p>
        </div>

        <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 16 }}>
          <TextField id="handle" label="Handle" kind="handle" value="noor" error="That handle is taken." node="handle" />
          <TextField id="email" label="Email" type="email" autoComplete="username" value="noor@fieldmail.org" node="email" />
          <PasswordField
            id="password"
            label="Password"
            autoComplete="new-password"
            value="fieldday"
            error="A password is at least 12 characters."
            node="password"
          />
        </div>

        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 8 }}>
          <JoinTermsLine />
          <WaitingCommit id="join" label="Create account" waiting={false} node="commit" />
          <Button variant="text" style={{ width: "100%" }} node="signInDoor">
            Already have an account? Sign in
          </Button>
          <JoinPrivacyNotice />
        </div>
      </div>
    </>
  );
}
