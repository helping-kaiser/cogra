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
   `inverse`.

   THE KEY CARD NAMES ITS PLATFORM (jakob 2026-10-05; the `wording` chip):
   `…needs a key on this browser…` on the web, `…needs a key in this app…`
   in the app. `Resend the link` answers with the sent-shape snackbar
   naming the address, the line `Wrong address?` already speaks.

   REGISTERED under the feed's own prefix (round 7), the shell named as
   `ApplicantRejected` names it. The two cards are `verifyCard` and `keyCard`,
   the vouch-back card's shape of name: the verify card's address line is
   `address`, `Wrong address?` is `wrongAddress`, the seven-day line `note` and
   `Resend the link` `resend`, as on `VerifyExpired`; the key card's button is
   `create`.

   A KEY THAT EXISTS AND IS NOT ATTACHED (round 66; jakob 2026-11-23, "Attach
   i guess and body is fine"; backlog 303) is the `keyCard` chip's `attach`:
   the applicant's own key, on this device, failed to reach the application.
   The key card stands in its place, titled `Attach your key`, its body naming
   the platform as the `wording` chip does — `Your key is on this browser. It
   hasn't reached your application yet.` on the web, `…is in this app…` in
   the app — and `Create my key` gives way to the house line `That didn't go
   through.` with `Retry` at its end, the Invites copy fault's shape
   (`SigningPending row`, `invites.link.copyFault`), named `attachFault`.
   `create` is the card for a key not yet made. */
export const NODE = "feed";
export const PROPS = {
  wording: { editor: "enum", options: ["browser", "app"], default: "browser" },
  keyCard: { editor: "enum", options: ["create", "attach"], default: "create" },
};
export const VALS = `keyCardTitle: this.props.keyCard === "attach" ? "Attach your key" : "Create your key", keyCardBody: this.props.keyCard === "attach" ? (this.props.wording === "app" ? "Your key is in this app. It hasn't reached your application yet." : "Your key is on this browser. It hasn't reached your application yet.") : this.props.wording === "app" ? "Your application needs a key in this app before @mira can approve it." : "Your application needs a key on this browser before @mira can approve it.", keyCreateShown: this.props.keyCard === "attach" ? "none" : "contents", keyFaultShown: this.props.keyCard === "attach" ? "block" : "none"`;

export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter node="filterTrigger" />} node="band">
        <BorrowedViewBand
          handle="mira"
          displayName="Mira Voss"
          avatarSrc="inviter.jpg"
          line="Browsing from @mira's view."
          node="borrowedViewBand"
        />
      </CograBand>
      <FeedList>
        <TaskCard tone="notice" title="Verify your email" node="verifyCard">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span
              style={{
                minWidth: 0,
                overflowWrap: "anywhere",
                fontSize: "var(--text-body-medium)",
                fontWeight: "var(--text-body-medium--font-weight)",
                lineHeight: "var(--text-body-medium--line-height)",
                letterSpacing: "var(--text-body-medium--letter-spacing)",
              }}
              data-node="address"
            >
              Sent to noor@fieldmail.org
            </span>
            <InlineAction size="sm" onClick={() => {}} node="wrongAddress">
              Wrong address?
            </InlineAction>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: "var(--text-body-small)",
              fontWeight: "var(--text-body-small--font-weight)",
              lineHeight: "var(--text-body-small--line-height)",
              letterSpacing: "var(--text-body-small--letter-spacing)",
              color: "var(--text-secondary)",
            }}
            data-node="note"
          >
            An account left unverified for seven days is removed — joining again then starts over.
          </p>
          <Button variant="outline" selfStart node="resend">
            Resend the link
          </Button>
        </TaskCard>
        <TaskCard tone="notice" title="{{keyCardTitle}}" body="{{keyCardBody}}" node="keyCard">
          <div style={{ display: "{{keyCreateShown}}" }}>
            <Button variant="inverse" selfStart node="create">
              Create my key
            </Button>
          </div>
          <div style={{ display: "{{keyFaultShown}}" }} data-node-chip="keyCard" data-node-key="attach">
            <div data-node="attachFault">
              <SigningPending row message="That didn't go through." onRetry={() => {}} />
            </div>
          </div>
        </TaskCard>
        <PostCard {...ADA_POST} signedIn={false} stanceOpacity="var(--state-disabled)" node="card" />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline composeOpacity="var(--state-disabled)" node="bottomBar" />
    </>
  );
}
