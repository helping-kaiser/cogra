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

   THE FIRST ROW IS THE TYPED NAME, ALWAYS (jakob's ruling, 2026-09-30, the
   V1.0 audit's K14.1). The list's first row is the canonicalized form of what
   is typed, whether or not rows match below it, and the name field's keyboard
   action key stages it — the same pick as a tap on it. It is a row, not a
   "Create" button: the `Signs as #salt` preview made tappable, the
   `ReferenceRow` every other row is, its preview on the row's second line. It
   names a Type that already exists; it creates nothing. A name in use that is
   the typed name is that row, never listed twice. So a name nobody has used is
   exactly as pickable as one everybody has, which is the footnote's promise
   kept by the list itself.

   THE ROWS UNDER IT ARE THE INDEX'S. Hashtag `name` is an indexed field in
   the global search index (api-spec.md, "What is indexed"), and slice 2.7 is
   what lands that index. Until then there are no rows under the first —
   `referenceCandidates` explicitly refuses to offer topics ("A topic is never
   offered — it is tagged, not referenced — which is why a #-typed query finds
   nothing") — and the first row alone carries every pick. Same staging shape
   as the Sky's, and the register carries it.

   RANKING ORDERS THE ROWS UNDER THE FIRST AND THE EDGE GOES TO THE ACT, which
   is `ReferenceRow`'s own rule and `ReferencePicker`'s drawing: where the whole
   row's tap picks, the right edge is the add mark and the number yields to it.
   So no row carries a figure at all, the first included.

   AND CERTAINLY NOT A USE COUNT. Instagram and Tumblr both hang "12k posts"
   off a tag; §3 refuses it — it is nobody's view in particular and it is not
   explainable. Where a tag does wear a number in this system it is a
   viewer-relative rank, on a search result row (`ExploreSearch`), and it
   arrives with 2.7's index and slice 3's ranker together.

   THE ROWS UNDER THE FIRST ARE ALREADY-USED NAMES, which is what an index can
   offer. That is not a contradiction of the paragraphs above: the picker helps
   you find a name others reach for, and its first row never stops you naming
   one they do not.

   NO SKY ENTRY AND NO BOTTOM NAV — picking is a task, not the tab, which is
   `ReferencePicker`'s own reason.

   A PICK STAGES AND THE PICKER STAYS OPEN (jakob, 2026-10-01). A tap on a
   row — or the action key on the typed name — stages that tag in the composer
   at once, and the reader goes on picking: tags come several at a time, and a
   picker that closed on every pick would send the reader back through
   "+ Add a tag" once per tag.

   THE PICKED ROW MOVES ABOVE THE RESULTS (jakob, 2026-10-01, overruling the
   in-list check). The moment a row is picked it leaves the list and stands in
   the staged section between the name field and the results, a
   `StagedReference` with its × — the post-MVP chat pickers' idiom exactly
   (`ChatPickerGroup`): no heading, the rows themselves say what they are.
   Here two of the index's rows are in. The × un-stages the tag on the spot,
   and the row goes back to the list if the query still matches it; the
   composer's chip × still removes it too. The query stays as typed, so the
   list being picked from does not move under the reader. A tag the composer
   already holds stands in the staged section the moment the picker opens.

   THE MOVE IS SPOKEN TOO (jakob, 2026-10-01). The row's move is all an eye
   needs; an ear gets `PickAnnouncement`, a polite status message that says
   `Added — in the staged list.` on a pick and `Removed from the staged list.`
   on the ×, and draws nothing. This board is the moment after `saltflats`
   went in.

   `Done` AND THE HEADER BACK ARE ONE LEAVE (jakob, 2026-10-01). Both return to
   the composer the picker was opened from, every staged tag kept — back is
   navigation, never an undo; `Done` is the affirmative twin, because a back
   arrow reads as an abort to a reader who has finished adding tags. It is the
   full-width foot every wizard stage wears (`ReplyDraft`'s `Next`), and every
   state of both pickers carries it. */
export function Screen() {
  return (
    <>
      <PageHeader backHref="#" backLabel="Back to the post" title="Add a tag" action={<HelpDot />} />
      <div style={{ flex: "none" }}>
        <SearchBar query="salt" placeholder="Name a tag" />
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 16px 8px" }}>
          <StagedReference kind="topic" name="saltmarsh" onRemove={() => {}} />
          <StagedReference kind="topic" name="saltflats" onRemove={() => {}} />
        </div>
        <PickAnnouncement said="Added — in the staged list." />
      </div>
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <ReferenceRow kind="topic" name="salt" sub="Signs as #salt" trailing={<Icon name="add" size={20} />} onOpen={() => {}} />
        <ReferenceRow kind="topic" name="saltmaps" trailing={<Icon name="add" size={20} />} onOpen={() => {}} />
        <ReferenceRow kind="topic" name="saltcrust" trailing={<Icon name="add" size={20} />} onOpen={() => {}} />
        <div style={{ flex: 1 }} />
        <p style={{ margin: 0, padding: "8px 24px 16px", fontSize: "var(--text-body-small)", lineHeight: "var(--text-body-small--line-height)", color: "var(--text-secondary)" }}>
          Any name works, used or not — nobody owns a tag. It is yours the moment you sign.
        </p>
      </div>
      <div style={{ flex: "none", padding: "0 24px 24px" }}>
        <Button style={{ width: "100%" }}>Done</Button>
      </div>
    </>
  );
}
