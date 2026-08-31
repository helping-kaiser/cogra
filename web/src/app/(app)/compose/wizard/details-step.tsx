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
import type { PickedAsset } from "@/lib/compose/wizard";

export function DetailsStep({
  mode,
  assets,
  previews,
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
}: {
  mode: "words" | "media";
  assets: readonly PickedAsset[];
  previews: Readonly<Record<string, string>>;
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
}) {
  return (
    <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-6 pb-4 pt-3">
      {mode === "media" && (
        <BodyStrip
          assets={assets}
          previews={previews}
          onManage={onManage}
          onDescribe={onDescribe}
          onRetry={onRetry}
          onRemove={onRemove}
        />
      )}

      <TextField
        label="Title"
        optional
        value={title}
        onChange={onTitle}
        testId="wizard-title"
      />
      <TextField
        label="Description"
        optional
        multiline
        rows={3}
        value={description}
        onChange={onDescription}
        testId="wizard-description"
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
      <PillButton testId="wizard-next" full onClick={onNext}>
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

function BodyStrip({
  assets,
  previews,
  onManage,
  onDescribe,
  onRetry,
  onRemove,
}: {
  assets: readonly PickedAsset[];
  previews: Readonly<Record<string, string>>;
  onManage: () => void;
  onDescribe: () => void;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const failed = assets.filter((asset) => asset.upload.kind === "failed");
  const described = assets.filter((asset) => asset.altText.trim() !== "").length;

  return (
    <div className="flex flex-col gap-2">
      <PickedRow
        items={assets.map((asset) => ({
          id: asset.id,
          src: previews[asset.id] ?? null,
          ...thumbState(asset),
        }))}
        caption={
          assets.length === 1 ? "1 picture — the body" : `${assets.length} pictures — the body`
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
        onDescribe={onDescribe}
        testId="wizard-describe-counter"
      />
    </div>
  );
}
