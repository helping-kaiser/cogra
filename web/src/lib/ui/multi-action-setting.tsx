"use client";

// The way back to the confirmation a reader switched off from inside the
// dialog (F4). A checkbox, because it is one thing that is either on or
// off — the semantics carry the keyboard behaviour and the accessible
// name for free.

import { useConfirmMultiAction } from "@/lib/signing/confirm-multi-action";
import { Card } from "@/lib/ui/card";

export function MultiActionConfirmSetting() {
  const [enabled, setEnabled] = useConfirmMultiAction();
  return (
    <Card testId="settings_multi_action_card">
      <h2 className="text-title-medium">Signing</h2>
      <label className="flex items-start gap-3 text-body-medium">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
          data-testid="settings_confirm_multi_action"
          className="mt-1 accent-primary"
        />
        <span className="flex flex-col">
          <span className="text-label-large">Confirm multi-action submits</span>
          <span className="text-body-small text-on-surface-variant">
            Ask first when one submit signs more than one action — each is paid for separately.
          </span>
        </span>
      </label>
    </Card>
  );
}
