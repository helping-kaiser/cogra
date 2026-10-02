import React from "react";
import { Button } from "../core/Button.jsx";

/* The seal's foot (item 17, the conformance round, jakob's ruling G): the pair
   of full-width buttons that ends every signing surface in the system — the
   post's seal, the reply's, the profile picture's, the profile's, the payout
   address's, the wallet change's.

   THE PAIR IS THE GRAMMAR OF A SEAL. Commit is filled and first; the way back
   is the text button under it, full width so the two read as one block rather
   than a button with a link stuck beneath. Back goes UP one stage — it is the
   header arrow said again at the bottom, where the thumb is — and it never
   leaves the flow. Leaving is the header's X, and that separation is the whole
   reason the seal can afford a Back at all.

   ONLY THE VERB CHANGES. "Sign and publish", "Sign the change", "Sign
   comment" — the label names what is being signed, because a seal that says
   only "Sign" makes the author scroll up to find out what for. Back is the
   same word on all six, and takes no argument.

   THE UPLOAD'S GATE LEAVES THE COMMIT ENABLED (jakob 2026-10-02, the fix-fix
   round's 20). Nothing signs until the content it signs exists, and the line
   above the pair says so; a press while it shows is the signing in flight
   below — inert from the press, `busy` past 200ms, the label swapped in
   place — and signing proceeds the moment the bytes land, no second press. `disabled` is only the failed upload's: with nothing left to
   wait for, the commit stops until Retry, and the line above says why. A
   disabled button with no line explaining it is the one shape this must
   never take.

   `busy` IS THE SIGNING IN FLIGHT (jakob, the failure pack). The commit is
   the one control a slow answer leaves pressable twice, so it goes inert and
   its label reads `busyLabel` — the verb's present participle, "Signing and
   publishing…" — through `Button`'s own `busy`. The ways out lock with it
   for the swap's duration (jakob 2026-10-01): this foot's Back and the
   header's back arrow and X refuse a press, because leaving mid-sign would
   orphan the outcome. Everything above the foot stays as it was and
   readable: the fault, if one comes, takes the commit's place
   (`NetworkError`), and a success leaves the seal. */

export function SealFooter({ signLabel, busyLabel, backLabel = "Back", disabled = false, busy = false, onSign, onBack }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <Button disabled={disabled} busy={busy} busyLabel={busyLabel} onClick={onSign} style={{ width: "100%" }}>
        {signLabel}
      </Button>
      <Button variant="text" onClick={onBack} style={{ width: "100%" }}>
        {backLabel}
      </Button>
    </div>
  );
}
