/* INVITES, EMPTY — and this is the state most readers will meet. A cohort of
   friends invites rarely, so the teaching surface is not the populated list:
   it is this one, and it is the only place in the product where the whole
   mechanic can be said in three lines to somebody who has never used it.

   WHAT THE LINES CARRY is the one thing no other social has. Everywhere else a
   share link is a share link; here it does two separable things, and a reader
   who conflates them will be surprised by the second. So they are said apart:
   the LINK makes an account possible, and the VOUCH — the reader's own signed
   opinion, given at approval — is what actually brings the person in. `Vouch`
   is the product's word and a reader's unfamiliar one, so it is explained
   where it stands, in half a sentence, rather than left to be guessed.

   `brings them in` IS THE PRODUCT'S OWN PHRASE, taken from `VouchBack`,
   `ApplicantWaiting` and `VouchedIn` rather than coined here. The boards
   already had the right words, and a phrase repeated across four surfaces
   teaches faster than four near-synonyms would.

   THE EMPTY-STATE IDIOM IS THE SHAPE, NOT THE DRESS (jakob 2026-09-15:
   "Create invite should be more prominent no? it is the single actionable item
   on that screen"). What the idiom fixes is the ARRANGEMENT — a calm statement
   and the one action that fills it, never a scold and never a sell — and the
   outlined shrink-to-fit button is the dress it wears where an empty list is
   one surface among several a reader is passing through. This screen is not
   one of those. Nothing else is on it, and the action is the whole reason the
   reader came. So it wears the page's own committing control instead: the
   filled primary at the column's full width, the same button the populated
   list carries at the head of its column, so the two states of one screen
   offer one control that looks like itself in both. `EmptyState`'s `action`
   slot is what makes this a choice rather than a fork — the component's calm
   default stays the default for every other empty list in the tree.

   THE MECHANIC IS BEHIND A "?" (jakob 2026-11-12, the re-ask's 4): the empty
   state says one thing, `No invites out yet.`, and the two sentences on the
   link and the vouch — `How vouching works`' first paragraph word for word —
   open from a "?" beside `Create invite`, a plain dialog, its subject its
   name. The "?" trails the button in its row, `SheetTitle`'s `trailing`
   construction, and the button keeps the rest of the column's width.

   REGISTERED under the `invites` prefix (seam 248): the empty state `empty`,
   its action `empty.create`, the "?" `empty.help` (the house name for a "?"). */
export const NODE = "invites";
export function Screen() {
  return (
    <>
      <PageHeader title="Invites" backHref="/profile" backLabel="Back to your profile" node="header" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "16px 24px 32px" }}>
        <EmptyState
          title="No invites out yet."
          action={
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", alignSelf: "stretch" }}>
              <Button style={{ flex: 1 }} onClick={() => {}} node="create">
                Create invite
              </Button>
              <HelpDot ariaLabel="How vouching works" onOpen={() => {}} node="help" />
            </div>
          }
          node="empty"
        />
      </div>
    </>
  );
}
