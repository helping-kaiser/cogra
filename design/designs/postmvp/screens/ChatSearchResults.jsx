/* EXPLORE, SEARCHING — a chat among the results (round B3 of the chats work,
   the integration round).

   A CHAT IS A RESULT KIND. Chat `name` is in the global index (api-spec.md,
   *What is indexed*), so a query that matches a chat's name returns the chat
   as a row in the search's own grammar — `ReferenceRow` at chat kind: the
   `forum` mark, the name, the policy line as its second line, and the
   viewer-relative rank on the edge where the ranked rows carry it.

   A CHAT RESULT OPENS THE CHAT'S READ SURFACE, FOR ANYONE (ruled): the thread
   itself — read from outside with the join at the foot for a non-member or a
   guest (`ChatThreadReader`), the member's own thread for a member. Chats are
   public reads, so no result needs a gate before it is read.

   WHAT IS NOT HERE. Messages are not a global
   search kind: api-spec.md excludes chat messages from the global index —
   "casual conversation doesn't surface to strangers by keyword" — and gives
   them the scoped `chatSearch` (`ChatSearchIn`). Backlog item 105 settled it
   (readme §13, the indirect kinds are scope-served): a message result exists
   only in a scoped query. This board's query is unscoped, so it draws no
   message row.

   THE MIGRATION NOTE: the search surface is canonical's. V1.0's
   `ExploreSearch` and `RefsSheet` carry no chat or message rows (readme §13,
   the V1.0 scope cut). At migration the chat row joins `ExploreSearch` and
   this excerpt goes — and chat and message rows join canonical's `RefsSheet`
   with it, landing on the chat's read surface and on the thread scrolled to
   the message, the destinations this round's rows already take. */
function SearchTriggerRow() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4, padding: "0 16px 8px 16px" }}>
      <FilterTrigger reading="Everything" ariaLabel="What the search shows" />
      <HelpDot ariaLabel="How searching works" />
    </div>
  );
}

export function Screen() {
  return (
    <>
      <div style={{ flex: "none", paddingTop: 12 }}>
        <SearchBar query="harbour" />
        <SearchTriggerRow />
      </div>
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <ReferenceRow kind="chat" name="Harbour office" sub={CHAT_POLICY_LINE.request} rank="4.10" onOpen={() => {}} />
        <ReferenceRow kind="person" name="Harbour Rowing Club" sub="@rowingclub" rank="2.80" onOpen={() => {}} />
        <ReferenceRow kind="chat" name="Harbour seal watch" sub={CHAT_POLICY_LINE.open} rank="1.90" onOpen={() => {}} />
        <ReferenceRow kind="post" name="Harbour lights at dusk" src="post-photo.jpg" rank="1.20" onOpen={() => {}} />
      </div>
      <BottomNav active="search" slots={ALL_SLOTS} inline />
    </>
  );
}
