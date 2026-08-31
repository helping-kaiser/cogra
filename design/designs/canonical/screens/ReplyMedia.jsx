/* Comments carrying pictures, and the author's own comment (media slice,
   2026-08-31): a single picture shows whole at its own ratio (comment pictures
   never crop), multiples share the fixed square pager, and the viewer's own
   comment wears Edit and — once edited — the Edited marker. The sheet is the
   comments sheet of readme §13, unchanged. */
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
            content="The glovebox camera earns its keep — this is the print from 2019 that almost catches it."
            timestamp="1h"
            media={[
              { src: "comment-camera.jpg", ratio: "tall", fit: "contain", alt: "A person holding a film camera up to the light." },
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
              { src: "gallery-market.jpg", ratio: "4 / 3", fit: "contain", alt: "Crates of strawberries on a market stand." },
              { src: "gallery-honey.jpg", ratio: "1 / 1", fit: "contain", alt: "A jar of honey in low sun." },
            ]}
            edited
            own
            onEdit={() => {}}
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
