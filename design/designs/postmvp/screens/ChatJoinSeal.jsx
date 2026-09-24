/* WHAT YOU SIGN, TO JOIN — the seal behind every route into a chat (round B2
   of the chats work, the governance round; jakob 2026-09-23).

   ONE BOARD FOR THE THREE ROUTES. Membership materialises only from the
   joiner's own Participant record (chats.md §4, *Joining*), whichever way they
   came — an open chat's `Join`, an invitation accepted, a request approved —
   so the three routes sign the same one record and meet the same seal. THE
   NOUNS SWAP PER ROUTE, NOTHING ELSE MOVES (the confirm-nouns precedent,
   copy-voice): the one fact row that says how the reader comes to be joining
   reads, by route,
   · invited (drawn) — `Invited by` · `Mira Voss`;
   · approved request — `Your request` · `Approved`;
   · open chat — `Who can join` · `Anyone`.
   Everything else on the sheet is identical across the three.

   `ChatSignSheet`'S SHAPE, BECAUSE IT IS THE SAME SIZE OF ACT. A message's seal
   is a sheet over the thread, not a page, because one record signed over the
   surface the reader is already looking at comes up and goes back down; a join
   is exactly that. So: the title and the seal's "?", the acts card — `Joining`
   · the chat · `1 thing, signed` — the facts, one quiet line, and the act at
   the foot in words.

   1 THING, SIGNED. The Participant alone: joining is no proposal and passes
   no gate of its own — an open chat recognises it as-is, and in a gated chat
   the backing was the invitation or the approval that already stands (§4,
   *Backing*). Nobody else signs anything for the reader to join.

   `Your opinion` IS THE JOIN'S OWN STANCE. A Participant carries a real stance
   toward the chat, defaulted low like every normal act (invitations.md §3,
   `(+0.1, +0.1)`), read through `OwnStanceReadout` exactly as the message's
   seal reads the message's. It reads; it does not edit — `ChatSignSheet`'s
   open question, carried.

   THE ONE LINE says the two things a joiner cannot guess: the membership is
   public, and joining starts a new key for the chat (every join rotates it,
   chats.md §7), so what was encrypted before the reader arrived stays closed
   to them.

   THE SURFACE BENEATH IS THE INVITED THREAD, whole and inert — the route the
   board draws. */
export function Screen() {
  return (
    <>
      <ChatThreadInvitedBody />
      <BottomSheet open ariaLabel="What you sign" maxHeight="88%">
        <SheetTitle trailing={<HelpDot ariaLabel="How signing works" />}>What you sign</SheetTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "0 24px 24px" }}>
          <ActsCard rows={[{ label: "Joining", value: "Night fishing crew", count: "1", countNoun: "join" }]} total="1 thing, signed" />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <FactRow label="Invited by" value="Mira Voss" />
            <FactRow label="Your opinion" value={<OwnStanceReadout pDirected={0.1} />} last />
          </div>
          <QuietNote>Joining is public — your name joins the member list. Encrypted messages sent before you join stay closed to you.</QuietNote>
          <Button style={{ width: "100%" }}>Sign and join</Button>
        </div>
      </BottomSheet>
    </>
  );
}
