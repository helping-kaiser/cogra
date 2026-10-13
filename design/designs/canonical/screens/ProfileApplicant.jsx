/* Your own profile in applicant days (profile round, item 23). The same
   header — applicant versus member is cards and states, never a different
   layout (the ProfileHeader rule). The application card rides above the
   header; the chronicle holds the acts already staged, each marked as still
   settling (the ruling: an applicant stages each kind of act once). Invites
   are the one locked control: the tap answers with the snackbar, drawn here —
   an informational line, never a gate screen (jakob 2026-09-01). The button
   wears auth.md's locked look, the comment foot's pattern (jakob
   2026-10-02): visibly inactive at the disabled opacity, still tappable,
   answering `You can invite once you're in.`

   THE CARD NAMES THE APPROVER (the approver sweep, 2026-09-15). "Waiting on
   your inviter" named a person this reader does not have — the inviter is
   fixed at the vouch-back — so the title names whoever's approval is in play,
   and the sentence that repeated it under a second verb is gone rather than
   rewritten. What is left is the fact the title cannot carry: acts staged now
   arrive with the reader.

   THE ASK LINK LIVES HERE FOR GOOD (jakob 2026-10-02). The waiting card on the
   feed carries it until `Got it` puts that card away; this card is never put
   away, so the profile is the link's permanent home — `ApplicantWaiting`'s
   block and label, `bare` inside the card. Its caption adds what the open
   application means now that anyone holding the ask can vouch (jakob
   2026-10-07, item 58), spoken in the second person because this is the
   reader's own page — "more personal is better" (jakob 2026-10-09, item 91);
   the third-person form stays wherever another reader meets the fact.
   Settings carries no ask link.

   TURNED DOWN, THE CARD SAYS SO (jakob 2026-10-05, D9; the `application`
   chip). Once @mira closes the application, `Waiting on @mira` and the
   chronicle's `with your application` are false, and the profile is still the ask link's home. So the card takes
   `ApplicantRejected`'s blessed words and its olive (the card now asks for
   the reader's action), the ask link takes that card's label and caption,
   and the chronicle's line says what the staged acts wait for: `These wait
   — they arrive when someone vouches you in.`

   REGISTERED under the `profile` prefix (design ⇄ impl seam 078), named as
   `Profile` names your own page; the card is `application`, its ask link
   `link`. The `application` chip draws the card once per value, one shown at
   a time, so both copies take the card's one path, keyed by the chip's value
   (the chip-drawn duplicate rule). */
export const NODE = "profile";
export const PROPS = { application: { editor: "enum", options: ["waiting", "closed"], default: "waiting" } };
export const VALS = `waitingShown: this.props.application === "closed" ? "none" : "block", closedShown: this.props.application === "closed" ? "block" : "none", stagedLine: this.props.application === "closed" ? "These wait — they arrive when someone vouches you in." : "These wait with your application and arrive with you."`;

export function Screen() {
  return (
    <>
      <ProfileBand node="band" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "8px 16px 0", display: "{{waitingShown}}" }} data-node-chip="application" data-node-key="waiting">
          <TaskCard title="Waiting on @mira" body="What you post now arrives with you." node="application">
            <PayoutAddress
              bare
              label="Your ask link"
              address={ASK_LINK}
              onCopy={() => {}}
              copyLabel="Copy your ask link"
              caption="It does not expire. Anyone who holds your ask can let you in — the first vouch lands it."
              node="link"
            />
          </TaskCard>
        </div>
        <div style={{ padding: "8px 16px 0", display: "{{closedShown}}" }} data-node-chip="application" data-node-key="closed">
          <TaskCard
            tone="notice"
            title="@mira closed your application"
            body="That was @mira's call, and it is the only thing it decides. Your account stays exactly as it is, you can keep reading, and any member you know can vouch you in instead."
            node="application"
          >
            <PayoutAddress
              bare
              label="Ask someone you know to vouch for you"
              address={ASK_LINK}
              onCopy={() => {}}
              copyLabel="Copy your ask link"
              caption="Send it to anyone who is already in. It does not expire, and it works however many people you send it to."
              node="link"
            />
          </TaskCard>
        </div>
        <div style={{ padding: "0 16px" }}>
          <ProfileHeader
            node="identity"
            handle="juno"
            displayName="Juno Baptiste"
            posts={1}
            stancesOn={0}
            stancesTaken={1}
            own
            onEdit={() => {}}
            onInvites={() => {}}
            invitesOpacity="var(--state-disabled)"
            onAvatarChange={() => {}}
            onCounts={() => {}}
            menu={ownProfileMenu()}
          />
        </div>
        <TabBar ariaLabel={CHRONICLE_TABS_LABEL} value="everything" tabs={CHRONICLE_TABS} node="tabRow" />
        <ChronicleList node="chronicle">
          <ContentRow variant="chronicle" chevron={false} glyph="dynamic_feed" title="Published a post" trailing="1h" second="First light over the flats — brought the wrong lens, kept the picture anyway." pending onOpen={() => {}} node="act" nodeKey="1" />
          <ContentRow variant="chronicle" chevron={false} face={{ pDirected: 0.1, pInterest: 0.1 }} title="Gave an opinion" titleAside="on @mira" trailing="2h" pending inert node="act" nodeKey="2" />
          <p style={{ margin: 0, padding: "4px 0", fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "var(--text-label-small--letter-spacing)", color: "var(--text-secondary)" }} data-node="stagedLine">
            {"{{stagedLine}}"}
          </p>
        </ChronicleList>
      </div>
      <Snackbar message="You can invite once you're in." node="snackbar" />
      <BottomNav active="profile" slots={ALL_SLOTS} inline node="bottomBar" />
    </>
  );
}
