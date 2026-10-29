"use client";

// EditCompose / EditComposeVideo / EditWords / EditComposeUnchanged — the
// post edit, one screen and one batch (design/designs/canonical/screens/
// _shared.jsx `EditComposeBody`, EditComposeVideo.jsx, EditWords.jsx).
// Everything the edit changes signs together, and the foot says how much
// before the button does it.
//
// THE BODY EDITS LIKE A COMPOSER'S, because an edit carries complete state.
// Pictures: the row opens Show all (reorder, re-cover, describe, remove) and
// `+ Add pictures · N of 10` takes more through the device's own picker and
// the crop, locked to the post's one shape — never a pick stage. A clip: it
// stays or leaves whole, and its face changes through the cover's crop.
// Words: `+ Add pictures or a video` is the way back to a media body.
//
// AN EDIT THAT TOOK NEW BYTES GATES ITS SIGN ON THEIR UPLOAD, in the seal's
// grammar (ComposeSealUploading; EditCompose.md): the gate line stands over
// the foot, Sign stays enabled, and a press is HELD until the bytes land. A
// failed upload drops the press, the gate takes its fault reading, and Sign
// is disabled until Retry re-gates.
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
// REGISTERED (nodes.json EditCompose, EditComposeVideo, EditWords, EditPicked;
// round 23): every part wears its `postEdit.*` path. The board draws its
// chip-keyed states (`postEdit.sign` under `none`/`slow`/`failed`) once per
// value; the web shows one at a time, so those nodes carry no key.

import { useRef, type ReactNode } from "react";

import { TagEntryField } from "@/lib/ui/tag-entry-field";
import { ReferenceEntryField } from "@/lib/ui/reference-entry-field";
import { TransportError } from "@/lib/ui/transport-error";
import { HeaderBar } from "@/lib/ui2/header-bar";
import { HelpDot } from "@/lib/ui2/help-dot";
import { FactRow } from "@/lib/ui2/fact-row";
import { InlineAction } from "@/lib/ui2/inline-action";
import { PillButton } from "@/lib/ui2/pill-button";
import { QuietNote } from "@/lib/ui2/quiet-note";
import { TextField } from "@/lib/ui2/text-field";
import { MediaThumb } from "@/lib/ui2/compose/media-thumb";
import { DescribeCounter, PickedRow, type PickedThumb } from "@/lib/ui2/compose/picked-row";
import { RefusedFileRow } from "@/lib/ui2/compose/refused-file";
import { UploadErrorLine, UploadStatusLine } from "@/lib/ui2/compose/upload-notice";
import { ActsFooter, WithdrawnLine } from "@/lib/ui2/compose/edit-acts";
import { EditWriteRuleNotice } from "@/lib/ui2/compose/edit-notices";
import { useSlowAnswer } from "@/lib/ui2/waiting-commit";
import { PICKABLE_VIDEO_TYPES } from "@/lib/ui2/media/video";
import { licenseName } from "@/lib/license";
import {
  DESCRIPTION_MAX_CHARS,
  BODY_MAX_CHARS,
  POST_ATTACHMENT_CAP,
  TITLE_MAX_CHARS,
  descriptionProblem,
  titleProblem,
  type PickedAsset,
} from "@/lib/compose/wizard";
import { isMediaBody, wordsProblem, type PostEditState } from "@/lib/compose/post-edit";
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
} from "@/lib/compose/comment-edit";
import type { PickRefusal } from "@/lib/compose/pick";
import { withdrawnReferences, withdrawnTags } from "@/lib/compose/edit-batch";
import { attachmentLanding } from "@/lib/stance/backing";
import { AttachmentReadout, BACKING_UNREAD } from "@/lib/ui/attachment-readout";
import type { TagDraft } from "@/lib/topics/draft";
import type { ReferenceDraft } from "@/lib/references/draft";
import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { thumbState } from "./wizard/details-step";

/** The registered edit screen (`postEdit`), and the parts its blocks hang off. */
const NODE: DataNode = { path: "postEdit" };
const BODY = part(NODE, "body");
const FACTS = part(NODE, "facts");
const VIDEO = part(NODE, "video");
const COVER = part(NODE, "cover");

function FieldLabel({ children, node }: { children: string; node?: DataNode }) {
  return (
    <span className="text-label-large" {...testAttributes(node)}>
      {children}
    </span>
  );
}

/** The header X's accessible name: the edit keeps no draft (EditCompose, EditWords boards). */
export const EDIT_LEAVE_LABEL = "Leave — the edit is discarded";

/** The body rule, under the add control (copy-voice; EditCompose.md, EditWords.md). */
export const BODY_RULE = "A post’s body is words or media, never both.";

/** What the edit's `+ Add pictures` takes: pictures. A video picked anyway is refused in words. */
const ACCEPT_PICTURES = "image/*";
/** What the words edit's `+ Add pictures or a video` takes. */
const ACCEPT_MEDIA = `image/*,${PICKABLE_VIDEO_TYPES}`;

/** A clip's tile and its face's, the height `EditComposeVideo` draws them at. */
const CLIP_TILE_HEIGHT = 96;

export function PostEditView({
  state,
  previews,
  count,
  tagErrors,
  referenceErrors,
  busy,
  held,
  slow,
  countChanged,
  writeRuleRefused,
  keyAbsent,
  refusal,
  failed,
  refusals,
  onTitle,
  onDescription,
  onWords,
  onTags,
  onReferences,
  onUndoTag,
  onUndoReference,
  onManagePictures,
  onAddMedia,
  onDismissRefusal,
  onRetryUploads,
  onRemoveFailed,
  onRemoveClip,
  onDescribeClip,
  onPickCover,
  onRemoveCover,
  onOpenSensitive,
  onOpenBacking,
  backingRawSum,
  onOpenActs,
  onHelp,
  onWriteRuleHelp,
  onWriteRuleNotNow,
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
  /** Media id or asset id → something to draw: a served URL, or a local object URL. */
  previews: Readonly<Record<string, string>>;
  /** What the batch signs, in records — the guard reads this and nothing else. */
  count: number;
  tagErrors: Readonly<Record<number, string>>;
  referenceErrors: Readonly<Record<number, string>>;
  /** The signing is out. */
  busy: boolean;
  /** A press is held at the upload gate, waiting on the bytes. */
  held: boolean;
  /** The press has gone 5s unanswered. */
  slow: boolean;
  /** The prepared batch was not the one the foot read; the held press dropped. */
  countChanged: boolean;
  writeRuleRefused: boolean;
  keyAbsent: boolean;
  refusal: string | null;
  failed: boolean;
  /** Files the add control turned away, each standing on the media row until dismissed. */
  refusals: readonly PickRefusal[];
  onTitle: (title: string) => void;
  onDescription: (description: string) => void;
  onWords: (words: string) => void;
  onTags: (tags: readonly TagDraft[]) => void;
  onReferences: (references: readonly ReferenceDraft[]) => void;
  onUndoTag: (name: string) => void;
  onUndoReference: (targetId: string) => void;
  onManagePictures: () => void;
  /** Files back from the device's own picker, for the route to screen and crop. */
  onAddMedia: (files: readonly File[]) => void;
  onDismissRefusal: (id: string) => void;
  /** Retry, under the row and on the gate: every failed upload tries again. */
  onRetryUploads: () => void;
  /** `Remove it` under the row: the failed pictures leave the batch. */
  onRemoveFailed: () => void;
  onRemoveClip: () => void;
  onDescribeClip: () => void;
  /** A picture back from the picker for the clip's face, for the route to crop. */
  onPickCover: (file: File) => void;
  /** `Remove it` under the cover row: the new face leaves the batch. */
  onRemoveCover: () => void;
  onOpenSensitive: () => void;
  onOpenActs: () => void;
  onHelp: () => void;
  /** The write rule's own "?": `Why signing waits`. */
  onWriteRuleHelp: () => void;
  /** `Not now` under the write rule's notice: the edit stands again as it was. */
  onWriteRuleNotNow: () => void;
  onSign: () => void;
  /** The back arrow and the X alike: the route decides whether leaving asks. */
  onLeave: () => void;
  /** The key-absent seal, standing in the commit's place. */
  keyCard: ReactNode;
}) {
  const media = isMediaBody(state);
  const clip = clipOf(state.gallery);
  const signing = busy || held;
  // Past 200ms the commit reads its in-flight label and the ways out refuse —
  // held at the gate or not (EditCompose.md).
  const slowAnswer = useSlowAnswer(signing);
  const problem =
    titleProblem(state.title) ??
    (media ? descriptionProblem(state.description) : wordsProblem(state.words));
  const pending = uploadsPending(state.gallery);
  const faulted = uploadsFailed(state.gallery);
  const took = editUploads(state.gallery).length;
  // Inert, never hidden, at an empty batch (EditComposeUnchanged.md:5): the
  // control stays where it is and the foot says why it goes nowhere. A failed
  // upload shuts it too, the gate saying why; a running one never does.
  const inert = count === 0 || problem !== null || faulted > 0;
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
    crop: picture.kind === "added" ? picture.asset.crop : null,
    ...(picture.kind === "added" ? thumbState(picture.asset) : {}),
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
        help={<HelpDot ariaLabel="Editing" onOpen={onHelp} node={part(NODE, "header.help")} />}
        testId="post-edit-header"
        node={part(NODE, "header")}
        focusTitle
      />

      <div className="flex flex-1 flex-col gap-3.5 px-6 pb-4 pt-3">
        {clip !== undefined ? (
          <ClipFields
            clip={clip}
            previews={previews}
            durationMs={state.durations[clip.mediaId] ?? null}
            onRemoveClip={onRemoveClip}
            onDescribeClip={onDescribeClip}
            onPickCover={onPickCover}
            onRetryUploads={onRetryUploads}
            onRemoveCover={onRemoveCover}
          />
        ) : media ? (
          <div className="flex flex-col gap-1.5" {...testAttributes(BODY)}>
            <PickedRow
              items={thumbs}
              caption={
                thumbs.length === 1 ? "1 picture — the body" : `${thumbs.length} pictures — the body`
              }
              onManage={onManagePictures}
              manageLabel={`Manage the ${thumbs.length === 1 ? "picture" : `${thumbs.length} pictures`}`}
              testId="post-edit-picked"
              node={part(BODY, "mediaRow")}
            />
            {/* The edit's row is the compose row, and it fails the compose
                way: the tile marked, one line under the row with its two ways
                out (EditCompose.md; `ComposeUploading`). */}
            {faulted > 0 && (
              <UploadErrorLine
                message={failedUploadLine(faulted)}
                onRetry={onRetryUploads}
                onRemove={onRemoveFailed}
                count={faulted}
                testId="post-edit-upload-error"
                node={part(BODY, "uploadError")}
              />
            )}
            <Refusals refusals={refusals} onDismiss={onDismissRefusal} />
            <AddControl
              label={`+ Add pictures · ${state.gallery.length} of ${POST_ATTACHMENT_CAP}`}
              accept={ACCEPT_PICTURES}
              onFiles={onAddMedia}
              testId="post-edit-add-pictures"
              node={part(BODY, "add")}
            />
            <QuietNote testId="post-edit-body-rule" node={part(BODY, "rule")}>
              {BODY_RULE}
            </QuietNote>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5" {...testAttributes(BODY)}>
            <TextField
              label="What do you want to publish?"
              value={state.words}
              onChange={onWords}
              multiline
              rows={6}
              cap={BODY_MAX_CHARS}
              error={wordsProblem(state.words) ?? undefined}
              testId="post-edit-words"
              labelNode={part(BODY, "label")}
              boxNode={part(BODY, "words")}
            />
            <Refusals refusals={refusals} onDismiss={onDismissRefusal} />
            <AddControl
              label="+ Add pictures or a video"
              accept={ACCEPT_MEDIA}
              onFiles={onAddMedia}
              testId="post-edit-add-media"
              node={part(BODY, "add")}
            />
            <QuietNote testId="post-edit-body-rule" node={part(BODY, "rule")}>
              {BODY_RULE}
            </QuietNote>
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
          node={part(NODE, "title")}
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
            node={part(NODE, "description")}
          />
        )}

        {/* The fields carry their own `Tags` and `References` labels. A staged
            chip or row opens its pair in a sheet over the edit (EditCompose.md). */}
        <TagEntryField
          tags={state.tags}
          onChange={onTags}
          fieldErrors={tagErrors}
          cap={null}
          testIdPrefix="post-edit"
          pairs="sheet"
          node={part(NODE, "tags")}
          after={withdrawnTagList.map((tag) => (
            <WithdrawnLine
              key={tag.name}
              name={`#${tag.name}`}
              onUndo={() => onUndoTag(tag.name)}
              testId={`post-edit-withdrawn-tag-${tag.name}`}
              node={part(NODE, "tags.withdrawn")}
            />
          ))}
        />

        <ReferenceEntryField
          references={state.references}
          onChange={onReferences}
          fieldErrors={referenceErrors}
          cap={null}
          testIdPrefix="post-edit"
          pairs="sheet"
          node={part(NODE, "references")}
          after={withdrawnRefList.map((reference) => (
            <WithdrawnLine
              key={reference.targetId}
              name={reference.target.label}
              onUndo={() => onUndoReference(reference.targetId)}
              testId={`post-edit-withdrawn-reference-${reference.targetId}`}
              node={part(NODE, "references.withdrawn")}
            />
          ))}
        />

        {/* FactRow's seal emphasis, the seal's order (`_shared.jsx`): the
            License row locked, Your backing under it, then Sensitive. */}
        <div className="flex flex-col" {...testAttributes(FACTS)}>
          <FactRow
            label="License"
            value={<LicenseValue node={part(FACTS, "license.value")}>{licenseName(state.license)}</LicenseValue>}
            node={part(FACTS, "license")}
            action={
              <span
                className="inline-flex text-on-surface-variant"
                aria-label="The license never changes"
                {...testAttributes(part(FACTS, "license.lock"))}
              >
                <LockGlyph />
              </span>
            }
          />
          {/* YOUR BACKING (EditCompose.md, `_shared.jsx`'s `EditBackingRow`):
              the post's backing as it stands with the edit — the raw sum plus
              the edit's own pick, clipped — one number. Unmoved, that is the
              backing as it stands. Its record rides the edit, so it adds no act. */}
          <FactRow
            label="Your backing"
            value={
              backingRawSum === null ? (
                <span data-testid="post-edit-backing-unread" className="text-body-small text-on-surface-variant">
                  {BACKING_UNREAD}
                </span>
              ) : (
                <AttachmentReadout
                  pDirected={attachmentLanding(backingRawSum, state.pick).landing}
                  testId="post-edit-backing-value"
                  node={part(FACTS, "backing.value")}
                />
              )
            }
            action="Adjust"
            onAction={onOpenBacking}
            testId="post-edit-open-backing"
            node={part(FACTS, "backing")}
          />
          <FactRow
            label="Sensitive"
            value={
              <span
                className="text-body-medium text-on-surface-variant"
                {...testAttributes(part(FACTS, "sensitive.value"))}
              >
                {state.sensitive ? "Marked" : "Not marked"}
              </span>
            }
            action={state.sensitive ? "Change" : "Mark"}
            onAction={onOpenSensitive}
            testId="post-edit-open-sensitive"
            node={part(FACTS, "sensitive")}
            last
          />
        </div>

        <div className="flex-1" />

        {refusal && (
          <p role="alert" data-testid="post-edit-refused" className="m-0 text-body-medium text-error">
            {refusal}
          </p>
        )}
        {failed && <TransportError testId="post-edit-failed" />}

        {/* THE GATE (EditCompose.md, EditComposeVideo.md): while the bytes
            the edit took are going up, the seal's line stands over the foot,
            naming the cover where the edit set one; failed, it takes its fault
            reading with Retry. */}
        {faulted > 0 ? (
          <UploadStatusLine
            done={0}
            total={0}
            failed
            failedCount={faulted}
            message={failedUploadLine(faulted)}
            onRetry={onRetryUploads}
            testId="post-edit-gate"
            node={part(NODE, "gate")}
          />
        ) : (
          pending > 0 && (
            <UploadStatusLine
              done={uploadsDone(state.gallery)}
              total={took}
              media={clip !== undefined ? "cover" : "pictures"}
              testId="post-edit-gate"
              node={part(NODE, "gate")}
            />
          )
        )}

        <ActsFooter
          count={count}
          onOpen={onOpenActs}
          subline={subline}
          sublineIsSlow={slow}
          testId="post-edit-acts-footer"
          node={part(NODE, "acts")}
        />
        {keyAbsent ? (
          keyCard
        ) : writeRuleRefused ? (
          // The write rule's notice takes the commit's place, its fact ending
          // on what is true for an edit, `Not now` its way out and no Retry
          // (EditCompose.md).
          <EditWriteRuleNotice onHelp={onWriteRuleHelp} onNotNow={onWriteRuleNotNow} testIdPrefix="post-edit" />
        ) : (
          <PillButton
            testId="post-edit-sign"
            node={part(NODE, "sign")}
            full
            disabled={inert}
            onClick={() => {
              // Refuses a second press while the signing is out or held, and
              // never dims.
              if (!signing) onSign();
            }}
          >
            {slowAnswer ? "Signing the edit…" : "Sign the edit"}
          </PillButton>
        )}
      </div>
    </main>
  );
}

/** A license name in the row's quiet voice, named for the tests. */
function LicenseValue({ children, node }: { children: string; node?: DataNode }) {
  return (
    <span className="text-body-medium text-on-surface-variant" {...testAttributes(node, "post-edit-license")}>
      {children}
    </span>
  );
}

/**
 * The add word and the device's own picker behind it — never a pick stage
 * (EditCompose.md: "the device's own picker opens AND NEVER a pick stage
 * opens"). NEVER SHUT AT THE CAP: a picture past ten is refused in words on
 * the row, which a closed picker would only hide.
 */
function AddControl({
  label,
  accept,
  onFiles,
  testId,
  node,
}: {
  label: string;
  accept: string;
  onFiles: (files: readonly File[]) => void;
  testId: string;
  node?: DataNode;
}) {
  const input = useRef<HTMLInputElement | null>(null);
  return (
    <>
      <InlineAction size="sm" testId={testId} node={node} onClick={() => input.current?.click()}>
        {label}
      </InlineAction>
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple
        data-testid={`${testId}-input`}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const files = event.target.files;
          if (files !== null && files.length > 0) onFiles([...files]);
          // Cleared so picking the same file twice in a row still fires.
          event.target.value = "";
        }}
        className="sr-only"
      />
    </>
  );
}

/** The refused files, each a `RefusedFile` under the row, until dismissed. */
function Refusals({
  refusals,
  onDismiss,
}: {
  refusals: readonly PickRefusal[];
  onDismiss: (id: string) => void;
}) {
  if (refusals.length === 0) return null;
  return (
    <ul data-testid="post-edit-refusals" className="m-0 flex list-none flex-col gap-2.5 p-0">
      {refusals.map((one) => (
        <li key={one.id}>
          <RefusedFileRow refusal={one} onDismiss={() => onDismiss(one.id)} testIdPrefix="post-edit" />
        </li>
      ))}
    </ul>
  );
}

/**
 * EditComposeVideo's two fields: the clip, which stays or leaves whole, and
 * its cover — the door (`Add a cover`) where no face was ever chosen, the face
 * and `Change the cover` where one was. A taken frame is not a choice, so it
 * opens the door too (EditComposeVideo.md). Frames are never re-offered: the
 * device's own picker is the one way in, through the cover's crop.
 */
function ClipFields({
  clip,
  previews,
  durationMs,
  onRemoveClip,
  onDescribeClip,
  onPickCover,
  onRetryUploads,
  onRemoveCover,
}: {
  clip: NonNullable<ReturnType<typeof clipOf>>;
  previews: Readonly<Record<string, string>>;
  durationMs: number | null;
  onRemoveClip: () => void;
  onDescribeClip: () => void;
  onPickCover: (file: File) => void;
  onRetryUploads: () => void;
  onRemoveCover: () => void;
}) {
  const input = useRef<HTMLInputElement | null>(null);
  const width = Math.round(CLIP_TILE_HEIGHT * (clip.ratio ?? 1));
  const face: PickedAsset | null = clip.newCover;
  const faceSrc = face !== null ? (previews[face.id] ?? null) : clip.coverUrl;
  const faceFailed = face !== null && face.upload.kind === "failed";
  const openPicker = () => input.current?.click();
  return (
    <>
      <div className="flex flex-col gap-1.5" {...testAttributes(VIDEO)}>
        <FieldLabel node={part(VIDEO, "label")}>Video</FieldLabel>
        <div className="flex items-center gap-2">
          <MediaThumb
            src={clip.coverUrl}
            altText={clip.altText}
            width={width}
            height={CLIP_TILE_HEIGHT}
            fit="cover"
            durationMs={durationMs ?? 0}
            onRemove={onRemoveClip}
            removeLabel="Remove this video"
            testId="post-edit-clip"
            node={part(VIDEO, "thumb")}
            removeNode={part(VIDEO, "thumb.remove")}
          />
        </div>
        {/* One description for the clip, none for its cover (EditComposeVideo.md). */}
        <DescribeCounter
          subject="the video"
          described={describedCount([clip])}
          total={1}
          onDescribe={onDescribeClip}
          testId="post-edit-describe-clip"
          node={part(VIDEO, "describeRow")}
        />
        {/* Where the picture edit's add control stands, the quiet line
            (copy-voice, *Staging a video*: the edit's trim). */}
        <QuietNote testId="post-edit-clip-note" node={part(VIDEO, "rule")}>
          A video is the whole post.
        </QuietNote>
      </div>

      <div className="flex flex-col gap-1.5" {...testAttributes(COVER)}>
        <FieldLabel node={part(COVER, "label")}>Cover</FieldLabel>
        {coverChosen(clip) ? (
          <div className="flex items-center gap-2">
            <MediaThumb
              src={faceSrc}
              width={width}
              height={CLIP_TILE_HEIGHT}
              fit="cover"
              crop={face?.crop ?? null}
              {...(face !== null ? thumbState(face) : {})}
              testId="post-edit-cover"
              node={part(COVER, "thumb")}
            />
            <PillButton
              variant="text"
              size="sm"
              testId="post-edit-change-cover"
              node={part(COVER, "change")}
              onClick={openPicker}
            >
              Change the cover
            </PillButton>
          </div>
        ) : (
          <>
            <InlineAction size="sm" testId="post-edit-add-cover" node={part(COVER, "add")} onClick={openPicker}>
              Add a cover
            </InlineAction>
            <QuietNote testId="post-edit-cover-note" node={part(COVER, "note")}>
              It plays the moment it is on screen, so it starts on its own first frame.
            </QuietNote>
          </>
        )}
        {faceFailed && (
          // The cover is one picture, so its line is the one-picture line
          // (EditComposeVideo.md), under the cover row with its two ways out.
          <UploadErrorLine
            message={failedUploadLine(1)}
            onRetry={onRetryUploads}
            onRemove={onRemoveCover}
            testId="post-edit-cover-error"
          />
        )}
        <input
          ref={input}
          type="file"
          accept={ACCEPT_PICTURES}
          data-testid="post-edit-cover-input"
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
