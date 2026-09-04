/* Comments carrying media, and the author's own comment (media slice,
   2026-08-31): a single picture shows whole at its own ratio (comment pictures
   never crop), multiples share the fixed square pager, and the viewer's own
   comment wears Edit and — once edited — the Edited marker. The sheet is the
   comments sheet of readme §13, unchanged.

   A COMMENT'S VIDEO PLAYS LIKE A POST'S (jakob 2026-09-02): muted autoplay
   while it is on screen, in the comment pager's square frame, wearing the one
   control a video ever wears — sound, on the global sticky decision every
   video shares. No play/pause and no duration pill: presence on screen is the
   policy on a reading surface, exactly as on a post's card. */
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
            content="Eighteen seconds of the same headland, if the light comes through at all."
            timestamp="1h"
            media={[
              {
                kind: "video",
                src: "comment-clip.mp4",
                poster: "comment-camera.jpg",
                ratio: "square",
                fit: "cover",
                alt: "A film camera panning across the headland at low light.",
              },
            ]}
            bundle={mkBundle(0.1, 0.1)}
            onReply={() => {}}
            license={{ attribution: 0, provenance: 0 }}
            menuItems={CITE_MENU}
          />
          <CommentCard
            author={SOL}
            content="Two from the stand by the sea wall, before the crowd came."
            timestamp="30m"
            media={[
              { src: "gallery-market.jpg", ratio: "4 / 3", fit: "cover", alt: "Crates of strawberries on a market stand." },
              { src: "gallery-honey.jpg", ratio: "1 / 1", fit: "cover", alt: "A jar of honey in low sun." },
            ]}
            edited
            own
            onEdit={() => {}}
            onReply={() => {}}
            license={{ attribution: 0, provenance: 0 }}
            menuItems={CITE_MENU}
          />
        </ul>
        <CommentComposerFoot />
      </BottomSheet>
    </>
  );
}
