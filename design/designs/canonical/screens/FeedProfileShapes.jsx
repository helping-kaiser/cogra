/* THE PROFILE CARD'S SHAPES (the feed cards, ruled 2026-10-01) — the states a
   person's card meets in the feed today, held against each other, the way
   `FeedShapes` holds the clip's three. `FeedKinds` draws the card at rest: a
   picture, a two-line bio, no opinion yet.

   · A LONG BIO folds at two lines in the quiet colour; the whole of it is on
     the profile the card opens.
   · NO BIO. The card is the person alone — picture, name, handle — and the
     row; nothing stands in for the words they did not write.
   · NO PICTURE. The monogram, `MonogramAvatar`'s own fallback, at the card's
     56px.
   · AN OPINION ALREADY HELD. The row's face is the reader's own, as on every
     card.
   · A DELETED ACCOUNT (the closing batch, jakob 2026-10-01). The husk keeps
     its records and its standing, so it still ranks: the disc keeps its
     space and fills with nothing, the name's place reads `Deleted account` in
     the system's voice, and no handle and no bio stand under it — the
     redacted actor everywhere (`ActorChip`'s `redacted`, `ProfileDeleted`).
   · A NEGATIVE SCORE. A minus sign and no colour (`ExplainableNumber`): a low
     score is a fact about reach, not a fault.

   GUESTS meet these cards as every card — the face opens `GuestGate` — and
   no guest board draws one (`ProfileFeedCard`).

   A REFERENCE BOARD, like `FeedShapes`: wired nowhere, each card one a reader
   would meet on `FeedKinds`, which carries the wiring, drawn whole in a tall
   `FRAME`. */

export const FRAME = { width: 390, height: 1300 };

export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter value={{ ...FEED_FILTER_DEFAULT, kinds: FEED_KINDS.map((kind) => kind.value) }} />} />
      <FeedList>
        <ProfileFeedCard
          person={ADA}
          src="comment-camera.jpg"
          bio="A dozen tries at the third headland light and counting. Coast road on weekends, tide tables on the fridge, and a camera in every bag I own."
          score="10.90"
        />
        <ProfileFeedCard person={MIRA} src="inviter.jpg" score="9.40" />
        <ProfileFeedCard person={TOBIAS} bio="Walks the flats before work." score="8.20" />
        <ProfileFeedCard person={SOL} bio="Rubbings, tide tables and the long way round." bundle={mkBundle(0.4, 0.5)} score="6.00" />
        <ProfileFeedCard person={{ handle: "marlow", displayName: "Marlow" }} redacted score="3.40" />
        <ProfileFeedCard person={{ handle: "kel", displayName: "Kel Moreau" }} bio="Night shifts at the harbour office." score="−1.20" />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
