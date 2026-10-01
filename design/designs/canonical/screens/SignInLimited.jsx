/* SIGN IN · TOO MANY TRIES — the login backoff, said (jakob 2026-10-01,
   audit K3.7; auth.md, *Rate limiting*).

   THE BACKOFF IS THE ONE LIMIT THAT REFUSES VISIBLY. Consecutive failures arm
   an exponential backoff, and the server says so rather than going silent —
   so the form needs a line for it. It is `SignInError`'s anatomy exactly: the
   same form-level fault line above the submit, in `NetworkError`'s voice, the
   fields kept as typed.

   IT NAMES NO FIGURE. The backoff grows with each failure and the client is
   not told by how much, so the line says what to do and not how long — a
   number here would be a countdown the product does not have, and a guess.
   And it accuses no field and no account: the backoff arms identically for
   an email that has no account behind it, which is what keeps the line from
   telling a stranger that one exists. */
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
          <TextField id="signin-email" label="Email" type="email" autoComplete="email" value="" />
          <PasswordField id="signin-password" label="Password" autoComplete="current-password" value="" />
          <Checkbox label="Don't remember this account on this device" />
          <p role="alert" style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", letterSpacing: "var(--text-body-medium--letter-spacing)", color: "var(--error)" }}>
            Too many tries in a row. Wait a moment, then try again.
          </p>
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
