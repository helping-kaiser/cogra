"use client";

// DELETE ACCOUNT · DURING THE GRACE (design/designs/canonical/screens/
// DeleteAccountPending.jsx; DeleteAccountPending.md). What the settings row
// opens once the deletion is confirmed: the deadline in full and `Cancel`, the
// band's word for the same act, done here on purpose.
//
// THE BAND STEPS ASIDE ON THIS ONE PAGE (`:9`) — the page itself is the
// deletion's, and a band above it would say the paragraph twice. CANCELLING
// ASKS NOTHING: settings returns with the band gone, the row back to `Delete
// account` and the canceled snackbar, never with Undo (`:11`). Offline, the
// network error answers and the deletion stands (`:13`).

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { DeletionCommit } from "@/lib/deletion/deletion-commit";
import { NO_ANSWER, pendingBody } from "@/lib/deletion/deletion-copy";
import { useAccountDeletion } from "@/lib/deletion/deletion-status";
import { part, type DataNode } from "@/lib/ui/data-node";
import { useSlowAnswer } from "@/lib/ui2/waiting-commit";

import { NOT_THROUGH, TaskPage } from "../../task-page";

const NODE: DataNode = { path: "deleteAccount" };

export function DeleteAccountPendingView() {
  const router = useRouter();
  const status = useAccountDeletion();
  const refresh = status.refresh;
  const [canceling, setCanceling] = useState(false);
  const [fault, setFault] = useState<string | null>(null);
  const slow = useSlowAnswer(canceling);
  /** Set once this page's own Cancel landed, so the empty standing it leaves is not read as "nothing to show". */
  const [canceled, setCanceled] = useState(false);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const standing = status.standing;
  const grace = standing?.deletion ?? null;

  // Nothing stands — canceled elsewhere, or never confirmed: settings says where it is.
  // This page's own Cancel empties the standing while it is still in flight,
  // so neither that moment nor the one after it reads as "nothing stands".
  useEffect(() => {
    if (standing !== null && grace === null && !canceling && !canceled) router.replace("/settings");
  }, [standing, grace, canceling, canceled, router]);

  const onCancel = async () => {
    if (canceling) return;
    setCanceling(true);
    setFault(null);
    const outcome = await status.cancel();
    setCanceling(false);
    if (outcome.kind === "success") {
      setCanceled(true);
      router.push("/settings?done=deletionCanceled");
      return;
    }
    setFault(outcome.kind === "failed" ? NO_ANSWER : NOT_THROUGH);
  };

  return (
    <TaskPage
      node={NODE}
      backHref="/settings"
      backLabel="Back to settings"
      title="Delete account"
      lead={grace === null ? undefined : pendingBody(grace, status.now)}
      deletionBand={false}
    >
      {grace !== null && (
        <DeletionCommit
          label="Cancel"
          busyLabel={slow ? "Canceling…" : undefined}
          busy={canceling}
          fault={fault}
          onCommit={() => void onCancel()}
          node={part(NODE, "cancel")}
        />
      )}
    </TaskPage>
  );
}
