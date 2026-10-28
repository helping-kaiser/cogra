"use client";

// WHAT YOUR FEED SHOWS, over Settings (SettingsReading.md; the SettingsReading
// board; FeedFilter.jsx `FeedFilterSheet`): the reader's default — the filter
// every feed opens with — set in the feed's own sheet. One control, two ends
// of one promise: the filter's "?" sends the reader here to change their
// defaults, and this is that same sheet, titled because it covers the page it
// was opened from.
//
// It opens on the reader's own default, or CoGra's where they set none, with
// focus on its title. Every tap stages; Done saves the staged filter as the
// reader's default ON THIS DEVICE and closes; the scrim, a swipe down, Back
// and Escape drop what is staged. HERE `Reset` STAGES COGRA'S DEFAULT — the
// one place a reader gets back to it (pass C 10) — never their own.
//
// A default never holds a topic, so this sheet draws no topic section.
// Registered under `settings.feedSheet` (seam 082; ruling 37: never sharing a
// path with the feed filter's).

import { useState } from "react";

import { FEED_FILTER_DEFAULT, type FeedFilterValue } from "@/lib/feed/feed-filter";
import { part, type DataNode } from "@/lib/ui/data-node";
import { FeedFilterSheet } from "@/lib/ui2/feed-filter-sheet";
import { HelpDialog, HELP_TOPICS } from "@/lib/ui2/help-dialog";

export function SettingsReadingSheet({
  saved,
  onDone,
  onDiscard,
  node,
}: {
  /** The reader's saved default — CoGra's where they set none. */
  saved: FeedFilterValue;
  /** Done: the staged filter, to save as the reader's default. */
  onDone: (value: FeedFilterValue) => void;
  /** The scrim, a swipe down, Back or Escape: nothing staged applies. */
  onDiscard: () => void;
  node: DataNode;
}) {
  // Mounted when the row opens it, so the staged copy is taken at opening.
  const [staged, setStaged] = useState<FeedFilterValue>(saved);
  const [help, setHelp] = useState(false);
  return (
    <>
      <FeedFilterSheet
        open
        titled
        staged={staged}
        onStage={setStaged}
        onReset={() => setStaged(FEED_FILTER_DEFAULT)}
        onDone={() => onDone(staged)}
        onClose={onDiscard}
        onHelp={() => setHelp(true)}
        node={part(node, "feedSheet")}
        testId="settings-reading-sheet"
      />
      <HelpDialog
        open={help}
        onClose={() => setHelp(false)}
        topic={HELP_TOPICS.theFeedFilter}
        testId="settings-reading-help-dialog"
      />
    </>
  );
}
