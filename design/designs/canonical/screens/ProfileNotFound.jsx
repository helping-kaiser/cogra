/* Profile · no such profile — the terminal state of a public profile URL
   (readme §13, the audit states; jakob 2026-09-09, item 17).

   A PROFILE URL IS SHAREABLE, so a handle that resolves to nothing is a
   state readers reach from outside the app, not an edge case. It is drawn.

   IT IS TERMINAL, AND THAT IS THE RULING. Nothing here retries, because
   nothing about waiting or asking again makes a profile exist. The way out
   is the back arrow the surface already has — a board that answered a dead
   handle with a Retry would be offering the reader work that cannot pay.

   IT IS `EmptyState`, NOT `TransportError`. Nothing failed: the answer
   arrived and the answer was no. `EmptyState` is the atom for a surface
   with nothing in it (`ExploreNone`, `FeedNothing` draw it the same way),
   and its refusal to carry `--error` is the point — an absence is not a
   fault, and colouring it like one would say the app is broken.

   THE HEADER KEEPS THE HANDLE. It is the only thing known about what was
   asked for, and without it the reader cannot tell which link was dead. The
   overflow goes: a menu of things to do about a person offers nothing when
   there is no person. */
export function Screen() {
  return (
    <>
      <PageHeader title="@marlow" backHref="#" backLabel="Back" />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "8px 24px" }}>
        <EmptyState title="This profile doesn't exist." />
      </div>
      <BottomNav active={null} slots={ALL_SLOTS} inline />
    </>
  );
}
