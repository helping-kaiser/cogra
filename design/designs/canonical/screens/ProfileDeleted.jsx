/* PROFILE · DELETED BY THE PERSON WHOSE ACCOUNT IT WAS — how a deleted account
   reads to everyone else (readme §13, the account-deletion round; jakob's
   ruling 2026-09-11: "we never pretend sth that once was there never existed").

   A SIBLING OF `ProfileNotFound`, AND ITS OPPOSITE IN THE ONE WAY THAT MATTERS.
   There, a handle resolved to nothing and the honest answer is that there is
   nothing. Here there WAS someone: the actor is still on the graph, still the
   author of everything it authored, still carrying the standing others vouched
   into it (`erasure.md` §3). What went is the name. A surface that answered
   this with "This profile doesn't exist." would be the product telling a lie
   about its own record — the one lie the erasure ethic exists to forbid.

   HOW A READER GETS HERE. Not from a shared @handle link: the handle is
   redacted at execution, so that route is `ProfileNotFound`'s own case and its
   entry already says so. This is reached by following STRUCTURE that still
   points at the actor — an author chip on a post they wrote, a comment's
   author, a name in someone's chronicle. Those point at an actor, and the actor
   is still there.

   IT IS `RedactedContent`, NOT `EmptyState`, AND THAT IS THE WHOLE DESIGN.
   `ProfileNotFound` takes the empty state because nothing is missing — the
   answer arrived and it was no. Here a payload was removed, which is what the
   redaction mark is the mark for: identity-level redaction empties the
   Registration bundle exactly as a removal empties a post's, so the profile
   wears the mark a post wears, on the reserved surface that says a space was
   kept rather than lost. `account` is its third reason, worded so it can never
   be mistaken for a moderation verdict.

   NO TITLE IN THE HEADER. `ProfileNotFound` keeps `@marlow` because the handle
   is the only thing known about what was asked for; here the handle is the
   thing that was removed, and printing it back would undo the redaction on the
   one surface that exists to report it. The header is `Removed`'s — a back
   arrow and nothing else.

   NOTHING TO DO HERE. No overflow menu: a menu of things to do about a person
   has nothing to offer when the person is gone. No opinion control either —
   the actor can still be acted on in principle, but this board is a statement,
   and offering an opinion on a name that is not there would be the surface
   asking a question it cannot phrase. */
export function Screen() {
  return (
    <>
      <PageHeader backHref="#" backLabel="Back" />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "8px 24px" }}>
        <RedactedContent reason="account" when="3d" />
      </div>
      <BottomNav active={null} slots={ALL_SLOTS} inline />
    </>
  );
}
