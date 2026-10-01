/* THE SEAL, SIGNING SLOWLY (jakob 2026-10-01, backlog item 117) — a reference
   plate beside `SealSigning`: the same moment, five seconds on, so it is drawn
   and wired nowhere. The seal's controls are `ComposeSeal`'s.

   A LABEL SWAP HAS NO PROGRESS TO SHOW. The loading law asks for determinate
   progress once a wait passes 5s, and a signing cannot measure its own steps
   (readme §4, *Loading*, names it the law's second exception): prepare, the device signature, the submit and the approval answer
   when they answer. So nothing pretends to — no bar, no percentage, no named
   steps. What changes is one line: the acts card's subline under the total
   swaps to `Still signing — the network is slow right now.`, in the olive
   `--tertiary` ink of the notice family (`ActsCard`'s `noteTone="slow"`), and
   is spoken once as a status. The words are a draft flagged for blessing
   (copy-voice, *Faults by code*).

   THE REST IS `SealSigning` UNCHANGED. The commit still reads `Signing and
   publishing…` and refuses a second press; the ways out stay locked for the
   swap's duration, and the fact rows stay readable. The outcome lands as it
   does there: in the commit's place, or by leaving the seal. */
export function Screen() {
  return <ComposeSealBody state="slow" />;
}
