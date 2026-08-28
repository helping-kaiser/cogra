/* The post ladder — the marked states: veiled, and the two removals. */
export function Screen() {
  return (
    <>
      <CograBand />
      <FeedList>
        <Card style={{ flex: "none" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <ActorChip handle="sol" displayName="Sol Ferreira" />
            <span style={{ fontSize: "var(--text-body-small)", color: "var(--text-secondary)" }}>3d</span>
          </div>
          <h2 style={{ margin: 0, fontSize: "var(--text-title-medium)", lineHeight: "var(--text-title-medium--line-height)", fontWeight: "var(--text-title-medium--font-weight)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            Salt maps of the coast road
          </h2>
          <SensitiveScope>
            <div style={{ margin: "0 calc(var(--card-padding) * -1)" }}>
              <SensitiveVeil kind="media" label="One rubbing includes a dead seabird." radius="0px">
                <MediaAttachment src="post-photo.jpg" ratio="landscape" fit="cover" radius="0px" />
              </SensitiveVeil>
            </div>
          </SensitiveScope>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <StanceControl targetLabel="this post" />
            <span style={{ fontSize: "var(--text-label-large)", color: "var(--text-secondary)" }}>9.10</span>
          </div>
        </Card>
        <PostCard author={ADA} content="" timestamp="1w" redacted={{ reason: "author" }} score="15.20" comments={3} />
        <PostCard author={TOBIAS} content="" timestamp="2w" redacted={{ reason: "illegal" }} score="4.70" comments={1} />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
