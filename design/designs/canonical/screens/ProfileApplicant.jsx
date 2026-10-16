/* Your own profile in applicant days (profile round, item 23). The same
   header — applicant versus member is cards and states, never a different
   layout (the ProfileHeader rule). The application card rides above the
   header. Invites wears auth.md's locked look, the comment foot's pattern
   (jakob 2026-10-02): visibly inactive at the disabled opacity, still
   tappable, answering with the snackbar drawn here — `You can invite once
   you're in.`, an informational line, never a gate screen (jakob
   2026-09-01).

   NOTHING IS STAGED, SO THE CHRONICLE IS EMPTY (PR-103, round 16).
   Applicant acting is post-MVP: nothing an applicant does waits with the
   application, and nothing has landed, so the figures read zero and the
   chronicle stands at `EmptyState`, saying what fills it and when — the
   applicant-foot family's `once you're in`. `New post` on the bar answers in
   place with `You can post once you're in.`, as the shells' bar does.

   THE CARD NAMES THE APPROVER (the approver sweep, 2026-09-15). "Waiting on
   your inviter" named a person this reader does not have — the inviter is
   fixed at the vouch-back — so the title names whoever's approval is in play.
   Its body takes `ApplicantWaiting`'s first sentence and adds what the reader
   can do meanwhile: `Their approval brings you in. Until then, you can read
   everything.`

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
   chip). Once @mira closes the application, `Waiting on @mira` is false, and
   the profile is still the ask link's home. So the card takes
   `ApplicantRejected`'s blessed words and its olive (the card now asks for
   the reader's action), and the ask link takes that card's label and
   caption. The chronicle reads the same either way.

   REGISTERED under the `profile` prefix (design ⇄ impl seam 078), named as
   `Profile` names your own page; the card is `application`, its ask link
   `link`, the chronicle's empty line `empty`, `HistoryEmpty`'s name. The
   `application` chip draws the card once per value, one shown at a time, so
   both copies take the card's one path, keyed by the chip's value (the
   chip-drawn duplicate rule). */
export const NODE = "profile";
export const PROPS = { application: { editor: "enum", options: ["waiting", "closed"], default: "waiting" } };
export const VALS = `waitingShown: this.props.application === "closed" ? "none" : "block", closedShown: this.props.application === "closed" ? "block" : "none"`;

export function Screen() {
  return (
    <>
      <ProfileBand node="band" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "8px 16px 0", display: "{{waitingShown}}" }} data-node-chip="application" data-node-key="waiting">
          <TaskCard title="Waiting on @mira" body="Their approval brings you in. Until then, you can read everything." node="application">
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
            posts={0}
            stancesOn={0}
            stancesTaken={0}
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
          <EmptyState title="Nothing here yet. Your posts and opinions show up here once you're in." node="empty" />
        </ChronicleList>
      </div>
      <Snackbar message="You can invite once you're in." node="snackbar" />
      <BottomNav active="profile" slots={ALL_SLOTS} inline node="bottomBar" />
    </>
  );
}
