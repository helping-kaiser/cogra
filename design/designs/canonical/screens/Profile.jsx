/* Your own profile — the tab (profile round, item 23). The gear hangs off the
   band per design.md §6; the header wears the avatar's change badge (a standalone
   signed act → the crop-and-seal flow) and the tappable figures row; the actions
   are the two things you do to your own record. The chronicle is the quiet-row
   list, filtered by the segmented control. Sol has no picture: the monogram is
   the designed fallback, and the badge on it reads as "add one". */
export function Screen() {
  return (
    <>
      <CograBand
        trailing={
          <button
            type="button"
            aria-label="Settings"
            className="cg-state cg-focus"
            style={{ display: "grid", placeItems: "center", height: "var(--touch-target-min)", width: "var(--touch-target-min)", border: 0, background: "none", borderRadius: "var(--radius-full)", color: "var(--text-secondary)", cursor: "pointer", padding: 0 }}
          >
            <Icon name="settings" />
          </button>
        }
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "0 16px" }}>
          <ProfileHeader
            handle="sol"
            displayName="Sol Ferreira"
            bio="Field notes from the flats — salt, paper, and whatever the wind allows."
            website="solferreira.art"
            posts={5}
            stancesOn={9}
            stancesTaken={14}
            own
            onEdit={() => {}}
            onInvites={() => {}}
            onAvatarChange={() => {}}
            onCounts={() => {}}
          />
        </div>
        <div style={{ padding: "4px 16px 12px" }}>
          <SegmentedFilter
            ariaLabel="What the chronicle shows"
            value="everything"
            options={[
              { value: "posts", label: "Posts" },
              { value: "comments", label: "Comments" },
              { value: "everything", label: "Everything" },
            ]}
          />
        </div>
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <ChronicleRow label="Published a post" time="3d" snippet="Salt maps of the coast road — rubbings from three weekends at low tide." />
          <ChronicleRow label="Commented" time="4d" snippet="The third headland light is real — I have a print from 2019 that almost catches it." />
          <ChronicleRow label="Took a stance" time="5d" link={false} />
          <ChronicleRow label="Published a post" time="1w" snippet="Three weekends of walking the same stretch at low tide." />
          <ChronicleRow label="Updated your profile" time="2w" link={false} />
        </div>
      </div>
      <BottomNav active="profile" slots={ALL_SLOTS} inline />
    </>
  );
}
