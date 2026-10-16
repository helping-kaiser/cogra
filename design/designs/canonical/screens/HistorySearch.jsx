/* HISTORY · a search that reaches people, tags and things — the matches
   SECTIONED (jakob 2026-10-16: the stamped search law, seam 220, and the
   search-section ruling (a); round 14; the tags section, round 17).
   `Saved`'s sibling search, over the seen-list alone, reading the one law
   every search surface reads: plain `m` matches a name or title by the
   start of any word, so the people the reader has seen, the tags and the
   things whose words start with it all answer — the people first, then the
   tags, then the content. No full name is needed.

   PEOPLE FIRST, CAPPED AT THREE — THE CAP IS THE ORCHESTRATOR'S REC, NOT YET
   JAKOB'S WORD (one law for every sectioned surface; he may carve History
   out). The people take a section under the house's quiet caption
   (`SectionLabel`, `People`), at most three — the most recently first seen
   among the matches — and `See all profiles` closes it when more match.
   History HAS a kind filter, so its door opens the narrowing that already
   exists: the history's filter at Profiles alone, the trigger reading
   `Profiles`, the query kept (law rule 4).

   THE TAGS FOLLOW, THE PEOPLE SECTION'S EXACT MIRROR (jakob 2026-10-16,
   round 17: "all as rec"). Under the same quiet caption (`Tags`), at most
   three, the most recently first seen among the matches, closed by
   `See all tags`, whose narrowing is the filter at Tags alone, the trigger
   reading `Tags`, the query kept. The cards are History's own `TagFeedCard`.
   The tag names are the board's own to picture the section with.

   NO DAY DIVIDERS ARE DRAWN HERE, AND THAT IS FLAGGED. History's dividers
   mark the first-seen day down one chronological column; sections break
   that column in two, and whether the dividers stand in the content section
   only, in both, or not at all under a query is not ruled. The board leaves
   them off rather than answer it.

   EVERY CARD IS HISTORY'S OWN, which is the feed's own: `ProfileFeedCard`
   for a person, `PostCard` for a post, fully live. The content after the
   section takes no caption — the door is the people section's end.

   REGISTERED under the `history` prefix (design ⇄ impl seam 062/063), every
   node named as `History` names it; the caption is `profilesLabel` and the
   door `profilesDoor`, as `ExplorePerson` names them; the tags' are `tagsLabel`
   and `tagsDoor`. */
export const NODE = "history";
export const FRAME = { width: 390, height: 1900 };

const MAREN = { handle: "maren", displayName: "Maren Holt" };
const MATEO = { handle: "mateo", displayName: "Mateo Ruiz" };
const MIRA_WORDS_POST = {
  author: MIRA,
  content: "Honey's back at the stand by the sea wall — the first jars since June.",
  timestamp: "5h",
  score: "4.30",
  comments: 1,
  opinions: 3,
  license: { attribution: 0, provenance: 0 },
  menuItems: CARD_MENU,
};

export function Screen() {
  return (
    <>
      <PageHeader title="History" backHref="#" backLabel="Back to your profile" node="header" />
      <div style={{ flex: "none" }}>
        <SearchBar query="m" ariaLabel="Search your history" node="searchField" />
        <div style={{ display: "flex", alignItems: "center", padding: "0 16px 8px 16px" }}>
          <FilterTrigger reading="Everything" ariaLabel="What your history shows" node="filterTrigger" />
        </div>
      </div>
      <SectionLabel node="profilesLabel">Profiles</SectionLabel>
      <FeedList>
        <ProfileFeedCard person={MATEO} bio="Boat repairs, mostly. Sometimes the boats are mine." score="5.10" node="profileCard" />
        <ProfileFeedCard
          person={MIRA}
          src="inviter.jpg"
          bio="Runs the stand by the sea wall — honey from the headland hives."
          score="11.70"
          node="profileCard"
        />
        <ProfileFeedCard person={MAREN} bio="Charts the tide pools north of the harbour, one notebook a season." score="8.20" node="profileCard" />
        <div style={{ display: "flex", padding: "0 8px" }}>
          <Button variant="text" size="sm" node="profilesDoor">
            See all profiles
          </Button>
        </div>
        <SectionLabel node="tagsLabel">Tags</SectionLabel>
        <TagFeedCard name="#moorings" through={["ada", "tobias"]} tagged={SALTMAPS_TAGGED} score="7.40" node="tagCard" />
        <TagFeedCard name="#mudflats" through={["mira"]} tagged={[SALTMAPS_TAGGED[0]]} score="5.20" node="tagCard" />
        <TagFeedCard name="#midsummer" through={["sol", "ada"]} tagged={NEWEST_PICTURE} score="3.60" node="tagCard" />
        <div style={{ display: "flex", padding: "0 8px" }}>
          <Button variant="text" size="sm" node="tagsDoor">
            See all tags
          </Button>
        </div>
        <PostCard {...MIRA_WORDS_POST} bundle={mkBundle(0.3, 0.1)} node="card" />
      </FeedList>
      <BottomNav active="profile" slots={ALL_SLOTS} inline node="bottomBar" />
    </>
  );
}
