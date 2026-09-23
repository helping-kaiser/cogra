/* SEARCH IN THIS CHAT — the search glyph on the thread's header (round B1 of
   the chats work; jakob's rulings 2026-09-23, the fix pass: search left the
   details page for the header, beside the details door, on every thread —
   `ChatThreadHeader`). The way back is the thread it was opened from.

   ONE CHAT, WORD BY WORD, NEWEST FIRST — the contract's own shape: the scoped
   `chatSearch` read (chats.md §7, *Searching*; api-spec.md), which keeps chat
   messages out of the global index and searches exactly one chat. The field
   is the Explore field (`SearchBar`), and it stands under a titled header
   rather than in place of one, because this is a subpage of the thread with
   a way back, not a tab.

   THE RESULTS ARE MESSAGES AT CHAT SCALE: the list row every chats surface
   is built from (`ContentRow`'s chronicle variant, `ChatRow`'s shape), with
   the sender where the chat's name would be and the message's words where
   the preview would be — `You` for the reader's own. The trailing edge is the
   ages ladder, because a row answers "how long ago"; the exact clock lives in
   the thread, one tap away, where each result opens at its message. No match
   highlighting: the word the reader typed is in every line, and a bolded
   fragment in a one-line ellipsis is as likely to be cut off as shown.

   THE TRUTHFUL NOTE, UNDER THE FIELD (a copy candidate). Encrypted messages
   are never searchable: the server holds only their ciphertext and no key
   (chats.md §7, *What encryption does not hide*), so a search that seemed to
   cover them would be lying by omission about every locked message it
   silently skipped. So it says, before the results, what it reads and why —
   `ExploreNone`'s register for the same kind of fact. Juno's `boots` message
   is encrypted, and it is not here.

   A NON-MEMBER SEARCHES THE SAME WAY — plaintext is a public read — and gets
   the same results: this board serves both readers. */
export function Screen() {
  return (
    <>
      <PageHeader title="Search in this chat" backHref="#" backLabel="Back to the chat" />
      <div style={{ flex: "none" }}>
        <SearchBar query="tide" placeholder="Search messages" />
        <div style={{ padding: "0 24px 4px" }}>
          <QuietNote>Only messages sent without the lock are searched — an encrypted message's words open on members' devices and nowhere else.</QuietNote>
        </div>
      </div>
      <ChatsColumn>
        <ContentRow variant="chronicle" chevron={false} title="Mira Voss" image="inviter.jpg" second="Low tide's at six tomorrow — anyone walking the flats?" trailing="12h" onOpen={() => {}} />
        <ContentRow variant="chronicle" chevron={false} title="Tobias Lindqvist" name="Tobias Lindqvist" second="The tide table on the harbour door is wrong for Sunday." trailing="4d" onOpen={() => {}} />
        <ContentRow variant="chronicle" chevron={false} title="You" name="Sol Ferreira" second="Tide was out past the second groyne by seven." trailing="9d" onOpen={() => {}} />
        <ContentRow variant="chronicle" chevron={false} title="Juno Baptiste" name="Juno Baptiste" second="Spring tide on Saturday — the crust will be soft by noon." trailing="12d" onOpen={() => {}} />
      </ChatsColumn>
    </>
  );
}
