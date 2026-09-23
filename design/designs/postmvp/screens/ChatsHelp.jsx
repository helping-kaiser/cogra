/* HOW CHATS WORK — the chats page's "?" (would-like #3; jakob 2026-09-23).

   `HelpDialog`'S SHAPE, `TimelineHelp`'S PRECEDENT: a heading naming the thing
   asked about, two short paragraphs, one way out. No links and nothing to
   decide.

   THREE THINGS NOBODY GUESSES, IN TWO PARAGRAPHS. That a chat is public — its
   members and who talks to whom are there for anyone to read, which is the
   one fact a reader arriving from any other messenger will get wrong (chats.md
   §1). That encryption is chosen message by message, with the lock beside the
   field, and hides the words but never that a message was sent (chats.md §7,
   *What encryption does not hide*). And that sending signs — the arrow is the
   seal, and holding it shows what is signed. The first two share a paragraph
   because the second is the answer to the first.

   THE SURFACE BENEATH IS YOUR CHATS, whole and inert — the "?" is the page's,
   and both faces open this same dialog; one board draws it, because the words
   do not change with the face. */
export function Screen() {
  return (
    <>
      <ChatsHomeBody />
      <div style={{ position: "relative", zIndex: 50 }}>
        <DialogSurface ariaLabel="How chats work">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <h2 style={{ margin: 0, fontSize: "var(--text-headline-small)", lineHeight: "var(--text-headline-small--line-height)", fontWeight: "var(--text-headline-small--font-weight)" }}>
              How chats work
            </h2>
            <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>
              Chats are public: anyone can read a chat and see who is in it and who talks to whom. The lock beside the field encrypts
              the message you are writing, so only the chat's members can read its words — everyone can still see that it was sent.
            </p>
            <p style={{ margin: 0, fontSize: "var(--text-body-medium)", lineHeight: "var(--text-body-medium--line-height)" }}>
              Sending signs the message in your name, like any post. Press and hold the send arrow to see exactly what you sign. A sent
              message never changes — a correction is the next message.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button>Close</Button>
            </div>
          </div>
        </DialogSurface>
      </div>
    </>
  );
}
