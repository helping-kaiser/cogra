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
   Merged under the autonomy order of 2026-10-28; the wording jakob's at
   review. */
export const PROPS = { comments: { editor: "enum", options: ["some", "none"], default: "some" } };
export const VALS = `someShown: this.props.comments === "none" ? "none" : "flex", noneShown: this.props.comments === "none" ? "flex" : "none"`;

export function Screen() {
  return (
    <>
      <PageHeader title="@ada" backHref="#" backLabel="Back to feed" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "0 16px" }}>
          <ProfileHeader
            handle="ada"
            displayName="Ada Okonkwo"
            avatarSrc="comment-camera.jpg"
            bio="A dozen tries at the third headland light and counting."
            posts={12}
            stancesOn={48}
            stancesTaken={31}
            onCounts={() => {}}
            onCommit={() => {}}
            onMessage={() => {}}
            menu={otherProfileMenu()}
            showHandle={false}
          />
        </div>
        <TabBar ariaLabel={CHRONICLE_TABS_LABEL} value="comments" tabs={CHRONICLE_TABS} />
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
          />
          <CommentCard
            author={ADA}
            content="Low tide is kinder to the rubbings than noon ever was."
            timestamp="4d"
            license={{ attribution: 0, provenance: 0 }}
            onOpenReplies={() => {}}
            onReply={() => {}}
            target="“Salt maps of the coast road” — @sol"
            onOpenTarget={() => {}}
          />
        </div>
        <div style={{ flex: 1, overflow: "hidden", display: "{{noneShown}}", flexDirection: "column", padding: "8px 16px 0" }}>
          <EmptyState title="Nothing here yet." />
        </div>
      </div>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
