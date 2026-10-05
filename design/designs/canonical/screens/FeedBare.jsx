/* Bare arrival — no invite link, so the genesis moderator's borrowed view.
   An invite link that resolves to nothing carries no issuer and lands here
   too, with `Main`'s dead-link snackbar (jakob 2026-10-02). An applicant who
   deletes their account lands here signed out, and one snackbar answers on
   arrival: `Your account is deleted.` (jakob 2026-10-05; `DeleteAccount`'s
   applicant case). */
export function Screen() {
  return (
    <>
      <CograBand bell={false} trailing={<FeedFilter />}>
        <BorrowedViewBand handle="noa" displayName="Noa Lindgren" actionLabel="Sign in or join" />
        <ApkLine />
      </CograBand>
      <FeedList>
        <PostCard {...ADA_POST} signedIn={false} />
        <PostCard {...TOBIAS_POST} signedIn={false} />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
