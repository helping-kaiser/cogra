/* THE PROFILE'S COMMENTS VIEW, A REMOVED COMMENT'S MENU OPEN (jakob
   2026-11-13, point C: a removed comment's menu follows the post's). @ada's
   comment, removed by her, stands as its mark on her Comments tab
   (`ProfileComments`' `removed`), and its ⋮ raises the reader's comment menu
   whole — Save, Cite in a new post, Cited by, Opinions on this, License terms,
   Report at the tail — `ProfileCommentsMenu`'s rows over the same profile,
   unstacked. The license stays: its terms still bind every use already made.

   REGISTERED under the `profile` prefix, `profile.menuSheet`, as
   `ProfileCommentsMenu` names it. */
export const NODE = "profile";
export function Screen() {
  return (
    <>
      <ProfileTabTop tab="comments">
        <CommentCard
          author={ADA}
          timestamp="4d"
          redacted={{ reason: "author", when: "2h" }}
          onReply={() => {}}
          target="“Salt maps of the coast road” — @sol"
          onOpenTarget={() => {}}
          menuItems={COMMENT_CARD_MENU}
          node="commentCard"
          id="c4d2e6f8-1a3b-4d5c-8e9f-6a7b8c9d0e1f"
        />
      </ProfileTabTop>
      <CardMenuSheet items={COMMENT_MENU} ariaLabel="Comment actions" />
    </>
  );
}