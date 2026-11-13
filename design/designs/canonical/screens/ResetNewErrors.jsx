/* Set a new password · the errors in place — `JoinErrors`' construction for
   `ResetNew` (round 46; seam 316, entry 5): the form after a press whose two
   passwords differ. One reachable moment, not a composite: the mismatch is
   the form's only local refusal besides the length line, and it is drawn
   alone. Repeat password takes M3's error state with its line,
   `The two passwords don't match.` (ResetNew.md:27); New password keeps its
   own hint, unerrored; the fields keep what was typed, and the commit is live
   — the press is the re-check.

   REGISTERED under the `reset` prefix with `ResetNew`'s names; the repeat
   field's line is `confirm.support`, the path `JoinErrors` gives `join`. */
export const NODE = "reset";
export function Screen() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "32px 24px", overflow: "hidden" }}>
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
        Set a new password
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
        Setting a new password signs out every device.
      </p>

      <div style={{ marginTop: 32 }}>
        <PasswordField id="new-password" label="New password" autoComplete="new-password" account="sol@solferreira.art" enterKeyHint="next" value="coast-road-maps" hint="At least 12 characters." node="password" />
      </div>

      <div style={{ marginTop: 24 }}>
        <PasswordField id="new-password-repeat" label="Repeat password" autoComplete="new-password" value="coast-road-map" error="The two passwords don't match." node="confirm" />
      </div>

      <div style={{ marginTop: 24 }}>
        <WaitingCommit id="reset-new" label="Set the new password" waiting={false} node="commit" />
      </div>

      <div style={{ marginTop: 24 }}>
        <QuietNote node="note">
          This restores your sign-in only. Your key stays wherever it is — restoring the key is its own step, with your
          recovery code.
        </QuietNote>
      </div>
    </div>
  );
}
