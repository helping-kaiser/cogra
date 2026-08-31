"use client";

// ComposeDetails — the optional half of the post, and the two sections the
// author already knows from 2.3 and 2.4.
//
// The topic and citation sections are the SHIPPED ones, embedded unchanged.
// They carry their own caps, their own field errors and their own finder; a
// second copy restyled for this screen would be two implementations of one
// gesture, and the batch caps are the same caps either way.
//
// THE UPLOAD STATE IS AN ADDITION TO THE CANVAS. The boards draw a picked
// gallery as if the bytes were already on the server, because on a phone board
// nothing is in flight. Here the uploads run from the moment the crop screen is
// left, so the strip that stands for the body also has to say when a picture
// has not made it and offer the retry — a reader must not reach the seal and
// find it locked for a reason no screen mentioned.

import { PillButton, TextAction } from "@/lib/ui2/pill-button";
import { TextField } from "@/lib/ui2/text-field";
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
  onCrop,
  onEdit,
  onRetry,
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
  onCrop: () => void;
  onEdit: () => void;
  onRetry: (id: string) => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-6 pb-4 pt-3">
      {mode === "media" && (
        <BodyStrip
          assets={assets}
          previews={previews}
          onCrop={onCrop}
          onEdit={onEdit}
          onRetry={onRetry}
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
      <PillButton testId="wizard-next" full onClick={onNext}>
        Next
      </PillButton>
    </div>
  );
}

function BodyStrip({
  assets,
  previews,
  onCrop,
  onEdit,
  onRetry,
}: {
  assets: readonly PickedAsset[];
  previews: Readonly<Record<string, string>>;
  onCrop: () => void;
  onEdit: () => void;
  onRetry: (id: string) => void;
}) {
  const failed = assets.filter((asset) => asset.upload.kind === "failed");
  const moving = assets.filter(
    (asset) =>
      asset.upload.kind === "waiting" ||
      asset.upload.kind === "encoding" ||
      asset.upload.kind === "uploading",
  ).length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <ul className="m-0 flex list-none gap-2 overflow-x-auto p-0">
          {assets.slice(0, 4).map((asset) => (
            <li key={asset.id} className="size-12 flex-none overflow-hidden rounded-small">
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob: URL. */}
              <img src={previews[asset.id] ?? ""} alt="" className="block size-full object-cover" />
            </li>
          ))}
        </ul>
        <span className="flex-1 text-body-small text-on-surface-variant">
          {assets.length === 1 ? "1 picture — the body" : `${assets.length} pictures — the body`}
        </span>
        <TextAction testId="wizard-recrop" onClick={onCrop}>
          Crop
        </TextAction>
        <TextAction testId="wizard-repick" onClick={onEdit}>
          Edit
        </TextAction>
      </div>

      {/* `polite` rather than `assertive`: an upload finishing is news, not an
          interruption, and ten of them would otherwise talk over the author
          filling in the title. */}
      <div role="status" aria-live="polite" className="text-label-small text-on-surface-variant">
        {moving > 0
          ? moving === 1
            ? "Uploading 1 picture…"
            : `Uploading ${moving} pictures…`
          : failed.length === 0
            ? "Every picture is uploaded."
            : ""}
      </div>

      {failed.map((asset, index) => (
        <p
          key={asset.id}
          role="alert"
          className="m-0 flex items-center gap-2 text-body-medium text-error"
        >
          <span className="flex-1">
            Picture {assets.indexOf(asset) + 1}:{" "}
            {asset.upload.kind === "failed" ? asset.upload.message : ""}
          </span>
          {asset.upload.kind === "failed" && asset.upload.retryable && (
            <TextAction testId={`wizard-retry-${index}`} onClick={() => onRetry(asset.id)}>
              Try again
            </TextAction>
          )}
        </p>
      ))}
    </div>
  );
}
