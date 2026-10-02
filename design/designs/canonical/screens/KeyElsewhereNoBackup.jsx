/* The key isn't here, and there is no backup to bring it (the key-loss round).
   A member who declined the backup made their key on one device and signed in
   on another: the account has no sealed backup (`User.keyBackup` is null), so
   restore could only ever answer "That code doesn't check out." A notice that
   offers it anyway is a retry loop with no exit.

   THE CARD SAYS SO, AND DROPS THE RESTORE. What it offers instead is the way
   the key CAN come here: a recovery code made on the device that holds it
   (`SettingsBackupNone` there), after which this card becomes `KeyElsewhere`'s
   and its restore works. Until then the feed reads as it always does, and
   anything signed waits as pending — a pick kept here can still be signed the
   day the key arrives.

   EVERY KEY-ABSENT NOTICE TAKES THE SAME TWO CHANGES for this reader — the
   composer's seal, the pad, the two settings twins: the restore line becomes
   this card's no-backup sentence, and the `Restore the key` button is not
   drawn. The pad keeps `Keep it pending, restore later`, because a later
   restore is still possible. This board draws the card once.

   IT IS AN EXEMPLAR OF `KeyElsewhere`'S SHELL (readme §13, Canvas pages and
   flows): the card is this board's own, and the band, the post and the nav
   beneath it are `KeyElsewhere`'s, wired there — wiring them twice would give
   one control two edges. The card has no control, so nothing here carries a
   number. The wording chip flips the title the way `KeyElsewhere`'s does.

   IT WEARS THE OLIVE LIKE `KeyElsewhere`'S CARD (jakob 2026-10-02, the olive
   split): the action it asks for happens on the other device, and it is
   still the reader's to take (`tone="notice"`). */
export const PROPS = { wording: { editor: "enum", options: ["browser", "app"], default: "browser" } };
export const VALS = `keyTitle: this.props.wording === "app" ? "Your key isn't in this app" : "Your key isn't on this browser"`;

export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter />} />
      <FeedList>
        <TaskCard
          tone="notice"
          title="{{keyTitle}}"
          body="This account has no backup, so the key can't be brought here yet. Make a recovery code on the device that holds it, then restore it here. Until then, anything you sign waits as pending."
        />
        <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
