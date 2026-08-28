"use client";

// ComposeLanded / ComposeExpired — what the feed says about the post the reader
// just tried to publish.
//
// Both boards are FEED screens with a card at the top, not screens of their
// own, and that is the right shape: the wizard is finished either way, and the
// reader's next move is reading. The wizard hands the outcome over in the URL
// so a reload cannot resurrect a stale notice.
//
// The expiry wording is a promise the wizard has to have kept before this
// renders: "Nothing was spent — your draft is saved" is only true because the
// draft was written back before the redirect.

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button, buttonClassName } from "@/lib/ui/button";
import { Card } from "@/lib/ui/card";
import { composeDraftStore, draftSummary, type ComposeDraftStore } from "@/lib/compose/draft-store";

export type ComposeOutcome = "landed" | "expired";

/** The one query value this reads; anything else is not a notice. */
export function composeOutcomeOf(value: string | null): ComposeOutcome | null {
  return value === "landed" || value === "expired" ? value : null;
}

export function ComposeNotice({
  outcome,
  onDismiss,
  drafts = composeDraftStore,
}: {
  outcome: ComposeOutcome;
  onDismiss: () => void;
  drafts?: ComposeDraftStore;
}) {
  // Named from the draft that is still on the device, so the notice says which
  // post did not land rather than "a post".
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    if (outcome !== "expired") return;
    let cancelled = false;
    void drafts.load().then((draft) => {
      if (!cancelled && draft !== null) setName(draftSummary(draft).title);
    });
    return () => {
      cancelled = true;
    };
  }, [outcome, drafts]);

  if (outcome === "landed") {
    return (
      <Card testId="compose-landed">
        <h2 className="text-title-medium">Your post is in the feed</h2>
        <p className="text-body-medium text-on-surface-variant">
          It settles into its place in the order as the graph catches up.
        </p>
        <div className="flex justify-end">
          <Button testId="compose-landed-dismiss" variant="text" size="sm" onClick={onDismiss}>
            Dismiss
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card testId="compose-expired">
      <h2 className="text-title-medium">Your post didn&apos;t land</h2>
      <p className="text-body-medium text-on-surface-variant">
        {name === null ? "It" : `“${name}”`} couldn&apos;t finish settling. Nothing was spent —
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
    </Card>
  );
}
