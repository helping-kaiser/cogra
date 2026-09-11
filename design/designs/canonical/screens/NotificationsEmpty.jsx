/* NOTIFICATIONS · nothing yet — the state a new member opens the bell into,
   and the one a quiet account stays in.

   IT NAMES THE KINDS, because nothing else can. The list has no gesture of its
   own: it fills from what other people do, and a reader who has never had a
   comment cannot tell from an empty screen whether the channel is empty or
   broken. Naming the five things that arrive answers both.

   NO ACTION BUTTON. `EmptyState` takes the one action that fills the list where
   there is one, and nothing the reader can do from here fills this one — it
   fills when somebody else acts. */
export function Screen() {
  return (
    <>
      <PageHeader title="Notifications" backHref="#" backLabel="Back" />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "8px 24px" }}>
        <EmptyState title="Nothing here yet. Comments, replies, citations, mentions and opinions on you arrive here as they happen." />
      </div>
      <BottomNav active={null} slots={ALL_SLOTS} inline />
    </>
  );
}
