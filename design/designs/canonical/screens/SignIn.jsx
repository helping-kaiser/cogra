/* Sign in — the returning-member path off Main's borrowed view, Join, and
   every guest gate's "Sign in or join" (readme §13, entry). The link stack
   below the primary action stays flush with the screen's own gutter — plain
   text rows, not a second row of pill buttons.

   SIGN-IN LANDS WHEREVER APP-OPEN LANDS FOR THAT ACCOUNT (jakob 2026-10-01,
   audit K3.7). One rule, not a list to keep true: an account can be in
   any of the states the shells draw — a member with or without the key
   here, landed and not yet vouched back, in its deletion grace; an applicant
   with tasks left, waiting, turned down, or with the key made
   elsewhere — and signing in is just the app opening for it, so each state
   opens where an app-open in that state does. A pending security notice
   (`LogInPayload.reuseDetectedAt`) rides along to that landing as a card.
   A tripped login backoff answers here, as `SignInLimited`. */
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
          Sign in to CoGra
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
          Welcome back — your feed is where you left it.
        </p>

        <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 16 }}>
          <TextField id="signin-email" label="Email" type="email" autoComplete="username" value="" />
          <PasswordField id="signin-password" label="Password" autoComplete="current-password" value="" />
          <Checkbox label="Don't remember this account on this device" />
          <Button style={{ width: "100%" }}>Sign in</Button>
        </div>

        <div style={{ marginTop: 24, display: "flex", flexDirection: "column" }}>
          <Button variant="text" style={{ width: "100%", justifyContent: "flex-start", padding: 0 }}>
            Forgot password?
          </Button>
          <Button variant="text" style={{ width: "100%", justifyContent: "flex-start", padding: 0 }}>
            New here? Enter your invite
          </Button>
          <Button variant="text" style={{ width: "100%", justifyContent: "flex-start", padding: 0 }}>
            Just looking? Browse the feed →
          </Button>
          <Button variant="text" style={{ width: "100%", justifyContent: "flex-start", padding: 0 }}>
            On Android? Download the app (APK)
          </Button>
        </div>
      </div>
    </>
  );
}
