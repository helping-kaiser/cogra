/* Citing — the reference explorer, wearing the search UI (readme §13): the
   same bar, the same worded trigger, the same rows. No Sky entry — citing is a
   task, not the tab. The rows' edge is the ADD mark: the whole row's tap picks
   the reference; ranking still orders the list.

   IT OFFERS POSTS, COMMENTS AND PROFILES (readme §13, the V1.0 scope cut,
   2026-09-25): a V1.0 reference points at a person, a post or a comment — the
   contract's `ReferenceTarget` union, read as the ruling — so no row offers a
   kind that cannot be cited, and its filter holds those three kinds.

   A PICK STAGES AND THE PICKER STAYS OPEN (jakob, 2026-10-01, the shared
   anatomy's law — `TagPicker`). A tap on a row stages that citation in the
   composer at once and the reader goes on picking, the row's add mark turned
   to the added mark (`ReferenceRow`'s `staged`): here the post is in and the
   person is still to add. A tap on a row already added changes nothing; a
   staged citation leaves from the composer, where its row carries the ×. The
   composer's cap still bounds the batch — ten references (`ComposeSealCited`)
   — and how the list reads once the tenth is in is not drawn yet.

   `Done` AND THE HEADER BACK ARE ONE LEAVE (jakob, 2026-10-01, carried here by
   the shared anatomy `TagPicker` names). Both return to the composer the
   picker was opened from, every staged reference kept — back is navigation,
   never an undo; `Done` is the affirmative twin, because a back arrow reads as
   an abort to a reader who has finished citing. It is the full-width foot
   every wizard stage wears (`ReplyDraft`'s `Next`). */
export function Screen() {
  return (
    <>
      <PageHeader backHref="#" backLabel="Back to the post" title="Cite something" action={<HelpDot />} />
      <div style={{ flex: "none" }}>
        <SearchBar query="salt" />
        <div style={{ display: "flex", alignItems: "center", padding: "0 16px 8px 16px" }}>
          <FilterTrigger reading="Everything" ariaLabel="What the search shows" />
        </div>
      </div>
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <ReferenceRow kind="post" name="Salt maps of the coast road" sub="@sol · 3d" src="post-photo.jpg" staged onOpen={() => {}} />
        <ReferenceRow kind="person" name="Sal Torres" sub="@saltorres" trailing={<Icon name="add" size={20} />} onOpen={() => {}} />
      </div>
      <div style={{ flex: "none", padding: "8px 24px 24px" }}>
        <Button style={{ width: "100%" }}>Done</Button>
      </div>
    </>
  );
}
