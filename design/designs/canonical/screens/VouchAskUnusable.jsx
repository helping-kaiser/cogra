/* AN ASK THAT CAN'T BE TAKEN UP RIGHT NOW (jakob 2026-10-01, audit K3.8;
   auth.md, *The ask link*).

   AN ASK LINK TRAVELS BY HAND, so it reaches people the happy path never
   drew. Two of them open a link that cannot stage anyone: the applicant has
   already landed — "landing retires it" — or their one live application is
   already waiting on somebody else, and an applicant asks one person at a
   time. `askLinkCheck` says so before the reader commits to anything, and this
   board is what it says.

   `JoinInvalid`'S IDIOM, the product's dead-link landing: the fact said out
   loud in the heading, what it means and whether the link comes back in the
   paragraph, and the way on. It is not a failure of the reader's, so it
   carries no error colour; and neither case is the end of the person — a
   landed applicant is simply in, and a waiting one may come back to this very
   link. The case chip flips between the two.

   IT NAMES NOBODY ELSE. Who is deciding on @noor is @noor's and that member's
   business, `VouchAsk`'s own rule; "someone else" is all this reader needs.

   THE WAY BACK IS THE LAYER LAW: a link opens over whatever the reader was
   doing and back returns there, or to the feed when the link opened the app
   cold. `Go to the feed` is the plain way on, `VerifyExpired`'s. */
export const PROPS = { case: { editor: "enum", options: ["landed", "elsewhere"], default: "landed" } };
export const VALS = `askTitle: this.props.case === "elsewhere" ? "@noor is waiting on someone else" : "@noor is already in", askBody: this.props.case === "elsewhere" ? "Another member is deciding on their application right now. If it ends without them getting in, this same link works again." : "Someone has vouched them in already, so this ask has nothing left to do."`;

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
          {"{{askTitle}}"}
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
          {"{{askBody}}"}
        </p>

        <div style={{ marginTop: 24 }}>
          <Button variant="text" style={{ width: "100%" }}>
            Go to the feed
          </Button>
        </div>
      </div>
    </>
  );
}
