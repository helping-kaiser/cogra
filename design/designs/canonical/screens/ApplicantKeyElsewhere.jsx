/* Applicant days, the key made elsewhere (the key-loss round; auth.md, the
   key ceremony). An applicant made their key on one device and signed in on
   another. Until the application is approved the attached key is
   replaceable — a key lost before approval "costs nothing but a re-run of the
   ceremony" — so this reader, unlike a member, has two honest ways on, and
   the card offers both.

   `Restore the key` brings the key from its backup, exactly as a member's
   card does. `Make a new key` runs the ceremony again, and its end replaces
   the attached key: the one on the other device stops counting for this
   application, which is why the body says the new key costs nothing only
   until approval. Without a backup there is nothing to restore, and the card
   carries `Make a new key` alone.

   THE SHELL IS `ApplicantFeed`'S — the borrowed view's band, the feed read
   from @mira's vantage, the application riding as a card — and it is wired
   there: this board is its exemplar (readme §13, Canvas pages and flows), and
   only the card's two controls carry numbers. The wording chip flips the
   title the way `KeyElsewhere`'s does.

   IT WEARS THE OLIVE (jakob 2026-10-02, the olive split): the application
   cannot move until the reader brings a key, so the card asks for their
   action and stands on the account-notice register (`tone="notice"`), its
   filled `Restore the key` in `inverse`.

   WITHOUT A BACKUP THE BODY SAYS SO (jakob 2026-10-05; the `backup` chip):
   `Restore the key` is not drawn, and the body takes `KeyElsewhereNoBackup`'s
   reason with the new-key clause kept, so it never asks for a code that
   cannot open anything. The body is new and flagged for blessing. */
export const PROPS = {
  wording: { editor: "enum", options: ["browser", "app"], default: "browser" },
  backup: { editor: "enum", options: ["made", "none"], default: "made" },
};
export const VALS = `keyTitle: this.props.wording === "app" ? "Your key isn't in this app" : "Your key isn't on this browser", keyBody: this.props.backup === "none" ? "Your application's key was made on another device and has no backup, so it can't be brought here yet. Make a recovery code on that device and restore it here, or make a new key — until you're approved, a new one costs nothing." : "Your application's key was made on another device. Restore it here with your recovery code, or make a new key — until you're approved, a new one costs nothing.", restoreDoor: this.props.backup === "none" ? "none" : "inline-flex"`;

export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter />}>
        <BorrowedViewBand handle="mira" displayName="Mira Voss" avatarSrc="inviter.jpg" line="Browsing from @mira's view while your application lands." />
      </CograBand>
      <FeedList>
        <TaskCard
          tone="notice"
          title="{{keyTitle}}"
          body="{{keyBody}}"
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Button variant="inverse" style={{ display: "{{restoreDoor}}" }}>Restore the key</Button>
            <Button variant="outline">Make a new key</Button>
          </div>
        </TaskCard>
        <PostCard {...ADA_POST} signedIn={false} />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
