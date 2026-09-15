/* THE TOPIC FEED (the topic round, 2026-09-14) — the feed narrowed to one
   topic, and nothing else about the screen changes. That is the whole ruling
   drawn: a topic feed is another feed setting, so it is the feed, with a
   setting on.

   THE TRIGGER SAYS WHICH ONE, and the tag's own name is what it says: `Posts ·
   #saltmaps`. The topic rides the extras, leading them — the loudest narrowing
   a reader can have on, and the one they will want read back first. It is not
   in the head because the head spells kinds and a topic is not one; "Tags" is
   already a kind and means the Type as something ranked, which is the opposite
   of narrowing to it.

   AND BECAUSE IT RIDES THE EXTRAS IT CAN LEAVE. A tag name is the reader's, up
   to the contract's 128 bytes, and the head is the half the collapse cannot
   take away — so a name too wide for the pill collapses with the rest of the
   detail into `Posts · 2 changes` rather than drawing a summary nobody can
   read. The gate measures every combination of that, the widest name the
   grammar allows included.

   WHAT THE FEED BEHIND IT HOLDS is content reaching the viewer over Tag records
   toward this Type (hashtag.md §5), ranked by the same primitive as everything
   else — the author's own declarations plus third-party tags whose authors the
   viewer actually reaches. There is no second ranker and no AI in it, here as
   anywhere.

   ONLY A TOPIC HELD *FOR* CAN BE ON. The predicate is jakob's: held is a netted
   Affinity that is not (0, 0), and the topic feed admits positive association
   only. A topic held against stays a public record and stays on Your topics; it
   simply never reaches this pill. */
const NARROWED = { kinds: ["posts"], topic: "#saltmaps", forms: ["text", "photos", "video"], order: "ranked", seen: false, also: [] };

export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter value={NARROWED} topics={FEED_TOPICS} onOpenTopics={() => {}} />} />
      <FeedList>
        <PostCard {...SOL_POST} bundle={mkBundle(0.3, 0.45)} />
        <PostCard {...TOBIAS_POST} bundle={mkBundle(0.1, 0.1)} />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
