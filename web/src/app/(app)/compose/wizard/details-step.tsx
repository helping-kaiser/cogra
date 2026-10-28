"use client";

// ComposeDetails — the optional half of the post, and the two sections the
// author already knows from 2.3 and 2.4.
//
// The topic and citation sections are the SHARED ones, carrying their own
// field errors and staged rows; a second copy restyled for this screen would
// be two implementations of one gesture. Their way IN is the stage's own:
// `+ Add a tag` and `+ Cite something` open the two pickers (TagPicker,
// ReferencePicker) the wizard draws in the stage's place. Here they set a
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
import { MediaThumb } from "@/lib/ui2/compose/media-thumb";
import { instance, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { TagEntryField } from "@/lib/ui/tag-entry-field";
import { ReferenceEntryField } from "@/lib/ui/reference-entry-field";
import { publishedMarkerText } from "@/lib/compose/published-match";
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

/** The registered media row; on the video path, the clip's own block. */
const MEDIA_ROW: DataNode = { path: "composeDetails.mediaRow" };

/** The clip's tile on details, as `ComposeDetailsVideo.jsx` draws it. */
const CLIP_TILE = { width: 54, height: 96 } as const;

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
  onOpenTagPicker,
  onOpenReferencePicker,
  onManage,
  onDescribe,
  onRetry,
  onRemove,
  onNext,
  blocked,
  published = null,
  onOpenPublished = () => {},
}: {
  /**
   * The earliest of the author's own published posts carrying media on the
   * stage, and its date — the already-published marker (ComposeDetailsReused).
   * Null draws the stage at rest.
   */
  published?: { readonly postId: string; readonly date: string } | null;
  /** The marker's door: opens the post it names. */
  onOpenPublished?: (postId: string) => void;
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
  /** `+ Add a tag`: the tag picker (ComposeDetails: "composeDetails.tags.add"). */
  onOpenTagPicker: () => void;
  /** `+ Cite something`: the citation picker (ComposeDetails.md: "the citation picker opens"). */
  onOpenReferencePicker: () => void;
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
          published={published}
          onOpenPublished={onOpenPublished}
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
          // ComposeDetailsVideo draws the clip's description two rows deep,
          // the gallery's three (ComposeDetailsBody).
          rows={assets[0] !== undefined && kindOf(assets[0]) === "video" ? 2 : 3}
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
        onOpenPicker={onOpenTagPicker}
      />
      <ReferenceEntryField
        references={references}
        onChange={onReferences}
        fieldErrors={referenceErrors}
        cap={REFERENCE_BATCH_CAP}
        testIdPrefix="wizard"
        node={{ path: "composeDetails.references" }}
        pairs="sheet"
        onOpenPicker={onOpenReferencePicker}
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
  published,
  onOpenPublished,
}: {
  assets: readonly PickedAsset[];
  previews: Readonly<Record<string, string>>;
  clipFace: string | null;
  coverPreview: string | null;
  durationMs: number;
  published: { readonly postId: string; readonly date: string } | null;
  onOpenPublished: (postId: string) => void;
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
      {isVideo ? (
        // THE CLIP'S OWN BLOCK (ComposeDetailsVideo.jsx): `FieldLabel` `Video`
        // over the clip's 54 × 96 tile — its face its own frame 0, the chosen
        // cover only as the inset, its own × — then the one describe row, 6
        // apart. No row, no caption, no manager: one clip is not a set (jakob
        // 2026-09-15). Android's `ClipBlock` draws the same.
        <div className="flex flex-col gap-1.5" {...testAttributes(MEDIA_ROW, "wizard-picked-row")}>
          <span className="text-label-large">Video</span>
          <MediaThumb
            src={clipFace}
            width={CLIP_TILE.width}
            height={CLIP_TILE.height}
            durationMs={durationMs}
            coverSrc={coverPreview}
            {...thumbState(first)}
            onRemove={() => onRemove(first.id)}
            removeLabel="Remove this video"
            testId="wizard-picked-row-thumb-0"
            node={instance(MEDIA_ROW, "thumb", "1")}
          />
          <DescribeCounter
            described={described}
            total={assets.length}
            subject="the video"
            onDescribe={onDescribe}
            testId="wizard-describe-counter"
            node={{ path: "composeDetails.describeRow" }}
          />
        </div>
      ) : (
      <PickedRow
        items={assets.map((asset) => ({
          id: asset.id,
          src: previews[asset.id] ?? null,
          // The row draws the framing the author left the crop step with —
          // the source here would read as the crop having been discarded.
          crop: asset.crop,
          ...thumbState(asset),
        }))}
        // A gallery counts itself — "3 pictures — the body" — because the
        // count is the thing to know; a clip names itself above instead.
        caption={assets.length === 1 ? "1 picture — the body" : `${assets.length} pictures — the body`}
        onManage={onManage}
        testId="wizard-picked-row"
        node={MEDIA_ROW}
      />
      )}

      {/* THE ALREADY-PUBLISHED MARKER (ComposeDetailsReused.md): one soft line
          under the media row in the honesty-marker ink, in the tappable-marker
          form `Edited` wears — underlined, quiet, `cg-hit` — named by its own
          words. It opens the post it names; nothing asks, nothing gates, and
          Next stays as live as at rest. */}
      {published !== null && (
        <button
          type="button"
          onClick={() => onOpenPublished(published.postId)}
          data-testid="composeDetails.mediaRow.published"
          className="cg-state cg-focus cg-hit cursor-pointer self-start border-0 bg-transparent p-0 text-left font-sans text-[length:var(--text-label-small)] text-on-surface-variant underline"
        >
          {publishedMarkerText(published.date)}
        </button>
      )}

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
          count={failed.length}
          testId="wizard-upload-error"
        />
      )}

      {!isVideo && (
        <DescribeCounter
          described={described}
          total={assets.length}
          subject="the pictures"
          onDescribe={onDescribe}
          testId="wizard-describe-counter"
          node={{ path: "composeDetails.describeRow" }}
        />
      )}
    </div>
  );
}
