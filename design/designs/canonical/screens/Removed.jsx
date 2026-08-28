/* Removed by its author — the record's skeleton holds the thread's place. */
export function Screen() {
  return (
    <>
      {/* A removed post has no menu left — back is the whole header. */}
      <PageHeader backHref="#" backLabel="Back to feed" />
      <DetailColumn>
        <PostCard author={SOL} content="" timestamp="3d" variant="detail" redacted={{ reason: "author", when: "today" }} score="9.10" />
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "0 16px" }}>
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            <CommentCard
              author={TOBIAS}
              content="The wax-stick ones read like weather charts. Would love to see the full set someday."
              timestamp="2d"
              onReply={() => {}}
            />
          </ul>
          <TextField label="Add a comment" value="" />
        </div>
      </DetailColumn>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
