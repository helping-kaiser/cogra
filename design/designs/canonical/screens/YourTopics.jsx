/* YOUR TOPICS (the topic round, 2026-09-14) — every topic the reader holds, in
   one place. The list jakob's ruling names, and the ONLY name it has: the word
   "follow" is not on this screen or any other (copy-voice's ban, extended to
   topics the same day). What a reader has done here is take a position, so the
   page says what they hold, not who they follow.

   HELD IS THE PREDICATE, AND IT IS THE ONLY ONE. A topic is held when the
   viewer's netted Affinity is not (0, 0) — records alone are not enough, and a
   bundle walked back to nothing leaves the list the moment it lands. Nothing
   else qualifies a row: this page is the whole held set.

   SO A NEGATIVE ASSOCIATION STANDS HERE TOO (`#wellness`, below). It is a
   signed public record like any other and the reader made it deliberately; a
   list that quietly dropped it would be the one place their own act stopped
   being visible to them. Its one difference is invisible from this page: the
   topic feed admits positive association only, so a topic held against never
   narrows anything. That is a fact about the FEED, and the feed's own filter is
   where it shows — a mark here would be a second vocabulary for a rule the
   reader meets in one place.

   IT IS A SUBPAGE OF EXPLORE, so the arrow is a LINK back to it rather than
   history, and there is NO BOTTOM BAR — `TagPage`'s arrangement exactly, and
   for the same settings-round rule: a surface a reader arrives at, reads, and
   leaves is not a tab.

   THE ROWS ARE `ReferenceRow`, kind `topic`: the `#` tile, the name, and the
   pair the reader signed — the shape every topic in this system already wears
   in the tags-and-references sheet and in search results. One row shape for one
   kind of fact, wherever it is met.

   THE PAIR IS AN AFFINITY'S, NOT A TAG'S, which is the one thing the row could
   not have known from its kind (`pairFamily`, added this round). A tag row's
   two numbers are relevance and confidence and read through the thirteen
   objects; these two are association and attraction, both signed, and read
   through the twenty faces — because following a topic IS the stance gesture
   and there is one face table for it.

   NO PER-ROW REMOVAL, and that is the point of the row. Walking a topic back is
   priced severance through the same ceremony every other stance walks, and a ×
   at the end of a list row is the affordance of a thing that costs nothing. The
   row opens the topic's page, where the one control stands; the act happens
   where the act is explained.

   THE ORDER IS STRONGEST FIRST, by association — `ProfileStances`' order and
   `PostOpinions`' after it, descending through the warm faces and past nothing
   into the ones held against. Alphabetical is a shelf's order and this is not a
   shelf: it is a set of positions, and the strongest is the one the reader is
   most likely to be looking for. PROPOSED, not blessed — the alternative is
   real and jakob's to pick.

   THE COUNT ON EXPLORE'S DOOR IS THIS LIST'S LENGTH, five here and five rows
   below: the subpage is the only place that number can be checked. */

export function Screen() {
  return (
    <>
      <PageHeader title="Your topics" backHref="#" backLabel="Back to Explore" />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "4px 0 0" }}>
        {HELD_TOPICS.map((topic) => (
          <ReferenceRow
            key={topic.name}
            kind="topic"
            pairFamily="stance"
            name={topic.name}
            pair={topic.pair}
            pending={topic.pending}
            onOpen={() => {}}
          />
        ))}
      </div>
    </>
  );
}
