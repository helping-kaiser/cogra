/* SAVED · a search that reaches people — the matches SECTIONED (jakob
   2026-10-16: the stamped search law, seam 220/224, and the search-section
   ruling (a); round 14). The field is the system's one search bar over the
   saved list alone, and it reads the one law every search surface reads: a
   bare `@m` is a person cue, so the saved people whose handle starts with
   it stand first and the saved things those people authored follow them.
   No full handle is needed — `@m` reaches @mira, @maren and @mateo alike.

   PEOPLE FIRST, CAPPED AT THREE — THE CAP IS THE ORCHESTRATOR'S REC, NOT YET
   JAKOB'S WORD. The ruling drew the cap for search; whether Saved and
   History cap too is enumerated for jakob, drawn here as recommended (one
   law for every sectioned surface). So the people take a section under the
   house's quiet caption (`SectionLabel`, `People`, the caption Explore's
   recents wear), at most three — the newest saves among the matches — and
   `See all people` closes it when more match. Saved has no kind filter, so
   its door opens Saved's OWN people-only narrowing: the query kept, the
   people alone, every one. That narrowing is not drawn; it is the bare
   @handle state Saved drew before the law changed, now reached by the door.

   EVERY CARD IS SAVED'S OWN, which is the feed's own: `ProfileFeedCard` for
   a person, `PostCard` for a post, fully live, each one's ⋮ opening on
   `Unsave`. The content after the section takes no caption — the door is the
   people section's end — and stands newest first by when it was saved.

   REGISTERED under the `saved` prefix (design ⇄ impl seam 059/061), every
   node named as `Saved` names it; the caption is `peopleLabel` and the door
   `peopleDoor`, as `ExplorePerson` names them. */
export const NODE = "saved";
export const FRAME = { width: 390, height: 1110 };

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
      <PageHeader title="Saved" backHref="#" backLabel="Back to your profile" node="header" />
      <div style={{ flex: "none" }}>
        <SearchBar query="@m" ariaLabel="Search what you saved" node="searchField" />
      </div>
      <SectionLabel node="peopleLabel">People</SectionLabel>
      <FeedList>
        <ProfileFeedCard
          person={MIRA}
          src="inviter.jpg"
          bio="Runs the stand by the sea wall — honey from the headland hives."
          score="11.70"
          node="profileCard"
        />
        <ProfileFeedCard person={MAREN} bio="Charts the tide pools north of the harbour, one notebook a season." score="8.20" node="profileCard" />
        <ProfileFeedCard person={MATEO} bio="Boat repairs, mostly. Sometimes the boats are mine." score="5.10" node="profileCard" />
        <div style={{ display: "flex", padding: "0 8px" }}>
          <Button variant="text" size="sm" node="peopleDoor">
            See all people
          </Button>
        </div>
        <PostCard {...MIRA_WORDS_POST} bundle={mkBundle(0.3, 0.1)} node="card" />
      </FeedList>
      <BottomNav active="profile" slots={ALL_SLOTS} inline node="bottomBar" />
    </>
  );
}
