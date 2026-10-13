/* Explore, searching — a query that reaches a person (jakob 2026-10-07,
   ruling 23; the search packet's SG-4). Profiles is one of the four kinds the
   search serves, and until now no board drew the row a person's result
   takes.

   IT IS THE PICKER'S OWN PERSON ROW. `ReferencePicker` already draws a person
   found by a bare query — `Sal Torres`, `@saltorres`, reached by `salt`
   through the handle — and search is the same bar, the same trigger and the
   same rows. So the row is `ReferenceRow`'s `person` kind: the avatar as its
   leading mark (people are circles everywhere in this system), the display
   name as its name, the `@handle` under it as its second line, and the
   viewer-relative rank on its right edge beside the score's glyph, where every
   other ranked row keeps its own. Only the edge differs from the picker's,
   whose add mark yields to the rank here.

   AN UNSCOPED QUERY, BECAUSE A SCOPED ONE NEVER RETURNS A PERSON. `@sol salt`
   — `ExploreSearch`'s query — searches inside one person's work and returns
   no profile row (jakob 2026-10-07: `@sol <text>` returns none), so the person is
   drawn where a person is actually found: a bare word matching a name or a
   handle. The tag row beside it stands unscoped too, so it carries no
   `tagged by` line.

   THE ROW OPENS THE PERSON. Another person's opens their profile, its back
   arrow reading `Back to the search` (the profile's noun table); the reader's
   own opens their own profile.

   REGISTERED under the `explore` prefix (design ⇄ impl seam 062/063), named
   as `ExploreSearch` names its rows: each is a `result`, keyed by its position
   in the results. */
export const NODE = "explore";
export function Screen() {
  return (
    <>
      <div style={{ flex: "none", paddingTop: 12 }}>
        <SearchBar query="salt" node="searchField" />
        <SearchTriggerRow reading="Everything" />
      </div>
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <ReferenceRow kind="post" name="Salt maps of the coast road" src="post-photo.jpg" rank="9.10" onOpen={() => {}} node="result" nodeKey="1" />
        <ReferenceRow kind="person" name="Sal Torres" sub="@saltorres" rank="4.20" onOpen={() => {}} node="result" nodeKey="2" />
        <ReferenceRow kind="topic" name="saltmaps" rank="3.40" onOpen={() => {}} node="result" nodeKey="3" />
      </div>
      <BottomNav active="search" slots={ALL_SLOTS} inline node="bottomBar" />
    </>
  );
}
