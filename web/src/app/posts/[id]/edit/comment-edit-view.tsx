"use client";

// CommentEdit / CommentEditVideo / CommentEditActs — the post's one-screen-one-
// batch, scaled to a comment's anatomy: words, pictures or a clip, tags,
// citations, the licence locked (design/designs/canonical/screens/_shared.jsx
// `CommentEditBody`, CommentEditVideo.jsx).
//
// THE LICENCE IS READ-ONLY HERE, and the lock says why. A licence is a term of
// the minting record; an edit is a new record over the same node, so there is
// nothing an edit could change it to. Drawing it greyed with a lock is the
// board's own answer to "why can't I touch this" — better than hiding a term
// the comment is still under.
//
// THE MARK IS THE AUTHOR'S ONGOING JUDGEMENT, which is why it sits beside a
// licence that cannot move: the licence is fixed by contract at signing, the
// mark is not, so an author can veil or unveil their own comment after
// publishing (design/backlog.md item 25.2). It opens the same ComposeSensitive
// sheet the post's seal opens — one sheet for every surface that marks.
//
// A CLIP STAYS OR LEAVES WHOLE, AND ITS FACE CAN CHANGE (CommentEditVideo.md):
// the clip is never swapped, its × takes the comment's media with it, and the
// cover row's `Change the cover` opens the platform's own picker — never the
// clip's frames — and the picture passes the cover's crop, locked to the
// comment's square, before it lands here.
//
// THE BYTES THE EDIT TAKES GATE ITS SIGN in the seal's grammar: the gate line
// over the foot, Sign enabled while they run and a press held until they land;
// a failed upload drops the press and shuts Sign until Retry re-gates.
//
// THE ACTS FOOTER IS AN AFFORDANCE, not a label: it opens the acts sheet
// (CommentEditActs), which is the EditActs pattern at comment scale. At an
// empty batch it is no control at all — `Nothing to sign yet` — and Sign the
// edit stays visible and inert (EditComposeUnchanged: the guard is the
// family's, and it is the acts batch, never a byte comparison).
//
// UNREGISTERED: no CommentEdit* board is in nodes.json yet, so this surface
// carries test ids, not node paths.

import { useRef, type ReactNode } from "react";

import { useCoversSurface } from "@/lib/ui2/covering-layer";
import { HeaderBar } from "@/lib/ui2/header-bar";
import { HelpDot } from "@/lib/ui2/help-dot";
import { FactRow } from "@/lib/ui2/fact-row";
import { InlineAction } from "@/lib/ui2/inline-action";
import { PillButton } from "@/lib/ui2/pill-button";
import { QuietNote } from "@/lib/ui2/quiet-note";
import { TextField } from "@/lib/ui2/text-field";
import { MediaThumb } from "@/lib/ui2/compose/media-thumb";
import { DescribeCounter } from "@/lib/ui2/compose/picked-row";
import { RefusedFileRow } from "@/lib/ui2/compose/refused-file";
import { SensitiveSheet } from "@/lib/ui2/compose/sensitive-sheet";
import { UploadErrorLine, UploadStatusLine } from "@/lib/ui2/compose/upload-notice";
import { ActsFooter, ActsSheet, WithdrawnLine } from "@/lib/ui2/compose/edit-acts";
import { EditBugNotice, EditWriteRuleNotice } from "@/lib/ui2/compose/edit-notices";
import { CoverCrop } from "@/lib/ui2/compose/cover-crop";
import { useSlowAnswer } from "@/lib/ui2/waiting-commit";
import type { Crop } from "@/lib/ui2/media/crop";
import { TagEntryField } from "@/lib/ui/tag-entry-field";
import { ReferenceEntryField } from "@/lib/ui/reference-entry-field";
import { TransportError } from "@/lib/ui/transport-error";
import { licenseName, type License } from "@/lib/license";
import {
  editActCount,
  withdrawnReferences,
  withdrawnTags,
  type EditActRow,
} from "@/lib/compose/edit-batch";
import { COMMENT_ATTACHMENT_CAP } from "@/lib/compose/comment-media";
import {
  clipOf,
  coverChosen,
  describedCount,
  editUploads,
  failedUploadLine,
  pictureAltText,
  pictureId,
  uploadsDone,
  uploadsFailed,
  uploadsPending,
  type EditGallery,
} from "@/lib/compose/comment-edit";
import type { PickRefusal } from "@/lib/compose/pick";
import type { SealFault } from "@/lib/compose/seal-fault";
import { sensitiveReasonProblem, type PickedAsset } from "@/lib/compose/wizard";
import { COMMENT_BODY_MAX_CHARS, commentBodyProblem } from "@/lib/compose/reply-wizard";
import type { TagDraft } from "@/lib/topics/draft";
import type { ReferenceDraft } from "@/lib/references/draft";
import { unlandedCitationLine } from "@/app/(app)/compose/wizard/seal-step";

/** The header X's accessible name: the edit keeps no draft (CommentEditVideo, WizardHeader boards). */
export const COMMENT_EDIT_LEAVE_LABEL = "Leave — the edit is discarded";

/** The slow and the count lines, standing under the acts footer (CommentEdit.md). */
const SLOW_LINE = "Still signing — the network is slow right now.";
const COUNT_CHANGED_LINE = "The count changed while you were editing — check it, then sign again.";

/** The comment pager's square: the tile a comment's media is drawn at, whole. */
const COMMENT_TILE = 56;

/** A group's caption — the board's own label rung. */
function FieldLabel({ children }: { children: string }) {
  return <span className="text-label-large">{children}</span>;
}

/** The cover's crop, raised over the edit for a picture the picker handed back. */
export type CommentCoverCropping = {
  readonly src: string;
  readonly crop: Crop;
  readonly onCrop: (next: Crop) => void;
  readonly onNext: () => void;
  readonly onBack: () => void;
};

export function CommentEditView({
  targetLabel,
  words,
  gallery,
  previews,
  license,
  tags,
  references,
  loadedTags,
  loadedReferences,
  tagErrors,
  referenceErrors,
  sensitive,
  sensitiveReason,
  sensitiveOpen,
  acts,
  actsOpen,
  busy,
  held = false,
  slow = false,
  countChanged = false,
  fault = null,
  refusals = [],
  cropping = null,
  refusal,
  failed,
  onWords,
  onSensitive,
  onSensitiveReason,
  onSensitiveOpen,
  onSensitiveHelp,
  onPick,
  onDismissRefusal = () => {},
  onRemovePicture,
  onRetryUploads = () => {},
  onRemoveFailed = () => {},
  onDescribe,
  onPickCover = () => {},
  onRemoveCover = () => {},
  onTags,
  onReferences,
  onUndoTag,
  onUndoReference,
  onActs,
  onHelp,
  onWriteRuleHelp = () => {},
  onNotNow = () => {},
  onTryAgain = () => {},
  onReport = () => {},
  onDiscard = () => {},
  onRemoveRefusedCitation = () => {},
  onSign,
  onLeave,
}: {
  /** What the comment is on — the board's lede. */
  targetLabel: string;
  words: string;
  gallery: EditGallery;
  /** Media id or asset id → something to draw: a served URL, or a local object URL. */
  previews: Readonly<Record<string, string>>;
  /** The comment's license as it was signed — shown, locked. */
  license: License;
  tags: readonly TagDraft[];
  references: readonly ReferenceDraft[];
  /** What the comment arrived with: the baseline a withdrawal is read against. */
  loadedTags: readonly TagDraft[];
  loadedReferences: readonly ReferenceDraft[];
  tagErrors?: Readonly<Record<number, string>>;
  referenceErrors?: Readonly<Record<number, string>>;
  /** The author's own mark, and the line the veil would show. */
  sensitive: boolean;
  sensitiveReason: string;
  sensitiveOpen: boolean;
  /** The batch, every kind counted in the records it signs. */
  acts: readonly EditActRow[];
  actsOpen: boolean;
  /** The signing is out. */
  busy: boolean;
  /** A press is held at the upload gate, waiting on the bytes. */
  held?: boolean;
  /** The press has gone 5s unanswered. */
  slow?: boolean;
  /** The prepared batch was not the one the foot read; the held press dropped. */
  countChanged?: boolean;
  /** What became of the last press, when it did not leave the edit. */
  fault?: SealFault | null;
  /** Files the add control turned away, standing under the pictures until dismissed. */
  refusals?: readonly PickRefusal[];
  /** The cover's crop, standing in the edit's place while it is up. */
  cropping?: CommentCoverCropping | null;
  refusal: string | null;
  failed: boolean;
  onWords: (words: string) => void;
  onSensitive: (next: boolean) => void;
  onSensitiveReason: (next: string) => void;
  onSensitiveOpen: (open: boolean) => void;
  onSensitiveHelp: () => void;
  onPick: (files: readonly File[]) => void;
  onDismissRefusal?: (id: string) => void;
  onRemovePicture: (id: string) => void;
  /** Retry, under the pictures and on the gate: every failed upload tries again. */
  onRetryUploads?: () => void;
  /** `Remove it` under the pictures: the failed ones leave the batch. */
  onRemoveFailed?: () => void;
  onDescribe: (id: string) => void;
  /** A picture back from the picker for the clip's face, for the controller to crop. */
  onPickCover?: (file: File) => void;
  /** `Remove it` under the cover row: the new face leaves the batch. */
  onRemoveCover?: () => void;
  onTags: (tags: readonly TagDraft[]) => void;
  onReferences: (references: readonly ReferenceDraft[]) => void;
  onUndoTag: (name: string) => void;
  onUndoReference: (targetId: string) => void;
  onActs: (open: boolean) => void;
  onHelp: () => void;
  onWriteRuleHelp?: () => void;
  /** `Not now` under the write rule's notice: the edit stands again as it was. */
  onNotNow?: () => void;
  onTryAgain?: () => void;
  onReport?: () => void;
  /** `Discard the edit` under the bug's notice: asks first. */
  onDiscard?: () => void;
  /** `Remove it` on a citation whose target never landed. */
  onRemoveRefusedCitation?: (targetId: string) => void;
  onSign: () => void;
  onLeave: () => void;
}) {
  const clip = clipOf(gallery);
  const full = gallery.length >= COMMENT_ATTACHMENT_CAP;
  const count = editActCount(acts);
  const signing = busy || held;
  // Past 200ms the commit reads its in-flight label and the ways out refuse —
  // held at the gate or not (CommentEdit.md).
  const slowAnswer = useSlowAnswer(signing);
  const pending = uploadsPending(gallery);
  const faulted = uploadsFailed(gallery);
  const wordsIssue = commentBodyProblem(words);
  const leave = () => {
    if (!slowAnswer) onLeave();
  };
  // A modal dialog over the surface that raised it, so it announces itself as
  // one: the stage beneath it is suspended while it is up (Feed.md:31,
  // `covering-layer.tsx`). Mounted only while open, so it covers for as long
  // as it is mounted.
  useCoversSurface(true, "suspend");
  const pickInput = useRef<HTMLInputElement | null>(null);
  const coverInput = useRef<HTMLInputElement | null>(null);
  const refusedCitation =
    fault?.kind === "row" ? references.find((reference) => reference.targetId === fault.targetId) : undefined;

  const subline = slow ? SLOW_LINE : countChanged ? COUNT_CHANGED_LINE : null;

  let commit: ReactNode;
  if (fault?.kind === "writeRule") {
    commit = <EditWriteRuleNotice onHelp={onWriteRuleHelp} onNotNow={onNotNow} testIdPrefix="comment-edit" />;
  } else if (fault?.kind === "bug") {
    commit = (
      <EditBugNotice onTryAgain={onTryAgain} onReport={onReport} onDiscard={onDiscard} testIdPrefix="comment-edit" />
    );
  } else {
    // Inert, never hidden, at an empty batch; a press while the signing is
    // out or held is refused without the button dimming (CommentEdit.md). A
    // failed upload shuts it, the gate saying why; a running one never does.
    commit = (
      <PillButton
        testId="comment-edit-save"
        full
        disabled={
          count === 0 ||
          words.trim() === "" ||
          wordsIssue !== null ||
          (sensitive && sensitiveReasonProblem(sensitiveReason) !== null) ||
          faulted > 0 ||
          refusedCitation !== undefined
        }
        onClick={() => {
          if (!signing) onSign();
        }}
      >
        {slowAnswer ? "Signing the edit…" : "Sign the edit"}
      </PillButton>
    );
  }

  return (
    <div
      data-testid="comment-edit"
      role="dialog"
      aria-modal="true"
      aria-label="Edit comment"
      className="fixed inset-0 z-40 flex flex-col bg-surface text-on-surface"
    >
      {cropping !== null ? (
        // CoverCrop over the comment edit: its back arrow gives the cover row
        // back with the picture unused; its X is the edit's own X, asking
        // first where the batch holds an act (CoverCrop.md).
        <>
          <HeaderBar
            title="The cover"
            backLabel="Back to the edit"
            onBack={cropping.onBack}
            onLeave={leave}
            leaveLabel={COMMENT_EDIT_LEAVE_LABEL}
            testId="comment-edit-crop-header"
          />
          <div data-testid="comment-edit-cover-crop" className="flex min-h-0 flex-1 flex-col">
            <CoverCrop
              src={cropping.src}
              ratio={1}
              crop={cropping.crop}
              onCrop={cropping.onCrop}
              onNext={cropping.onNext}
              testIdPrefix="comment-edit"
            />
          </div>
        </>
      ) : (
        <>
          <HeaderBar
            title="Edit comment"
            backLabel="Back to the thread"
            onBack={leave}
            onLeave={leave}
            leaveLabel={COMMENT_EDIT_LEAVE_LABEL}
            help={<HelpDot ariaLabel="Editing" onOpen={onHelp} testId="header-help" />}
            focusTitle
          />

          <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-6 pb-4 pt-3">
            <QuietNote testId="comment-edit-lede">Your comment on &ldquo;{targetLabel}&rdquo;.</QuietNote>

            <TextField
              label="Words"
              value={words}
              onChange={onWords}
              multiline
              rows={clip !== undefined ? 2 : 3}
              testId="comment-edit-input"
              cap={COMMENT_BODY_MAX_CHARS}
              error={wordsIssue ?? undefined}
            />

            {clip !== undefined ? (
              <>
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>Video</FieldLabel>
                  <div className="flex items-center gap-2">
                    <MediaThumb
                      src={clip.coverUrl}
                      altText={clip.altText}
                      width={COMMENT_TILE}
                      height={COMMENT_TILE}
                      fit="contain"
                      durationMs={0}
                      onRemove={() => onRemovePicture(clip.mediaId)}
                      removeLabel="Remove this video"
                      testId="comment-edit-clip"
                    />
                  </div>
                  {/* One description for the clip, none for its cover. */}
                  <DescribeCounter
                    subject="the video"
                    described={describedCount([clip])}
                    total={1}
                    onDescribe={() => onDescribe(clip.mediaId)}
                    testId="comment-edit-describe-counter"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <FieldLabel>Cover</FieldLabel>
                  {coverChosen(clip) ? (
                    <div className="flex items-center gap-2">
                      <MediaThumb
                        src={clip.newCover !== null ? (previews[clip.newCover.id] ?? null) : clip.coverUrl}
                        width={COMMENT_TILE}
                        height={COMMENT_TILE}
                        fit="contain"
                        crop={clip.newCover?.crop ?? null}
                        {...coverThumbState(clip.newCover)}
                        testId="comment-edit-cover"
                      />
                      <PillButton
                        variant="text"
                        size="sm"
                        testId="comment-edit-change-cover"
                        onClick={() => coverInput.current?.click()}
                      >
                        Change the cover
                      </PillButton>
                    </div>
                  ) : (
                    // The field's other state: no picture, and the door
                    // (CommentEditVideo.md: "Add a cover and no picture").
                    <InlineAction
                      size="sm"
                      testId="comment-edit-add-cover"
                      onClick={() => coverInput.current?.click()}
                    >
                      Add a cover
                    </InlineAction>
                  )}
                  {clip.newCover?.upload.kind === "failed" && (
                    // The cover is one picture, so its line is the one-picture
                    // line, under the cover row with its two ways out.
                    <UploadErrorLine
                      message={failedUploadLine(1)}
                      onRetry={onRetryUploads}
                      onRemove={onRemoveCover}
                      testId="comment-edit-cover-error"
                    />
                  )}
                  <input
                    ref={coverInput}
                    type="file"
                    accept="image/*"
                    data-testid="comment-edit-cover-input"
                    tabIndex={-1}
                    aria-hidden="true"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file !== undefined) onPickCover(file);
                      event.target.value = "";
                    }}
                    className="sr-only"
                  />
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-1.5">
                <FieldLabel>Pictures</FieldLabel>
                <div className="flex flex-wrap items-center gap-2">
                  {gallery.map((picture) => {
                    const id = pictureId(picture);
                    const upload = picture.kind === "added" ? picture.asset.upload : null;
                    return (
                      <MediaThumb
                        key={id}
                        src={previews[id] ?? null}
                        altText={pictureAltText(picture)}
                        width={COMMENT_TILE}
                        height={COMMENT_TILE}
                        fit="contain"
                        progress={
                          upload !== null &&
                          (upload.kind === "waiting" ||
                            upload.kind === "encoding" ||
                            upload.kind === "uploading" ||
                            upload.kind === "processing")
                            ? "indeterminate"
                            : undefined
                        }
                        failed={upload?.kind === "failed"}
                        onRemove={() => onRemovePicture(id)}
                        testId={`comment-edit-media-${id}`}
                      />
                    );
                  })}
                  {/* The platform's own dialog: an editor has no pick stage
                      either. NEVER SHUT AT THE CAP — a fifth picture is
                      refused in words, which a closed picker would hide. */}
                  <InlineAction
                    size="sm"
                    testId="comment-edit-add-media"
                    onClick={() => pickInput.current?.click()}
                  >
                    + Add pictures · {gallery.length} of {COMMENT_ATTACHMENT_CAP}
                  </InlineAction>
                  <input
                    ref={pickInput}
                    type="file"
                    accept="image/*"
                    multiple
                    data-testid="comment-edit-media-input"
                    tabIndex={-1}
                    aria-hidden="true"
                    data-full={full || undefined}
                    onChange={(event) => {
                      const files = event.target.files;
                      if (files !== null && files.length > 0) onPick([...files]);
                      event.target.value = "";
                    }}
                    className="sr-only"
                  />
                </div>
                {faulted > 0 && (
                  <UploadErrorLine
                    message={failedUploadLine(faulted)}
                    onRetry={onRetryUploads}
                    onRemove={onRemoveFailed}
                    count={faulted}
                    testId="comment-edit-upload-error"
                  />
                )}
                {refusals.length > 0 && (
                  <ul data-testid="comment-edit-refusals" className="m-0 flex list-none flex-col gap-2.5 p-0">
                    {refusals.map((one) => (
                      <li key={one.id}>
                        <RefusedFileRow
                          refusal={one}
                          onDismiss={() => onDismissRefusal(one.id)}
                          testIdPrefix="comment-edit"
                        />
                      </li>
                    ))}
                  </ul>
                )}
                {gallery.length > 0 && (
                  <DescribeCounter
                    described={describedCount(gallery)}
                    total={gallery.length}
                    onDescribe={() => {
                      const first = gallery[0];
                      if (first !== undefined) onDescribe(pictureId(first));
                    }}
                    testId="comment-edit-describe-counter"
                  />
                )}
              </div>
            )}

            {/* The fields carry their own `Tags` and `References` labels. A
                staged chip or row opens its pair in a sheet over the edit
                (CommentEdit.md). The edit stages a separate act per change,
                so there is no batch cap here — that is the creation
                gesture's rule. */}
            <div className="flex flex-col gap-1.5">
              <TagEntryField
                tags={tags}
                onChange={onTags}
                fieldErrors={tagErrors}
                cap={null}
                testIdPrefix="comment-edit"
                pairs="sheet"
              />
              {withdrawnTags(loadedTags, tags).map((tag) => (
                <WithdrawnLine
                  key={tag.name}
                  name={`#${tag.name}`}
                  onUndo={() => onUndoTag(tag.name)}
                  testId={`comment-edit-withdrawn-tag-${tag.name}`}
                />
              ))}
            </div>

            <div className="flex flex-col gap-1.5">
              <ReferenceEntryField
                references={references}
                onChange={onReferences}
                fieldErrors={referenceErrors}
                cap={null}
                testIdPrefix="comment-edit"
                pairs="sheet"
              />
              {/* CommentEdit.md: a citation whose target never landed reads
                  why, followed by Remove it — never Retry. */}
              {refusedCitation !== undefined && (
                <UploadErrorLine
                  message={unlandedCitationLine(refusedCitation)}
                  onRemove={() => onRemoveRefusedCitation(refusedCitation.targetId)}
                  testId="comment-edit-citation-fault"
                />
              )}
              {withdrawnReferences(loadedReferences, references).map((reference) => (
                <WithdrawnLine
                  key={reference.targetId}
                  name={reference.target.label}
                  onUndo={() => onUndoReference(reference.targetId)}
                  testId={`comment-edit-withdrawn-reference-${reference.targetId}`}
                />
              ))}
            </div>

            {/* The two term rows the board draws shut: the licence, stated and
                locked, then the author's own mark — FactRow's seal emphasis. */}
            <div className="flex flex-col">
              <FactRow
                label="License"
                value={
                  <span className="text-body-medium text-on-surface-variant" data-testid="comment-edit-license">
                    {licenseName(license)}
                  </span>
                }
                action={
                  <span
                    className="inline-flex text-on-surface-variant"
                    aria-label="The license never changes"
                    data-testid="comment-edit-license-locked"
                  >
                    <LockGlyph />
                  </span>
                }
              />
              <FactRow
                label="Sensitive"
                value={
                  <span
                    className="text-body-medium text-on-surface-variant"
                    data-testid="comment-edit-sensitive-value"
                  >
                    {sensitive ? "Marked" : "Not marked"}
                  </span>
                }
                action={sensitive ? "Change" : "Mark"}
                onAction={() => onSensitiveOpen(true)}
                testId="comment-edit-open-sensitive"
                last
              />
            </div>

            <div className="flex-1" />

            {refusal && (
              <p role="alert" data-testid="comment-edit-refused" className="m-0 text-body-medium text-error">
                {refusal}
              </p>
            )}
            {failed && <TransportError testId="comment-edit-failed" />}

            {/* THE GATE: while the bytes the edit took go up, the seal's line
                over the foot — naming the cover where the edit set one; failed,
                its fault reading with Retry. */}
            {faulted > 0 ? (
              <UploadStatusLine
                done={0}
                total={0}
                failed
                failedCount={faulted}
                message={failedUploadLine(faulted)}
                onRetry={onRetryUploads}
                testId="comment-edit-gate"
              />
            ) : (
              pending > 0 && (
                <UploadStatusLine
                  done={uploadsDone(gallery)}
                  total={editUploads(gallery).length}
                  media={clip !== undefined ? "cover" : "pictures"}
                  testId="comment-edit-gate"
                />
              )
            )}

            {/* What the edit would sign, and the way into the detail. */}
            <ActsFooter
              count={count}
              onOpen={() => onActs(true)}
              subline={subline}
              testId="comment-edit-signed-actions"
            />

            {commit}
          </div>
        </>
      )}

      <SensitiveSheet
        open={sensitiveOpen}
        reason={sensitiveReason}
        onDone={(next) => {
          onSensitive(next.sensitive);
          onSensitiveReason(next.sensitiveReason);
          onSensitiveOpen(false);
        }}
        onClose={() => onSensitiveOpen(false)}
        onHelp={onSensitiveHelp}
        testIdPrefix="comment-edit"
      />

      <ActsSheet
        open={actsOpen}
        rows={acts}
        onClose={() => onActs(false)}
        testId="comment-edit-acts-sheet"
      />
    </div>
  );
}

/** How the face this edit set reads on its tile: a ring while it goes up, marked when it failed. */
function coverThumbState(cover: PickedAsset | null): { progress?: "indeterminate"; failed?: boolean } {
  if (cover === null) return {};
  switch (cover.upload.kind) {
    case "waiting":
    case "encoding":
    case "uploading":
    case "processing":
      return { progress: "indeterminate" };
    case "failed":
      return { failed: true };
    default:
      return {};
  }
}

// Material's `lock`, the 16px cut the board draws beside the licence.
function LockGlyph() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden="true">
      <path d="M18 8h-1V6a5 5 0 00-10 0v2H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V10a2 2 0 00-2-2zM9 6a3 3 0 016 0v2H9V6zm3 13a2 2 0 110-4 2 2 0 010 4z" />
    </svg>
  );
}
