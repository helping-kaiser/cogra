/* Bare arrival — no invite link, so the genesis moderator's borrowed view.
   An invite link that resolves to nothing carries no issuer and lands here
   too, with `Main`'s dead-link snackbar (jakob 2026-10-02). An applicant who
   deletes their account lands here signed out, and one snackbar answers on
   arrival: `Your account is deleted.` (jakob 2026-10-05; `DeleteAccount`'s
   applicant case). The view is `@genesis_mod`, the one handle every guest
   board names it by (`GUEST_VANTAGE`; jakob 2026-11-23, B2); its display
   name is the tree's `Genesis Moderator` (ExploreSearch.md). Its picture is
   the CoGra mark, the brand's orange tile clipped round (jakob 2026-11-24,
   "(a) orange tile"; readme §4 *Imagery*) — the account's own picture, set
   by the person who holds it, drawn so on the sample.

   REGISTERED (impl seam 451): the feed as a guest reads it, under `Feed`'s
   prefix and body names — `band`, `filterTrigger`, `card`, `bottomBar` — and
   the borrowed-view band by `ApplicantFeed`'s name, `borrowedViewBand`. The
   APK line carries no name: no board registers it. */
export const NODE = "feed";
export function Screen() {
  return (
    <>
      <CograBand bell={false} trailing={<FeedFilter node="filterTrigger" />} node="band">
        <BorrowedViewBand handle={GUEST_VANTAGE} displayName="Genesis Moderator" avatarMark actionLabel="Sign in or join" node="borrowedViewBand" />
        <ApkLine />
      </CograBand>
      <FeedList>
        {/* THE BORROWED VIEW'S OWN OPINIONS (round 63; jakob 2026-11-23,
            point 7 "build it"): the view holds one on @ada's post — the face
            and pair the member's feed draws there (`Feed`) — and none on
            @tobias's, which wears the hollow face. Read-only: a tap raises
            the guest gate. Each anchor is spoken as the band's view's
            opinion, `@genesis_mod's opinion on this post` (point 8 (a)). */}
        <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} signedIn={false} stanceVantage={GUEST_VANTAGE} node="card" />
        <PostCard {...TOBIAS_POST} signedIn={false} stanceVantage={GUEST_VANTAGE} node="card" />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline node="bottomBar" />
    </>
  );
}
