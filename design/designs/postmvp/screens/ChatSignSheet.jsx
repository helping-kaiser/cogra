/* WHAT YOU SIGN, FOR ONE MESSAGE — press and hold the send arrow (would-like
   #3; jakob 2026-09-23: the signing ceremony compresses into the send act, and
   the long-press opens it back up).

   THE SEAL'S VOCABULARY, AT MESSAGE SCALE. `ComposeSealBody`'s parts in its
   order: the acts card first — one Send, one message, `1 thing, signed` — then
   the fact rows a reader checks before putting their name to it, then the one
   committing act. The facts are the record's own shape (chats.md §3): where
   the message goes, whether its body rides encrypted, the license every
   content flow declares, and the low-default opinion it carries, which follows
   the post's own rule (post.md §1 — the frontend defaults it to +0.1) and
   reads through `OwnStanceReadout` exactly as the post seal's does.

   IT IS A SHEET, NOT A PAGE. The post's seal is a place because a post is
   built in stages and the seal is the last one; a message is one line already
   written in a thread the reader is still looking at, so its seal comes up
   over the thread and goes back down. `Sign and send` at the foot is the arrow
   said in words — sending from here is the same act as a tap on the arrow.

   IT READS; IT DOES NOT EDIT. The post seal's facts carry `Change` and
   `Adjust`; these carry nothing, because the lock toggle beside the field is
   the message's one per-message choice (jakob) and the license is the
   account's default. Whether a reader may retune one message's license or
   opinion from here is left open (flagged in the round's report).

   ONE MARKUP, TWO PAINTINGS (the geek-mode round). The opinion row is the one
   pair-shaped fact, and `OwnStanceReadout` already draws the face AND the
   exact value in a `cg-exact` span, with a spoken twin — so the board draws
   once and the reading mode decides whether the digits paint. Every other
   fact is words in both modes. No second board.

   THE "?" IS THE SEAL'S OWN, `How signing works` (copy-voice, *The "?"
   dialogs*): what signing is does not change with what is signed. */
export function Screen() {
  return (
    <>
      <ChatThreadBody />
      <BottomSheet open ariaLabel="What you sign" maxHeight="88%">
        <SheetTitle trailing={<HelpDot ariaLabel="How signing works" />}>What you sign</SheetTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "0 24px 24px" }}>
          <ActsCard rows={[{ label: "Message", value: "Bringing a flask.", count: "1", countNoun: "message" }]} total="1 thing, signed" />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <FactRow label="Into" value="Coast walkers" />
            <FactRow label="Encrypted" value="No — anyone can read it" />
            <FactRow label="License" value="Public domain — your default" />
            <FactRow label="Your opinion" value={<OwnStanceReadout pDirected={0.1} />} last />
          </div>
          <Button style={{ width: "100%" }}>Sign and send</Button>
        </div>
      </BottomSheet>
    </>
  );
}
