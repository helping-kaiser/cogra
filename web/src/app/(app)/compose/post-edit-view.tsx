"use client";

// EditCompose / EditComposeVideo / EditWords / EditComposeUnchanged — the
// post edit, one screen and one batch (design/designs/canonical/screens/
// _shared.jsx `EditComposeBody`, EditWords.jsx). Everything the edit changes
// signs together, and the foot says how much before the button does it.
//
// THE LICENSE IS LOCKED, and the lock is a mark rather than an action: a
// license is published with the post and never changes, so the row shows what
// was declared — its name, `licenseName` — and says why nothing can be done.
//
// THE MARK IS THE AUTHOR'S ONGOING JUDGMENT, which is why it sits beside a
// license that cannot move; it opens the seal's own sheet (ruling 42).
//
// THE EDIT KEEPS NO DRAFT. The back arrow and the X are one way out: with an
// act in the batch the route asks `Discard the changes?` first, with none it
// leaves at once — so the X says what leaving does, `Leave — the edit is
// discarded` (EditCompose.md, EditWords.md, DiscardConfirm.md).
//
// DRIFT (registration-gated, feed-card-rework §16): no Edit* board is in
// nodes.json yet, so this surface carries test ids, not node paths — the
// structural diff waits on registration; the behavior tests pin the sidecars.
//
// DRIFT (FC-8 remainder, named in the PR): the edit's own add paths — `+ Add
// pictures · N of 10` through the device picker and the locked crop, the
// upload gate's lines, and a clip's `Change the cover` — are not built here;
// the media this edit can author is the post's own pictures, reordered,
// re-covered, described or removed. When the crops land, their X raises the
// same ask the edit's own X does (ComposeCrop.md, CoverCrop.md).

import type { ReactNode } from "react";

import { TagEntryField } from "@/lib/ui/tag-entry-field";
import { ReferenceEntryField } from "@/lib/ui/reference-entry-field";
import { TransportError } from "@/lib/ui/transport-error";
import { HeaderBar, HelpButton } from "@/lib/ui2/header-bar";
import { PillButton, TextAction } from "@/lib/ui2/pill-button";
import { TextField } from "@/lib/ui2/text-field";
import { PickedRow, type PickedThumb } from "@/lib/ui2/compose/picked-row";
import { ActsFooter, WithdrawnLine } from "@/lib/ui2/compose/edit-acts";
import { useSlowAnswer } from "@/lib/ui2/waiting-commit";
import { licenseName } from "@/lib/license";
import {
  DESCRIPTION_MAX_CHARS,
  BODY_MAX_CHARS,
  TITLE_MAX_CHARS,
  descriptionProblem,
  titleProblem,
} from "@/lib/compose/wizard";
import {
  isClipBody,
  isMediaBody,
  wordsProblem,
  type PostEditState,
} from "@/lib/compose/post-edit";
import { pictureAltText, pictureId } from "@/lib/compose/comment-edit";
import { withdrawnReferences, withdrawnTags } from "@/lib/compose/edit-batch";
import { attachmentLanding } from "@/lib/stance/backing";
import { AttachmentReadout, BACKING_UNREAD } from "@/lib/ui/attachment-readout";
import type { TagDraft } from "@/lib/topics/draft";
import type { ReferenceDraft } from "@/lib/references/draft";

function FieldLabel({ children, id }: { children: string; id?: string }) {
  return (
    <span id={id} className="text-label-large">
      {children}
    </span>
  );
}

/** The header X's accessible name: the edit keeps no draft (EditCompose, EditWords boards). */
export const EDIT_LEAVE_LABEL = "Leave — the edit is discarded";

function BodyRule() {
  return (
    <p className="m-0 text-body-small text-on-surface-variant">
      A post&rsquo;s body is words or media, never both.
    </p>
  );
}

export function PostEditView({
  state,
  previews,
  count,
  tagErrors,
  referenceErrors,
  busy,
  slow,
  countChanged,
  writeRuleRefused,
  keyAbsent,
  refusal,
  failed,
  onTitle,
  onDescription,
  onWords,
  onTags,
  onReferences,
  onUndoTag,
  onUndoReference,
  onManagePictures,
  onRemoveClip,
  onDescribeClip,
  onOpenSensitive,
  onOpenBacking,
  backingRawSum,
  onOpenActs,
  onHelp,
  onSign,
  onLeave,
  keyCard,
}: {
  state: PostEditState;
  /**
   * The raw sum of the author's Publish records toward the post — null when
   * the read answered none or failed (`fetchPostBacking`), when the row stops
   * at the flagged placeholder.
   */
  backingRawSum: number | null;
  /** `Adjust` on the Your backing row: the one-axis pad over the edit. */
  onOpenBacking: () => void;
  previews: Readonly<Record<string, string>>;
  /** What the batch signs, in records — the guard reads this and nothing else. */
  count: number;
  tagErrors: Readonly<Record<number, string>>;
  referenceErrors: Readonly<Record<number, string>>;
  busy: boolean;
  /** The signing has gone 5s unanswered. */
  slow: boolean;
  /** The prepared batch was not the one the foot read; the held press dropped. */
  countChanged: boolean;
  writeRuleRefused: boolean;
  keyAbsent: boolean;
  refusal: string | null;
  failed: boolean;
  onTitle: (title: string) => void;
  onDescription: (description: string) => void;
  onWords: (words: string) => void;
  onTags: (tags: readonly TagDraft[]) => void;
  onReferences: (references: readonly ReferenceDraft[]) => void;
  onUndoTag: (name: string) => void;
  onUndoReference: (targetId: string) => void;
  onManagePictures: () => void;
  onRemoveClip: () => void;
  onDescribeClip: () => void;
  onOpenSensitive: () => void;
  onOpenActs: () => void;
  onHelp: () => void;
  onSign: () => void;
  /** The back arrow and the X alike: the route decides whether leaving asks. */
  onLeave: () => void;
  /** The key-absent seal, standing in the commit's place. */
  keyCard: ReactNode;
}) {
  const media = isMediaBody(state);
  const clip = isClipBody(state);
  const slowAnswer = useSlowAnswer(busy);
  const problem =
    titleProblem(state.title) ??
    (media ? descriptionProblem(state.description) : wordsProblem(state.words));
  // Inert, never hidden, at an empty batch (EditComposeUnchanged.md:5): the
  // control stays where it is and the foot says why it goes nowhere.
  const inert = count === 0 || problem !== null;
  const withdrawnTagList = withdrawnTags(state.loadedTags, state.tags);
  const withdrawnRefList = withdrawnReferences(state.loadedReferences, state.references);
  const leave = () => {
    if (!slowAnswer) onLeave();
  };
  const subline = slow
    ? "Still signing — the network is slow right now."
    : countChanged
      ? "The count changed while you were editing — check it, then sign again."
      : null;

  const thumbs: PickedThumb[] = state.gallery.map((picture) => ({
    id: pictureId(picture),
    src: previews[pictureId(picture)] ?? null,
    altText: pictureAltText(picture),
    durationMs: state.durations[pictureId(picture)] ?? null,
  }));

  return (
    <main
      data-testid="post-edit"
      className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col bg-surface text-on-surface"
    >
      {/* While the signing holds the reader, the way out refuses a press and
          never dims (EditCompose.md: the back arrow and the ✕ refuse while it
          signs). */}
      <HeaderBar
        title="Edit post"
        backLabel="Back to the post"
        onBack={leave}
        onLeave={leave}
        leaveLabel={EDIT_LEAVE_LABEL}
        help={<HelpButton label="Editing" onOpen={onHelp} />}
        testId="post-edit-header"
      />

      <div className="flex flex-1 flex-col gap-3.5 px-6 pb-4 pt-3">
        {media ? (
          <div className="flex flex-col gap-1.5">
            {clip ? (
              // A video is the whole post: its tile, its own description and its
              // remove control; the clip itself never changes at an edit.
              <div className="flex flex-col gap-1.5">
                <PickedRow
                  items={thumbs}
                  caption="1 video — the body"
                  onManage={null}
                  onRemove={() => onRemoveClip()}
                  removeLabel="Remove this video"
                  testId="post-edit-clip"
                />
                <TextAction testId="post-edit-describe-clip" onClick={onDescribeClip}>
                  {pictureAltText(state.gallery[0]!) === "" ? "Describe the video" : "Described"}
                </TextAction>
                <p className="m-0 text-body-small text-on-surface-variant">
                  A video is the whole post.
                </p>
              </div>
            ) : (
              <>
                <PickedRow
                  items={thumbs}
                  caption={
                    thumbs.length === 1 ? "1 picture — the body" : `${thumbs.length} pictures — the body`
                  }
                  onManage={onManagePictures}
                  manageLabel={`Manage the ${thumbs.length === 1 ? "picture" : `${thumbs.length} pictures`}`}
                  testId="post-edit-picked"
                />
                <BodyRule />
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <TextField
              label="What do you want to publish?"
              value={state.words}
              onChange={onWords}
              multiline
              rows={6}
              cap={BODY_MAX_CHARS}
              error={wordsProblem(state.words) ?? undefined}
              testId="post-edit-words"
            />
            <BodyRule />
          </div>
        )}

        <TextField
          label="Title"
          optional
          value={state.title}
          onChange={onTitle}
          cap={TITLE_MAX_CHARS}
          error={titleProblem(state.title) ?? undefined}
          testId="post-edit-title"
        />

        {/* THE WORDS EDIT CARRIES NO DESCRIPTION (EditWords.md:7; K8.1/D4): a
            description is how words stand beside pictures. */}
        {media && (
          <TextField
            label="Description"
            optional
            multiline
            rows={2}
            value={state.description}
            onChange={onDescription}
            cap={DESCRIPTION_MAX_CHARS}
            error={descriptionProblem(state.description) ?? undefined}
            testId="post-edit-description"
          />
        )}

        <div className="flex flex-col gap-1.5">
          <FieldLabel>Tags</FieldLabel>
          <TagEntryField
            tags={state.tags}
            onChange={onTags}
            fieldErrors={tagErrors}
            cap={null}
            testIdPrefix="post-edit"
          />
          {withdrawnTagList.map((tag) => (
            <WithdrawnLine
              key={tag.name}
              name={`#${tag.name}`}
              onUndo={() => onUndoTag(tag.name)}
              testId={`post-edit-withdrawn-tag-${tag.name}`}
            />
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel>References</FieldLabel>
          <ReferenceEntryField
            references={state.references}
            onChange={onReferences}
            fieldErrors={referenceErrors}
            cap={null}
            testIdPrefix="post-edit"
          />
          {withdrawnRefList.map((reference) => (
            <WithdrawnLine
              key={reference.targetId}
              name={reference.target.label}
              onUndo={() => onUndoReference(reference.targetId)}
              testId={`post-edit-withdrawn-reference-${reference.targetId}`}
            />
          ))}
        </div>

        <div className="flex flex-col">
          <div className="flex min-h-11 items-center gap-2 border-t border-outline-variant">
            <span className="flex-1 text-body-medium">License</span>
            <span className="text-body-medium text-on-surface-variant" data-testid="post-edit-license">
              {licenseName(state.license)}
            </span>
            <span
              className="inline-flex text-on-surface-variant"
              aria-label="The license never changes"
              data-testid="post-edit-license-locked"
            >
              <LockGlyph />
            </span>
          </div>
          {/* YOUR BACKING (EditCompose.md, `_shared.jsx`'s `EditBackingRow`):
              under the License row, the seal's order, reading the post's
              backing as it stands with the edit — the raw sum plus the edit's
              own pick, clipped — one number. Unmoved, that is the backing as
              it stands. Its record rides the edit, so it adds no act. */}
          <div className="flex min-h-11 items-center gap-2 border-t border-outline-variant">
            <span className="flex-1 text-body-medium">Your backing</span>
            <span className="text-body-medium text-on-surface-variant">
              {backingRawSum === null ? (
                <span data-testid="post-edit-backing-unread" className="text-body-small">
                  {BACKING_UNREAD}
                </span>
              ) : (
                <AttachmentReadout
                  pDirected={attachmentLanding(backingRawSum, state.pick).landing}
                  testId="post-edit-backing-value"
                />
              )}
            </span>
            <TextAction testId="post-edit-open-backing" onClick={onOpenBacking}>
              Adjust
            </TextAction>
          </div>
          <div className="flex min-h-11 items-center gap-2 border-y border-outline-variant">
            <span className="flex-1 text-body-medium">Sensitive</span>
            <span className="text-body-medium text-on-surface-variant" data-testid="post-edit-sensitive-value">
              {state.sensitive ? "Marked" : "Not marked"}
            </span>
            <TextAction testId="post-edit-open-sensitive" onClick={onOpenSensitive}>
              {state.sensitive ? "Change" : "Mark"}
            </TextAction>
          </div>
        </div>

        <div className="flex-1" />

        {refusal && (
          <p role="alert" data-testid="post-edit-refused" className="m-0 text-body-medium text-error">
            {refusal}
          </p>
        )}
        {failed && <TransportError testId="post-edit-failed" />}

        <ActsFooter count={count} onOpen={onOpenActs} subline={subline} testId="post-edit-acts-footer" />
        {keyAbsent ? (
          keyCard
        ) : writeRuleRefused ? (
          // The write rule's notice takes the commit's place, and no Retry
          // comes with it (EditCompose.md: `You can't sign right now`).
          <p role="alert" data-testid="post-edit-write-rule" className="m-0 text-center text-body-medium">
            You can&rsquo;t sign right now.
          </p>
        ) : (
          <PillButton
            testId="post-edit-sign"
            full
            disabled={inert}
            onClick={() => {
              // Refuses a second press while the signing is out, and never dims.
              if (!busy) onSign();
            }}
          >
            {slowAnswer ? "Signing the edit…" : "Sign the edit"}
          </PillButton>
        )}
      </div>
    </main>
  );
}

// Material's `lock`, the 16px cut the board draws beside the license.
function LockGlyph() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden="true">
      <path d="M18 8h-1V6a5 5 0 00-10 0v2H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V10a2 2 0 00-2-2zM9 6a3 3 0 016 0v2H9V6zm3 13a2 2 0 110-4 2 2 0 010 4z" />
    </svg>
  );
}
