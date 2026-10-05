/* Join — arrival through the vouching handoff (readme §13, entry): Mira's
   borrowed view hands off here once the invite link checks out. Handle,
   email, and password collected in one pass; Create account starts the
   applicant days (ApplicantFeed). No back history from a deep link, so the
   arrow is a link: to the invite-entry step for a link pasted there, and to
   the borrowed view for a link the arrival already held — the band and the
   guest gate open this form with it in hand (jakob 2026-10-01, audit K3.6).

   INVITE LINKS IGNORE SIGN-IN (jakob 2026-10-02). One person may hold
   several accounts, member or applicant alike, so a live invite link opened
   while signed in opens this same form, holding the link, as a layer over
   the signed-in state. Create account makes the new account and switches
   this device to it; the other account's sessions stay valid wherever they
   are. Back closes the layer onto the signed-in state, untouched (readme §4,
   the layer law). `Already have an account? Sign in` stays there too: it is
   the account-switch door, the way onto another account the person already
   holds (jakob 2026-10-02).

   THE HEADING SAYS INVITED (jakob 2026-10-05, D1). No vouch exists yet when
   the form opens — the inviter's approval comes after the account does — so
   the heading reads `Mira invited you`, the entry flow's *invited, never
   vouched*.

   THE ARROW READS A BARE `Back` — the funnel exception (readme §4,
   *Navigation*): the entry funnel's screens carry no origin nouns, and the
   About page this form's "?" opens keeps the same plain `Back` on its way
   back here (jakob 2026-10-02).

   THE DOOR'S ONE EXPLANATION IS A "?", NOT A FIFTH LINE (jakob's ruling, the
   batch-rulings round: "that sounds great maybe behind a '?'. i already dislike
   it that we have four clickable texts on this screen"). `HelpDot` is the
   system's "?" — one per screen, top-right of the header, 32px of ring inside
   the 48px target — so the About page arrives on this board without the board
   growing a line of text. Its accessible name says where it goes, because a
   ring drawn round a question mark says only that something is explained. */
export function Screen() {
  return (
    <>
      <PageHeader backHref="#" backLabel="Back" action={<HelpDot ariaLabel="About CoGra" onOpen={() => {}} />} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "8px 24px 32px", overflow: "hidden" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <MonogramAvatar name="Mira Voss" size={64} src="inviter.jpg" />
          <h1
            style={{
              margin: "16px 0 0",
              fontSize: "var(--text-headline-small)",
              lineHeight: "var(--text-headline-small--line-height)",
              fontWeight: "var(--text-headline-small--font-weight)",
            }}
          >
            Mira invited you
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
            CoGra is invite-only — a member vouches for you, and @mira's approval brings you in.
          </p>
        </div>

        <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 16 }}>
          <TextField id="handle" label="Handle" kind="handle" value="" hint="3–30 characters: a–z, 0–9, _" />
          <TextField id="email" label="Email" type="email" autoComplete="username" value="" />
          <PasswordField id="password" label="Password" autoComplete="new-password" value="" hint="At least 12 characters." />
        </div>

        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 8 }}>
          <WaitingCommit id="join" label="Create account" reason="Waiting for a handle, your email and a password" />
          <Button variant="text" style={{ width: "100%" }}>
            Already have an account? Sign in
          </Button>
        </div>
      </div>
    </>
  );
}
