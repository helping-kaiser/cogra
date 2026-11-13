/* Settings · change your password · the errors in place — `JoinErrors`'
   construction for `ChangePassword` (round 46; seam 316, entry 5): the form
   after a press whose new password and its repeat differ. One reachable
   moment, not a composite: a local refusal stops the press before the server
   is asked, so the server's lines (a wrong current password, a breached one)
   never stand with it. Repeat password takes M3's error state with its line,
   `The two passwords don't match.` (ChangePassword.md:31); the other two
   fields keep what was typed and New password its own hint; the commit is
   live — the press is the re-check.

   REGISTERED under the `changePassword` prefix with `ChangePassword`'s names;
   the repeat field's line is `confirm.support`, the path `JoinErrors` gives
   `join`. */
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
          <PasswordField id="current-password" label="Current password" autoComplete="current-password" account="sol@solferreira.art" enterKeyHint="next" value="saltmarsh-tides" node="current" />
        </div>

        <div style={{ marginTop: 24 }}>
          <PasswordField
            id="change-new-password"
            label="New password"
            autoComplete="new-password"
            enterKeyHint="next"
            value="coast-road-maps"
            hint="At least 12 characters."
            node="password"
          />
        </div>

        <div style={{ marginTop: 24 }}>
          <PasswordField id="change-new-password-repeat" label="Repeat password" autoComplete="new-password" value="coast-road-map" error="The two passwords don't match." node="confirm" />
        </div>

        <div style={{ marginTop: 24 }}>
          <WaitingCommit id="change-password" label="Change password" waiting={false} node="commit" />
        </div>
      </div>
    </>
  );
}
