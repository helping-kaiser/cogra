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
   address.

   IT INHERITS `ChangeEmail`'s FORM WHOLE (jakob 2026-10-05, the final brief):
   at rest the commit waits on both fields (`WaitingCommit`); the field errors
   are `ChangeEmail`'s drawing — a wrong password under its field, a malformed
   address under its own, and an address in use never answered at the request
   (auth.md); and the password names the account by a hidden username.

   REGISTERED under the `changeEmail` prefix (design ⇄ impl seam 082, the
   settings packet): it is `ChangeEmail`'s form with the old side gone, so it
   takes `ChangeEmail`'s names — `email`, `current`, `commit`.

   THE `submit` CHIP'S `pending` IS THE CHANGE CLOSED ON (round 43; jakob
   2026-11-11, backlog 191 (a): submit is submit — the applicant is signed
   in). From the press on `Change email` nothing cancels it: past 200ms it
   reads `Changing email…`, and the header's arrow is named `Close` from the
   press itself — the seals' X (`WizardHeader`'s `closing`); it leaves for
   where the form was opened and the change goes on. A change that fails
   after Close says so on the Email row in settings (`Settings`' `forms`
   chip, jakob 2026-11-12). The pending header and fields are drawn copies;
   the rest ones alone carry the names. */
export const NODE = "changeEmail";
export const PROPS = { submit: { editor: "enum", options: ["rest", "pending"], default: "rest" } };
export const VALS = `restShown: this.props.submit === "pending" ? "none" : "block", pendingShown: this.props.submit === "pending" ? "block" : "none"`;

function ApplicantEmailFields({ pending = false }) {
  const named = (n) => (pending ? undefined : n);
  const at = pending ? "-pending" : "";
  return (
    <>
      <div style={{ marginTop: 32 }}>
        <TextField id={`new-email${at}`} label="New email" type="email" autoComplete="email" value={pending ? "noor@fieldnotes.org" : ""} node={named("email")} />
      </div>

      <div style={{ marginTop: 24 }}>
        <PasswordField
          id={`email-current-password${at}`}
          label="Current password"
          autoComplete="current-password"
          account="noor@fieldmail.org"
          value={pending ? "fieldday-notes" : ""}
          node={named("current")}
        />
      </div>

      <div style={{ marginTop: 24 }}>
        {pending ? (
          <Button style={{ width: "100%" }} busy busyLabel="Changing email…">
            Change email
          </Button>
        ) : (
          <WaitingCommit id="change-email" label="Change email" reason="Waiting for a new email and your password" node="commit" />
        )}
      </div>
    </>
  );
}

export function Screen() {
  return (
    <>
      <div style={{ display: "{{restShown}}" }}>
        <PageHeader backHref="#" backLabel="Back" node="header" />
      </div>
      <div style={{ display: "{{pendingShown}}" }}>
        <PageHeader backHref="#" backLabel="Close" />
      </div>
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
          Change your email
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
          A fresh link goes there, and the one sent to noor@fieldmail.org stops working.
        </p>

        <div style={{ display: "{{restShown}}" }}>
          <ApplicantEmailFields />
        </div>
        <div style={{ display: "{{pendingShown}}" }}>
          <ApplicantEmailFields pending />
        </div>
      </div>
    </>
  );
}
