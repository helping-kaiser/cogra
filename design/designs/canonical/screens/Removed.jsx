/* Removed by its author — the record's skeleton holds the thread's place. */
export function Screen() {
  return (
    <>
      {/* A removed post has no menu left — back is the whole header. */}
      <PageHeader backHref="#" backLabel="Back to feed" />
      <DetailColumn>
        {/* The responses live on in the comments sheet — the glyph still counts
            them, which is itself the proof that nothing was quietly deleted. */}
        <PostCard author={SOL} content="" timestamp="3d" variant="detail" redacted={{ reason: "author", when: "today" }} score="9.10" comments={2} />
      </DetailColumn>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
