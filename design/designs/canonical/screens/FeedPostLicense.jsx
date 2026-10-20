/* THE FEED, A POST'S LICENSE TERMS UP (FC-G10; readme §13, the menus round;
   ruling 84's host). What the feed's post menu's License terms row opens:
   the menu closes and the terms come up in a sheet over the column the tap
   was made in. The sheet is `PostLicense`'s — `LicenseSheet` with Ada's
   terms — so the terms read the same whichever host asked; what differs is
   beneath, the feed exactly as `FeedPostMenu` draws it under the wash.

   REGISTERED under the `feed` prefix (the hosting-surface rule): the page as
   `Feed` names it, the sheet `licenseSheet` and its `terms` block.

   THE DRAWN LICENSE IS THE ZERO PAIR (the twin of #228's caption
   registration, 2026-10-14): the feed host shows the same caption a
   public-domain post gets everywhere, so the state is drawn where its node
   lives — `feed.licenseSheet.terms.publicDomain` — with the rows still
   spelling what it means, as `CommentLicense` draws the stacked sibling.
   The credited reading stays drawn on `PostLicense`: one shared component,
   both states drawn in the system, each on the host that registers it. */
export const NODE = "feed";
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter node="filterTrigger" />} node="band" />
      <FeedList>
        <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} node="card" />
        <PostCard {...TOBIAS_POST} bundle={mkBundle(0.1, 0.1)} node="card" />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline node="bottomBar" />

      <LicenseSheet license={{ attribution: 0, provenance: 0 }} node="licenseSheet" />
    </>
  );
}
