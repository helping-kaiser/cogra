/* Applicant days, first steps — the application rides the feed as cards.

   THE VERIFY CARD PRINTS THE ADDRESS (jakob 2026-10-01, audit K3.2). A reader
   who mistyped their email at Join finds out here, and only if the card names
   it — `DeleteAccountMail`'s rule, from `ChangeEmail`. `Wrong address?` is the
   way out the two-sided change cannot give an unverified account: the old
   address's code would go to an address that never receives it, so the
   applicant changes it with the new address alone (auth.md, *Email change*,
   the unverified carve-out) on `ApplicantEmail`.

   THE CONSEQUENCE IS SAID ONCE, HERE (jakob 2026-10-01, audit K3.3). An
   account nobody verifies is reaped after seven days (jakob 2026-10-02: a day
   is short enough for a mail outage on our side to cost accounts), and the
   loss is silent and total — so the card says it, in one line, as a
   consequence and not a clock: no figure ticks down, and no other surface
   repeats it. `VerifyExpired` keeps its reassurance to what is true.

   BOTH CARDS WEAR THE OLIVE (jakob 2026-10-02, the olive split): each is a
   step the applicant still owes, so each stands on the account-notice
   register (`TaskCard`'s `tone="notice"`), and the key's filled action is
   `inverse`. */
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter />}>
        <BorrowedViewBand handle="mira" displayName="Mira Voss" avatarSrc="inviter.jpg" line="Browsing from @mira's view while your application lands." />
      </CograBand>
      <FeedList>
        <TaskCard tone="notice" title="Verify your email" body="We sent you a verification link — open it to prove this email is yours.">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span
              style={{
                minWidth: 0,
                overflowWrap: "anywhere",
                fontSize: "var(--text-body-medium)",
                lineHeight: "var(--text-body-medium--line-height)",
                letterSpacing: "var(--text-body-medium--letter-spacing)",
              }}
            >
              Sent to noor@fieldmail.org
            </span>
            <InlineAction size="sm" onClick={() => {}}>
              Wrong address?
            </InlineAction>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: "var(--text-body-small)",
              lineHeight: "var(--text-body-small--line-height)",
              letterSpacing: "var(--text-body-small--letter-spacing)",
              color: "var(--text-secondary)",
            }}
          >
            An account left unverified for seven days is removed — joining again then starts over.
          </p>
          <Button variant="outline" selfStart>
            Resend the link
          </Button>
        </TaskCard>
        <TaskCard tone="notice" title="Create your key" body="Your application needs a key on this browser before @mira can approve it.">
          <Button variant="inverse" selfStart>Create my key</Button>
        </TaskCard>
        <PostCard {...ADA_POST} signedIn={false} />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
