/* Explore, searching — a query that reaches people (jakob 2026-10-07,
   ruling 23; the search packet's SG-4), drawn SECTIONED (jakob 2026-10-16,
   the search-section ruling (a); round 14). Profiles is one of the four
   kinds the search serves, and this is the board that draws the row a
   person's result takes.

   IT IS THE PICKER'S OWN PERSON ROW. `ReferencePicker` already draws a person
   — and search is the same bar, the same trigger and the same rows. So the
   row is `ReferenceRow`'s `person` kind: the avatar as its leading mark
   (people are circles everywhere in this system), the display name as its
   name, the `@handle` under it as its second line, and the viewer-relative
   rank on its right edge beside the score's glyph, where every other ranked
   row keeps its own. Only the edge differs from the picker's, whose add mark
   yields to the rank here.

   THE PEOPLE STAND FIRST, CAPPED AT THREE (the stamped search law, seam
   220/223). A person cue lists the matching profiles before the content, and
   a query that many handles or names answer would otherwise become a list of
   people before any content at all — jakob's own find. So the people take a
   section of their own, at most three of them (the first three by the
   search's order), and `See all profiles` closes the section when more match.
   The door opens the narrowing that already exists: the search filter at
   Profiles alone (ExploreFilter's kinds, law rule 4) — every matched person,
   the trigger reading `Profiles`. No new state is drawn for it.

   THE CAPTION IS THE HOUSE'S QUIET ONE. `SectionLabel` — label-small,
   secondary, the caption Explore's own `Recent` already wears — reads
   `People`; the door is the text button on its own line (`Button`'s rule:
   an action that owns its line). The content after the section keeps the
   search's own order, its full matches first and its seam where ranked, and
   takes no caption: the door is the people section's end.

   A PLAIN WORD, MATCHED BY WORD PREFIX (the law's rule 3, with jakob's
   2026-10-16 extension to handles, seam 226). `sal` reaches Sal Torres and
   Salome Ward by their first word and Ines Salas by her second — a display
   name, a handle or a title matches when any of its words starts with what
   is typed, with no `@`; `las` would reach none of them. `@` stays the
   deliberate person cue. The post and the tag stand in the content as
   before.

   REGISTERED under the `explore` prefix (design ⇄ impl seam 062/063), named
   as `ExploreSearch` names its rows: each is a `result`, keyed by its position
   in the results, the content counting on after the people. The caption is
   `profilesLabel`, as Explore's recents' is `recentLabel`; the door is
   `profilesDoor`. */
export const NODE = "explore";
export function Screen() {
  return (
    <>
      <div style={{ flex: "none", paddingTop: 12 }}>
        <SearchBar query="sal" node="searchField" />
        <SearchTriggerRow reading="Everything" />
      </div>
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <SectionLabel node="profilesLabel">Profiles</SectionLabel>
        <ReferenceRow kind="person" name="Sal Torres" sub="@saltorres" rank="4.20" onOpen={() => {}} node="result" nodeKey="1" />
        <ReferenceRow kind="person" name="Ines Salas" sub="@inesalas" rank="3.10" onOpen={() => {}} node="result" nodeKey="2" />
        <ReferenceRow kind="person" name="Salome Ward" sub="@salome" rank="2.60" onOpen={() => {}} node="result" nodeKey="3" />
        <div style={{ display: "flex", padding: "0 8px 8px" }}>
          <Button variant="text" size="sm" node="profilesDoor">
            See all profiles
          </Button>
        </div>
        <ReferenceRow kind="post" name="Salt maps of the coast road" src="post-photo.jpg" rank="9.10" onOpen={() => {}} node="result" nodeKey="4" />
        <ReferenceRow kind="topic" name="saltmaps" rank="3.40" onOpen={() => {}} node="result" nodeKey="5" />
      </div>
      <BottomNav active="search" slots={ALL_SLOTS} inline node="bottomBar" />
    </>
  );
}
