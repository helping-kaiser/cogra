/* Sign in · signed out mid-session — where `UNAUTHENTICATED` and
   `REFRESH_TOKEN_INVALID` put a reader whose session ended while they were
   using the app (the failure pack's transport faults, copy-voice *Faults by
   code*; jakob 2026-10-01, backlog item 117).

   THE VEHICLE IS THE SURFACE: THE SIGN-IN SCREEN ITSELF. Nothing the reader
   did failed, and nothing short of signing in again lets them carry on, so
   the whole screen is the answer — `SignIn`, unchanged in every control, with
   the one sentence that says why it is here standing where the welcome line
   stood: `You've been signed out. Sign in again to carry on.` Calm, in the
   welcome line's own secondary ink, never the failure voice: being signed
   out is a fact about the session, not a fault of the reader's.

   NOTHING IS LOST. The draft and any picks stay kept on the device
   through the sign-in (copy-voice, *Faults by code*), so the line promises
   carrying on, not starting over.

   EVERY CONTROL IS `SignIn`'s, and so is every outcome: the fields, the
   remember switch, `Sign in` and the four ways round it. */
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
          You&apos;ve been signed out. Sign in again to carry on.
        </p>

        <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 16 }}>
          <TextField id="signin-email" label="Email" type="email" autoComplete="email" value="" />
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
