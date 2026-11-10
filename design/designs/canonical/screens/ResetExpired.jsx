/* Reset link · already used or expired — what a spent or timed-out password
   reset link opens (jakob 2026-10-05, B4; `RESET_TOKEN_INVALID`).

   `VerifyExpired`'S CONSTRUCTION, the product's dead-mail-link landing: the
   failure said out loud in the blessed heading, the two possibilities and
   the way forward in the paragraph, the pair following the words. A reset
   link works once and lives fifteen minutes (`Reset`'s own status line), so
   yesterday's mail, or a second tap on today's, lands here; the reader
   cannot tell which happened and neither changes what to do next, so one
   board answers both.

   THE WAY BACK IS `Reset`. The outlined act opens the request again under
   its own heading's words, because a fresh link is what fixes this and the
   address is typed there, never here: a spent token says nothing about
   whose it was, and the screen must not enumerate accounts any more than
   `Reset` does. The plain way on is `Sign in`, `VerifyExpired`'s signed-out
   label, for the reader who remembered the password meanwhile.

   NO MARK, NO ARROW, NO ERROR COLOUR, for `VerifyExpired`'s reasons: a mail
   link has no previous screen of ours, and the dead link is not the
   reader's failure. The paragraph is blessed (jakob 2026-10-05).

   REGISTERED under the `reset` prefix (round 28), `VerifyExpired`'s names:
   `title`, `body`, and the plain way on `onward`; the outlined act that opens
   the request again is `again` (the web's id, kept). */
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
        This link doesn't work anymore
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
        It may have expired or already been used. A reset link works once and expires after 15 minutes — ask for a
        fresh one.
      </p>

      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 8 }}>
        <Button variant="outline" style={{ width: "100%" }} node="again">
          Reset your password
        </Button>
        <Button variant="text" style={{ width: "100%" }} node="onward">
          Sign in
        </Button>
      </div>
    </div>
  );
}
