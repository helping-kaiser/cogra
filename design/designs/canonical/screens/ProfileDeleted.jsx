/* PROFILE · DELETED BY THE PERSON WHOSE ACCOUNT IT WAS — how a deleted account
   reads to everyone else (the redacted-actor law, jakob 2026-09-11: "the whole
   profile should be untouched, exactly the same structure as before, just all
   the personal data is taken out and placeholdered… never the shells").

   THE SHELLS NEVER GO, AND THAT IS THE WHOLE BOARD. An actor whose account was
   deleted is still an actor: still the author of everything it signed, still
   carrying the standing others vouched into it, still routing its content
   through other people's feeds (`erasure.md` §3 — records, standing, counts
   and authorship are all preserved). So this page is the other-profile page,
   unchanged: the same header, the same real counts, the same tabs, the same
   chronicle of what they actually did. What went is the personal data, and
   only that.

   A PAGE STRIPPED TO A NOTICE WOULD BE A LIE OF THE OTHER KIND. The erasure
   ethic forbids pretending that something which was there never existed; a
   board answering with a bare removal mark on an empty page is the opposite of
   `ProfileNotFound` and has the same effect — it hides a record still on the
   graph, still credited, still ranked. The mark belongs where the payload was,
   not in place of the page.

   WHAT IS PLACEHOLDERED, AND WHY EACH WAY. The avatar is the reserved disc —
   no monogram, because a monogram is the first letter of a name and there is
   no name to take one from, and no glyph, because that would be imagery with
   no source. The name slot reads `Deleted account` in `text-secondary`: the
   system's own voice, not a name somebody chose. The handle is dropped rather
   than replaced — it was redacted at execution and the stored form is a
   uniqueness device, so printing anything there would invent a handle a reader
   could try to reach. All three are `ProfileHeader`'s `redacted`, which is
   `ActorChip`'s treatment at page scale: the same drawing follows this actor
   onto every card and row it authored.

   THE MARK LIVES IN THE BIO'S PLACE. The bio is a profile's one authored,
   personal region — exactly the payload that was removed — and
   `RedactedContent` is the atom for a content region whose payload went. Put
   as a band under the header it would read as a fault with the page; sitting
   where the words were, it reads as what it is. `account` is its own reason,
   worded so it can never be mistaken for a moderation verdict.

   THE CONTENT STAYS READABLE, and this fixture is the no-sweep case: the
   default deletion is identity-level, so the chronicle carries their real acts
   with their real words (`erasure.md` §2). The content-level opt-in is the
   other reading of this same page — every act still listed, each one's words
   gone instead.

   THE ACTIONS ROW KEEPS THE OPINION AND THE ⋮, AND LOSES THE MESSAGE. An
   opinion targets the ACTOR, and the actor is there — its content still ranks
   in other people's feeds, so a reader who wants it out of theirs needs the
   control that does that, severance included. A message targets a PERSON, and
   the person is gone: the identity association is deleted, so a composer here
   would address nobody.

   THE ⋮ HOLDS THE THREE ROWS THAT WORK ON A NAMELESS ACTOR (jakob 2026-09-12):
   `Save`, `Share this profile`, `Hide this account`. Saving keeps a pointer,
   sharing sends a page, and hiding acts on the actor — not one of them needs a
   name. Mention is the row that does, and it is the only one dropped: it
   stages a Reference at a PERSON and spells their handle in the composer.
   The hide row's wording is `ActorChip`'s own (`HIDE_ACTOR_LABEL`), so this
   page and every card this actor authored say the same thing. The dot stands
   in the row rather than the bar — the band law, and the row Message vacated
   is where the page's rare acts belong.

   HOW A READER GETS HERE. Not from a shared @handle link: the handle is
   redacted at execution, so that route is `ProfileNotFound`'s case and its
   entry says so. This is reached by following STRUCTURE that still points at
   the actor — an author chip on a post they wrote, a comment's author, a name
   in someone's chronicle. Those point at an actor, and the actor is there. */
export function Screen() {
  return (
    <>
      <PageHeader backHref="#" backLabel="Back" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "0 16px" }}>
          <ProfileHeader
            handle="marlow"
            redacted
            bio={<RedactedContent reason="account" when="3d" />}
            posts={7}
            stancesOn={22}
            stancesTaken={19}
            onCounts={() => {}}
            onCommit={() => {}}
            menu={deletedProfileMenu()}
            showHandle={false}
          />
        </div>
        <TabBar ariaLabel={CHRONICLE_TABS_LABEL} value="everything" tabs={CHRONICLE_TABS} />
        <ChronicleList>
          <ContentRow variant="chronicle" chevron={false} glyph="dynamic_feed" title="Published a post" trailing="9d" second="Three mornings on the wall, watching the tide come in over the flats." onOpen={() => {}} />
          <ContentRow variant="chronicle" chevron={false} glyph="chat_bubble" title="Commented" trailing="12d" second="The tunnel is faster; the coast road is the reason to drive at all." onOpen={() => {}} />
          <ContentRow variant="chronicle" chevron={false} face={{ pDirected: 0.5, pInterest: 0.3 }} title="Gave an opinion" titleAside="on @sol" trailing="14d" inert />
          <ContentRow variant="chronicle" chevron={false} glyph="dynamic_feed" title="Published a post" trailing="21d" second="Low sun on the salt crust, and nobody else out there." onOpen={() => {}} />
        </ChronicleList>
      </div>
      <BottomNav active={null} slots={ALL_SLOTS} inline />
    </>
  );
}
