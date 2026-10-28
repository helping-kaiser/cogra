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
import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";

export function EmptyState({
  title,
  action,
  actionLabel,
  onAction,
  testId,
  node,
}: {
  title: string;
  /** A custom action, for a case the two strings below can't express. */
  action?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  testId: string;
  /** The registered empty line (`profile.chronicle.empty`), naming its `title` and its `action`. */
  node?: DataNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 py-2" {...testAttributes(node, testId)}>
      <p className="text-body-medium text-on-surface-variant" {...testAttributes(part(node, "title"))}>
        {title}
      </p>
      {action ??
        (actionLabel !== undefined && onAction !== undefined ? (
          <Button
            testId={`${testId}-action`}
            node={part(node, "action")}
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
