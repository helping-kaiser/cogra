/* THE FEED, A POST'S LICENSE TERMS UP (FC-G10; readme §13, the menus round;
   ruling 84's host). What the feed's post menu's License terms row opens:
   the menu closes and the terms come up in a sheet over the column the tap
   was made in. The sheet is `PostLicense`'s — `LicenseSheet` with Ada's
   terms — so the terms read the same whichever host asked; what differs is
   beneath, the feed exactly as `FeedPostMenu` draws it under the wash.

   REGISTERED under the `feed` prefix (the hosting-surface rule): the page as
   `Feed` names it, the sheet `licenseSheet` and its `terms` block. */
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

      <LicenseSheet license={ADA_POST.license} node="licenseSheet" />
    </>
  );
}
