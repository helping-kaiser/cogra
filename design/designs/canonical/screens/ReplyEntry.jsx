/* The comments sheet (readme §13, 2026-08-28): the thread lives in a bottom
   sheet over the post — near full height, a sliver of the post left above it —
   with replies collapsed behind counts, deeper answers flattened to @handles,
   and the entry row pinned at its foot. The detail view behind is just the
   post. The last comment carries a sensitive mark: the whole body veils as one
   comment-scale block, the frame around it still readable. */
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
          {/* The veiled comment: the whole body — the words and the two
              pictures with them — under one comment-scale block, while the
              author, the timestamp and the stance stay readable. */}
          <CommentCard
            author={MIRA}
            content="The gulls had been at it before the tide came back. Two frames, both grim."
            timestamp="10m"
            media={[
              { src: "comment-shingle.jpg", ratio: "4 / 3", fit: "contain", alt: "A stretch of shingle at low tide." },
              { src: "comment-gulls.jpg", ratio: "1 / 1", fit: "contain", alt: "Gulls on the tideline." },
            ]}
            sensitive={{ reason: "A dead seabird in the second frame." }}
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
