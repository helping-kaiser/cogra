/* The profile's COMMENTS view (profile round, item 23): the second tab — the
   person's comments as the real comment cards, each in reach of its thread.
   Same header block; only the list changes. Drawn on @ada's profile — the
   master instance every profile's comments tab follows. The ⋮ rides the
   actions row and holds the whole profile menu, exactly as the profile's own
   board draws it (the band law): a tab of a page is not a smaller page.

   A MEMBER'S EMPTY CHRONICLE (seam 245, ask 11; the `comments` chip at
   `none`). A tab with nothing in it reads `Nothing here yet.` at
   `EmptyState`, the line alone: a member knows why their own is empty, and
   another's needs no reason — only the applicant's says what fills it and
   when (`ProfileApplicant`), because that is new. It is drawn here because
   this is where a member meets it: `Everything` always holds the member's
   own registration, while `Comments` is empty for anyone who never
   commented — and the figures, which count no comments, stay true over it.
   Merged under the autonomy order of 2026-10-28; blessed (jakob
   2026-11-10).

   REGISTERED under the `profile` prefix (round 27, seam 252), as
   `ProfilePosts` is: a tab of the profile page takes the page's prefix. The
   list is `comments`, each `commentCard` in it keyed by the comment's id
   as every comment card is, and `empty` in the
   cards' place. A card's pointer to what it answers is its `target`; the
   collapsed replies' line hangs under the card, outside its surface, so it is
   `viewReplies` beside the card, keyed by the same id (round 28, seam 254
   A3).

   A REMOVED COMMENT IN THE LIST (round 30, jakob 2026-11-11, Q13) is the
   `comments` chip's `removed`: the second comment, removed by its author,
   drawn as the thread draws a removed comment (`CommentRemoved`,
   `CommentsThreadSheet`'s `redacted`) — `RedactedContent` in the words'
   place over the thread's own note, the author, the age, the reply and the
   pointer to what it answered kept, no menu's license. Its mark registers as `removalMark` under the card
   (round 28's promise, seam 259), the card keyed by its id in both copies.
   The mark carries its removal's date under it (jakob 2026-11-12, the
   re-ask's seventeenth: "knowing when something was removed is good info"),
   `removalMark.when`, as the feed's card, the post and the thread's comment
   draw it — `2h`, the removal's own moment, never the comment's `4d`.

   THE FIRST PAGE'S OTHER MOMENTS (round 45) are the `load` chip,
   `ProfileTabFirstPage`'s, as on `ProfilePosts`. */
export const NODE = "profile";
const ADA_COMMENT_ID = "5e8a1c3d-2b4f-4c6a-9d7e-3f1a2b3c4d5e";
const ADA_SECOND_COMMENT_ID = "c4d2e6f8-1a3b-4d5c-8e9f-6a7b8c9d0e1f";
export const PROPS = {
  comments: { editor: "enum", options: ["some", "none", "removed"], default: "some" },
  load: { editor: "enum", options: ["loaded", "loading", "failed"], default: "loaded" },
};
export const VALS = `someShown: this.props.load === "loaded" && this.props.comments !== "none" ? "flex" : "none", noneShown: this.props.load === "loaded" && this.props.comments === "none" ? "flex" : "none", loadingShown: this.props.load === "loading" ? "block" : "none", failedShown: this.props.load === "failed" ? "block" : "none", secondLive: this.props.comments === "removed" ? "none" : "contents", secondRemoved: this.props.comments === "removed" ? "contents" : "none"`;

export function Screen() {
  return (
    <>
      <PageHeader title="@ada" backHref="#" backLabel="Back to feed" node="header" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "0 16px" }}>
          <ProfileHeader
            node="identity"
            handle="ada"
            displayName="Ada Okonkwo"
            avatarSrc="comment-camera.jpg"
            bio="A dozen tries at the third headland light and counting."
            posts={12}
            stancesOn={6}
            stancesTaken={6}
            onCounts={() => {}}
            onCommit={() => {}}
            onMessage={() => {}}
            menu={otherProfileMenu()}
            showHandle={false}
          />
        </div>
        <TabBar ariaLabel={CHRONICLE_TABS_LABEL} value="comments" tabs={CHRONICLE_TABS} node="tabRow" />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }} data-node="comments">
        <div style={{ flex: 1, overflow: "hidden", display: "{{someShown}}", flexDirection: "column", gap: 8, padding: "8px 0 0" }}>
          <CommentCard
            author={ADA}
            content="The glovebox camera earns its keep — this is the print from 2019 that almost catches it."
            timestamp="1d"
            license={{ attribution: 0, provenance: 0 }}
            bundle={mkBundle(0.1, 0.1)}
            replyCount={2}
            onOpenReplies={() => {}}
            onReply={() => {}}
            target="“The long way home” — @ada"
            onOpenTarget={() => {}}
            menuItems={COMMENT_CARD_MENU}
            node="commentCard"
            id={ADA_COMMENT_ID}
          />
          <div style={{ display: "{{secondLive}}" }} data-node-chip="comments" data-node-key="some">
            <CommentCard
              author={ADA}
              content="Low tide is kinder to the rubbings than noon ever was."
              timestamp="4d"
              license={{ attribution: 0, provenance: 0 }}
              onOpenReplies={() => {}}
              onReply={() => {}}
              target="“Salt maps of the coast road” — @sol"
              onOpenTarget={() => {}}
              menuItems={COMMENT_CARD_MENU}
              node="commentCard"
              id={ADA_SECOND_COMMENT_ID}
            />
          </div>
          {/* The same comment removed by its author: the thread's removed
              comment (`CommentRemoved`), the mark in the words' place, author,
              age, reply and pointer kept, the license gone with the payload. */}
          <div style={{ display: "{{secondRemoved}}" }} data-node-chip="comments" data-node-key="removed">
            <CommentCard
              author={ADA}
              timestamp="4d"
              redacted={{ reason: "author", when: "2h" }}
              onReply={() => {}}
              target="“Salt maps of the coast road” — @sol"
              onOpenTarget={() => {}}
              node="commentCard"
              id={ADA_SECOND_COMMENT_ID}
            />
          </div>
        </div>
        <div style={{ flex: 1, overflow: "hidden", display: "{{noneShown}}", flexDirection: "column", padding: "8px 16px 0" }}>
          <EmptyState title="Nothing here yet." node="empty" />
        </div>
        <ProfileTabFirstPage kind="comments" />
        </div>
      </div>
      <BottomNav active="feed" slots={ALL_SLOTS} inline node="bottomBar" />
    </>
  );
}
