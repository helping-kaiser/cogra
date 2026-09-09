/* THE TAG PICKER (readme §13, the tag round). What "+ Add a tag" opens, on all
   nine composers that offer it. `ReferencePicker`'s anatomy exactly — the same
   header, the same bar, the same rows, the same trailing add mark — because
   staging a tag and staging a citation are the same errand with a different
   record at the end, and two pickers that looked different would be saying
   they were not.

   THERE IS NO "CREATE #foo" ROW, AND THERE NEVER CAN BE. hashtag.md §2 is
   unambiguous: "There is no creation gesture. A Type is anchored vacuously."
   Every well-formed name already denotes a Type — the id is a pure function of
   the name — so a name nobody has ever used is not missing, it is unused. An
   affordance offering to create one would invent a step the substrate does not
   have and imply an ownership nobody gets: a Type is a commons, authored by no
   one. This is the round's sharpest divergence from every platform we looked
   at, and it is forced by the contract rather than chosen.

   SO THE FOOTNOTE IS THE WHOLE MECHANIC, said plainly. Typing a name that
   nothing carries is not an error state and gets no warning; it is simply a
   tag with an empty page (`TagPageEmpty`), and signing is what puts the first
   thing on it.

   THE CANDIDATE LIST IS THE END STATE. Hashtag `name` is an indexed field in
   the global search index (api-spec.md, "What is indexed"), and slice 2.7 is
   what lands that index. Until then there is no candidate field at all —
   `referenceCandidates` explicitly refuses to offer topics ("A topic is never
   offered — it is tagged, not referenced — which is why a #-typed query finds
   nothing"), so the apps ship type-only and this list arrives with search.
   Same staging shape as the Sky's, and the register carries it.

   RANKING ORDERS THE LIST AND THE EDGE GOES TO THE ACT, which is
   `ReferenceRow`'s own rule and `ReferencePicker`'s drawing: where the whole
   row's tap picks, the right edge is the add mark and the number yields to it.
   So a candidate row carries no figure at all.

   AND CERTAINLY NOT A USE COUNT. Instagram and Tumblr both hang "12k posts"
   off a tag; §3 refuses it — it is nobody's view in particular and it is not
   explainable. Where a tag does wear a number in this system it is a
   viewer-relative rank, on a search result row (`ExploreSearch`), and it
   arrives with 2.7's index and slice 3's ranker together.

   THE ROWS ARE ALREADY-USED NAMES, which is what an index can offer. That is
   not a contradiction of the paragraph above: the picker helps you find a name
   others reach for, and it never stops you naming one they do not.

   NO SKY ENTRY AND NO BOTTOM NAV — picking is a task, not the tab, which is
   `ReferencePicker`'s own reason. */
export function Screen() {
  return (
    <>
      <PageHeader backHref="#" backLabel="Back to the post" title="Add a tag" action={<HelpDot />} />
      <div style={{ flex: "none" }}>
        <SearchBar query="salt" placeholder="Name a tag" />
      </div>
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <ReferenceRow kind="topic" name="saltmaps" trailing={<Icon name="add" size={20} />} onOpen={() => {}} />
        <ReferenceRow kind="topic" name="saltmarsh" trailing={<Icon name="add" size={20} />} onOpen={() => {}} />
        <ReferenceRow kind="topic" name="saltcrust" trailing={<Icon name="add" size={20} />} onOpen={() => {}} />
        <ReferenceRow kind="topic" name="saltflats" trailing={<Icon name="add" size={20} />} onOpen={() => {}} />
        <div style={{ flex: 1 }} />
        <p style={{ margin: 0, padding: "8px 24px 16px", fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)" }}>
          Any name works, used or not — nobody owns a tag. It is yours the moment you sign.
        </p>
      </div>
    </>
  );
}
