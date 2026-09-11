/* Join — arrival through the vouching handoff (readme §13, entry): Mira's
   borrowed view hands off here once the invite link checks out. Handle,
   email, and password collected in one pass; Create account starts the
   applicant days (ApplicantFeed). No back history from a deep link, so the
   arrow returns to the invite-entry step instead. */
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
          <TextField id="handle" label="Handle" value="" hint="3–30 characters: a–z, 0–9, _" />
          <TextField id="email" label="Email" type="email" autoComplete="email" value="" />
          <PasswordField id="password" label="Password" autoComplete="new-password" value="" hint="At least 12 characters." />
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
