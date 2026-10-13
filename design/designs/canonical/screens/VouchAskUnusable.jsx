/* AN ASK THAT CAN'T BE TAKEN UP RIGHT NOW (jakob 2026-10-01, audit K3.8;
   auth.md, *The ask link*).

   AN ASK LINK TRAVELS BY HAND, so it reaches people the happy path never
   drew. One of them opens a link that cannot stage anyone: the applicant has
   already landed — "landing retires it". `askLinkCheck` says so before the
   reader commits to anything, and this board is what it says. A live
   application waiting on another member blocks nobody: any member who holds
   the ask can vouch, and the first vouch lands it (jakob 2026-10-07, item 58).

   `JoinInvalid`'S IDIOM, the product's dead-link landing: the fact said out
   loud in the heading, what it means in the paragraph, and the way on. It is
   not a failure of the reader's, so it carries no error colour; and it is not
   the end of the person — a landed applicant is simply in.

   IT NAMES NOBODY ELSE. Who vouched @noor in is @noor's and that member's
   business, `VouchAsk`'s own rule.

   THE WAY BACK IS THE LAYER LAW: a link opens over whatever the reader was
   doing and back returns there, or to the feed when the link opened the app
   cold. It is also the whole of "not now".

   THE LANDED CASE OPENS THEIR PROFILE (jakob 2026-10-02). @noor has a full
   profile now, and the member who opened the ask came to vouch for them — they
   will want to look, and most likely give an opinion. So the way on is `See
   @noor's profile`, not the feed. */

/* REGISTERED under the `vouchAsk` prefix (design ⇄ impl seam 078), named as
   `VouchAskInvalid` names the landing; the way on is `profileDoor`. Nothing
   here is keyed. */
export const NODE = "vouchAsk";
export function Screen() {
  return (
    <>
      <PageHeader backHref="#" backLabel="Back" node="header" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "8px 24px 32px", overflow: "hidden" }}>
        <h1
          style={{
            margin: 0,
            fontSize: "var(--text-headline-small)",
            lineHeight: "var(--text-headline-small--line-height)",
            fontWeight: "var(--text-headline-small--font-weight)",
          }}
          data-node="title"
        >
          @noor is already in
        </h1>
        <p
          style={{
            margin: "8px 0 0",
            fontSize: "var(--text-body-medium)",
            lineHeight: "var(--text-body-medium--line-height)",
            letterSpacing: "var(--text-body-medium--letter-spacing)",
            color: "var(--text-secondary)",
          }}
          data-node="body"
        >
          Someone has vouched them in already, so this ask has nothing left to do.
        </p>

        <div style={{ marginTop: 24 }}>
          <Button variant="text" style={{ width: "100%" }} node="profileDoor">
            See @noor's profile
          </Button>
        </div>
      </div>
    </>
  );
}
