/* YOUR OWN PROFILE'S COMMENTS VIEW (round 41; jakob 2026-11-11, M2 "as rec",
   backlog 160). The Comments tab of the reader's own profile, a board of its
   own beside `ProfileComments` (@ada's) rather than a setting on it: a chip
   copy would re-key that board's registered paths. The head is `Profile`'s,
   with the Comments tab lit; the card is the reader's own comment as
   `ProfileCommentsMenuOwn` draws it, its ⋮ the own comment menu (Save, Cite,
   Edit, Remove, Cited by, Opinions on this, the license closing it; no
   Report).

   AN EMPTY TAB (the `comments` chip's `none`) reads `Nothing here yet.`, the
   line alone, an applicant's own as a member's (jakob 2026-11-12, the
   re-ask's sixteenth): only `Everything` carries the applicant's sentence.
   The `load` chip draws the first page's wait and failure,
   `ProfileTabFirstPage`'s, as on `ProfileComments`.

   REGISTERED under the `profile` prefix, told apart by board as
   `ProfileCommentsMenuOwn`. */
export const NODE = "profile";
export const PROPS = {
  comments: { editor: "enum", options: ["some", "none"], default: "some" },
  load: { editor: "enum", options: ["loaded", "loading", "failed"], default: "loaded" },
};
export const VALS = `someShown: this.props.load === "loaded" && this.props.comments !== "none" ? "contents" : "none", noneShown: this.props.load === "loaded" && this.props.comments === "none" ? "block" : "none", loadingShown: this.props.load === "loading" ? "block" : "none", failedShown: this.props.load === "failed" ? "block" : "none"`;
export function Screen() {
  return (
    <ProfileTabTop own tab="comments">
      <div style={{ display: "{{someShown}}" }}>
      <CommentCard
        author={SOL}
        content={SOL_OWN_COMMENT.content}
        timestamp={SOL_OWN_COMMENT.timestamp}
        license={{ attribution: 0, provenance: 0 }}
        onReply={() => {}}
        target={`“${MIRA_GALLERY_POST.title}” — @mira`}
        onOpenTarget={() => {}}
        menuItems={OWN_COMMENT_CARD_MENU}
        node="commentCard"
        id={SOL_OWN_COMMENT.id}
      />
      </div>
      <div style={{ display: "{{noneShown}}", padding: "0 16px" }}>
        <EmptyState title="Nothing here yet." node="empty" />
      </div>
      <ProfileTabFirstPage top={0} />
    </ProfileTabTop>
  );
}
