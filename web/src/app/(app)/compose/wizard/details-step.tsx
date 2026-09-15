"use client";

// ComposeDetails — the optional half of the post, and the two sections the
// author already knows from 2.3 and 2.4.
//
// The topic and citation sections are the SHIPPED ones, embedded unchanged.
// They carry their own caps, their own field errors and their own finder; a
// second copy restyled for this screen would be two implementations of one
// gesture, and the batch caps are the same caps either way.
//
// THE UPLOAD STATE IS BOARDED (ComposeUploading, 2026-08-31): rings on the
// thumbnails, one failure with its words and ways out, and the describe counter
// — and no Crop or Edit links anywhere. The row IS the affordance and it opens
// Show all; the crop step is one Back away (jakob: "none").

import { PillButton } from "@/lib/ui2/pill-button";
import { TextField } from "@/lib/ui2/text-field";
import { DescribeCounter, PickedRow, type PickedThumb } from "@/lib/ui2/compose/picked-row";
import { UploadErrorLine } from "@/lib/ui2/compose/upload-notice";
import { TagEntryField } from "@/lib/ui/tag-entry-field";
import { ReferenceEntryField } from "@/lib/ui/reference-entry-field";
import { TAG_BATCH_CAP } from "@/lib/topics/normalize";
import { REFERENCE_BATCH_CAP } from "@/lib/references/normalize";
import type { TagDraft } from "@/lib/topics/draft";
import type { ReferenceDraft } from "@/lib/references/draft";
import {
  DESCRIPTION_MAX_CHARS,
  descriptionProblem,
  kindOf,
  TITLE_MAX_CHARS,
  titleProblem,
  type PickedAsset,
} from "@/lib/compose/wizard";

export function DetailsStep({
  mode,
  assets,
  previews,
  clipFace,
  coverPreview,
  durationMs,
  onCover,
  title,
  description,
  tags,
  references,
  tagErrors,
  referenceErrors,
  onTitle,
  onDescription,
  onTags,
  onReferences,
  onManage,
  onDescribe,
  onRetry,
  onRemove,
  onNext,
  blocked,
}: {
  mode: "words" | "media";
  assets: readonly PickedAsset[];
  previews: Readonly<Record<string, string>>;
  /** The still that stands for the clip: its cover, or its own first frame. */
  clipFace: string | null;
  /** A video's CHOSEN face, and null while it has none — what the field reads. */
  coverPreview: string | null;
  /** The video's length, badged on its own thumbnail. Meaningless off a video post. */
  durationMs: number;
  /** Opens the cover stage — one Back away, from either state of the field. */
  onCover: () => void;
  title: string;
  description: string;
  tags: readonly TagDraft[];
  references: readonly ReferenceDraft[];
  tagErrors: Readonly<Record<number, string>>;
  referenceErrors: Readonly<Record<number, string>>;
  onTitle: (next: string) => void;
  onDescription: (next: string) => void;
  onTags: (next: readonly TagDraft[]) => void;
  onReferences: (next: readonly ReferenceDraft[]) => void;
  onManage: () => void;
  onDescribe: () => void;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
  onNext: () => void;
  /** A title or description over its cap — the same law PickStep and CoverStep already draw. */
  blocked: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-6 pb-4 pt-3">
      {mode === "media" && (
        <BodyStrip
          assets={assets}
          previews={previews}
          clipFace={clipFace}
          durationMs={durationMs}
          onManage={onManage}
          onDescribe={onDescribe}
          onRetry={onRetry}
          onRemove={onRemove}
        />
      )}

      {/* The clip and its cover are TWO STANDALONE ASSETS, so the board gives
          the cover its own field under the body rather than folding it into
          the clip's tile. A gallery has no such field: its cover is its
          order. */}
      {mode === "media" && assets[0] !== undefined && kindOf(assets[0]) === "video" && (
        <CoverField face={coverPreview} onOpen={onCover} />
      )}

      <TextField
        label="Title"
        optional
        value={title}
        onChange={onTitle}
        testId="wizard-title"
        cap={TITLE_MAX_CHARS}
        error={titleProblem(title) ?? undefined}
      />
      <TextField
        label="Description"
        optional
        multiline
        rows={3}
        value={description}
        onChange={onDescription}
        testId="wizard-description"
        cap={DESCRIPTION_MAX_CHARS}
        error={descriptionProblem(description) ?? undefined}
      />

      <TagEntryField
        tags={tags}
        onChange={onTags}
        fieldErrors={tagErrors}
        cap={TAG_BATCH_CAP}
        testIdPrefix="wizard"
      />
      <ReferenceEntryField
        references={references}
        onChange={onReferences}
        fieldErrors={referenceErrors}
        cap={REFERENCE_BATCH_CAP}
        testIdPrefix="wizard"
      />

      <div className="flex-1" />
      {/* Why the seal may wait, said before the reader reaches it rather than
          as a refusal when they get there. */}
      {mode === "media" && (
        <p
          data-testid="wizard-upload-aside"
          className="m-0 text-center text-label-small text-on-surface-variant"
        >
          Pictures upload while you write — signing waits for them.
        </p>
      )}
      <PillButton testId="wizard-next" full disabled={blocked} onClick={onNext}>
        Next
      </PillButton>
    </div>
  );
}

/** How one asset's upload state reads on its thumbnail. */
export function thumbState(asset: PickedAsset): Pick<PickedThumb, "progress" | "failed"> {
  switch (asset.upload.kind) {
    case "waiting":
    case "encoding":
    case "uploading":
      // No fraction is measured, so the ring turns rather than claiming one.
      return { progress: "indeterminate" };
    case "failed":
      return { failed: true };
    default:
      return {};
  }
}

/**
 * The cover as the details board draws it — a FIELD with two states, never a
 * second entrance (`ComposeDetailsVideo`, `CommentEditVideo`).
 *
 * Empty, it is the door: "Add a cover" over the line that says what a clip
 * without one does. Filled, it is the face: the 56px still and "Change the
 * cover". Both reach the same stage, which is one Back away — the cover is
 * the clip's own standalone asset and this is where the post says whether
 * there is one.
 */
function CoverField({ face, onOpen }: { face: string | null; onOpen: () => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-label-large">Cover</span>
      {face === null ? (
        <>
          <button
            type="button"
            data-testid="wizard-cover-door"
            onClick={onOpen}
            className="cg-state cg-focus cg-hit m-0 cursor-pointer self-start border-0 bg-transparent p-0 text-label-small text-primary"
          >
            Add a cover
          </button>
          <p className="m-0 text-label-small text-on-surface-variant">
            It plays the moment it is on screen, so it starts on its own first frame.
          </p>
        </>
      ) : (
        <div className="flex items-center gap-2">
          {/* A plain `img`: an object URL for bytes already in memory. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={face}
            alt=""
            data-testid="wizard-cover-face"
            className="size-14 flex-none rounded-small bg-surface-container-high object-cover"
          />
          <button
            type="button"
            data-testid="wizard-cover-change"
            onClick={onOpen}
            className="cg-state cg-focus min-h-8 cursor-pointer rounded-full border border-transparent bg-transparent px-4 py-1.5 text-label-large text-primary"
          >
            Change the cover
          </button>
        </div>
      )}
    </div>
  );
}

function BodyStrip({
  assets,
  previews,
  clipFace,
  durationMs,
  onManage,
  onDescribe,
  onRetry,
  onRemove,
}: {
  assets: readonly PickedAsset[];
  previews: Readonly<Record<string, string>>;
  clipFace: string | null;
  durationMs: number;
  onManage: () => void;
  onDescribe: () => void;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const failed = assets.filter((asset) => asset.upload.kind === "failed");
  const described = assets.filter((asset) => asset.altText.trim() !== "").length;
  const first = assets[0];
  const isVideo = first !== undefined && kindOf(first) === "video";

  return (
    <div className="flex flex-col gap-2">
      <PickedRow
        items={assets.map((asset) => ({
          id: asset.id,
          // A VIDEO'S TILE STANDS FOR THE CLIP, and shows the clip's face:
          // the source preview is the video's blob URL, which an `<img>`
          // cannot decode, so the still is the chosen cover where there is
          // one and the clip's own first frame where there is not.
          src: isVideo ? clipFace : (previews[asset.id] ?? null),
          // The row draws the framing the author left the crop step with —
          // the source here would read as the crop having been discarded. A
          // video post never reaches the crop screen, so it has none to draw.
          crop: isVideo ? null : asset.crop,
          durationMs: isVideo ? durationMs : undefined,
          ...thumbState(asset),
        }))}
        // THE BOARD NAMES THE CLIP, IT DOES NOT COUNT IT. A gallery reads
        // "3 pictures — the body" because the count is the thing to know;
        // a clip is the whole body and there is only ever one, so
        // `ComposeDetailsVideo` labels it "Video" and leaves the counting
        // to the path that has something to count.
        caption={
          isVideo
            ? "Video"
            : assets.length === 1
              ? "1 picture — the body"
              : `${assets.length} pictures — the body`
        }
        onManage={onManage}
        testId="wizard-picked-row"
      />

      {/* One line for the failure, whatever its count — the tiles already say
          WHICH ones, so repeating a row per picture would say it twice. */}
      {failed.length > 0 && (
        <UploadErrorLine
          // One failure keeps the SERVER'S OWN WORDS — "the server refused that
          // picture" and "too many uploads" are different problems and only one
          // of them is worth retrying. Several collapse to the count, because a
          // stack of reasons is not a thing to read while writing a title.
          message={
            failed.length === 1 && failed[0].upload.kind === "failed"
              ? failed[0].upload.message
              : `${failed.length} pictures didn't upload.`
          }
          onRetry={() => {
            for (const asset of failed) {
              if (asset.upload.kind === "failed" && asset.upload.retryable) onRetry(asset.id);
            }
          }}
          onRemove={() => {
            for (const asset of failed) onRemove(asset.id);
          }}
          testId="wizard-upload-error"
        />
      )}

      <DescribeCounter
        described={described}
        total={assets.length}
        subject={isVideo ? "the video" : "the pictures"}
        onDescribe={onDescribe}
        testId="wizard-describe-counter"
      />
    </div>
  );
}
