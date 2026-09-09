/* THE TAG PAGE, EMPTY (readme §13, the tag round). Not an error, not a 404 —
   a page the contract guarantees resolves.

   IT IS ITS OWN BOARD BECAUSE IT IS ITS OWN CLAIM. `hashtag(name)` says it in
   the schema: "Every well-formed name already denotes a Type, whether or not a
   record has referenced it — Types anchor vacuously and their ids are a pure
   function of the name — so this resolves without a registry row and without
   writing one, and a client can navigate to an empty topic page from a chip."
   A canvas that drew only the populated page would leave implementation to
   guess whether an unused name is a miss, and the honest answer is that it is
   a real page about a real node with nothing tagged into it yet.

   SO THE COPY NEVER SAYS "NOT FOUND". The tag exists; what is empty is the
   list. `EmptyState`'s rules hold — a calm statement, no scolding, no `error`
   colour, and an empty list is not a fault (design.md §6, §9).

   NO FOLLOW CONTROL, same as the populated page (jakob's review 2026-09-09):
   the header anchor misread as a stance readout, so the follow gesture waits
   for its own surface in slice 3's round. Following an unused tag stays a
   perfectly good act — an Affinity toward a Type needs no Tag records to
   exist first — and the slice-3 shape must keep that true.

   NO ACTION IS OFFERED, and that is deliberate. `EmptyState` takes the one
   action that fills a list where there is one; here the action would be "post
   something and tag it", a compose entrance from a read surface that nothing
   has ruled. The page states what is true and leaves it there rather than
   inventing the way out. */
export function Screen() {
  return (
    <>
      <PageHeader title="#slipwaylight" backHref="#" backLabel="Back to Explore" />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "4px 24px 0" }}>
        <EmptyState title="Nothing carries this tag yet. The name is still a place — anyone can be the first to use it." />
      </div>
    </>
  );
}
