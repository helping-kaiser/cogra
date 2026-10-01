/* THE SEAL, SIGNING (the failure pack, jakob 2026-09-30) — a reference plate:
   one moment of `ComposeSeal` that no tap can hold still, so it is drawn and
   wired nowhere. The seal's controls are `ComposeSeal`'s.

   THE LABEL SAYS WHAT IS HAPPENING. Sign and publish is prepare, a device
   signature, a submit and an approval — seconds, not a blink. Past 200ms
   without an answer the commit reads its present participle, `Signing and
   publishing…`: the verb takes -ing, the rest of the label stays, and `…`
   closes it, the ellipsis copy-voice already reserves for work in progress.

   INERT, NOT DIMMED, AND NO SPINNER. The button is still the one committing
   action on the surface; 40% opacity would say it cannot be pressed for a
   reason the reader has to go and find, and a spinner would break the house
   law that a wait is shown in words. It refuses a second press from the first
   one — that part shows nothing, and needs nothing shown.

   EVERYTHING ELSE IS THE SEAL AS IT WAS. The outcome lands in the commit's
   place or leaves the seal: signed, it exits to the post; offline, the fault
   stands where the button is (`NetworkError`); refused, the row or the notice
   says so (`SealFaultRow`, `SealFaultBug`, `WriteRuleFailed`). */
export function Screen() {
  return <ComposeSealBody state="signing" />;
}
