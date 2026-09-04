/* Your own profile in applicant days (profile round, item 23). The same
   header — applicant versus member is cards and states, never a different
   layout (the ProfileHeader rule). The application card rides above the
   header; the chronicle holds the acts already staged, each marked as still
   settling (the ruling: an applicant stages each kind of act once). Invites
   are the one dead control: the tap answers with the snackbar, drawn here —
   an informational line, never a gate screen (jakob 2026-09-01). */
export function Screen() {
  return (
    <>
      <ProfileBand />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "8px 16px 0" }}>
          <TaskCard title="Waiting on your inviter" body="Your application is with @mira. What you stage now lands with you." />
        </div>
        <div style={{ padding: "0 16px" }}>
          <ProfileHeader
            handle="juno"
            displayName="Juno Baptiste"
            posts={1}
            stancesOn={0}
            stancesTaken={1}
            own
            onEdit={() => {}}
            onInvites={() => {}}
            onAvatarChange={() => {}}
            onCounts={() => {}}
          />
        </div>
        <TabBar ariaLabel="What the chronicle shows" value="everything" tabs={CHRONICLE_TABS} />
        <ChronicleList>
          <ContentRow variant="chronicle" chevron={false} glyph="dynamic_feed" title="Published a post" trailing="1h" second="First light over the flats — brought the wrong lens, kept the picture anyway." pending onOpen={() => {}} />
          <ContentRow variant="chronicle" chevron={false} face={{ pDirected: 0.1, pInterest: 0.1 }} title="Took a stance" titleAside="on @mira" trailing="2h" pending inert />
          <p style={{ margin: 0, padding: "4px 0", fontSize: "var(--text-label-small)", lineHeight: "var(--text-label-small--line-height)", letterSpacing: "0.4px", color: "var(--text-secondary)" }}>
            Each kind of act stages once until you land.
          </p>
        </ChronicleList>
      </div>
      <Snackbar message="Invites open when you land." />
      <BottomNav active="profile" slots={ALL_SLOTS} inline />
    </>
  );
}
