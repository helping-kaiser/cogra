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
   the surface the reader asked from.

   REGISTERED under the `postDetail` prefix (seam 248): the sheet is
   `opinionsSheet`, each row an `opinion` keyed by its holder's handle — a
   person is content, so the row keys by who, never by position. */
/* THE `list` CHIP DRAWS THE SHEET EMPTY AT POST SCALE (seam 248). The count
   line drops away at zero, so a post's sheet meets nothing only when the
   count it was opened from had gone stale — every opinion walked back since
   — and then it says so in the comment sheet's words (`CommentOpinionsEmpty`):
   `No opinions yet — yours would be the first.`, the line alone, as `empty`. */
export const NODE = "postDetail";
export const PROPS = { list: { editor: "enum", options: ["rows", "empty"], default: "rows" } };
export const VALS = `rowsShown: this.props.list === "empty" ? "none" : "flex", emptyShown: this.props.list === "empty" ? "block" : "none"`;
export function Screen() {
  return (
    <>
      <DetailHeader items={READER_POST_MENU} node="header" />
      <DetailColumn>
        <PostCard {...MIRA_GALLERY_POST} variant="detail" opinions={8} onOpenOpinions={() => {}} node="card" />
      </DetailColumn>
      <BottomNav active="feed" slots={ALL_SLOTS} inline node="bottomBar" />

      <BottomSheet open ariaLabel="Opinions on this post" maxHeight="88%" node="opinionsSheet">
        <SheetTitle node="title">Opinions on this post</SheetTitle>
        <div style={{ display: "{{rowsShown}}", flexDirection: "column", overflow: "hidden" }}>
          {POST_OPINION_HOLDERS.map((holder) => (
            <StanceRow key={holder.handle} {...holder} onOpen={() => {}} node="opinion" nodeKey={holder.handle} />
          ))}
        </div>
        <div style={{ display: "{{emptyShown}}", padding: "0 24px 8px" }} data-node-chip="list" data-node-key="empty">
          <EmptyState title="No opinions yet — yours would be the first." node="empty" />
        </div>
      </BottomSheet>
    </>
  );
}
