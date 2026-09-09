import React from "react";
import { Button } from "../core/Button.jsx";

/* The foot of a wizard step whose CONTENT RUNS EDGE TO EDGE (jakob's ruling R9,
   the slice-2.5 round): the pick step and its states — the device gallery, the
   staged clip, the picked set, the refused batch.

   IT OWNS THE SIDE PADDING BECAUSE NOTHING ABOVE IT DOES. A step drawn as a
   padded column hands its footer the margins for free, and the Next button just
   sits in the column — that is the other nine wizard steps, and they are not
   this. A step whose grid and tray band reach both edges has no column to
   inherit from, so the 24px sides live HERE, in the one region that must not
   touch the edge. The vertical pair is its own: 12 above, 16 below, the button
   held off the screen's bottom lip.

   NOT THE SEAL'S FOOT AND NOT A SHEET'S ACTION ROW. `SealFooter` deliberately
   owns no padding — it is dropped into a padded column and would double the
   margins if it carried its own. A sheet's Done row (`ComposeLicense`) is a
   hairline, a summary line and a button sharing a row inside the sheet's own
   inset. Three feet, three anatomies; the padding is what tells them apart. */

export function WizardFooter({ label = "Next", onNext }) {
  return (
    <div style={{ padding: "12px 24px 16px" }}>
      <Button onClick={onNext} style={{ width: "100%" }}>
        {label}
      </Button>
    </div>
  );
}
