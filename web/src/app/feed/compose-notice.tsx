"use client";

// ComposeExpired — what the feed says about the post that did not land.
//
// The board is a FEED screen with a card at the top, and that is the right
// shape for THIS outcome: there is no post to look at, so the reader's next
// move is reading someone else's. A post that DID land is a different board
// entirely — the post's own page — and it lives there, not here.
//
// The wizard hands the outcome over in the URL so a reload cannot resurrect a
// stale notice. The expiry wording is a promise the wizard has to have kept
// before this renders: "Nothing was spent — your draft is saved" is only true
// because the draft was written back before the redirect.

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button, buttonClassName } from "@/lib/ui/button";
import { Icon } from "@/lib/ui/icons";
import { composeDraftStore, draftSummary, type ComposeDraftStore } from "@/lib/compose/draft-store";

export type ComposeOutcome = "expired";

/** The one query value this reads; anything else is not a notice. */
export function composeOutcomeOf(value: string | null): ComposeOutcome | null {
  return value === "expired" ? value : null;
}

export function ComposeNotice({
  onDismiss,
  drafts = composeDraftStore,
}: {
  onDismiss: () => void;
  drafts?: ComposeDraftStore;
}) {
  // Named from the draft that is still on the device, so the notice says which
  // post did not land rather than "a post".
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void drafts.load().then((draft) => {
      if (!cancelled && draft !== null) setName(draftSummary(draft).title);
    });
    return () => {
      cancelled = true;
    };
  }, [drafts]);

  // `TaskCard` (the system speaking, so it wears the task ring and the mark),
  // on the feed card's ground: it says how things stand rather than asking
  // a step the reader owes, so not the notice's olive.
  return (
    <section data-testid="compose-expired" className="cg-task-ring flex flex-col gap-3 rounded-medium p-4 text-on-surface">
      <div className="flex items-start justify-between gap-3">
        <h2 className="m-0 text-title-medium">Your post didn&apos;t land</h2>
        <span className="flex-none text-primary">
          <Icon name="mark" size={20} pickColor="var(--primary-container)" />
        </span>
      </div>
      <p className="m-0 text-body-medium text-on-surface-variant">
        {name === null ? "It" : `"${name}"`} couldn&apos;t finish settling. Nothing was spent —
        your draft is saved.
      </p>
      <div className="flex justify-end gap-2">
        <Button testId="compose-expired-dismiss" variant="text" size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
        <Link
          href="/compose"
          data-testid="compose-expired-open"
          className={buttonClassName({ size: "sm" })}
        >
          Open the draft
        </Link>
      </div>
    </section>
  );
}
