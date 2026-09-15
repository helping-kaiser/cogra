// A list surface with nothing in it yet — the master this carries over
// (design/components/states/EmptyState.jsx), whose own header calls it
// "the stated requirement, built": design.md §6 names DESIGNED, NOT BLANK
// as the rule, and the master exists because the product had shipped bare
// `<p>Nothing here yet.</p>` against it with no shared shape.
//
// A calm statement plus, where there is one, the single action that fills
// it (the master's register rules, §7 and §9): never a scold, never a
// sell, never `error` colouring — an empty list is not a fault. No live
// region: a list that has always been empty has nothing to announce
// arriving (that is `LoadingState`'s job, drawn elsewhere).

import type { ReactNode } from "react";

import { Button } from "@/lib/ui/button";

export function EmptyState({
  title,
  action,
  actionLabel,
  onAction,
  testId,
}: {
  title: string;
  /** A custom action, for a case the two strings below can't express. */
  action?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  testId: string;
}) {
  return (
    <div className="flex flex-col items-start gap-3 py-2" data-testid={testId}>
      <p className="text-body-medium text-on-surface-variant">{title}</p>
      {action ??
        (actionLabel !== undefined && onAction !== undefined ? (
          <Button
            testId={`${testId}-action`}
            variant="outline"
            size="sm"
            selfStart
            onClick={onAction}
          >
            {actionLabel}
          </Button>
        ) : null)}
    </div>
  );
}
