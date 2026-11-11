/* Set a new password — where the reset link actually lands (readme §13, the
   audit states; jakob 2026-09-09, item 18).

   THE STAGE THE DESIGN NEVER DREW. `Reset` asks for the address and ends at
   its status line; the mail goes out; and until now nothing said what the
   link opens. Both apps filled the hole by putting the new password on the
   request screen with a field to paste the link's own secret into — which is
   why both of them have the word §3 bans on screen. The destination drawn is
   what removes the need for that field, and the word with it.

   NO HEADER, BECAUSE THERE IS NO BACK. `Reset`, `SignIn`, `Join` and
   `Restore` are all reached by a tap and all carry the back arrow that
   undoes it; this board is reached by a link from a mail app, where there is
   no previous screen of ours to return to. `Verified` — the other board a
   mail link opens — draws none either, and for the same reason.

   NOTHING IS PASTED HERE. The link carried what proves the reader owns the
   address; asking them to carry it too is asking them to do the link's job.
   The surface is the new password, asked twice, and one commitment.

   THE PASSWORD TWICE (jakob 2026-11-11, J2). Every form that sets a new
   password asks for it again under the first field — `Repeat password`,
   masked, with its own reveal toggle — and refuses on the press when the two
   differ, the way this form refuses a short password: `The two passwords
   don't match.` under the repeat field. `Join` and `ChangePassword` do the
   same.

   THE QUIET NOTE IS `Reset`'s, VERBATIM, and it matters more here. A reader
   who has just finished a password reset is exactly the reader most likely
   to believe their key came back with it.

   REGISTERED under the `reset` prefix (round 28): `title`, `body`, the field
   `password` (`ChangePassword`'s name for the new one), its repeat `confirm`
   (`RecoveryCode`'s name for the field that types a thing back; round 38),
   `commit` and `note`. */
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
        Setting a new password signs out every device. You sign in again with the new one.
      </p>

      <div style={{ marginTop: 32 }}>
        <PasswordField id="new-password" label="New password" autoComplete="new-password" account="sol@solferreira.art" enterKeyHint="next" value="" hint="At least 12 characters." node="password" />
      </div>

      <div style={{ marginTop: 24 }}>
        <PasswordField id="new-password-repeat" label="Repeat password" autoComplete="new-password" value="" node="confirm" />
      </div>

      <div style={{ marginTop: 24 }}>
        <WaitingCommit id="reset-new" label="Set the new password" reason="Waiting for a new password" node="commit" />
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
