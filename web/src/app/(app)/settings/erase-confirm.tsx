"use client";

// ERASE EVERYTHING FROM THIS BROWSER? (design/designs/canonical/screens/
// EraseConfirm.jsx; behavior/EraseConfirm.md). The think-twice dialog in
// front of the wipe: the Clearing data group's one row raises it, and nothing
// is erased before an answer.
//
// DRAWN ONCE PER BACKUP STATE, because the safe answer differs (`:11`, `:13`):
// with no recovery code `Make a recovery code` leads, filled, and the erase is
// the quiet answer; with one made, the destructive dialog's own shape — the
// erase quiet on the left, `Cancel` filled on the right. The erase never takes
// the error colour (`:15`). The scrim, Escape and system Back take the safe
// answer in both: the dialog closes and nothing is erased.

import { buttonClassName } from "@/lib/ui/button";
import { instance, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { DialogSurface } from "@/lib/ui2/dialog-surface";

const DIALOG: DataNode = { path: "settings.dialog" };

export const ERASE_TITLE = "Erase everything from this browser?";

/** EraseConfirm.md:5 and :7 — the key and the account gone for good, before anything else. */
export function eraseBody(backupMade: boolean): string {
  return backupMade
    ? "Your key is erased with everything else, and only your recovery code can bring it back — without the code, your account is gone for good. Your draft, any kept picks and the choices kept on this device go too, and you're signed out. What you've seen comes back when you sign in."
    : "This browser holds the only copy of your key, and it has no recovery code. Erase everything and your account is gone for good — no one, including CoGra, can bring it back. Your draft, any kept picks and the choices kept on this device go too, and you're signed out.";
}

export function EraseConfirm({
  backupMade,
  onMakeCode,
  onErase,
  onDismiss,
}: {
  backupMade: boolean;
  onMakeCode: () => void;
  onErase: () => void;
  onDismiss: () => void;
}) {
  // Each answer sits in its chip's copy, keyed by the chip's value (nodes.json EraseConfirm).
  const chip = backupMade ? "made" : "none";
  const erase = (
    <button
      type="button"
      onClick={onErase}
      className={buttonClassName({ variant: "text" })}
      {...testAttributes(instance(DIALOG, "erase", chip))}
    >
      Erase everything and sign out
    </button>
  );
  return (
    <DialogSurface
      title={ERASE_TITLE}
      body={[eraseBody(backupMade)]}
      onDismiss={onDismiss}
      node={DIALOG}
      actions={
        backupMade ? (
          <>
            {erase}
            <button
              type="button"
              onClick={onDismiss}
              className={buttonClassName({ variant: "primary" })}
              {...testAttributes(instance(DIALOG, "cancel", chip))}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onMakeCode}
              className={buttonClassName({ variant: "primary" })}
              {...testAttributes(instance(DIALOG, "recovery", chip))}
            >
              Make a recovery code
            </button>
            {erase}
          </>
        )
      }
    />
  );
}
