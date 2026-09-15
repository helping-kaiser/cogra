/* THE TAG PAGE, EMPTIED (readme §13, the tag round; the premise rewritten by
   jakob 2026-09-15). Not an error, not a 404 — a page the contract guarantees
   resolves.

   A TAG IS BORN OF A CONNECTION, so this is the page AFTER one (jakob: "a tag
   is born by its connection to sth.. it does not exist before its first
   connection.. so there is no page of tags that dont have posts yet.. i guess
   if someone unbind the post we have an empty page.. (its history would not be
   empty tho)"). The board used to justify itself by `hashtag(name)`'s vacuous
   anchoring — every well-formed name denotes a Type whether or not a record
   references it — and that is still how the READ resolves, but it is not how a
   reader gets here. Nothing in the product hands out a name nobody has used:
   every route to this page is a chip, a result or a link, and each of those is
   a record. So the state this board draws is the one with a past — everything
   that carried the name was untagged out of it — and the page is empty while
   the topic's history is not.

   SO THE COPY NEVER SAYS "NOT FOUND", AND IT NEVER SAYS "FIRST" EITHER. The tag
   exists; what is empty is the list, now. The line states the present and
   promises no past, which is also what keeps it honest for the one arrival the
   contract still allows — a typed URL for a name nothing has used — where a
   sentence about what was unbound would be a lie. `EmptyState`'s rules hold: a
   calm statement, no scolding, no `error` colour, and an empty list is not a
   fault (design.md §6, §9).

   THE STANCE ROW IS HERE, AND IT IS THE PAGE'S OWN (jakob 2026-09-15: "then we
   should add the stance here. no reason for it to not be there"). This
   OVERRULES item 81's clause that "the empty page wires no face at all", and it
   overrules it on its own reasoning: taking a position on a name is an Affinity
   toward a Type, which needs no Tag records to exist first, and the tag page is
   the one destination a Type has. A reader who arrives at a name with nothing
   under it is not a reader with nothing to say about it. The row is
   `TopicStanceRow`, the same anatomy the populated page draws, wearing this
   page's own name and holding nothing — so the face is the resting one and the
   pad it blooms is the master's three controls, exactly as on `TagPage`.

   A GUEST REACHES IT THE SAME WAY, so the face carries the same gate its
   siblings do. What a guest lacks here is an opinion of the topic, not the
   page.

   NO ACTION IS OFFERED, and that is deliberate. `EmptyState` takes the one
   action that fills a list where there is one; here the action would be "post
   something and tag it", a compose entrance from a read surface that nothing
   has ruled. The page states what is true and leaves it there rather than
   inventing the way out. The stance row is not that action: it is the page's
   own gesture about the page's own subject, and it fills nothing. */
export function Screen() {
  return (
    <>
      <PageHeader title="#slipwaylight" backHref="#" backLabel="Back to Explore" />
      <TopicStanceRow name="#slipwaylight" />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "4px 24px 0" }}>
        <EmptyState title="Nothing carries this tag right now. The name is still a place — anyone can use it." />
      </div>
    </>
  );
}
