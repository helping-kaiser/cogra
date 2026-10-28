"use client";

// ComposeDetails — the optional half of the post, and the two sections the
// author already knows from 2.3 and 2.4.
//
// The topic and citation sections are the SHIPPED ones, embedded unchanged.
// They carry their own caps, their own field errors and their own finder; a
// second copy restyled for this screen would be two implementations of one
// gesture, and the batch caps are the same caps either way. Here they set a
// staged pair in its sheet (`pairs="sheet"`: TagPadCompose, RefPair), and the
// wizard's state moves only when that sheet's Done hands the pair out.
//
// THE UPLOAD STATE IS BOARDED (ComposeUploading, 2026-08-31): rings on the
// thumbnails, one failure with its words and ways out, and the describe counter
// — and no Crop or Edit links anywhere. The row IS the affordance and it opens
// Show all; the crop step is one Back away (jakob: "none").
//
// THE SCREEN IS REGISTERED (`design/designs/canonical/nodes.json`,
// `composeDetails`), so every drawn part carries its node id — see
// `lib/ui/data-node.ts`.

import { InlineAction } from "@/lib/ui2/inline-action";
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
  coverDoor,
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
  /**
   * Whether the `Add a cover` door stands: a vertical clip that skipped the
   * cover step and has no face chosen yet (ComposeDetailsVideo.md: "the stage
   * carries the Add a cover door GIVEN the clip skipped the cover step" and
   * "no cover section GIVEN the clip came through the cover step").
   */
  coverDoor: boolean;
  /** The door: opens the step the clip skipped, whose Next comes back here. */
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
          coverPreview={coverPreview}
          durationMs={durationMs}
          onManage={onManage}
          onDescribe={onDescribe}
          onRetry={onRetry}
          onRemove={onRemove}
        />
      )}

      {/* THE DOOR ONLY, AND ONLY WHILE NO FACE IS CHOSEN (jakob's ruling;
          `ComposeDetailsVideo.jsx:19-21`, design/readme.md §13 "The cover's
          tile"). Once a face exists it rides the clip's own tile above as
          its inset corner mark instead of a second field — a gallery has no
          such field either way: its cover is its order. */}
      {mode === "media" && coverDoor && <CoverField onOpen={onCover} />}

      <TextField
        label="Title"
        optional
        value={title}
        onChange={onTitle}
        testId="wizard-title"
        node={{ path: "composeDetails.title" }}
        cap={TITLE_MAX_CHARS}
        error={titleProblem(title) ?? undefined}
      />
      {/* THE WORDS PATH COMPOSES NO DESCRIPTION (K8.1/D4; ComposeCited.md:15,
          ComposeDetailsWords.md:3): a description is how words stand BESIDE
          pictures, and the server refuses one beside words. */}
      {mode === "media" && (
        <TextField
          label="Description"
          optional
          multiline
          rows={3}
          value={description}
          onChange={onDescription}
          testId="wizard-description"
          node={{ path: "composeDetails.description" }}
          cap={DESCRIPTION_MAX_CHARS}
          error={descriptionProblem(description) ?? undefined}
        />
      )}

      <TagEntryField
        tags={tags}
        onChange={onTags}
        fieldErrors={tagErrors}
        cap={TAG_BATCH_CAP}
        testIdPrefix="wizard"
        node={{ path: "composeDetails.tags" }}
        pairs="sheet"
      />
      <ReferenceEntryField
        references={references}
        onChange={onReferences}
        fieldErrors={referenceErrors}
        cap={REFERENCE_BATCH_CAP}
        testIdPrefix="wizard"
        node={{ path: "composeDetails.references" }}
        pairs="sheet"
      />

      <div className="flex-1" />
      {/* Why the seal may wait, said before the reader reaches it rather than
          as a refusal when they get there — and only while something is still
          going up: `ComposeUploading` draws it, the stage at rest
          (`ComposeDetails`) does not. */}
      {mode === "media" && assets.some((asset) => thumbState(asset).progress !== undefined) && (
        <p
          data-testid="wizard-upload-aside"
          className="m-0 text-center text-[length:var(--text-label-small)]/[var(--text-label-small--line-height)] [letter-spacing:var(--text-label-small--letter-spacing)] text-on-surface-variant"
        >
          Pictures upload while you write — signing waits for them.
        </p>
      )}
      <PillButton
        testId="wizard-next"
        node={{ path: "composeDetails.next" }}
        full
        disabled={blocked}
        onClick={onNext}
      >
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
    case "processing":
      // No fraction is measured, so the ring turns rather than claiming one.
      return { progress: "indeterminate" };
    case "failed":
      return { failed: true };
    default:
      return {};
  }
}

/**
 * The vertical/no-cover default's door — the details board's Cover field
 * where no face has been chosen (`ComposeDetailsVideo.jsx` lines 19-21,
 * design/readme.md §13 "The cover's tile"). A clip that has a chosen face
 * shows no Cover section at all — the caller only reaches here while
 * `coverPreview` is null, and the face rides the clip's own tile instead
 * once one exists.
 */
function CoverField({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-label-large">Cover</span>
      <InlineAction size="sm" testId="wizard-cover-door" onClick={onOpen}>
        Add a cover
      </InlineAction>
      <p className="m-0 text-label-small text-on-surface-variant">
        It plays the moment it is on screen, so it starts on its own first frame.
      </p>
    </div>
  );
}

function BodyStrip({
  assets,
  previews,
  clipFace,
  coverPreview,
  durationMs,
  onManage,
  onDescribe,
  onRetry,
  onRemove,
}: {
  assets: readonly PickedAsset[];
  previews: Readonly<Record<string, string>>;
  clipFace: string | null;
  coverPreview: string | null;
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
    // ComposeDetails / ComposeUploading: the row, the failure line and the
    // describe counter stand in the stage's own 14px column rhythm.
    <div className="flex flex-col gap-3.5">
      <PickedRow
        items={assets.map((asset) => ({
          id: asset.id,
          // A VIDEO'S TILE STANDS FOR THE CLIP, and shows the clip's face:
          // the source preview is the video's blob URL, which an `<img>`
          // cannot decode, so the still is the clip's own first frame —
          // always, never the chosen cover, which rides the tile only as
          // `coverSrc`'s inset mark below.
          src: isVideo ? clipFace : (previews[asset.id] ?? null),
          // The row draws the framing the author left the crop step with —
          // the source here would read as the crop having been discarded. A
          // video post never reaches the crop screen, so it has none to draw.
          crop: isVideo ? null : asset.crop,
          durationMs: isVideo ? durationMs : undefined,
          // ONE ATTACHMENT IS ONE TILE (jakob's ruling; `ComposeDetailsVideo
          // .jsx:19-21`, design/readme.md §13 "The cover's tile"): the chosen
          // cover rides the clip's own tile as its inset corner mark rather
          // than a second Cover section. Pictures carry none.
          coverSrc: isVideo ? coverPreview : undefined,
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
        // A CLIP HAS NO MANAGER (jakob's ruling 2026-09-15: "one clip is not
        // a set") — the row opens the Show all sheet for a gallery only; the
        // video tile wears its own × via `onRemove` instead
        // (`ComposeDetailsVideo.jsx` lines 22-32).
        onManage={isVideo ? null : onManage}
        onRemove={isVideo ? (index) => onRemove(assets[index]!.id) : undefined}
        removeLabel={isVideo ? "Remove this video" : undefined}
        testId="wizard-picked-row"
        node={{ path: "composeDetails.mediaRow" }}
      />

      {/* One line for the failure, whatever its count — the tiles already say
          WHICH ones, so repeating a row per picture would say it twice. */}
      {failed.length > 0 && (
        <UploadErrorLine
          // A FAILURE THAT CAN BE TRIED AGAIN READS THE BOARD'S LINE
          // (ComposeUploading.md: "One picture didn't upload."; copy-voice:
          // "That video didn't upload." for a clip) — the network's words
          // ("Couldn't reach the server.") stood in its place. A refusal
          // that no retry can change keeps its own reason, since that is the
          // only place the reason is said. Several collapse to the count,
          // because a stack of reasons is not a thing to read while writing
          // a title.
          message={
            failed.length === 1 && failed[0].upload.kind === "failed"
              ? failed[0].upload.retryable
                ? isVideo
                  ? "That video didn't upload."
                  : "One picture didn't upload."
                : failed[0].upload.message
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
        node={{ path: "composeDetails.describeRow" }}
      />
    </div>
  );
}
