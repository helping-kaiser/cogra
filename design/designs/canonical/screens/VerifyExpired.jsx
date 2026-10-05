/* Verification link · already used or expired — what a dead verify link
   opens, in the app and in a browser alike (readme §13, the audit states;
   jakob 2026-09-09, item 20; both platforms, jakob 2026-10-01, audit K3.20).

   THE MAIL OPENS WHEREVER THE READER READS IT — another phone, a desktop
   browser, a device with no session. Signed out, the way on goes to
   `SignIn`, its label saying so (`Sign in`), and `Resend the link` asks for
   the address in place: an `Email` field opens above the pair and the next
   press sends to it, because a signed-out page has no address to send to.
   The send never says whether the address has an account, as `Reset`'s
   never does: a status line under the pair answers every press in
   `Reset`'s construction, the same for an account already verified (jakob
   2026-10-05; its words flagged in copy-voice).

   THE REASSURANCE IS LIMITED TO WHAT IS TRUE (jakob 2026-10-01, audit
   K3.3). An account left unverified for seven days is reaped, so the paragraph
   promises the fresh link only to an account still waiting on it; the
   consequence itself is said once, on the verify card, and not again here.

   A LINK THAT IS THE PROOF CAN BE SPENT, and drawing only the landing where
   it works would leave the reader who taps yesterday's mail with nothing.
   One board covers both ways a link is dead: the reader cannot tell which
   happened and neither answer changes what to do next.

   IT IS `JoinInvalid`'s IDIOM, the product's other dead-link landing: the
   failure said out loud in the heading, the two possibilities and the way
   forward in the paragraph, and the reassurance an applicant who reads
   "expired" needs — that a fresh link picks the account back up while it is
   still waiting.

   NO MARK. `Verified` spends the brand mark in `--primary` on the moment
   something worked; wearing it over a failure would be the surface saying
   the opposite of its own heading. No back arrow either, for the reason
   `VerifiedApp` has none: a mail link has no previous screen of ours.

   THE PAIR IS `NetworkError`'s — the outlined act that might fix it over
   the plain way on — following the words in content flow, because a landing
   is a task page and not a seal (readme §4, the two placements). `Resend the
   link` is the applicant feed's own control, taken verbatim, because it is
   the same act asked from a different place. */
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
        This link doesn't work anymore
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
        It may have expired or already been used. Send yourself a fresh one — if your account is still waiting on its
        email, the new link picks it back up.
      </p>

      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 8 }}>
        <Button variant="outline" style={{ width: "100%" }}>
          Resend the link
        </Button>
        <Button variant="text" style={{ width: "100%" }}>
          Go to the feed
        </Button>
      </div>
    </div>
  );
}
