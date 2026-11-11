/* SAVED, A POST CARD'S MENU OPEN (round 36, backlog 149; jakob 2026-11-11,
   H7). The feed's own card, so the feed's own sheet — the reader's post menu —
   with the one difference Saved's law makes: every card here is kept, so the
   first row reads `Unsave` (Saved.md), the card's own Save in its kept state.
   Saved has no row of its own: Unsave is how a thing leaves it
   (`SavedUndo`). Then Cite, Hide @ada, License terms, Report at the tail.

   HIDING FROM HERE LEAVES THE CARDS WHERE THEY ARE: a hidden account's things
   and profile stay in Saved, the hidden list being the feed's.

   REGISTERED under the `saved` prefix — the host's own card raises it, so it
   takes the host's prefix (readme, the sheet node law): `saved.menuSheet`,
   the first row `save` whatever it reads, as every menu's. */
export const NODE = "saved";
export function Screen() {
  return (
    <>
      <SavedTop>
        <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} node="card" />
      </SavedTop>
      <CardMenuSheet items={keptMenu(READER_POST_MENU)} />
    </>
  );
}
