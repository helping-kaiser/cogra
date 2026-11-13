/* Sign in · wrong credentials — the input-error round (readme §13, entry):
   neither field is individually accused, so a form-level fault line sits
   above the submit button instead — the same voice and styling as
   NetworkError's fault line, in place of the control that failed.

   REGISTERED under the `signIn` prefix (round 28): `SignIn`'s names, and the
   form-level line `fault`, as the deletion landing names its fault. The live
   commit is `WaitingCommit` with nothing to wait for, so it keeps `SignIn`'s
   `commit.action` (`ChangeEmail`'s and `SettingsBackupError`'s live commit). */
export const NODE = "signIn";
export function Screen() {
  return (
    <>
      <PageHeader backHref="#" backLabel="Back" node="header" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "8px 24px 32px", overflow: "hidden" }}>
        <h1
          style={{
            margin: 0,
            fontSize: "var(--text-headline-small)",
            letterSpacing: "var(--text-headline-small--letter-spacing)",
            lineHeight: "var(--text-headline-small--line-height)",
            fontWeight: "var(--text-headline-small--font-weight)",
          }}
          data-node="title"
        >
          Sign in to CoGra
        </h1>
        <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 16 }}>
          <TextField id="signin-email" label="Email" type="email" autoComplete="username" value="sol@solferreira.art" node="email" />
          <PasswordField id="signin-password" label="Password" autoComplete="current-password" value="saltmarsh-tide" node="password" />
          <Checkbox label="Don't remember this account on this device" node="forget" />
          <p role="alert" style={{ margin: 0, fontSize: "var(--text-body-medium)", fontWeight: "var(--text-body-medium--font-weight)", lineHeight: "var(--text-body-medium--line-height)", letterSpacing: "var(--text-body-medium--letter-spacing)", color: "var(--error)" }} data-node="fault">
            That email and password don't match.
          </p>
          <WaitingCommit id="signin" label="Sign in" waiting={false} node="commit" />
        </div>

        <div style={{ marginTop: 24, display: "flex", flexDirection: "column" }}>
          <Button variant="text" style={{ width: "100%", justifyContent: "flex-start", padding: 0 }} node="forgot">
            Forgot password?
          </Button>
          <Button variant="text" style={{ width: "100%", justifyContent: "flex-start", padding: 0 }} node="invite">
            New here? Enter your invite
          </Button>
          <Button variant="text" style={{ width: "100%", justifyContent: "flex-start", padding: 0 }} node="browse">
            Just looking? Browse the feed →
          </Button>
          <Button variant="text" style={{ width: "100%", justifyContent: "flex-start", padding: 0 }} node="apk">
            On Android? Download the app (APK)
          </Button>
        </div>
      </div>
    </>
  );
}
