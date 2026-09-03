/* Sign in · wrong credentials — the input-error round (readme §13, entry):
   neither field is individually accused, so a form-level fault line sits
   above the submit button instead — the same voice and styling as
   NetworkError's fault line, in place of the control that failed. */
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
            That email and password don't match.
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
