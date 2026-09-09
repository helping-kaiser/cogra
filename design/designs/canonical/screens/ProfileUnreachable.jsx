/* Profile · can't reach the server — the whole-profile read failure
   (readme §13, the audit states; jakob 2026-09-09, item 17).

   THE TWIN OF `ProfileNotFound`, AND ITS OPPOSITE. There the answer arrived
   and it was no; here no answer arrived at all. The difference is the whole
   design: an absence gets `EmptyState` and no way on, a fault gets the
   failure voice and a Retry, because trying again is exactly the thing that
   might work.

   IT IS THE `NetworkError` FAMILY, drawn on the surface that failed —
   `TransportError` for the fact, an outlined Retry for the way out, and the
   surface's own chrome left standing. What differs from the exemplar is
   what there is to keep: the seal keeps a whole signed post under its fault
   because the fault took nothing away, and here the fetch is what failed,
   so there is nothing under it to keep.

   THE LINE IS THE SHORT FORM, and it is the same swap §3's feed variant
   already makes — `Can't reach the server — new posts can't load right
   now.`, with the noun this surface is about. The long house line ends in
   "and try again", which beside a Retry says try again twice; the reply's
   failed upload is drawn short for that reason and this is drawn short for
   the same one.

   THE RETRY WEARS `EmptyState`'s ACTION TREATMENT — outlined, small,
   leading the column — because it stands in the slot that atom would have
   filled. It is not a wizard's foot, so it is not a wizard's full-width
   button. */
export function Screen() {
  return (
    <>
      <PageHeader title="@ada" backHref="#" backLabel="Back" />
      <div
        style={{
          flex: 1,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: "var(--space-3)",
          padding: "16px 24px",
        }}
      >
        <TransportError message="Can't reach the server — this profile can't load right now." />
        <Button variant="outline" size="sm" selfStart>
          Retry
        </Button>
      </div>
      <BottomNav active={null} slots={ALL_SLOTS} inline />
    </>
  );
}
