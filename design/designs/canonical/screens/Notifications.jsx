/* NOTIFICATIONS — the second surfacing channel, reached from the bell on every
   root band (docs/implementation/notifications.md; jakob's rulings 2026-09-11).

   ONE FLAT LIST, NEWEST FIRST, NO GROUPING (jakob). Every row is one actor
   doing one thing at one moment, and the list is that sequence. Aggregating
   "three people commented" would trade away the two things a row is for — the
   name and the moment — and would need a second read model on top.

   SEVEN KINDS, EACH DRAWN ONCE: a comment on your post, a reply to your
   comment, an opinion on your profile, a mention, a citation, someone landing
   through your invite, and your own application approved. Opinions on your
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
   wear `unread` and the older four do not, and there is no mark-all — a
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
      </ChronicleList>
      <BottomNav active={null} slots={ALL_SLOTS} inline />
    </>
  );
}
