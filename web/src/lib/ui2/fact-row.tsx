// THE FACT ROW, the seal's emphasis (design/components/core/FactRow.jsx): one
// hairline line reading label · value, with an optional action at its end.
// The label at body-medium takes the row, the value goes quiet in the
// secondary ink, and the rules ENCLOSE — a hairline above every row and one
// under the last — so the block reads as a bounded list on the page's ground.
//
// THE ROW HOLDS ONE LINE, which is why a worded action is an `InlineAction`
// and never a pill: the pill's 64px minimum is exactly what wraps a row ruled
// to stay on one. An action given as a node — the edit's license lock — is
// drawn as handed.
//
// The seal and the two edits (EditCompose, CommentEdit) draw the same row, so
// it lives here once rather than as a private copy per surface.

import type { ReactNode } from "react";

import { InlineAction } from "./inline-action";

export function FactRow({
  label,
  value,
  action,
  onAction,
  testId,
  last = false,
}: {
  label: string;
  /** A string takes the row's quiet voice; a node (a stance readout) draws its own line. */
  value: ReactNode;
  /** A word drawn as the row's `InlineAction`, or a node drawn as handed. */
  action?: ReactNode;
  onAction?: () => void;
  /** Names the worded action. */
  testId?: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex min-h-11 items-center gap-2 border-0 border-t border-solid border-outline-variant ${
        last ? "border-b" : ""
      }`}
    >
      <span className="flex-1 whitespace-nowrap text-body-medium">{label}</span>
      {typeof value === "string" ? (
        <span className="text-body-medium text-on-surface-variant">{value}</span>
      ) : (
        value
      )}
      {typeof action === "string" ? (
        <InlineAction testId={testId} onClick={onAction}>
          {action}
        </InlineAction>
      ) : (
        action
      )}
    </div>
  );
}
