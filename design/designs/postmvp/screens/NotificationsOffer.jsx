/* NOTIFICATIONS · the offer row — the second of the two places the OS ask can
   fire (docs/implementation/notifications.md; jakob's rulings 2026-09-22).

   THE ASK FIRES FROM AN ACT, NEVER AT LAUNCH (jakob). A permission sheet on
   first open asks a reader about a channel they have not met, and on native a
   refusal is STICKY — the platform will not ask twice, so an ask spent early
   is the channel spent for good. Two acts may spend it: the settings toggle,
   and this row.

   ON WEB THIS ROW IS THE PRE-PROMPT. There is no second surface between it and
   the browser's own dialog, which is why the row says the dialog is coming:
   a reader who meets an unexplained permission sheet refuses it.

   IT IS ONE ROW, QUIET, AND AT THE TOP. Quiet because the list is the channel
   and this is an offer about it, not an item in it — the chronicle's own row
   at the chronicle's own weight, wearing the bell where a face would go. At
   the top because a reader scrolling for the thing that just arrived should
   pass it, not hunt for it.

   DISMISS IS FOREVER (jakob). The row does not come back, on any device, and
   settings keeps the same offer for a reader who changes their mind. An offer
   that returned would be the launch prompt with extra steps and a slower
   clock.

   THE LIST BELOW IS CANONICAL'S. Three rows stand here so the offer is drawn
   in its place rather than alone; `Notifications` in the canonical tree is the
   list itself and the master of every row on it. */
export function Screen() {
  return (
    <>
      <PageHeader title="Notifications" backHref="#" backLabel="Back" />
      <ChronicleList>
        <ContentRow
          variant="chronicle"
          chevron={false}
          glyph="notifications"
          title="Get these as they happen"
          second="This browser will ask you first."
          action={<InlineAction size="sm" ariaLabel="No thanks — this offer does not come back">No thanks</InlineAction>}
          onOpen={() => {}}
        />
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
      </ChronicleList>
      <BottomNav active={null} slots={ALL_SLOTS} inline />
    </>
  );
}
