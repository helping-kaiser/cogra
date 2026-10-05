/* THE FAULT IN PLACE (legacy conversion, lane C) — the pattern board for a
   transport failure, drawn where one actually happens: the post's seal, after
   Sign and publish didn't reach anything.

   IT IS `ComposeSeal`, UNSENT — and now literally so: the board is
   `ComposeSealBody` in its `offline` state (the failure pack, 2026-09-30,
   componentized before it was altered). Same header slots, same acts card,
   same three facts, because the whole point of the pattern is that nothing is
   taken away when a send fails. What the author signed is still exactly what
   they read a moment ago, still there to check, and the fault is added at the
   foot rather than replacing the surface with an error screen.

   THE ALERT IS `TransportError`, which is where the system keeps its failure
   voice — the one place `--error` is spent on a line of prose, and the reason
   a fault reads as a fault rather than as a warning-coloured note.

   THE FOOT IS NOT `SealFooter`. That footer's pair is commit-and-go-back, and
   there is nothing to commit until the send works: what stands here instead is
   the retry, outlined because it is not a new commitment, over the same way
   back the seal has.

   THE GRAMMAR, WHOLE (jakob, the failure pack — the seal's faults speak it).
   A fault is said where the thing it is about stands, and the rest of the
   surface stays readable:
   - a fault about the WHOLE SIGNING — no answer, a server fault, a signature
     that did not verify — takes the commit's place, as drawn here, in its
     code's words (copy-voice, *Faults by code*); Retry asks the same thing
     again;
   - a refusal of ONE STAGED ACT has two cases. A cited post that never
     landed is said on that act's row, with Remove it and no Retry, and the
     commit stays, because a refusal stages nothing (`SealFaultRow`). Any
     other is a bug the picker should have blocked, said in the notice panel
     in the commit's place, with Try again (`SealFaultBug`);
   - the WRITE RULE's refusal is not a fault at all: nothing was staged or
     spent, so the commit's place takes the notice panel and the way out keeps
     the draft (`WriteRuleFailed`).
   Off the seal the grammar holds unchanged: a form keeps its fields and its
   submit, and the fault stands in `SignInError`'s slot above the submit —
   `That didn't send. Try again.` — the submit itself being the retry (jakob
   2026-10-05), a pad keeps its pick with the fault above
   its commit row (`PadFailed`), and a hold, which has no surface to re-raise,
   says it on the target's row (`RowSigning`). */
export function Screen() {
  return <ComposeSealBody state="offline" />;
}
