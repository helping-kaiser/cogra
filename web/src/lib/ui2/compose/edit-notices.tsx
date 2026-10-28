// The two notices an edit's signing can come back with in the commit's place
// (copy-voice, *Faults by code*; EditCompose.md, CommentEdit.md,
// CommentEditVideo.md). Neither is the failure voice: the reader did nothing
// wrong and nothing was spent, so both stand on the tertiary panel.
//
// AN EDIT KEEPS NO DRAFT, so the write rule's fact ends on what IS true here —
// `your edit is still here.` — and its way out is `Not now`, back to the edit
// with the batch as it was; never a kept draft, never Retry (blessed, jakob
// 2026-10-05 for the comment edit, 2026-10-16 for the post edit).

import { PillButton } from "@/lib/ui2/pill-button";
import { NoticeLine, NoticePanel } from "@/lib/ui2/notice-panel";

export const EDIT_WRITE_RULE_TITLE = "You can't sign right now";
export const EDIT_WRITE_RULE_FACT =
  "Each signing is paid for, and there's only so much to go around at a time. Nothing was signed or spent — your edit is still here.";
export const EDIT_BUG_TITLE = "This shouldn't have happened";
export const EDIT_BUG_FACT =
  "That's a fault on our side, not yours. Nothing was signed or spent, and telling us helps us fix it.";

/** `WRITE_RULE_FAILED` at an edit: the notice, its "?", and `Not now`. */
export function EditWriteRuleNotice({
  onHelp,
  onNotNow,
  testIdPrefix,
}: {
  /** Opens `Why signing waits`, the edit's own clause. */
  onHelp: () => void;
  /** The notice goes and the edit stands again with the changes as they were. */
  onNotNow: () => void;
  testIdPrefix: string;
}) {
  return (
    <>
      <NoticePanel
        title={EDIT_WRITE_RULE_TITLE}
        help={{ label: "Why signing waits", onOpen: onHelp, testId: `${testIdPrefix}-write-rule-help` }}
        testId={`${testIdPrefix}-write-rule`}
      >
        <NoticeLine>{EDIT_WRITE_RULE_FACT}</NoticeLine>
      </NoticePanel>
      <PillButton testId={`${testIdPrefix}-not-now`} variant="text" full onClick={onNotNow}>
        Not now
      </PillButton>
    </>
  );
}

/**
 * Any other refusal of a staged act — a bug the picking stage should have
 * blocked: the notice in the bug's own words, `Try again` in the panel, and
 * `Report a problem` and `Discard the edit` under it (CommentEdit.md).
 */
export function EditBugNotice({
  onTryAgain,
  onReport,
  onDiscard,
  testIdPrefix,
}: {
  onTryAgain: () => void;
  onReport: () => void;
  /** Asks first: `Discard the changes?` (DiscardConfirm). */
  onDiscard: () => void;
  testIdPrefix: string;
}) {
  return (
    <>
      <NoticePanel title={EDIT_BUG_TITLE} testId={`${testIdPrefix}-bug`}>
        <NoticeLine>{EDIT_BUG_FACT}</NoticeLine>
        <PillButton testId={`${testIdPrefix}-try-again`} variant="inverse" full onClick={onTryAgain}>
          Try again
        </PillButton>
      </NoticePanel>
      <div className="flex flex-col">
        <PillButton testId={`${testIdPrefix}-report`} variant="text" full onClick={onReport}>
          Report a problem
        </PillButton>
        <PillButton testId={`${testIdPrefix}-discard`} variant="text" full onClick={onDiscard}>
          Discard the edit
        </PillButton>
      </div>
    </>
  );
}
