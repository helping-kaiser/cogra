/* Just signed — the author lands on their post wearing Still settling. */
export function Screen() {
  return (
    <>
      <PageHeader backLabel="Back to feed" />
      <DetailColumn>
        <PostCard
          {...SOL_POST}
          variant="detail"
          timestamp="now"
          pending
          bundle={mkBundle(0.1, 1)}
          score={"—"}
          references={1}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 16px" }}>
          <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)", color: "var(--text-secondary)" }}>No comments yet.</p>
          <TextField label="Add a comment" value="" />
        </div>
      </DetailColumn>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
      <Snackbar message="Signed — it's in the thread now, still settling." offset={80} />
    </>
  );
}
