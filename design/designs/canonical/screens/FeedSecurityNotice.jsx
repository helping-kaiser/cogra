/* THE SECURITY NOTICE — a reused sign-in, said once (jakob 2026-10-01, audit
   K3.7; auth.md, *Reuse detection* and *The security notice*).

   WHAT HAPPENED. A sign-in the account had already replaced was presented
   again, which is what a stolen copy looks like; the server signed out every
   device and stamped the account. The first sign-in after that carries the
   stamp once (`LogInPayload.reuseDetectedAt`), and this is where it is said —
   which is also the only explanation the reader gets for having been signed
   out everywhere.

   A `TaskCard` ON THE SHELL THE SIGN-IN LANDED ON. auth.md asks for a
   dismissible alert on the signed-in shell, and the shell's own idiom for the
   product addressing the reader is the task card: the brand ring and the
   mark, at the top of the column. It rides whichever shell sign-in lands on
   (an applicant's too); the canvas draws it on the feed, the most-landed one.

   IT WEARS THE OLIVE (jakob 2026-10-02, the olive split): it asks the reader
   to look at their password, so it stands on the account-notice register
   (`tone="notice"`), its filled `Change password` in `inverse`.

   THE WORDS STAY CALM AND SAY THE ONE USEFUL THING. Nothing is urgent any
   more — the sessions are already gone — so the card names what was done and
   what the reader can do if the cause was theirs to fix: a password someone
   else might hold. `Change password` opens the credential screen; `Got it`
   puts the card away, and it does not return, because the notice is
   delivered exactly once.

   IT IS AN EXEMPLAR OF `Feed`'S SHELL (readme §13, Canvas pages and flows):
   only the card's two controls carry numbers; the band, the posts and the
   nav are wired on `Feed`. */
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter />} />
      <FeedList>
        <TaskCard
          tone="notice"
          title="We signed out every device"
          body="A sign-in this account had already replaced was used again, which can mean someone else had a copy. If your password might be known to anyone, change it."
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Button variant="inverse">Change password</Button>
            <Button variant="outline">Got it</Button>
          </div>
        </TaskCard>
        <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
