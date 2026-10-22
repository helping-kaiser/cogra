"use client";

// TagsSheet — the staged tags, managed (design/components/compose/
// TagsSheet.jsx, backlog item 95): what the seal's `N tags` row opens once
// the row COUNTS instead of naming. It is `CitedSheet` with tags in it — the
// seal's two counting rows fold for one reason and open one kind of door.
//
// THE PILLS ARE `TopicRemovable`, the composer's own, so a staged tag is
// drawn once. IT ADDS NOTHING: a post's seal carries no add-rows by design.
// Every change applies the moment it is made and none waits on Done; the
// last × closes the sheet back to the seal (ComposeTags.md).

import { useState } from "react";

import type { TagDraft } from "@/lib/topics/draft";
import { BottomSheet } from "../bottom-sheet";
import { PillButton } from "../pill-button";
import { PairSheet, TAG_FAMILY } from "./pair-sheet";
import { TopicRemovable } from "./topic-removable";

export function TagsSheet({
  open,
  onClose,
  items,
  onChange,
  testId = "tags-sheet",
}: {
  open: boolean;
  onClose: () => void;
  items: readonly TagDraft[];
  /** The staged set after a removal or a re-pair — the details stage's own. */
  onChange: (next: readonly TagDraft[]) => void;
  testId?: string;
}) {
  const [pairing, setPairing] = useState<string | null>(null);
  const paired = items.find((tag) => tag.name === pairing);
  return (
    <>
      <BottomSheet
        open={open}
        onClose={onClose}
        title={`Tags · ${items.length}`}
        testId={testId}
      >
        <div className="flex flex-wrap gap-2">
          {items.map((tag, index) => (
            <TopicRemovable
              key={tag.name}
              name={tag.name}
              testId={`${testId}-tag-${index}`}
              onEdit={() => setPairing(tag.name)}
              expanded={pairing === tag.name}
              onRemove={() => {
                const next = items.filter((other) => other.name !== tag.name);
                onChange(next);
                // The last × closes the sheet to the seal it opened from.
                if (next.length === 0) onClose();
              }}
            />
          ))}
        </div>
        <div className="-mx-2 flex justify-end pt-2">
          <PillButton testId={`${testId}-done`} variant="text" onClick={onClose}>
            Done
          </PillButton>
        </div>
      </BottomSheet>
      {paired !== undefined && (
        <PairSheet
          open={pairing !== null}
          title={`#${paired.name}`}
          value={{ pDirected: paired.relevance, pInterest: paired.confidence }}
          family={TAG_FAMILY}
          onDone={(pair) => {
            onChange(
              items.map((tag) =>
                tag.name === paired.name
                  ? { ...tag, relevance: pair.pDirected, confidence: pair.pInterest }
                  : tag,
              ),
            );
            setPairing(null);
          }}
          onDiscard={() => setPairing(null)}
          testId={`${testId}-pair`}
        />
      )}
    </>
  );
}
