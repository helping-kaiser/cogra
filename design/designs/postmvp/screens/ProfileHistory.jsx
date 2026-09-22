/* A PROFILE'S EDIT HISTORY — the third kind, and the one that proves the
   pattern is about records rather than about posts (jakob's rulings
   2026-09-22).

   A PROFILE IS A VERSIONED THING LIKE ANY OTHER. Its display name, its words,
   its face and its address all ride one signed record, so changing any of them
   signs a new one — and the history is the same list of whole versions the post
   and the comment get, newest first, the current one marked.

   THE WHOLE BAND IS THE VERSION, never the field that changed. Nothing here
   says "the name changed": the three cards each show a complete identity, and a
   reader comparing two reads which parts moved. That is the no-diff ruling at
   its plainest — highlighting the changed field would be the product deciding
   which change was the story.

   IT IS PUBLIC, and the address makes that worth saying out loud. An address
   somebody stood behind for a month and then took down is a thing they
   published, and taking it down is a new version rather than an unpublishing —
   the way out of a version you regret is removal, which leaves a mark, and it
   is the same act here as on a post. */
export function Screen() {
  return (
    <>
      <PageHeader title="Edit history" backHref="#" backLabel="Back to the profile" />
      <HistoryColumn>
        <VersionBlock label="Current version · signed 12 September">
          <ProfileVersionCard
            displayName="Mira Voss"
            handle="mira"
            avatarSrc="inviter.jpg"
            bio="Runs the stand by the sea wall — honey from the headland hives, and whatever the flats give up that morning."
            website="tidemarket.example"
          />
        </VersionBlock>
        <VersionBlock label="Earlier version · signed 8 September">
          <ProfileVersionCard
            displayName="Mira Voss"
            handle="mira"
            bio="Runs the stand by the sea wall — honey from the headland hives."
            website="tidemarket.example"
          />
        </VersionBlock>
        <VersionBlock label="Earlier version · signed 3 September">
          <ProfileVersionCard displayName="M. Voss" handle="mira" bio="Beekeeper. Market on Sundays." website="voss.example" />
        </VersionBlock>
        <ChronicleFootnote>{CHRONICLE_FOOTNOTE}</ChronicleFootnote>
      </HistoryColumn>
      <BottomNav active={null} slots={ALL_SLOTS} inline />
    </>
  );
}
