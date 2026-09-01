/* The profile's COMMENTS view (profile round, item 23): the second tab — the
   person's comments as the real comment cards, each in reach of its thread.
   Same header block; only the list changes. Drawn on @ada's profile — the
   master instance every profile's comments tab follows. */
export function Screen() {
  return (
    <>
      <PageHeader
        title="@ada"
        backHref="#"
        backLabel="Back"
        action={
          <OverflowMenu
            ariaLabel="More about @ada"
            items={[
              { label: "Mention in a new post", onSelect: () => {} },
              { label: "Share this profile", onSelect: () => {} },
            ]}
          />
        }
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "0 16px" }}>
          <ProfileHeader
            handle="ada"
            displayName="Ada Okonkwo"
            avatarSrc="ava1.jpg"
            bio="A dozen tries at the third headland light and counting."
            posts={12}
            stancesOn={48}
            stancesTaken={31}
            onCounts={() => {}}
            onCommit={() => {}}
            onMessage={() => {}}
            showHandle={false}
          />
        </div>
        <ChronicleTabs value="comments" />
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: 8, padding: "8px 0 0" }}>
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
      </div>
      <BottomNav active={null} slots={ALL_SLOTS} inline />
    </>
  );
}
