/* THE PROFILE'S COMMENTS VIEW, A COMMENT'S MENU OPEN (round 36, backlog 149;
   jakob 2026-11-11, H5 and H7). Someone else's comment on their Comments tab
   raises the comment's menu (ProfileComments.md) — Save, Cite, Cited by,
   Opinions on this, License terms, Report at the tail, no Hide row.

   IT RISES OVER THE PROFILE, UNSTACKED (H5), as the feed's post menu rises
   over the feed: no thread is open beneath it here, so there is no sheet to
   stack on. Cited by, Opinions on this, License terms and Report rise over
   the profile too.

   REGISTERED under the `profile` prefix, `profile.menuSheet`, told apart from
   the profile's own menu by board. */
export const NODE = "profile";
export function Screen() {
  return (
    <>
      <ProfileTabTop tab="comments">
        <CommentCard
          author={ADA}
          content="The glovebox camera earns its keep — this is the print from 2019 that almost catches it."
          timestamp="1d"
          license={{ attribution: 0, provenance: 0 }}
          bundle={mkBundle(0.1, 0.1)}
          onReply={() => {}}
          target="“The long way home” — @ada"
          onOpenTarget={() => {}}
          menuItems={COMMENT_CARD_MENU}
          node="commentCard"
          id="5e8a1c3d-2b4f-4c6a-9d7e-3f1a2b3c4d5e"
        />
      </ProfileTabTop>
      <CardMenuSheet items={COMMENT_MENU} ariaLabel="Comment actions" />
    </>
  );
}
