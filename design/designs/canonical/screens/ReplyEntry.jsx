/* The comments sheet (readme §13, 2026-08-28): the thread lives in a bottom
   sheet over the post — near full height, a sliver of the post left above it —
   with replies collapsed behind counts, deeper answers flattened to @handles,
   and the entry row pinned at its foot. The detail view behind is just the
   post. */
export function Screen() {
  return (
    <>
      <DetailHeader items={READER_POST_MENU} />
      <DetailColumn>
        <PostCard {...ADA_POST} variant="detail" />
      </DetailColumn>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />

      <BottomSheet open ariaLabel="Comments" height="calc(100% - 72px)">
        <SheetTitle>Comments</SheetTitle>
        <ul style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: 12, margin: 0, padding: "0 16px", listStyle: "none" }}>
          <CommentCard
            author={TOBIAS}
            content="That stretch after the second bend is the reason I keep a camera in the glovebox."
            timestamp="1h"
            bundle={mkBundle(0.1, 0.1)}
            onReply={() => {}}
            replyCount={2}
            onOpenReplies={() => {}}
            topics={["glovebox", "coastroad"]}
            references={1}
            license={{ attribution: 0, provenance: 0 }}
            menuItems={CITE_MENU}
          />
          <CommentCard
            author={SOL}
            content="Which headland is the third one, counting from the ferry landing?"
            timestamp="45m"
            onReply={() => {}}
            license={{ attribution: 0, provenance: 0 }}
            menuItems={CITE_MENU}
            replies={[
              {
                id: "r1",
                author: ADA,
                content: "The one past the pines — the road dips right before it.",
                timestamp: "40m",
                onReply: () => {},
                license: { attribution: 0, provenance: 0 },
                menuItems: CITE_MENU,
              },
              {
                id: "r2",
                author: TOBIAS,
                content: "@ada That dip floods at spring tide, mind the sign.",
                timestamp: "22m",
                onReply: () => {},
                license: { attribution: 0, provenance: 0 },
                menuItems: CITE_MENU,
              },
            ]}
          />
          <CommentCard
            author={MIRA}
            content="Saving this for the weekend walk."
            timestamp="10m"
            onReply={() => {}}
            license={{ attribution: 0, provenance: 0 }}
            menuItems={CITE_MENU}
          />
        </ul>
        <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px 0", borderTop: "1px solid var(--border-hairline)" }}>
          <MonogramAvatar name="Sol Ferreira" />
          <div style={{ flex: 1 }}>
            <TextField label="Add a comment" value="" />
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
