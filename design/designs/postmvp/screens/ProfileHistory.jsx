/* A PROFILE'S EDIT HISTORY — the third kind, and the one that proves the
   pattern is about records rather than about posts (jakob's rulings
   2026-09-22).

   A PROFILE IS A VERSIONED THING LIKE ANY OTHER. Its display name, its words,
   its face and its address all ride one signed record, so changing any of them
   signs a new one — and the history is the same list of whole versions the post
   and the comment get, newest first, the current one marked.

   THE WHOLE BAND IS THE VERSION, never the field that changed. Nothing here
   says "the name changed": each card shows a complete identity, and a reader
   comparing two reads which parts moved. That is the no-diff ruling at its
   plainest — highlighting the changed field would be the product deciding which
   change was the story.

   A REMOVED VERSION KEEPS ITS ROW HERE TOO. The name, the words, the face and
   the address were its payload and went together; the handle, which is the
   account's and never a version's, stays beside the reserved disc, and the
   post's mark stands in the rest's place (`ProfileVersionTombstone`).

   IT IS PUBLIC, and the address makes that worth saying out loud. An address
   somebody stood behind for a month and then took down is a thing they
   published, and taking it down is a new version rather than an unpublishing —
   the way out of a version you regret is removal, which leaves a mark, and it
   is the same act here as on a post (`ProfileHistoryOwn`).

   THE FRAME IS TALLER THAN A PHONE so all four versions and the law at the foot
   show whole: the column measures 1000px; with the 48px header and the 65px bar
   that is 1113, drawn at 1116. */
export const FRAME = { width: 390, height: 1116 };

export function Screen() {
  return (
    <>
      <PageHeader title="Edit history" backHref="#" backLabel="Back to the profile" />
      <ProfileChronicle />
      <BottomNav active={null} slots={ALL_SLOTS} inline />
    </>
  );
}
