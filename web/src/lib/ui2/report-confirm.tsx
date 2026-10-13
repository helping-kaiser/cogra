"use client";

// REPORT, CONFIRMED BEFORE IT GOES (design/designs/canonical/screens/
// ReportConfirm.jsx; ruling 75). What a menu's tail row opens: one sheet naming
// the thing, one body line saying what happens, and the pair Report / Cancel.
//
// A SHEET, NOT A THINK-TWICE DIALOG. Reporting destroys nothing, so it takes the
// sheet's grammar: the menu closes and this rises in its place, the scrim, the
// swipe, Back and Escape drop it with nothing sent, `Report` is the filled
// commit and `Cancel` the quiet way out — the inverse of `RemoveConfirm`'s pair,
// because a removal destroys and a report does not.
//
// IT NEVER CONNECTS TO REPORT-A-PROBLEM: reporting content must not read as
// reporting the app, so nothing here names or opens it.

import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { BottomSheet } from "./bottom-sheet";
import { PillButton } from "./pill-button";

/** The body line, verbatim from the board. */
export const REPORT_BODY = "It goes to the people who run CoGra for a look.";

export function ReportConfirm({
  open,
  onClose,
  onReport,
  sending,
  title = "Report this post?",
  node,
  testId,
}: {
  open: boolean;
  /** Cancel, the scrim, the swipe, Back and Escape: nothing is sent. */
  onClose: () => void;
  /** The commit. */
  onReport: () => void;
  /** A report is in flight: the commit stands down so one tap sends one mail. */
  sending: boolean;
  /** The heading names the thing (ReportConfirm.md:5). */
  title?: string;
  /** The registered sheet (`postDetail.reportSheet`); its parts follow. */
  node?: DataNode;
  testId: string;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title} testId={testId} node={node}>
      <p
        className="m-0 pb-2 text-body-medium text-on-surface-variant"
        {...testAttributes(part(node, "body"), `${testId}-text`)}
      >
        {REPORT_BODY}
      </p>
      <div className="flex justify-end gap-2 pt-2">
        <PillButton
          testId={`${testId}-cancel`}
          node={part(node, "cancel")}
          variant="text"
          onClick={onClose}
        >
          Cancel
        </PillButton>
        <PillButton
          testId={`${testId}-report`}
          node={part(node, "report")}
          disabled={sending}
          onClick={onReport}
        >
          Report
        </PillButton>
      </div>
    </BottomSheet>
  );
}
