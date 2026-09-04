/* Guest gate · the ask — the pattern behind every account-needing slot
   (readme §13, patterns). A guest who reaches for a stance, a post, a
   profile, or the chats gets THIS, never a bounce: the read stays exactly
   where it was, under the wash, and the reader picks. Keep browsing closes
   the ask and gives the screen back; Sign in or join is the one committing
   action here and wears the filled button.

   The board draws the borrowed view whole beneath the ask, because the point
   of the pattern is what is NOT taken away. Everything under the scrim is
   inactive while it is open — the board is scanExempt on that account, and
   only the ask's own pair carries a number. */
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter />}>
        <BorrowedViewBand handle="mira" displayName="Mira Voss" avatarSrc="inviter.jpg" actionLabel="Sign in or join" />
        <ApkLine />
      </CograBand>
      <FeedList>
        <PostCard {...ADA_POST} signedIn={false} targetLabel="this post" />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
      <JoinPrompt />
    </>
  );
}
