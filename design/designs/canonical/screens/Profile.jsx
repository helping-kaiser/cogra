/* Your own profile — the tab (profile round, item 23). The compact shape:
   avatar left with its change badge (a standalone signed act → the crop-and-seal
   flow), name/handle/figures beside it, bio, then Edit profile + Invites sharing
   the row. The gear and the overflow (Share profile, and whatever else earns a
   place) hang off the band per design.md §6 — never down in the header. The
   chronicle sits under the icon tab row. Sol has no picture: the monogram is
   the designed fallback, and the badge on it reads as "add one". */
export function Screen() {
  return (
    <>
      <ProfileBand />
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
        <ChronicleTabs value="everything" />
        <ChronicleList>
          <ContentRow variant="chronicle" chevron={false} glyph="dynamic_feed" title="Published a post" trailing="3d" second="Salt maps of the coast road — rubbings from three weekends at low tide." onOpen={() => {}} />
          <ContentRow variant="chronicle" chevron={false} glyph="chat_bubble" title="Commented" trailing="4d" second="The third headland light is real — I have a print from 2019 that almost catches it." onOpen={() => {}} />
          <ContentRow variant="chronicle" chevron={false} face={{ pDirected: 0.4, pInterest: 0.5 }} title="Took a stance" titleAside="on @mira" trailing="5d" inert />
          <ContentRow variant="chronicle" chevron={false} glyph="dynamic_feed" title="Published a post" trailing="1w" second="Three weekends of walking the same stretch at low tide." onOpen={() => {}} />
          <ContentRow variant="chronicle" chevron={false} glyph="person" title="Updated your profile" trailing="2w" inert />
        </ChronicleList>
      </div>
      <BottomNav active="profile" slots={ALL_SLOTS} inline />
    </>
  );
}
