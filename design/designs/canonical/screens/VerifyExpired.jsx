/* Verification link · already used or expired — the other thing App Links
   can open (readme §13, the audit states; jakob 2026-09-09, item 20).

   A LINK THAT IS THE PROOF CAN BE SPENT, and drawing only the landing where
   it works would leave the reader who taps yesterday's mail with nothing.
   One board covers both ways a link is dead: the reader cannot tell which
   happened and neither answer changes what to do next.

   IT IS `JoinInvalid`'s IDIOM, the product's other dead-link landing: the
   failure said out loud in the heading, the two possibilities and the way
   forward in the paragraph, and the reassurance that nothing was lost — an
   applicant who reads "expired" without it will think the application went
   with it.

   NO MARK. `Verified` spends the brand mark in `--primary` on the moment
   something worked; wearing it over a failure would be the surface saying
   the opposite of its own heading. No back arrow either, for the reason
   `VerifiedApp` has none: a mail link has no previous screen of ours.

   THE PAIR IS `NetworkError`'s FOOT — the outlined act that might fix it
   over the plain way on. `Resend the link` is the applicant feed's own
   control, taken verbatim, because it is the same act asked from a
   different place. */
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
        It may have expired or already been used. Send yourself a fresh one — your application is untouched, and the new
        link picks it back up.
      </p>

      <div style={{ flex: 1 }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
