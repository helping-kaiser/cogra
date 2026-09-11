// The 2.0 page header — the band every wizard screen wears (ComposePick,
// ComposeCrop, ComposeDetails, ComposeSeal).
//
// It owns its band: 48px tall, its own 12px side padding, and a 48px SQUARE
// back target. The 1.0 header grew a 24px glyph to a 44px target with a
// negative margin, which was under the 48px minimum and bet on the caller
// supplying 24px of gutter — inside a surface with none, the target bled off
// the edge and was clipped. Owning the padding is what fixes that for every
// caller at once.
//
// The title is `title-large` at weight 400. The help slot takes AT MOST ONE
// `?` per screen (the copy rule of design/readme.md §13), top-right.
//
// THE TRAILING SLOT IS FOR PASSIVE INFORMATION — a stage label — and never for
// the screen's forward action (jakob 2026-09-01). Next sits at the bottom of
// the content column on every stage, so the top-right corner keeps one meaning
// the whole way through a flow.

import type { ReactNode } from "react";

import { Icon } from "@/lib/ui/icons";

// TWO WAYS OUT, each doing one thing (jakob, round 4): the ARROW steps ONE
// STAGE BACK and never leaves the flow, and the X LEAVES the whole flow from any
// stage — draft kept, no confirmation, because nothing is lost and the draft
// prompt is the return surface. Without the X an author five stages deep was
// stuck backing out tap by tap.
export function HeaderBar({
  title,
  onBack,
  backLabel = "Back",
  onLeave,
  leaveLabel = "Leave — your draft is kept",
  action,
  help,
  testId,
}: {
  title: string;
  // A screen with no way back — the recovery-code trap — simply passes none,
  // and the slot collapses rather than rendering a dead control.
  onBack?: () => void;
  backLabel?: string;
  onLeave?: () => void;
  leaveLabel?: string;
  action?: ReactNode;
  help?: ReactNode;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      className="flex min-h-12 flex-none items-center gap-1 px-3"
    >
      {onBack && (
        <button
          type="button"
          data-testid="header-back"
          aria-label={backLabel}
          onClick={onBack}
          className="cg-state cg-focus flex size-12 flex-none items-center justify-center rounded-full text-on-surface-variant"
        >
          <Icon name="arrow_back" />
        </button>
      )}
      <h1 className="m-0 min-w-0 truncate text-title-large">{title}</h1>
      <span className="flex-1" />
      {onLeave && (
        <button
          type="button"
          data-testid="header-leave"
          aria-label={leaveLabel}
          onClick={onLeave}
          className="cg-state cg-focus flex size-12 flex-none items-center justify-center rounded-full text-on-surface-variant"
        >
          <Icon name="close" />
        </button>
      )}
      {help}
      {action}
    </div>
  );
}

// The one `?` a screen may carry. A circled glyph rather than the word, and it
// opens a plain dialog elsewhere — this atom is only the opener.
export function HelpButton({
  onOpen,
  label = "About this step",
  testId = "header-help",
}: {
  onOpen: () => void;
  label?: string;
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={label}
      onClick={onOpen}
      className="cg-state cg-focus flex size-12 flex-none items-center justify-center rounded-full text-on-surface-variant"
    >
      <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" aria-hidden="true">
        <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26A1.96 1.96 0 0014 9a2 2 0 10-4 0H8a4 4 0 118 0c0 .88-.36 1.68-.93 2.25z" />
      </svg>
    </button>
  );
}
