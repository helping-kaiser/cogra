/* YOUR OWN PROFILE'S COMMENTS VIEW (round 41; jakob 2026-11-11, M2 "as rec",
   backlog 160). The Comments tab of the reader's own profile, a board of its
   own beside `ProfileComments` (@ada's) rather than a setting on it: a chip
   copy would re-key that board's registered paths. The head is `Profile`'s,
   with the Comments tab lit; the card is the reader's own comment as
   `ProfileCommentsMenuOwn` draws it, its ⋮ the own comment menu (Save, Cite,
   Edit, Remove, Cited by, Opinions on this, the license closing it; no
   Report).

   REGISTERED under the `profile` prefix, told apart by board as
   `ProfileCommentsMenuOwn`. */
export const NODE = "profile";
export function Screen() {
  return (
    <ProfileTabTop own tab="comments">
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
    </ProfileTabTop>
  );
}
