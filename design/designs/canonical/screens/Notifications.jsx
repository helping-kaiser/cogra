/* NOTIFICATIONS — the second surfacing channel, reached from the bell on every
   root band (docs/implementation/notifications.md; jakob's rulings 2026-09-11).

   ONE FLAT LIST, NEWEST FIRST, NO GROUPING (jakob). Every row is one actor
   doing one thing at one moment, and the list is that sequence. Aggregating
   "three people commented" would trade away the two things a row is for — the
   name and the moment — and would need a second read model on top.

   NINE KINDS, EACH DRAWN ONCE: a comment on your post, a reply to your
   comment, an opinion on your profile, a mention, an applicant ready for your
   approval, a citation, someone landing through your invite, your own
   application approved, and your own application closed. Opinions on your
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
   wear `unread` and the older six do not, and there is no mark-all — a
   control whose only job is to make a list stop asking is a control for a list
   that asks too much. */
export function Screen() {
  return (
    <>
      <PageHeader title="Notifications" backHref="#" backLabel="Back" />
      <ChronicleList>
        <ContentRow
          variant="chronicle"
          chevron={false}
          unread
          name="Ada Okonkwo"
          title="@ada commented on your post"
          second="The third headland light is real — I have a print from 2019 that almost catches it."
          trailing="35m"
          onOpen={() => {}}
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
        />
        <ContentRow
          variant="chronicle"
          chevron={false}
          unread
          face={{ pDirected: 0.4, pInterest: 0.5 }}
          title="@sol gave an opinion on you"
          trailing="6h"
          onOpen={() => {}}
        />
        <ContentRow
          variant="chronicle"
          chevron={false}
          image="inviter.jpg"
          title="@mira mentioned you"
          second="in Salt maps of the coast road"
          trailing="1d"
          onOpen={() => {}}
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
        />
        <ContentRow
          variant="chronicle"
          chevron={false}
          name="Ada Okonkwo"
          title="@ada cited your post"
          second="in Sunday at the tide market"
          trailing="3d"
          onOpen={() => {}}
        />
        <ContentRow
          variant="chronicle"
          chevron={false}
          name="Juno Baptiste"
          title="@juno landed through your invite"
          trailing="9d"
          onOpen={() => {}}
        />
        <ContentRow
          variant="chronicle"
          chevron={false}
          image="inviter.jpg"
          title="@mira approved your application"
          trailing="12d"
          onOpen={() => {}}
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
        />
      </ChronicleList>
      <BottomNav active={null} slots={ALL_SLOTS} inline />
    </>
  );
}
