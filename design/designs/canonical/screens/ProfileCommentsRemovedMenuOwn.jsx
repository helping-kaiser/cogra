/* YOUR OWN PROFILE'S COMMENTS VIEW, YOUR REMOVED COMMENT'S MENU OPEN (round
   55, backlog 223). A comment of your own removed keeps its place on your own
   Comments tab as its mark (jakob 2026-11-18, profiles (a);
   `ProfileCommentsOwn`'s `removed`) — @sol's comment on @mira's gallery post — and its ⋮
   raises `OWN_REMOVED_COMMENT_MENU`: Save, Cite in a new post, Cited by,
   Opinions on this, License terms, your own comment's menu less Edit and
   Remove (CommentRemoved.md), as `CommentRemovedMenu` over the thread.
   Unstacked over the profile, as `ProfileCommentsRemovedMenu`.

   REGISTERED under the `profile` prefix, `profile.menuSheet`, told apart by
   board. */
export const NODE = "profile";
export function Screen() {
  return (
    <>
      <ProfileTabTop own tab="comments">
        <CommentCard
          author={SOL}
          timestamp={SOL_OWN_COMMENT.timestamp}
          redacted={{ reason: "author", when: "now" }}
          onReply={() => {}}
          target={`“${MIRA_GALLERY_POST.title}” — @mira`}
          onOpenTarget={() => {}}
          menuItems={OWN_REMOVED_COMMENT_CARD_MENU}
          node="commentCard"
          id={SOL_OWN_COMMENT.id}
        />
      </ProfileTabTop>
      <CardMenuSheet items={OWN_REMOVED_COMMENT_MENU} ariaLabel="Comment actions" />
    </>
  );
}
