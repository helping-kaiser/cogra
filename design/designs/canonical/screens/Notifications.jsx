/* NOTIFICATIONS — the second surfacing channel, reached from the bell on every
   root band (docs/implementation/notifications.md; jakob's rulings 2026-09-11).

   ONE FLAT LIST, NEWEST FIRST, NO GROUPING (jakob). Every row is one actor
   doing one thing at one moment, and the list is that sequence. Aggregating
   "three people commented" would trade away the two things a row is for — the
   name and the moment — and would need a second read model on top.

   TEN KINDS, EACH DRAWN ONCE: a comment on your post, a reply to your
   comment, an opinion on your profile, a mention, an applicant ready for your
   approval, a citation, someone landing through your invite, your own
   application approved, your own application closed, and an opinion on your
   profile walked back. Opinions on your
   CONTENT are deliberately absent (jakob): a post collects those continuously,
   and the list would become a counter of ambient sentiment. Who holds an
   opinion on a post is answered on the post itself.

   THE ROW IS A SENTENCE, because a notification's whole content is who did
   what to which of yours — and `ContentRow`'s disc already says who. The second
   line carries the words that arrived or the piece that carries them; the
   opinion row has neither, so it has none.

   THE OPINION ROW WEARS THE FACE, the chronicle's "Gave an opinion" row exactly
   — the disc's own precedence puts a stance face where a picture would go, and
   no digits ride along in either reading, which is that row's standing shape.

   READ STATE IS TWO LEVELS (jakob). Opening this list clears the bell's dot;
   each row keeps its own quiet mark until it is opened. So the newest three
   wear `unread` and the older seven do not, and there is no mark-all — a
   control whose only job is to make a list stop asking is a control for a list
   that asks too much.

   REGISTERED under the `notifications` prefix (round 7): the list is `list`,
   each row a `notification` keyed by its place in the list, newest first —
   two rows can share an actor, so the place is the row's one stable key, as
   the chronicle's acts are keyed. A row's quiet mark is `ContentRow`'s `dot`.

   THE `load` CHIP DRAWS THE READ'S OTHER MOMENTS (seam 248), the house
   pattern Saved keeps. `loading` is the first read in flight with nothing
   to show: `LoadingState`'s `Loading…` in the list's place, no skeleton and
   no spinner. `failed` is that read with no answer: the noun form of the
   house line, `Can't reach the server — notifications can't load right
   now.`, over an outlined `Retry` (`ProfileUnreachable`'s grammar). `more`
   is the next page that did not come while rows stand: the list scrolled to
   its foot, and `Couldn't load more — Retry` ending it at the list's own
   rung, never `--error` (`ProfileMoreFailed`'s row). */
export const NODE = "notifications";
export const PROPS = { load: { editor: "enum", options: ["loaded", "loading", "failed", "more"], default: "loaded" } };
export const VALS = `headShown: this.props.load === "loaded" ? "flex" : "none", footShown: this.props.load === "loaded" || this.props.load === "more" ? "flex" : "none", loadingShown: this.props.load === "loading" ? "block" : "none", failedShown: this.props.load === "failed" ? "block" : "none", moreShown: this.props.load === "more" ? "block" : "none"`;
const NOTIFICATIONS_ROWS = { display: "flex", flexDirection: "column", gap: 8 };
const NOTIFICATIONS_TAIL = {
  margin: 0,
  padding: "8px 4px 16px",
  fontSize: "var(--text-body-medium)",
  lineHeight: "var(--text-body-medium--line-height)",
  letterSpacing: "var(--text-body-medium--letter-spacing)",
  color: "var(--text-secondary)",
};
export function Screen() {
  return (
    <>
      <PageHeader title="Notifications" backHref="#" backLabel="Back to feed" node="header" />
      <ChronicleList node="list">
        <div style={{ ...NOTIFICATIONS_ROWS, display: "{{headShown}}" }}>
        <ContentRow
          variant="chronicle"
          chevron={false}
          unread
          name="Ada Okonkwo"
          title="@ada commented on your post"
          second="The third headland light is real — I have a print from 2019 that almost catches it."
          trailing="35m"
          onOpen={() => {}}
          node="notification"
          nodeKey="1"
        />
        <ContentRow
          variant="chronicle"
          chevron={false}
          unread
          name="Tobias Lindqvist"
          title="@tobias replied to your comment"
          second="Crust held all the way past the slipway today."
          trailing="2h"
          onOpen={() => {}}
          node="notification"
          nodeKey="2"
        />
        <ContentRow
          variant="chronicle"
          chevron={false}
          unread
          face={{ pDirected: 0.4, pInterest: 0.5 }}
          title="@sol gave an opinion on you"
          trailing="6h"
          onOpen={() => {}}
          node="notification"
          nodeKey="3"
        />
        <ContentRow
          variant="chronicle"
          chevron={false}
          image="inviter.jpg"
          title="@mira mentioned you"
          second="in Salt maps of the coast road"
          trailing="1d"
          onOpen={() => {}}
          node="notification"
          nodeKey="4"
        />
        {/* THE EIGHTH KIND (the invites round, 2026-09-15): an application of
            yours became approvable. It belongs to the set by the set's own
            test — somebody else acted (the applicant attached their key, the
            second of the two proofs) and the act reached something with an
            owner, the invite that staged them. Nothing else can tell the
            link's issuer this: a staged applicant who never gets approved is
            the one failure mode the mechanic has, and it is entirely theirs
            to notice.

            IT WEARS THE MONOGRAM, not a picture, because there is no Profile
            to carry one until the approval lands — the same rule the invites
            list keeps for the same reason.

            IT IS READ AND THE APPLICATION IS STILL WAITING, and that is not a
            contradiction: the bell asks whether anything is new, and the
            profile's Invites dot asks whether anybody is waiting. The second
            outlives the first. */}
        <ContentRow
          variant="chronicle"
          chevron={false}
          name="rafa"
          title="@rafa is ready for your approval"
          trailing="2d"
          onOpen={() => {}}
          node="notification"
          nodeKey="5"
        />
        </div>
        <div style={{ ...NOTIFICATIONS_ROWS, display: "{{footShown}}" }}>
        <ContentRow
          variant="chronicle"
          chevron={false}
          name="Ada Okonkwo"
          title="@ada cited your post"
          second="in Sunday at the tide market"
          trailing="3d"
          onOpen={() => {}}
          node="notification"
          nodeKey="6"
        />
        <ContentRow
          variant="chronicle"
          chevron={false}
          name="Juno Baptiste"
          title="@juno landed through your invite"
          trailing="9d"
          onOpen={() => {}}
          node="notification"
          nodeKey="7"
        />
        <ContentRow
          variant="chronicle"
          chevron={false}
          image="inviter.jpg"
          title="@mira approved your application"
          trailing="12d"
          onOpen={() => {}}
          node="notification"
          nodeKey="8"
        />
        {/* THE NINTH KIND (the invites round's extension, 2026-09-15): a
            member closed an application of yours. It is the eighth's twin and
            had to be drawn beside it — a mechanic that notifies a yes and says
            nothing about a no leaves the applicant waiting on a thing that has
            already stopped happening, which is the one cruelty this flow can
            commit by omission.

            THE TWO ROWS TOGETHER ARE THE STORY, and the order tells it: @kel
            closed an application fourteen days ago and @mira vouched them in
            two days later. That is the ruled recovery path drawn as history —
            one member declining is one member declining, and the ask link is
            how the next one hears about it.

            IT NAMES THE PERSON AND USES THE CONTROL'S OWN WORD. `closed` is
            what the button said; a notification that softened it to something
            else would be the product telling two stories about one act. */}
        <ContentRow
          variant="chronicle"
          chevron={false}
          name="Kel Moreau"
          title="@kel closed your application"
          trailing="14d"
          onOpen={() => {}}
          node="notification"
          nodeKey="9"
        />
        {/* THE TENTH KIND (jakob 2026-10-14, PR-72): a withdrawal — someone
            walked an opinion on you back to nothing. A withdrawal is always
            addressed at the thing it zeroes, so it notifies like the opinion
            it undoes, and its words say plainly what happened. It is the
            opinion row's sibling: the HOLLOW FACE where the opinion row wears
            the opinion's face, no digits, no second line.

            THE ORDER TELLS A STORY TOO: @sol walked an opinion back sixteen
            days ago and gave a new one six hours ago — two pointings, two
            rows, each the act it was. */}
        <ContentRow
          variant="chronicle"
          chevron={false}
          face="walkedBack"
          title="@sol walked back their opinion on you"
          trailing="16d"
          onOpen={() => {}}
          node="notification"
          nodeKey="10"
        />
        </div>
        <div style={{ display: "{{moreShown}}" }} data-node-chip="load" data-node-key="more">
          <p style={NOTIFICATIONS_TAIL} data-node="moreFault">
            Couldn&apos;t load more <span aria-hidden="true">—</span> <InlineAction size="sm" node="retry">Retry</InlineAction>
          </p>
        </div>
        <div style={{ display: "{{loadingShown}}" }} data-node-chip="load" data-node-key="loading">
          <div data-node="loading">
            <LoadingState />
          </div>
        </div>
        <div style={{ display: "{{failedShown}}" }} data-node-chip="load" data-node-key="failed">
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "var(--space-3)", padding: "8px 8px" }} data-node="fault">
            <TransportError message="Can't reach the server — notifications can't load right now." />
            <Button variant="outline" size="sm" selfStart node="retry">
              Retry
            </Button>
          </div>
        </div>
      </ChronicleList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline node="bottomBar" />
    </>
  );
}
