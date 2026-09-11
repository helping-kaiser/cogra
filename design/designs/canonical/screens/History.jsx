/* HISTORY — the posts you have seen, latest first (readme §13, the private-
   viewer-state round; jakob: "just a list of all posts that you have seen in
   order of latest seen"). A sibling of Saved, reached from the same ⋮.

   POSTS ONLY, AND THAT IS THE RULING. Saved is the mixed list because saving is
   a deliberate act on anything; being seen is something posts do in a feed. A
   history that also collected every profile a thumb passed would be a log, and
   nobody goes looking through a log.

   THE ORDER IS THE LATEST TIME YOU SAW IT. A post read twice sits where the
   second reading put it, because that is the one a reader is retracing — so the
   list the apps read is ordered by the most recent seen event, not the first.

   THE DISC IS THE KIND, NEVER THE COVER. `ContentRow` would take a picture
   ahead of a glyph, and a post's cover in the disc's circle reads as a person —
   the one thing a round circle means in this product. Saved makes the same
   choice for the same reason, so the two lists scan alike.

   A WORDS POST CARRIES ITS WORDS. There is no title to show, so the row's first
   line is the post itself and there is no second — the same way a card draws a
   post whose body is words.

   NO CLEAR, AND NO PER-ROW REMOVE. Neither is ruled, and a control that empties
   a list is not a thing to invent beside it. */
export function Screen() {
  return (
    <>
      <PageHeader title="History" backHref="#" backLabel="Back to your profile" />
      <ChronicleList>
        <ContentRow
          variant="chronicle"
          chevron={false}
          glyph="dynamic_feed"
          title="Sunday at the tide market"
          titleAside="@mira"
          second="Everything the flats give up in one morning."
          trailing="20m"
          onOpen={() => {}}
        />
        <ContentRow
          variant="chronicle"
          chevron={false}
          glyph="dynamic_feed"
          title="The long way home"
          titleAside="@ada"
          second="Took the coast road instead of the tunnel. Four hours longer, worth every minute."
          trailing="2h"
          onOpen={() => {}}
        />
        <ContentRow
          variant="chronicle"
          chevron={false}
          glyph="dynamic_feed"
          title="Low tide at six tomorrow — anyone walking the flats?"
          titleAside="@tobias"
          trailing="5h"
          onOpen={() => {}}
        />
        <ContentRow
          variant="chronicle"
          chevron={false}
          glyph="dynamic_feed"
          title="Crossing at the narrows before the wind got up"
          titleAside="@tobias"
          second="The wind got up. The crossing held."
          trailing="1d"
          onOpen={() => {}}
        />
        <ContentRow
          variant="chronicle"
          chevron={false}
          glyph="dynamic_feed"
          title="The lake, doing nothing, for forty seconds"
          titleAside="@mira"
          second="Forty seconds of nothing at all, which is the point."
          trailing="2d"
          onOpen={() => {}}
        />
      </ChronicleList>
      <BottomNav active={null} slots={ALL_SLOTS} inline />
    </>
  );
}
