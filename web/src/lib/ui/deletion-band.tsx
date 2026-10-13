"use client";

// THE DELETION BAND (design/components/navigation/DeletionBand.jsx; its prompt
// and FeedDeleting.md). A confirmed deletion runs at a deadline and can be
// canceled until then, and this band carries that fact on every logged-in
// surface: the when, and the way back.
//
// A SIBLING OF `BorrowedViewBand`, NOT THE SAME BAND: it is filled with the
// shell's own chrome (`surface-bar`, which is `surface-container`) and its line
// is `on-surface`, where the borrowed band is bare and secondary. Never
// `--error` — the reader asked for this, and it is proceeding as asked.
//
// The line is the caller's (`bandLine`), so the forward ladder's count is
// composed once, beside the other deletion words.

import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { InlineAction } from "@/lib/ui2/inline-action";

export function DeletionBand({
  line,
  onCancel,
  busy = false,
  node,
  testId = "deletion-band",
}: {
  line: string;
  onCancel: () => void;
  busy?: boolean;
  /** The registered band (`feed.deletionBand`, `settings.deletionBand`); its parts are `line` and `cancel`. */
  node?: DataNode;
  testId?: string;
}) {
  return (
    <div
      {...testAttributes(node, testId)}
      className="flex items-center gap-2 border-b border-outline-variant bg-surface-container px-6 py-2"
    >
      <span
        {...testAttributes(part(node, "line"), `${testId}-line`)}
        className="flex-1 text-body-small text-on-surface"
      >
        {line}
      </span>
      <span className="flex flex-none items-center">
        <InlineAction size="sm" onClick={onCancel} busy={busy} node={part(node, "cancel")} testId={`${testId}-cancel`}>
          Cancel
        </InlineAction>
      </span>
    </div>
  );
}
