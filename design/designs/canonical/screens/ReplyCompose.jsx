/* THE REPLY WIZARD'S FIRST STAGE (legacy conversion, lane C): the words, and
   nothing else yet. It is `ReplyPictures` before anything was attached — same
   quoted row, same body mid-sentence, same foot — so the two are one composer
   at two moments and read from one set of masters.

   THE X DISCARDS HERE. A reply keeps no draft, so leaving it loses the words:
   `WizardHeader`'s `leaveLabel` says so, and a non-empty composer asks first
   through `DiscardConfirm` (graph.json, via 2).

   THE ADD IS A BARE WORD, not the small text pill its picture-bearing siblings
   wear. Preserved as the hand board drew it; which of the two voices the
   composer's "+ Add" speaks in is a drawing question the round leaves open. */
export function Screen() {
  return (
    <>
      <WizardHeader title="Reply" leaveLabel="Leave — the reply is discarded" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, padding: "8px 24px 24px", overflow: "hidden" }}>
        <QuotedRow
          title="The long way home — @ada"
          snippet="The light does something at the third headland that I have never managed…"
          name="Ada Okonkwo"
          src="ava1.jpg"
        />

        <p style={{ margin: 0, fontSize: "var(--text-body-large)", lineHeight: "var(--text-body-large--line-height)" }}>
          The third headland light is real — I have a print from 2019 that almost catches it. Almost.
          <Caret />
        </p>

        <InlineAction size="sm" selfStart>+ Add pictures or a video</InlineAction>

        <div style={{ flex: 1 }} />

        <QuietNote>Words first — pictures can join them.</QuietNote>
        <Button style={{ width: "100%" }}>Next</Button>
      </div>
    </>
  );
}
