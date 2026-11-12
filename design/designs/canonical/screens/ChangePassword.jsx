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
   line above it: the wait is self-evident (`WaitingCommit` with no reason;
   jakob 2026-11-11, R2).

   REGISTERED under the `changePassword` prefix (design ⇄ impl seam 082, the
   settings packet). The credential family names a field for what it changes
   and the proof `current`: here `current`, `password` and its repeat `confirm`
   (`RecoveryCode`'s name for the field that types a thing back; round 38); the
   commit is `commit` (its `reason` deleted with the line, R2). */
export const NODE = "changePassword";
export function Screen() {
  return (
    <>
      <PageHeader backHref="/settings" backLabel="Back to settings" node="header" />
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

        <div style={{ marginTop: 32 }}>
          <PasswordField id="current-password" label="Current password" autoComplete="current-password" account="sol@solferreira.art" enterKeyHint="next" value="" node="current" />
        </div>

        <div style={{ marginTop: 24 }}>
          <PasswordField
            id="change-new-password"
            label="New password"
            autoComplete="new-password"
            enterKeyHint="next"
            value=""
            hint="At least 12 characters."
            node="password"
          />
        </div>

        <div style={{ marginTop: 24 }}>
          <PasswordField id="change-new-password-repeat" label="Repeat password" autoComplete="new-password" value="" node="confirm" />
        </div>

        <div style={{ marginTop: 24 }}>
          <WaitingCommit id="change-password" label="Change password" node="commit" />
        </div>

      </div>
    </>
  );
}
