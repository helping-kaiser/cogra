/* Join · the errors in place — the input-error round (readme §13, entry):
   Join with two errors demonstrated at once, the server answer on Handle
   and a local format failure on Password. M3's error supporting line
   replaces each errored field's own helper span; Email is untouched. */
export function Screen() {
  return (
    <>
      <PageHeader backHref="#" backLabel="Back" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "8px 24px 32px", overflow: "hidden" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <MonogramAvatar name="Mira Voss" size={64} src="inviter.jpg" />
          <h1
            style={{
              margin: "16px 0 0",
              fontSize: "var(--text-headline-small)",
              lineHeight: "var(--text-headline-small--line-height)",
              fontWeight: "var(--text-headline-small--font-weight)",
            }}
          >
            Mira is vouching for you
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
            CoGra is invite-only — a member vouches for you, and @mira's approval brings you in.
          </p>
        </div>

        <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 16 }}>
          <TextField id="handle" label="Handle" value="" error="That handle is taken." />
          <TextField id="email" label="Email" type="email" autoComplete="email" value="" />
          <PasswordField
            id="password"
            label="Password"
            autoComplete="new-password"
            value=""
            error="A password is at least 12 characters."
          />
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Button style={{ width: "100%" }}>Create account</Button>
          <Button variant="text" style={{ width: "100%" }}>
            Already have an account? Sign in
          </Button>
        </div>
      </div>
    </>
  );
}
