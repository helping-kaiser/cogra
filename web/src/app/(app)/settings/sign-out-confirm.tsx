"use client";

// SIGN OUT WITHOUT A BACKUP? (design/designs/canonical/screens/
// SignOutConfirm.jsx; behavior/SignOutConfirm.md). Raised only when the
// don't-remember switch is on and this browser holds the only copy of an
// unbacked key: before anything is cleared, the reader is asked.
//
// `Make a recovery code` is the filled answer and leads; `Erase them and sign
// out` is quiet. THE THIRD ANSWER IS HELD — `Sign out, keep them locked`
// (`settings.dialog.lock`) needs the device lock the sign-out custody packet
// builds (the key sealed behind an online re-authentication); shipping its
// label before the lock exists would promise something nothing keeps.
//
// The scrim and system Back close it, still signed in, with focus back on
// the Sign out row (the caller's).

import { buttonClassName } from "@/lib/ui/button";
import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { DialogSurface } from "@/lib/ui2/dialog-surface";

const DIALOG: DataNode = { path: "settings.dialog" };

export function SignOutConfirm({
  onMakeCode,
  onErase,
  onDismiss,
}: {
  onMakeCode: () => void;
  onErase: () => void;
  onDismiss: () => void;
}) {
  return (
    <DialogSurface
      title="Sign out without a backup?"
      body={[
        "This browser holds the only copy of your key. Signing out leaves your key, your draft and any opinions you kept pending here, locked until you sign in again. Erase them instead, and no one — including CoGra — can bring them back.",
      ]}
      onDismiss={onDismiss}
      node={DIALOG}
      actions={
        <>
          <button
            type="button"
            onClick={onMakeCode}
            className={buttonClassName({ variant: "primary" })}
            {...testAttributes(part(DIALOG, "recovery"))}
          >
            Make a recovery code
          </button>
          <button
            type="button"
            onClick={onErase}
            className={buttonClassName({ variant: "text" })}
            {...testAttributes(part(DIALOG, "erase"))}
          >
            Erase them and sign out
          </button>
        </>
      }
    />
  );
}
