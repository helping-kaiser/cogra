/* HISTORY · nothing seen yet (the History redesign, 2026-10-05). A new
   account's first minute, and nothing else — the feed of what you have seen
   fills itself from then on, every kind the feed serves.

   IT SAYS THE LIST IS AUTOMATIC, which is the one fact a reader cannot infer.
   Saved fills because you acted; this fills because you read, and an empty
   screen that did not say so reads as a feature that is switched off. Its
   words name no kind, because the list holds every kind (blessed, jakob
   2026-10-05; copy-voice *Saved, History and hiding*).

   NO SEARCH FIELD AND NO TRIGGER YET (jakob 2026-10-05, "canvas looks
   good"). Both act on what has been seen, and here nothing has; they arrive
   with the first thing seen. A history narrowed or searched to nothing is a
   different state — the reader's own narrowing — and it is `HistoryNone`.

   REGISTERED under the `history` prefix (design ⇄ impl seam 062/063, the
   History packet), named as `SavedEmpty` names its page; the empty line is
   `empty`. */
export const NODE = "history";
export function Screen() {
  return (
    <>
      <PageHeader title="History" backHref="#" backLabel="Back to your profile" node="header" />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "8px 24px" }}>
        <EmptyState title="Nothing here yet. Everything you see shows up here on its own, newest first." node="empty" />
      </div>
      <BottomNav active={null} slots={ALL_SLOTS} inline node="bottomBar" />
    </>
  );
}
