/* The thread — the comment box is an entry, not a composer. */
export function Screen() {
  return (
    <>
      <PageHeader backLabel="Back to feed" />
      <DetailColumn>
        <PostCard {...ADA_POST} variant="detail" />
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "0 16px" }}>
          <TextField label="Add a comment" value="" />
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            <CommentCard
              author={TOBIAS}
              content="That stretch after the second bend is the reason I keep a camera in the glovebox."
              timestamp="1h"
              onReply={() => {}}
              replies={[
                {
                  id: "r1",
                  author: ADA,
                  content: "Bring it Saturday — the light is meant to hold.",
                  timestamp: "40m",
                },
              ]}
            />
          </ul>
        </div>
      </DetailColumn>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
