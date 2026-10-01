/* USE A FRESH INVITE — re-arming a closed application (jakob 2026-10-01,
   audit K3.5; auth.md, *Expiry*: "a fresh invite link through
   `applyWithInvite`").

   ONE PAGE, TWO WAYS IN. The door on a closed application's card
   (`ApplicantExpired`, `ApplicantRejected`) opens it empty, for a link the
   reader has been sent and pastes; an invite link opened by a signed-in
   applicant whose application is closed opens it holding that link — the
   signed-in answer `/join/<id>` owes (web.md: the re-arm's context action on
   the link page). The arrival chip flips between the two. Either way the link
   is never typed twice: a held link is in the field already (WCAG 3.3.7).
   A signed-in reader with nothing to re-arm — a member, the link's own
   issuer, an applicant whose application is still live — lands where
   app-open lands for them instead, and a snackbar says why.

   IT IS NOT `Join`. The account exists, the email is proved and the key is
   attached; only the application is new. So there is no handle, no address
   and no password here — the page says the account stays as it is, and the
   commitment says what the press does, in the words the audit drew for it.

   A DEAD LINK ANSWERS IN THE FIELD, in `JoinInvalid`'s heading, because the
   reader is still standing on the form with the way forward in their hand:
   another link in the same box.

   A TASK PAGE OF THE ENTRY FUNNEL: a fixed link back (the card's shell for
   the door, the reader's own landing for a link), the commit following its
   field in content flow. The new application asks for nothing more — both
   proofs are already made — so it lands on the waiting card, naming the new
   link's issuer. */
export const PROPS = { arrival: { editor: "enum", options: ["door", "link"], default: "door" } };
export const VALS = `rearmBody: this.props.arrival === "link" ? "This link from @sol can start your application again. Your account stays exactly as it is." : "Paste the new invite link, and your application starts again through it. Your account stays exactly as it is.", rearmLink: this.props.arrival === "link" ? "https://cogra.social/join/7f3e2a90-5c1d-4b8e-9a64-0d2f81c6e5b3" : ""`;

export function Screen() {
  return (
    <>
      <PageHeader backHref="#" backLabel="Back" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "8px 24px 32px", overflow: "hidden" }}>
        <h1
          style={{
            margin: 0,
            fontSize: "var(--text-headline-small)",
            lineHeight: "var(--text-headline-small--line-height)",
            fontWeight: "var(--text-headline-small--font-weight)",
          }}
        >
          Use a fresh invite
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
          {"{{rearmBody}}"}
        </p>

        <div style={{ marginTop: 32 }}>
          <TextField id="invite-link" label="Invite link" value="{{rearmLink}}" />
        </div>

        <div style={{ marginTop: 24 }}>
          <Button style={{ width: "100%" }}>Use this link for your application</Button>
        </div>
      </div>
    </>
  );
}
