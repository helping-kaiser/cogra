/* WHO HOLDS AN OPINION ON THIS POST (backlog item 55; jakob's rulings
   2026-09-11). The profile's "opinions on you", mirrored onto content — and
   UNGATED: everyone can check every post, the way everyone can read a profile's
   counts. No author sees more of this list than a stranger does.

   IT IS THE TAGS-AND-REFERENCES SHEET'S PATTERN, which is what jakob's ruling
   names: a quiet count row on the detail opens a bottom sheet holding the whole
   set. THE COUNT IS THE LIST'S LENGTH, `RefsSheet`'s discipline exactly — the
   card says eight and eight rows stand here, because this sheet is the only
   place that number can be checked.

   THE ROWS ARE `StanceRow`, the master the profile's own opinions page uses, so
   a reader meets one row shape for one kind of fact wherever they meet it: the
   person, and the public opinion the row is about, its face leading and its pair
   riding the reading mode. Tapping one opens their profile, which is where
   acting on an opinion lives.

   THE ORDER MIRRORS `ProfileStances`: strongest first, by the for-or-against
   value — descending through the warm faces and down past nothing into the
   against ones. The precedent is read off that board rather than written down
   anywhere, and mirroring it is the point: a second surface sorting the same
   rows a different way would teach a reader the order means nothing.

   THE SHEET SITS OVER THE POST DETAIL, drawn whole beneath it, because that is
   the surface the reader asked from. */
export function Screen() {
  return (
    <>
      <DetailHeader items={READER_POST_MENU} />
      <DetailColumn>
        <PostCard {...MIRA_GALLERY_POST} variant="detail" opinions={8} onOpenOpinions={() => {}} />
      </DetailColumn>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />

      <BottomSheet open ariaLabel="Opinions on this post" maxHeight="88%">
        <SheetTitle>Opinions on this post</SheetTitle>
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {POST_OPINION_HOLDERS.map((holder) => (
            <StanceRow key={holder.handle} {...holder} onOpen={() => {}} />
          ))}
        </div>
      </BottomSheet>
    </>
  );
}
