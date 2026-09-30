/* THE PAD, AFTER A SIGNING THAT DID NOT GO THROUGH (the failure pack, jakob
   2026-09-30: a failed signed act re-raises its own surface, with Retry) —
   the pattern board for every pad's Set, the way `NetworkError` is for every
   seal's commit.

   SET WAITS FOR ITS SIGNATURE, SO THE PAD NEVER CLOSED. Past 200ms it read
   `Setting…` and went inert; the answer that came back was a fault, so the
   pad is exactly where it was: the same target, the same standing line, the
   knob still at the reader's pick, the landing line still reading what it
   would come to. Nothing the reader chose is lost.

   THE FAULT TAKES THE COMMIT'S PLACE — `NetworkError`'s grammar, at the
   pad's scale. `TransportError`'s line stands above the commit row in the
   seal's own words, and Set's slot becomes `Retry`, outlined because it is
   not a new commitment but the same one asked again. `Cancel` and the
   walk-away keep their places: the way out is the way out it always was.

   THE FIXTURE IS `PadStanding`'S, deliberately — @ada, one standing edge at
   +1.00 / +1.00, the pick pulling back to −0.55 / −0.15 — so the pair reads
   as one pad in two moments, and the shell beneath is the everyday feed for
   the reason given there. */
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter />} />
      <FeedList>
        <PostCard
          {...ADA_POST}
          bundle={mkBundle(1, 1)}
          stanceOpen
          stancePadInset={80}
          stanceDefaultPick={{ pDirected: -0.55, pInterest: -0.15 }}
          stanceSigning="failed"
        />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />

      {/* The wash sits over the shell; the parked pad (fixed, above it) stays
          sharp. */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--scrim-dialog)" }} />
    </>
  );
}
