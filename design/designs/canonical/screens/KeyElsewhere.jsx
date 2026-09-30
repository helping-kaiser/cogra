/* The key isn't here — restore-first, and the feed keeps reading (readme §13).
   The wording chip flips the title between the browser and the installed app.

   THE STANCE FACE OPENS THE KEY-ABSENT PAD, WHICHEVER WAY IT IS PRESSED (the
   key-loss round). Everywhere else a tap opens the pad and a press-and-hold
   signs the modest opinion on the spot — and a hold here would sign with a
   key that is not here. So the hold opens `PadKeyAbsent` exactly as the tap
   does: nothing signs silently, and the reader meets the notice before the
   pick, never after it. A pick kept there waits on this device (`PadPending`). */
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
