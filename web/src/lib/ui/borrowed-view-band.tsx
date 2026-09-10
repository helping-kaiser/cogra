"use client";

// The borrowed-view band (design/components/navigation/BorrowedViewBand.jsx,
// `design/readme.md` §13; Android's twin in core:designsystem). A feed is
// ranked from the reader's own outgoing stances, and a reader with none is
// served someone else's view — the inviter's for an invite-link arrival, the
// genesis moderator's for a bare one, and still the inviter's through the
// applicant days.
//
// THE BORROWED VIEW IS ALWAYS NAMED, AND THIS BAND IS THE NAMING. It rides the
// collapsing top in place of the guest notice, which it subsumes: it says whose
// view this is and carries the one sign-in-or-join entry. The label is what
// makes borrowed ranking honest (§9), and it exposes nothing the public record
// does not already carry.
//
// A bare line on the shell's own surface, not a card — no fill, no border, no
// elevation — and a TEXT button rather than a filled one: the band names a fact
// and offers a way on, and the loud surface on a read screen belongs to the
// compose action (§2.4). It is not dismissible; the one thing that removes it
// is the reader's own view coming into existence.

import { Button } from "@/lib/ui/button";
import { MonogramAvatar } from "@/lib/ui/actor-chip";

export function BorrowedViewBand({
  handle,
  displayName,
  avatarUrl,
  line,
  actionLabel,
  onAction,
  testId = "borrowed-view",
}: {
  handle: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  /** One of the ruled readings; the caller picks which. */
  line: string;
  /** The one join entry. Omitted for a signed-in applicant. */
  actionLabel?: string;
  onAction?: () => void;
  testId?: string;
}) {
  const name = displayName?.trim() ? displayName : handle;
  return (
    // The master's own box: the screen gutter across, `space-3` below and
    // nothing above, so the band butts against the 48px identity band.
    <div data-testid={testId} className="flex items-center gap-2 px-6 pb-3">
      <MonogramAvatar name={name} src={avatarUrl} />
      <span data-testid={`${testId}-line`} className="flex-1 text-body-small text-on-surface-variant">
        {line}
      </span>
      {actionLabel !== undefined && onAction !== undefined && (
        <span className="flex-none">
          <Button testId={`${testId}-action`} variant="text" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </span>
      )}
    </div>
  );
}

/**
 * The three ruled readings (`design/readme.md` §13). All name the same
 * borrowed vantage and differ in what the reader can do about it: the
 * guest can join, the applicant can only wait, and the landed member can
 * end the borrowing by pointing back.
 */
export const borrowedViewLine = {
  /** A signed-out reader, who can do something about it. */
  join: (handle: string) => `Browsing from @${handle}'s view — join to build your own.`,
  /** A signed-in applicant: the vantage is the same, the action is not theirs. */
  applicant: (handle: string) => `Browsing from @${handle}'s view while your application lands.`,
  /** Landed, not yet pointed back — the act that ends the borrowing. */
  vouchBack: (handle: string) => `Browsing from @${handle}'s view — vouch back to start your own.`,
} as const;

export const SIGN_IN_OR_JOIN = "Sign in or join";
