/* AN ASK LINK THAT RESOLVES TO NOBODY (jakob 2026-10-02; auth.md, *The ask
   link*; ASK_LINK_UNUSABLE's unknown-id case).

   `VouchAskUnusable` answers a link that names a real person who cannot be
   staged right now. This board answers the link that names nobody:
   `askLinkCheck` finds no account behind the id — a link cut short in
   copying, mistyped, or one whose account is gone. The reader cannot tell
   which, and none of them changes what to do next, so the paragraph names
   no cause: it says what the reader can check, and who can help.

   `JoinInvalid`'S IDIOM, the product's dead-link landing: the fact said out
   loud in the heading and the way forward in the paragraph. There is no
   field — nobody pastes an ask link into the product — and no way on beyond
   the arrow: no person stands behind the link to show, so the one exit is
   the way back (jakob 2026-10-02, the residue round's Q7). It is not the
   reader's failure, so it carries no error
   colour.

   THE WAY BACK IS THE LAYER LAW: a link opens over whatever the reader was
   doing and back returns there, or to the feed when the link opened the app
   cold — a guest's or a member's, the same rule. */
export function Screen() {
  return (
    <>
      <PageHeader backHref="#" backLabel="Back" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "8px 24px 32px", overflow: "hidden" }}>
        <h1
          style={{
            margin: 0,
            fontSize: "var(--text-headline-small)",
            lineHeight: "var(--text-headline-small--line-height)",
            fontWeight: "var(--text-headline-small--font-weight)",
          }}
        >
          This ask link doesn't work
        </h1>
        <p
          style={{
            margin: "8px 0 0",
            fontSize: "var(--text-body-medium)",
            lineHeight: "var(--text-body-medium--line-height)",
            letterSpacing: "var(--text-body-medium--letter-spacing)",
            color: "var(--text-secondary)",
          }}
        >
          Check that the whole link came through, or ask the person who sent it for it again.
        </p>
      </div>
    </>
  );
}
