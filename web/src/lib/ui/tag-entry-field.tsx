"use client";

// The tags section every composing surface shares: the staged chips, each
// removable before send and each opening its pair in a sheet, and the one
// way to add a tag — `+ Add a tag`, which opens the tag picker. There is no
// typed entry here (jakob 2026-11-13): the picker is the only place a tag
// name is typed, and its two refusal lines are the only ones a name earns.
//
// Purely local state. What the drafted chips become depends on the host:
// the composer batches them onto the minting record, the edit screens stage
// each change as its own Tag act.
//
// A chip's pair is set in `TagPadCompose`'s sheet (ComposeDetails.md: "WHEN
// tap composeDetails.tags.tag -> the tag's pair opens in a sheet over the
// stage"; EditCompose.md, CommentEdit.md: "WHEN tap a staged tag chip -> the
// tag's pair opens in a sheet over the edit"), committed on Done and
// discarded on every other way out.

import { useState, type ReactNode } from "react";

import type { TagDraft } from "@/lib/topics/draft";
import { PairSheet, TAG_FAMILY } from "@/lib/ui2/compose/pair-sheet";
import { InlineAction } from "@/lib/ui2/inline-action";
import { TopicRemovable } from "@/lib/ui2/compose/topic-removable";
import { instance, part, testAttributes, type DataNode } from "./data-node";

export function TagEntryField({
  tags,
  onChange,
  fieldErrors,
  testIdPrefix,
  node,
  onOpenPicker,
  after,
}: {
  /**
   * What the section holds under its own controls: the edit's `Withdrawn:`
   * lines, which the edit boards draw inside the section (`postEdit.tags.withdrawn`).
   */
  after?: ReactNode;
  /** `+ Add a tag` (`<screen>.tags.add`): opens the tag picker (`TagPicker`). */
  onOpenPicker: () => void;
  /**
   * The registered section node on a registered screen (`composeDetails.tags`):
   * its `label`, each staged chip as its `tag` (keyed by the name) with the
   * chip's `remove`, and its `add` control.
   */
  node?: DataNode;
  tags: readonly TagDraft[];
  onChange: (tags: readonly TagDraft[]) => void;
  /**
   * Per-index refusal of a staged tag's act, already in the client's words —
   * a name refusal in the picker's own line (`tagNameRefusal`).
   */
  fieldErrors?: Readonly<Record<number, string>>;
  testIdPrefix: string;
}) {
  // Which chip has its pair sheet open.
  const [adjusting, setAdjusting] = useState<number | null>(null);
  // The chip the sheet last showed, kept past its close so the title holds
  // through the sheet's exit rather than blanking mid-drop.
  const [sheetIndex, setSheetIndex] = useState(0);
  const sheetTag = tags[sheetIndex];

  const select = (index: number) => {
    setSheetIndex(index);
    setAdjusting(index);
  };

  const removeAt = (index: number) => {
    onChange(tags.filter((_, i) => i !== index));
    setAdjusting(null);
  };

  const adjustAt = (index: number, next: { relevance: number; confidence: number }) => {
    onChange(tags.map((tag, i) => (i === index ? { ...tag, ...next } : tag)));
  };

  return (
    <div className="flex flex-col gap-1.5" {...testAttributes(node, `${testIdPrefix}-tag-entry`)}>
      {/* A label names a field; with the picker as the way in there is no
          field here to name, so the heading is a plain span (ComposeDetails). */}
      <span className="text-label-large" {...testAttributes(part(node, "label"))}>
        Tags
      </span>
      {tags.length > 0 && (
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0" data-testid={`${testIdPrefix}-tag-list`}>
          {tags.map((tag, index) => (
            <li key={`${tag.name}-${index}`} className="flex flex-col gap-1">
              <TopicRemovable
                name={tag.name}
                onRemove={() => removeAt(index)}
                onEdit={() => select(index)}
                expanded={adjusting === index}
                testId={`${testIdPrefix}-tag-${index}`}
                node={instance(node, "tag", tag.name)}
                removeNode={part(instance(node, "tag", tag.name), "remove")}
              />
              {fieldErrors?.[index] !== undefined && (
                <p
                  role="alert"
                  data-testid={`${testIdPrefix}-tag-error-${index}`}
                  className="text-body-small text-error"
                >
                  {fieldErrors[index]}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      {/* The quiet door under the chips (`+ Add a tag`, InlineAction sm),
          opening the tag picker. */}
      <InlineAction testId={`${testIdPrefix}-tag-add`} node={part(node, "add")} size="sm" onClick={onOpenPicker}>
        + Add a tag
      </InlineAction>
      {after}
      {sheetTag !== undefined && (
        <PairSheet
          open={adjusting !== null}
          title={`#${sheetTag.name}`}
          value={{ pDirected: sheetTag.relevance, pInterest: sheetTag.confidence }}
          family={TAG_FAMILY}
          // Done is the one way the sheet's pair reaches the staged chip.
          onDone={(pair) => {
            adjustAt(sheetIndex, { relevance: pair.pDirected, confidence: pair.pInterest });
            setAdjusting(null);
          }}
          // Scrim, swipe down, Back, Escape: the chip keeps what it had.
          onDiscard={() => setAdjusting(null)}
          testId={`${testIdPrefix}-tag-pair`}
        />
      )}
    </div>
  );
}
