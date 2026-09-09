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

   TWO FIELDS, AND THE FIRST IS PROOF, NOT CONFIRMATION. `ResetNew` settled the
   no-confirm rule — a typo is answered by looking, not by typing it twice — and
   nothing here reopens it. The current password is there because a live session
   is not proof enough to change the credential behind it, which is a fact worth
   saying rather than a hoop worth resenting; the last line says it.

   DRAWN AT REST. Validation is on submit (§13), so an untouched form has
   nothing marked; the marked states are their own boards when they are
   drawn. */
export function Screen() {
  return (
    <>
      <PageHeader backHref="/settings" backLabel="Back to settings" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "8px 24px 32px", overflow: "hidden" }}>
        <h1
          style={{
            margin: 0,
            fontSize: "var(--text-headline-small)",
            lineHeight: "var(--text-headline-small--line-height)",
            fontWeight: "var(--text-headline-small--font-weight)",
          }}
        >
          Change your password
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
          Changing your password signs out every other device. This one stays signed in.
        </p>

        <div style={{ marginTop: 32 }}>
          <PasswordField id="current-password" label="Current password" autoComplete="current-password" value="" />
        </div>

        <div style={{ marginTop: 24 }}>
          <PasswordField
            id="change-new-password"
            label="New password"
            autoComplete="new-password"
            value=""
            hint="At least 12 characters."
          />
        </div>

        <div style={{ marginTop: 24 }}>
          <Button style={{ width: "100%" }}>Change password</Button>
        </div>

        <div style={{ marginTop: 24 }}>
          <QuietNote>
            Your current password is asked for even though you are signed in: a live session is not
            proof enough to change the credential behind it.
          </QuietNote>
        </div>
      </div>
    </>
  );
}
