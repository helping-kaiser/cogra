/* WRONG ADDRESS? — an unverified applicant changes their email (jakob
   2026-10-01, audit K3.2; auth.md, *Email change*, the unverified carve-out).

   THE CARVE-OUT, DRAWN. A member's change is proved from both ends because the
   address is the account's only way back; an applicant's has proved nothing
   yet, and a mistyped one would never receive the code the old address is
   sent. So this is `ChangeEmail` with the old side gone: the new address and
   the password, and the new address's verification link is the whole proof.
   Opening it moves the address and verifies the account in the one step.

   THE PASSWORD IS STILL RE-ASKED. The carve-out drops the code and nothing
   else; `requestEmailChange`'s re-authentication is the server's own rule, and
   it costs a reader who typed the password at Join minutes ago one field.

   THE PARAGRAPH NAMES WHAT STOPS WORKING. The link already sent dies with the
   address it went to, and a reader holding that mail should not wonder which
   of two links counts.

   THE CHANGE DOES NOT RESTART THE SEVEN DAYS (jakob 2026-10-02). The reap's
   window runs from registration (auth.md, *Expiry*), so changing the address
   cannot extend an unverified account forever; nothing on screen says so,
   since the verify card already states the consequence once.

   A TASK PAGE OF THE ENTRY FUNNEL, its fixed link back to the shell the door
   was on; the commit follows its fields in content flow (readme §4, the two
   placements). It returns to `ApplicantFeed`, whose card then prints the new
   address. */
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
          Change your email
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
          Your email isn't verified yet, so the new address is all a change needs. A fresh link goes there, and the one
          sent to noor@fieldmail.org stops working.
        </p>

        <div style={{ marginTop: 32 }}>
          <TextField id="new-email" label="New email" type="email" autoComplete="email" value="" />
        </div>

        <div style={{ marginTop: 24 }}>
          <PasswordField id="email-current-password" label="Current password" autoComplete="current-password" value="" />
        </div>

        <div style={{ marginTop: 24 }}>
          <Button style={{ width: "100%" }}>Change email</Button>
        </div>
      </div>
    </>
  );
}
