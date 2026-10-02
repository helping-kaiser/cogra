/* The landing — the live public feed from @mira's borrowed view (readme §13).

   THE LINK LANDS FEED-FIRST, AND THE APP KEEPS IT (jakob 2026-10-01, audit
   K3.6). An invite link opens this view, never the form: the feed is what a
   visitor came to see. But the app already holds the link — the band is
   named from it — so a visitor holding a LIVE one never pastes it again: the
   band's `Sign in or join` and every guest gate's affirmative open `Join`
   with the link in hand, and `InviteEntry` is never shown to them (WCAG
   3.3.7, redundant entry). `Join` keeps its own `Already have an account?
   Sign in`, so the returning reader loses nothing.

   AN UNUSABLE LINK LANDS HERE TOO. The landing is feed-first for every
   arrival, and a dead link still names its issuer (`inviteLinkCheck` answers
   `usable: false` with the handle), so the vantage rule lands on the same
   view; the band and the gate then open `JoinInvalid`, which says so and
   takes another link. A link that resolves to nothing carries no issuer and
   lands on `FeedBare`, the bare view. Either dead arrival says so once, in
   one snackbar over the unchanged landing: `This invite link has expired.`
   (jakob 2026-10-02). */
export function Screen() {
  return (
    <>
      <CograBand bell={false} trailing={<FeedFilter />}>
        <BorrowedViewBand handle="mira" displayName="Mira Voss" avatarSrc="inviter.jpg" actionLabel="Sign in or join" />
        <ApkLine />
      </CograBand>
      <FeedList>
        <PostCard {...ADA_POST} signedIn={false} targetLabel="this post" />
        <PostCard {...TOBIAS_POST} signedIn={false} targetLabel="this post" />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
