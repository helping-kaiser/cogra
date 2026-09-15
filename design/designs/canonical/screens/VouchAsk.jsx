/* SOMEONE ASKED YOU TO VOUCH — where an ask link lands the member who opens
   it (jakob 2026-09-15).

   THE PAD IS CLOSED WHEN THE LINK LANDS (jakob 2026-09-15: "we should also
   show the page without the pad no? i dont think the pad should be open
   already when clicking the link"). A reader who taps a link has not asked for
   anything yet — they have arrived. Opening the pad for them would have the
   screen make the first move in a ceremony this product is careful to keep
   deliberate: a stance is opened by the reader's own gesture everywhere else
   in the tree, and an arrival from outside the app is the last place to make
   an exception. So the landing states who is asking and what a signature
   would do, and the stance affordance sits there closed until it is pressed.
   `VouchAskPad` is the state past that press.

   IT IS THE SAME ACT AS `ApprovePad`, SO IT IS THE SAME PAD. `StanceControl`
   and `ApprovePadNote` — the shared note, which is why that helper takes a
   handle rather than spelling one. A member answering an ask link is doing
   precisely what an approver does from their own queue; drawing it as a second
   kind of act would invent a difference the mechanic does not have. This
   screen is also the proof that the approver is not the issuer by definition:
   the reader here issued no link.

   THE SURFACE IS SMALL ON PURPOSE. It is reached from outside the app, by
   somebody who was handed a link and has one question to answer, so it carries
   a card and a way back and nothing else — no band, no bar, no feed to fall
   into. `VouchBackPad`'s shape, one seat over: the card names who, the line
   says what signing does, and `Not now` leaves it unanswered.

   IT NAMES NOBODY ELSE AND NO REASON. Who turned @noor down is @noor's to tell
   and not this screen's to publish — the ask link carries a person, not a
   case file. What the reader needs is who is asking and what their own
   signature would do.

   THE APPLICANT WEARS A MONOGRAM. There is no Profile to carry a picture until
   a vouch lands, which is the same rule the invites queue keeps and the same
   reason.

   `Not now` LEAVES IT STANDING. An ask link does not expire and does not get
   used up, so declining to answer costs the asker nothing — the reader can
   open the same link again, and so can everyone else it was sent to. */
export function Screen() {
  return (
    <>
      <PageHeader title="A vouch, asked for" backHref="#" backLabel="Back" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, padding: "8px 16px 0", overflow: "hidden" }}>
        <Card style={{ flex: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <MonogramAvatar name="noor" size="lg" />
            <h2 style={{ margin: 0, fontSize: "var(--text-title-medium)", lineHeight: "var(--text-title-medium--line-height)", fontWeight: "var(--text-title-medium--font-weight)" }}>
              @noor is asking to be vouched in
            </h2>
          </div>
          <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", color: "var(--text-secondary)" }}>
            They have an account and can read; what they do not have yet is anyone standing for them. Your opinion is what brings them in.
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
            <Button variant="text">Not now</Button>
            <StanceControl
              targetLabel="@noor"
              helpLabel="How vouching works"
              defaultPick={{ pDirected: 0.1, pInterest: 0.1 }}
              padNote={<ApprovePadNote handle="@noor" />}
            />
          </div>
        </Card>
        <div style={{ flex: 1 }} />
      </div>
    </>
  );
}
