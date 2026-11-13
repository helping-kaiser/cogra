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
   `commit` and `note`.

   THE LINK IS CHECKED BEFORE THE FORM STANDS (jakob 2026-11-13, seam 320-5
   and 320-6, as recommended; the `link` chip). `checking` is the check in
   flight: nothing for the first 200ms, then the tree's `LoadingState`
   `Loading…` alone at the column's head, no spinner — the chronicle's own
   wait (`ProfileTabFirstPage`). `fault` is the check with no answer: the
   fault family's one shape in the form's place (`DeleteAccountConfirmed`'s
   landing, `ProfileUnreachable`) — the house line's noun form, `Can't reach
   the server — this page can't load right now.`, over an OUTLINED `Retry`,
   sized to its word and leading the column; the read's word, since checking
   a link signs and confirms nothing. `limited` is the check refused by its
   budget: the reset's `RATE_LIMITED` line (copy-voice, *Faults by code*),
   `Too many tries. Wait a little, then try again.`, over the same control,
   as `DeleteAccountConfirmed`'s `limited` draws it. The fault's line is
   worded by the round-48 lane, to be blessed. Named `loading`, `fault` and
   its `retry`, each fault copy keyed by the chip's value; `live` is the form. */
export const NODE = "reset";
export const PROPS = { link: { editor: "enum", options: ["live", "checking", "fault", "limited"], default: "live" } };
export const VALS = `liveShown: this.props.link === "live" ? "flex" : "none", checkingShown: this.props.link === "checking" ? "block" : "none", faultShown: this.props.link === "fault" ? "block" : "none", limitedShown: this.props.link === "limited" ? "block" : "none"`;
const FAULT = (message) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "var(--space-3)" }} data-node="fault">
    <TransportError message={message} />
    <Button variant="outline" size="sm" selfStart node="retry">
      Retry
    </Button>
  </div>
);
export function Screen() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "32px 24px", overflow: "hidden" }}>
      <div style={{ display: "{{checkingShown}}" }}>
        <div data-node="loading">
          <LoadingState />
        </div>
      </div>
      <div style={{ display: "{{faultShown}}" }} data-node-chip="link" data-node-key="fault">
        {FAULT("Can't reach the server — this page can't load right now.")}
      </div>
      <div style={{ display: "{{limitedShown}}" }} data-node-chip="link" data-node-key="limited">
        {FAULT("Too many tries. Wait a little, then try again.")}
      </div>
      <div style={{ display: "{{liveShown}}", flexDirection: "column" }}>
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
    </div>
  );
}
