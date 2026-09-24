/* NOTIFICATIONS · the chat kinds — three new rows in the list's own grammar
   (round B3 of the chats work, the integration round; notifications.md, *The
   kinds later slices add*: "chat invitations each arrive with the slice that
   owns the act").

   EACH PASSES THE TAXONOMY'S ONE TEST — another actor acted, and it reached
   something of yours — and each lands where its act is answered:
   · AN INVITATION — `@mira invited you to Night fishing crew`, her face on the
     disc, the invitation's own message as the second line where she wrote one.
     Lands on the chat read as an invitee (`ChatThreadInvited`): the thread,
     her line and `Join` at the foot.
   · A REQUEST AWAITING YOUR APPROVAL — `@saltorres asks to join Headland
     honey`, the requester's monogram, their message as the second line.
     Written only for the people the chat's map lets approve (under the
     default map, its admins and moderators — chats.md §5); a plain member's
     list carries no row, because nothing about it is theirs to answer. Lands
     on the thread with the request's card (`ChatRequestApprove`). The
     applicant-approvable row's twin, one surface over.
   · YOUR REQUEST APPROVED — `Harbour office approved your request to join`,
     the CHAT'S disc on the row. THE LANE'S CALL, FLAGGED: an approval is the
     chat's decision passing, not one person's favour — under a map with more
     approvers it takes several — so the chat is the row's actor, the way
     `Removed by the chat's decision` names the chat. Lands on the thread with
     the outcome line and `Join` (`ChatThreadApproved`).

   THE LIST'S WORDS, NOT THE CHATS' (the lane's reading, flagged): a row names
   people by handle, `@mira`, as every row on this list does, where the chats
   surfaces spell display names whole. The list is one grammar; a chat row
   that spoke differently would be a second voice on one page.

   NO ROW FOR AN ORDINARY MESSAGE, EVER (ruled). Messages do not enter this
   list (notifications.md, *Out of scope*): a chat's unread is the dot on its
   own row and on the band's chats icon, and a list that also held every
   message would stop being a list of things that happened to the reader.
   Push is where a message announces itself (`PushKinds`).

   THE ROWS BELOW THE THREE are canonical's list, unchanged, so the new kinds
   are drawn in their place rather than alone; `Notifications` in the
   canonical tree is the list itself and the master of every row. */
export function Screen() {
  return (
    <>
      <PageHeader title="Notifications" backHref="#" backLabel="Back" />
      <ChronicleList>
        <ContentRow
          variant="chronicle"
          chevron={false}
          unread
          image="inviter.jpg"
          title="@mira invited you to Night fishing crew"
          second={`“${NIGHT_FISHING_INVITATION}”`}
          trailing="10m"
          onOpen={() => {}}
        />
        <ContentRow
          variant="chronicle"
          chevron={false}
          unread
          name="Sal Torres"
          title="@saltorres asks to join Headland honey"
          second="“I keep two hives inland now — could I join and learn from yours?”"
          trailing="1h"
          onOpen={() => {}}
        />
        <ContentRow
          variant="chronicle"
          chevron={false}
          unread
          glyph="forum"
          title="Harbour office approved your request to join"
          trailing="3h"
          onOpen={() => {}}
        />
        <ContentRow
          variant="chronicle"
          chevron={false}
          name="Ada Okonkwo"
          title="@ada commented on your post"
          second="The third headland light is real — I have a print from 2019 that almost catches it."
          trailing="1d"
          onOpen={() => {}}
        />
        <ContentRow
          variant="chronicle"
          chevron={false}
          name="Tobias Lindqvist"
          title="@tobias replied to your comment"
          second="Crust held all the way past the slipway today."
          trailing="2d"
          onOpen={() => {}}
        />
      </ChronicleList>
      <BottomNav active={null} slots={ALL_SLOTS} inline />
    </>
  );
}
