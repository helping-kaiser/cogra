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
   The surface is one field and one commitment.

   ONE FIELD, NO CONFIRM. `Join` sets a password with one field and the
   reveal toggle, and this is the same act — a typo is answered by looking,
   not by typing it twice. The recovery code is the one thing in the system
   that earns a confirm field, because it is the one thing the reader cannot
   look at later.

   THE QUIET NOTE IS `Reset`'s, VERBATIM, and it matters more here. A reader
   who has just finished a password reset is exactly the reader most likely
   to believe their key came back with it. */
export function Screen() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "32px 24px", overflow: "hidden" }}>
      <h1
        style={{
          margin: 0,
          fontSize: "var(--text-headline-small)",
          lineHeight: "var(--text-headline-small--line-height)",
          fontWeight: "var(--text-headline-small--font-weight)",
        }}
      >
        Set a new password
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
        Setting a new password signs out every device. You sign in again with the new one.
      </p>

      <div style={{ marginTop: 32 }}>
        <PasswordField id="new-password" label="New password" autoComplete="new-password" value="" hint="At least 12 characters." />
      </div>

      <div style={{ marginTop: 24 }}>
        <Button style={{ width: "100%" }}>Set the new password</Button>
      </div>

      <div style={{ marginTop: 24 }}>
        <QuietNote>
          This restores your sign-in only. Your key stays wherever it is — restoring the key is its own step, with your
          recovery code.
        </QuietNote>
      </div>
    </div>
  );
}
