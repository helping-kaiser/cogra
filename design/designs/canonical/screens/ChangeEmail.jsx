/* CHANGE YOUR EMAIL — the request (readme §13, the settings round; jakob's
   review 2026-09-09). What the Credentials group's Email row opens —
   `Settings/13`, the gap that named two confirmations and drew neither.

   IT IS TWO BOARDS BECAUSE IT IS TWO STATES. The code field does not exist
   until the mails have gone, so a single board carrying both phases would draw
   a screen the product never shows — and a board's frame is the state it draws.
   The split is `SettingsBackup`'s, for the same reason: two halves, each
   drawable, instead of one composite that is neither.

   THE PASSWORD IS RE-ASKED HERE, and unlike the handle that is the server's
   own rule: `requestEmailChange` re-authenticates, because the address is the
   account's sole login-recovery channel and a hijacker holding a live session
   is exactly who this stops. The password field names the account it
   re-proves by a hidden username (`PasswordField`'s `account`), the credential
   forms' one rule extended to the forms that re-prove a password (jakob
   2026-10-05).

   THE LAST LINE IS THE MECHANISM, NAMED. Two-sided proof is unusual enough that
   a reader who is not told will read the unchanged row afterwards as a failure.
   It names the current address, because "your current address" is a phrase and
   `sol@solferreira.art` is a place to go and look.

   AT REST THE COMMIT WAITS (jakob 2026-10-05, the disabled-until-filled law
   drawn): `Change email` disabled until both fields hold something, its reason
   above it (`WaitingCommit`).

   THE FIELD-ERROR IDIOM, DRAWN ONCE (jakob 2026-10-05, the final brief; the
   `fault` chip). A line answers on the field it is about, in the error colour,
   with the label — the input-error round's idiom — and `ApplicantEmail`
   inherits it whole. `password`: a wrong current password, server-answered,
   `That password isn't right.` under its field, standing until the next press.
   `malformed`: a new address that is not one, the local format line `That
   doesn't look like an email address.`, which answers on the press and then
   re-checks live. AN ADDRESS ALREADY IN USE IS NEVER ANSWERED HERE:
   `requestEmailChange` stays silent so no enumeration channel opens (auth.md,
   *Email change*); the owner learns it on the confirm, after proving the
   account (`EMAIL_IN_USE`, copy-voice).

   REGISTERED under the `changeEmail` prefix (design ⇄ impl seam 082, the
   settings packet), the family's surface. The credential family names a field
   for what it changes and the proof `current`: here `email` and `current`;
   the commit with its reason is `commit`. The fields and the commit are drawn
   once per `fault` value, one shown at a time, so each copy takes the same
   paths keyed by the chip's value (the chip-drawn duplicate rule). */
export const NODE = "changeEmail";
export const PROPS = { fault: { editor: "enum", options: ["none", "password", "malformed"], default: "none" } };
export const VALS = `restShown: this.props.fault === "none" ? "block" : "none", passwordShown: this.props.fault === "password" ? "block" : "none", malformedShown: this.props.fault === "malformed" ? "block" : "none"`;

function ChangeEmailFields({ shown, fault, at = "", email = "", password = "", emailError, passwordError, waiting = false }) {
  return (
    <div style={{ display: shown }} data-node-chip="fault" data-node-key={fault}>
      <div style={{ marginTop: 32 }}>
        <TextField id={`new-email${at}`} label="New email" type="email" autoComplete="email" value={email} error={emailError} node="email" />
      </div>

      <div style={{ marginTop: 24 }}>
        <PasswordField
          id={`email-current-password${at}`}
          label="Current password"
          autoComplete="current-password"
          account="sol@solferreira.art"
          value={password}
          error={passwordError}
          node="current"
        />
      </div>

      <div style={{ marginTop: 24 }}>
        <WaitingCommit id={`change-email${at}`} label="Change email" reason="Waiting for a new email and your password" waiting={waiting} node="commit" />
      </div>
    </div>
  );
}

export function Screen() {
  return (
    <>
      <PageHeader backHref="/settings" backLabel="Back to settings" node="header" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "8px 24px 32px", overflow: "hidden" }}>
        <h1
          style={{
            margin: 0,
            fontSize: "var(--text-headline-small)",
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
            lineHeight: "var(--text-body-medium--line-height)",
            letterSpacing: "var(--text-body-medium--letter-spacing)",
            color: "var(--text-secondary)",
          }}
          data-node="body"
        >
          Your email signs you in, and it is the only way back if you lose your password — so a
          change is proved from both ends.
        </p>

        <ChangeEmailFields shown="{{restShown}}" fault="none" waiting />
        <ChangeEmailFields
          shown="{{passwordShown}}"
          fault="password"
          at="-password"
          email="sol@ferreira.studio"
          password="saltmarsh-tides"
          passwordError="That password isn't right."
        />
        <ChangeEmailFields
          shown="{{malformedShown}}"
          fault="malformed"
          at="-malformed"
          email="sol@ferreira"
          password="saltmarsh-tides"
          emailError="That doesn't look like an email address."
        />

        <div style={{ marginTop: 24 }}>
          <QuietNote node="note">
            A code goes to sol@solferreira.art and a link to the new address. Your email is unchanged
            until both have been answered.
          </QuietNote>
        </div>
      </div>
    </>
  );
}
