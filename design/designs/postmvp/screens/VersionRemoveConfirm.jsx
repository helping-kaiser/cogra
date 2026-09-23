/* REMOVING ONE VERSION — the think-twice dialog at version scale, over the
   register it was reached from (jakob's rulings 2026-09-22).

   IT IS `RemoveConfirm`'S ANATOMY, DELIBERATELY. The same dialog surface, the
   same emphasis — the safe action filled, the removal a text button — and no
   error colour, because an author removing their own words is doing exactly
   what they meant to. A second, differently-shaped removal dialog would teach
   the thumb two habits for one kind of decision.

   WHAT THE BODY HAS TO SAY, AND WHY IT IS LONGER THAN THE POST'S. Removing a
   post is one fact; removing a version is three. The words go from every
   reader's view and a mark stays — that much is the post's own sentence. The
   other versions keep standing, which is the fact that makes this act different
   from the one above it on the register. And if this is the CURRENT version the
   post goes on showing it, removed: the head never falls through (erasure.md
   §1), so no earlier version is republished by an act of removal. That last
   sentence is the one a reader cannot guess, and it is why it is spelled out
   before the act rather than explained after it.

   IT IS THE MASTER AT EVERY SCALE (jakob's canvas review, 2026-09-23). The
   comment's and the profile's registers (`CommentHistoryOwn`,
   `ProfileHistoryOwn`) draw no confirm of their own: their per-version acts and
   their whole-thing leads all open this dialog's anatomy, the kind's noun in
   place of "post". One think-twice shape for one kind of decision. */
export function Screen() {
  return (
    <>
      <PageHeader title="Edit history" backHref="#" backLabel="Back to the post" />
      <PostChronicle own />
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
      <DialogSurface ariaLabel="Remove this version?">
        <h2 style={{ margin: 0, fontSize: "var(--text-headline-small)", lineHeight: "var(--text-headline-small--line-height)", fontWeight: "var(--text-headline-small--font-weight)" }}>
          Remove this version?
        </h2>
        <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>
          Its words and pictures leave every reader's view, and a mark stays in their place. The other versions keep standing. If this is the current version, the post shows it as removed — an earlier version never takes its place.
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button variant="text">Remove version</Button>
          <Button>Keep it</Button>
        </div>
      </DialogSurface>
    </>
  );
}
