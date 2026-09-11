/* HISTORY · nothing seen yet (the private-viewer-state round). A new account's
   first minute, and nothing else — the list fills itself from then on.

   IT SAYS THE LIST IS AUTOMATIC, which is the one fact a reader cannot infer.
   Saved fills because you acted; this fills because you read, and an empty
   screen that did not say so reads as a feature that is switched off. */
export function Screen() {
  return (
    <>
      <PageHeader title="History" backHref="#" backLabel="Back to your profile" />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "8px 24px" }}>
        <EmptyState title="Nothing here yet. Posts you read show up here on their own, newest first." />
      </div>
      <BottomNav active={null} slots={ALL_SLOTS} inline />
    </>
  );
}
