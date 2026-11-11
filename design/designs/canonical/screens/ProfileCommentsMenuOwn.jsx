/* YOUR OWN PROFILE'S COMMENTS VIEW, YOUR COMMENT'S MENU OPEN (round 36;
   jakob 2026-11-11, H5 and H7). The reader's own comment on their own
   Comments tab raises the own comment's menu (ProfileComments.md) — Save,
   Cite, Remove, Cited by, Opinions on this, License terms, and no Report —
   over the profile, unstacked, as `ProfileCommentsMenu`. The card is the
   tab's own comment card, `ProfileComments`' shape, holding the reader's own
   comment as `FeedCommentShapes` words it, its row wearing `Edit` as the
   thread's own card does (round 41; jakob 2026-11-11, M3).

   REGISTERED under the `profile` prefix, `profile.menuSheet`, told apart by
   board. */
export const NODE = "profile";
export function Screen() {
  return (
    <>
      <ProfileTabTop own tab="comments">
        <CommentCard
          author={SOL}
          content={SOL_OWN_COMMENT.content}
          timestamp={SOL_OWN_COMMENT.timestamp}
          license={{ attribution: 0, provenance: 0 }}
          onReply={() => {}}
          own
          onEdit={() => {}}
          target={`“${MIRA_GALLERY_POST.title}” — @mira`}
          onOpenTarget={() => {}}
          menuItems={OWN_COMMENT_CARD_MENU}
          node="commentCard"
          id={SOL_OWN_COMMENT.id}
        />
      </ProfileTabTop>
      <CardMenuSheet items={OWN_COMMENT_MENU} ariaLabel="Comment actions" />
    </>
  );
}
