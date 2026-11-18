/* SAVED, A REMOVED POST'S MENU OPEN (round 55, backlog 223). A thing removed
   after it was saved keeps its place in Saved and wears its removal mark
   (Saved.md) — @ada's post, removed by her — and its ⋮ raises the reader's
   post menu whole, Saved's first row reading `Unsave` (copy-voice, *Menu
   rows*: "on a removed post the same; on Saved, Unsave first"): Unsave, Cite
   in a new post, `Hide @ada`, Cited by, Opinions on this, License terms,
   Report at the tail. Unstacked over Saved, as `SavedPostMenu`.

   REGISTERED under the `saved` prefix, `saved.menuSheet`, the mark
   `card.removalMark`. */
export const NODE = "saved";
export function Screen() {
  return (
    <>
      <SavedTop>
        <PostCard id={ADA_POST.id} author={ADA} timestamp="7d" redacted={{ reason: "author", when: "2d" }} score="15.20" comments={3} bundle={mkBundle(0.55, 0.2)} menuItems={keptMenu(readerCardMenu("ada"))} node="card" />
        <PostCard {...TOBIAS_POST} bundle={mkBundle(0.1, 0.1)} node="card" />
      </SavedTop>
      <CardMenuSheet items={keptMenu(readerPostMenu("ada"))} />
    </>
  );
}
