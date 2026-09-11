/* Profile · the chronicle can't load more — the chronicle's page-failure state
   (readme §13, the audit states; jakob 2026-09-09, item 16).

   THE CHRONICLE SCROLLS THE WAY THE FEED SCROLLS. No Show more, no page
   numbers, no count of what is left: the next page arrives because the reader
   kept going. That leaves nothing to draw at rest — an affordance drawn for a
   thing that needs none is the invention both apps made — so the only state
   this ruling owes a board is the one where a page does not arrive.

   THE ROW STANDS WHERE THE NEXT PAGE WOULD HAVE. `UploadErrorLine`'s shape,
   one rung quieter: the fact, then the way out as an `InlineAction`, the em
   dash between them carrying the aside the way §3's punctuation rule has it.

   IT IS QUIET, AND THAT IS A RULING, NOT A DEFAULT. Rows are already on
   screen, so a page that didn't come means stale, not gone — `TransportError`
   says so in its own source — and `--error` over readable content would put
   the content in doubt instead of the fetch. The three things `--error` is
   allowed to mean (fault lines, signing failures, field errors) do not
   include a list that stopped growing, and `EmptyState` already refuses the
   colour for the same reason. So the line takes `text-secondary` at
   body-medium, the rung the list's own empty and loading states take.

   THE IN-FLIGHT STATE IS ALREADY WRITTEN: `LoadingState`'s `Loading…`, in
   this row's place. It needs no board of its own — one line of blessed copy
   in a slot this board already shows.

   IT IS `Profile`, WITH ONE ROW ADDED, and it is pattern-exemplar exempt for
   the reason readme §13 gives `NetworkError`: the failed page is the whole
   subject, and the band, the header, the tabs and the five nav slots belong
   to `Profile` and are wired there. Wiring them twice would give one control
   two edges. */
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
        <TabBar ariaLabel={CHRONICLE_TABS_LABEL} value="everything" tabs={CHRONICLE_TABS} />
        <ChronicleList>
          <ContentRow variant="chronicle" chevron={false} glyph="dynamic_feed" title="Published a post" trailing="3d" second="Salt maps of the coast road — rubbings from three weekends at low tide." onOpen={() => {}} />
          <ContentRow variant="chronicle" chevron={false} glyph="chat_bubble" title="Commented" trailing="4d" second="The third headland light is real — I have a print from 2019 that almost catches it." onOpen={() => {}} />
          <ContentRow variant="chronicle" chevron={false} face={{ pDirected: 0.4, pInterest: 0.5 }} title="Took a stance" titleAside="on @mira" trailing="5d" inert />
          <ContentRow variant="chronicle" chevron={false} glyph="dynamic_feed" title="Published a post" trailing="7d" second="Three weekends of walking the same stretch at low tide." onOpen={() => {}} />
          <ContentRow variant="chronicle" chevron={false} glyph="person" title="Updated your profile" trailing="14d" inert />

          {/* The row the next page would have filled. */}
          <p
            style={{
              margin: 0,
              padding: "8px 4px 16px",
              fontSize: "var(--text-body-medium)",
              lineHeight: "var(--text-body-medium--line-height)",
              letterSpacing: "var(--text-body-medium--letter-spacing)",
              color: "var(--text-secondary)",
            }}
          >
            Couldn&apos;t load more <span aria-hidden="true">—</span> <InlineAction size="sm">Retry</InlineAction>
          </p>
        </ChronicleList>
      </div>
      <BottomNav active="profile" slots={ALL_SLOTS} inline />
    </>
  );
}
