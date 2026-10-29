"use client";

// THE WRITE RULE'S NOTICE AT THE PAD'S SCALE (PadWriteRule.md; the master's
// `NoticePanel` in `StanceControl.jsx` and `StanceAlternates.jsx`): where the
// landing line and the commit row stood, the tertiary panel says the signing
// cannot go through right now and that nothing was signed or spent, with its
// own "?" — the seal panel's dialog, by the stopper exception. A notice, not a
// fault: never the error colour, and no Retry, because asking again at once
// meets the same answer. The pad and the alternates draw the same panel, so it
// lives here once.

import { WRITE_RULE_WORDS } from "@/lib/ui/stance-readout";
import { HelpDot } from "@/lib/ui2/help-dot";

export function WriteRuleNotice({ testId, onHelp }: { testId: string; onHelp: () => void }) {
  return (
    <div
      data-testid={testId}
      role="status"
      className="flex flex-col gap-3 rounded-medium bg-tertiary-container p-4 text-on-tertiary-container"
    >
      <div className="flex items-center gap-2">
        <h3 className="m-0 flex-1 text-title-medium">{WRITE_RULE_WORDS.title}</h3>
        <HelpDot ariaLabel={WRITE_RULE_WORDS.help} onOpen={onHelp} testId={`${testId}-help`} variant="inverse" />
      </div>
      <p className="m-0 text-body-medium">{WRITE_RULE_WORDS.padFact}</p>
    </div>
  );
}
