/* CHANGE YOUR PASSWORD (readme §13, the settings round; jakob's review
   2026-09-09). What the Credentials group's Password row opens — `Settings/11`,
   which the round left as an honest gap.

   IT IS `SettingsBackup`'s SHAPE, WHICH IS `Restore`'s: heading, the
   consequence, the fields, one commitment, and the thing to know last. Three
   credential screens arriving at once is exactly when a family either exists or
   stops existing, and the settings round already put two boards in this column.

   THE CONSEQUENCE IS THE ROW'S OWN FOOTNOTE, said again where the act happens
   rather than only where it was announced. `ResetNew` says every device,
   because a reset revokes the session doing it too; a change from settings
   keeps this one, and the difference is the whole reason both lines exist.

   THE FIRST FIELD IS PROOF; THE NEW ONE IS ASKED TWICE. The current password
   is there because a live session is not proof enough to change the credential
   behind it, which is a fact worth saying rather than a hoop worth resenting;
   the last line says it. The new password takes `Repeat password` under it, as
   on every form that sets one (jakob 2026-11-11, J2), refused on the press with
   `The two passwords don't match.` the way this form refuses a short one.

   DRAWN AT REST. Validation is on submit (§13), so an untouched form has
   nothing marked; the marked states are their own boards when they are
   drawn. At rest the commit waits on the three fields, disabled, with no
   line above it: the wait is self-evident (jakob 2026-11-11, R2), and
   `Waiting for both passwords` is its spoken description alone, as on every
   form's waiting commit (`WaitingCommit`; jakob 2026-11-12).

   THE `submit` CHIP'S `pending` IS THE CHANGE CLOSED ON (round 43; jakob
   2026-11-11, backlog 191 (a): submit is submit). From the press on `Change
   password` nothing cancels it: past 200ms it reads `Changing password…`, and
   the header's arrow is named `Close` from the press itself — the seals' X
   (`WizardHeader`'s `closing`); it leaves for settings and the change goes on.
   A change that fails after Close says so on the Password row (`Settings`'
   `forms` chip, jakob 2026-11-12). The pending header and fields are drawn
   copies; the rest ones alone carry the names.

   REGISTERED under the `changePassword` prefix (design ⇄ impl seam 082, the
   settings packet). The credential family names a field for what it changes
   and the proof `current`: here `current`, `password` and its repeat `confirm`
   (`RecoveryCode`'s name for the field that types a thing back; round 38); the
   commit is `commit`. */
export const NODE = "changePassword";
export const PROPS = { submit: { editor: "enum", options: ["rest", "pending"], default: "rest" } };
export const VALS = `restShown: this.props.submit === "pending" ? "none" : "block", pendingShown: this.props.submit === "pending" ? "block" : "none"`;

function ChangePasswordFields({ pending = false }) {
  const named = (n) => (pending ? undefined : n);
  const at = pending ? "-pending" : "";
  return (
    <>
      <div style={{ marginTop: 32 }}>
        <PasswordField id={`current-password${at}`} label="Current password" autoComplete="current-password" account="sol@solferreira.art" enterKeyHint="next" value={pending ? "saltmarsh-tides" : ""} node={named("current")} />
      </div>

      <div style={{ marginTop: 24 }}>
        <PasswordField
          id={`change-new-password${at}`}
          label="New password"
          autoComplete="new-password"
          enterKeyHint="next"
          value={pending ? "coast-road-maps" : ""}
          hint="At least 12 characters."
          node={named("password")}
        />
      </div>

      <div style={{ marginTop: 24 }}>
        <PasswordField id={`change-new-password-repeat${at}`} label="Repeat password" autoComplete="new-password" value={pending ? "coast-road-maps" : ""} node={named("confirm")} />
      </div>

      <div style={{ marginTop: 24 }}>
        {pending ? (
          <Button style={{ width: "100%" }} busy busyLabel="Changing password…">
            Change password
          </Button>
        ) : (
          <WaitingCommit id="change-password" label="Change password" reason="Waiting for both passwords" node="commit" />
        )}
      </div>
    </>
  );
}

export function Screen() {
  return (
    <>
      <div style={{ display: "{{restShown}}" }}>
        <PageHeader backHref="/settings" backLabel="Back to settings" node="header" />
      </div>
      <div style={{ display: "{{pendingShown}}" }}>
        <PageHeader backHref="/settings" backLabel="Close" />
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
          Change your password
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
          Changing your password signs out every other device. This one stays signed in.
        </p>

        <div style={{ display: "{{restShown}}" }}>
          <ChangePasswordFields />
        </div>
        <div style={{ display: "{{pendingShown}}" }}>
          <ChangePasswordFields pending />
        </div>

      </div>
    </>
  );
}
