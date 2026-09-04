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

   `disabled` IS THE UPLOAD'S GATE, not a validation state. Nothing signs until
   the content it signs exists, so the seal that is still uploading wears it
   and the words above the pair say why. A disabled button with no line
   explaining it is the one shape this must never take. */

export function SealFooter({ signLabel, backLabel = "Back", disabled = false, onSign, onBack }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <Button disabled={disabled} onClick={onSign} style={{ width: "100%" }}>
        {signLabel}
      </Button>
      <Button variant="text" onClick={onBack} style={{ width: "100%" }}>
        {backLabel}
      </Button>
    </div>
  );
}
