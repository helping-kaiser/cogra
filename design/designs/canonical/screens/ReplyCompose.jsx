/* THE REPLY WIZARD'S FIRST STAGE (legacy conversion, lane C): the words, and
   nothing else yet. It is `ReplyPictures` before anything was attached — same
   quoted row, same body mid-sentence, same foot — so the two are one composer
   at two moments and read from one set of masters.

   THE X DISCARDS HERE. A reply keeps no draft, so leaving it loses the words:
   `WizardHeader`'s `leaveLabel` says so, and a non-empty composer asks first
   through `DiscardConfirm` (graph.json, via 2) — which is why the composer
   itself is `_shared.jsx`'s `ReplyDraft`, drawn once for both boards.

   THE ADD IS A BARE WORD, not the small text pill its picture-bearing siblings
   wear. Preserved as the hand board drew it; which of the two voices the
   composer's "+ Add" speaks in is a drawing question the round leaves open. */
export function Screen() {
  return <ReplyDraft />;
}
