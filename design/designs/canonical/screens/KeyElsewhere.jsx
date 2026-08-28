/* The key isn't here — restore-first, and the feed keeps reading (readme §13).
   The wording chip flips the title between the browser and the installed app. */
export const PROPS = { wording: { editor: "enum", options: ["browser", "app"], default: "browser" } };
export const VALS = `keyTitle: this.props.wording === "app" ? "Your key isn't in this app" : "Your key isn't on this browser"`;

export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter />} />
      <FeedList>
        <TaskCard title="{{keyTitle}}" body="Restore it with your recovery code to post, vouch, and act. Until then, anything you sign waits as pending.">
          <div style={{ display: "flex" }}>
            <Button size="sm">Restore the key</Button>
          </div>
        </TaskCard>
        <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
