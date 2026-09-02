"use client";

// A comment's picture row — design/designs/canonical/ReplyPictures and, for the
// one web-only line, ReplyPicturesWeb.
//
// COMMENTS HAVE NO PICK STAGE, on either platform. The board says so in as many
// words: "+ Add" opens the platform's own picker — Android's photo-picker
// sheet, the browser's file dialog here — and never the post wizard's grid.
// That is why this is a row and a button rather than a screen.
//
// THE ONE WEB ADDITION IS THE DROP PATH. ReplyPicturesWeb differs from
// ReplyPictures by a single quiet line beside the Add button, and by the
// composer accepting files dropped anywhere on it. There is no dashed drop
// rectangle at comment scale — that belongs to the post wizard's pick step,
// where a whole grid had to be replaced. Here the target is invisible and the
// hint is the only thing drawn, which costs a phone nothing.
//
// THE THUMBS ARE UNCROPPED. A comment's pictures never go through a crop step,
// so each tile takes the picture's own shape: a fixed 88px height and a width
// that follows the ratio, which is exactly how the board's 70x88 and 117x88
// tiles are built (88 x 0.8 and 88 x 1.33). The ratio is measured from the
// decoded preview, so before it is known the tile is square and simply
// reflows — it never crops to hide that it does not know yet.

import { useEffect, useState } from "react";

import {
  COMMENT_ATTACHMENT_CAP,
  isVideoComment,
  type CommentMedia,
} from "@/lib/compose/comment-media";
import type { PickRefusal } from "@/lib/compose/pick";
import type { CoverAsset } from "@/lib/compose/wizard";
import { PillButton } from "../pill-button";
import { CoverRow } from "./cover-row";
import { MediaThumb } from "./media-thumb";
import { DescribeCounter } from "./picked-row";
import { UploadErrorLine } from "./upload-notice";

const NO_URLS: readonly string[] = [];
const NO_REFUSALS: readonly PickRefusal[] = [];

/** The board's tile height; the width follows each picture's own ratio. */
const THUMB_HEIGHT = 88;

/** Bounds on the derived width, so a panorama or a column stays a thumbnail. */
const MIN_THUMB_WIDTH = 56;
const MAX_THUMB_WIDTH = 132;

function thumbWidth(ratio: number | undefined): number {
  if (ratio === undefined || !Number.isFinite(ratio) || ratio <= 0) return THUMB_HEIGHT;
  return Math.round(Math.min(MAX_THUMB_WIDTH, Math.max(MIN_THUMB_WIDTH, THUMB_HEIGHT * ratio)));
}

/** Each preview's own width/height, once the browser has decoded it. */
function usePreviewRatios(previews: Readonly<Record<string, string>>) {
  const [ratios, setRatios] = useState<Readonly<Record<string, number>>>({});
  useEffect(() => {
    let cancelled = false;
    for (const [id, src] of Object.entries(previews)) {
      if (!src) continue;
      const image = new Image();
      image.onload = () => {
        if (cancelled || image.naturalHeight <= 0) return;
        setRatios((current) =>
          current[id] === undefined
            ? { ...current, [id]: image.naturalWidth / image.naturalHeight }
            : current,
        );
      };
      image.src = src;
    }
    return () => {
      cancelled = true;
    };
  }, [previews]);
  return ratios;
}

export function CommentAttachments({
  media,
  previews,
  cover = null,
  framePreviews = NO_URLS,
  capturing = false,
  durationMs = 0,
  refusals = NO_REFUSALS,
  onPick,
  onRemove,
  onRetry,
  onDescribe,
  onPickFrame,
  onPickCover,
  onDismissRefusal,
  testIdPrefix = "comment",
}: {
  media: CommentMedia;
  /** Asset id → object URL for the bytes on this device. */
  previews: Readonly<Record<string, string>>;
  /** ReplyVideo's cover row. Null until a face is settled. */
  cover?: CoverAsset | null;
  framePreviews?: readonly string[];
  capturing?: boolean;
  durationMs?: number;
  refusals?: readonly PickRefusal[];
  onPick: (files: readonly File[]) => void;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  /**
   * Opens the describe sheet on the first picture. Absent on a surface that
   * has no sheet to open — the counter is an affordance, not a label, so it is
   * drawn only where pressing it does something.
   */
  onDescribe?: () => void;
  onPickFrame?: (index: number) => void;
  onPickCover?: (file: File) => void;
  onDismissRefusal?: (id: string) => void;
  testIdPrefix?: string;
}) {
  const ratios = usePreviewRatios(previews);
  const video = isVideoComment(media);
  const clip = video ? media[0] : undefined;
  const full = media.length >= COMMENT_ATTACHMENT_CAP;
  const failed = media.filter((asset) => asset.upload.kind === "failed");

  // EVERYTHING PICKED IS HANDED OVER, unknown types included: filtering here is
  // what made a dropped PDF vanish without a word, and the screening is the
  // only thing that can say why a file did not get in.
  const take = (files: FileList | null) => {
    if (files === null || files.length === 0) return;
    onPick([...files]);
  };

  // ReplyVideo: the clip, its one description, and its face. The add control is
  // gone entirely — a video takes the body whole, so an "add" beside one could
  // only ever be refused.
  if (video && clip !== undefined) {
    const upload = clip.upload;
    return (
      <div className="flex flex-col gap-3">
        <ul className="m-0 flex list-none flex-wrap items-start gap-2 p-0">
          <li className="flex-none">
            <MediaThumb
              src={framePreviews[cover?.frame ?? 0] ?? null}
              altText={clip.altText}
              width={thumbWidth(undefined)}
              height={THUMB_HEIGHT}
              fit="contain"
              durationMs={durationMs}
              progress={
                upload.kind === "encoding" || upload.kind === "uploading" || upload.kind === "waiting"
                  ? "indeterminate"
                  : undefined
              }
              failed={upload.kind === "failed"}
              onRemove={() => onRemove(clip.id)}
              removeLabel="Remove this video"
              testId={`${testIdPrefix}-media-${clip.id}`}
            />
          </li>
        </ul>

        {upload.kind === "failed" && (
          <p
            role="alert"
            data-testid={`${testIdPrefix}-media-error-${clip.id}`}
            className="m-0 flex flex-wrap items-center gap-2 text-label-small text-error"
          >
            {upload.message}
            {upload.retryable && (
              <PillButton
                variant="text"
                testId={`${testIdPrefix}-media-retry-${clip.id}`}
                onClick={() => onRetry(clip.id)}
              >
                Retry
              </PillButton>
            )}
            <PillButton
              variant="text"
              testId={`${testIdPrefix}-media-drop-${clip.id}`}
              onClick={() => onRemove(clip.id)}
            >
              Remove
            </PillButton>
          </p>
        )}

        {/* ONE description for the clip. Its cover takes none — a poster is the
            video's face, not a second attachment a reader could be told about. */}
        {onDescribe && (
          <DescribeCounter
            described={clip.altText.trim() === "" ? 0 : 1}
            total={1}
            subject="the video"
            onDescribe={onDescribe}
            testId={`${testIdPrefix}-describe-counter`}
          />
        )}

        {onPickFrame && onPickCover && (
          <CoverRow
            framePreviews={framePreviews}
            cover={cover}
            capturing={capturing}
            onPickFrame={onPickFrame}
            onPickPicture={onPickCover}
            testIdPrefix={testIdPrefix}
          />
        )}

        <Refusals
          refusals={refusals}
          onDismiss={onDismissRefusal}
          testIdPrefix={testIdPrefix}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {media.length > 0 && (
        <ul className="m-0 flex list-none flex-wrap items-start gap-2 p-0">
          {media.map((asset) => {
            const upload = asset.upload;
            return (
              <li key={asset.id} className="flex-none">
                <MediaThumb
                  src={previews[asset.id] ?? null}
                  altText={asset.altText}
                  width={thumbWidth(ratios[asset.id])}
                  height={THUMB_HEIGHT}
                  fit="contain"
                  // The model reports a stage, not a fraction, so the ring
                  // turns rather than inventing a percentage.
                  progress={
                    upload.kind === "encoding" || upload.kind === "uploading" || upload.kind === "waiting"
                      ? "indeterminate"
                      : undefined
                  }
                  failed={upload.kind === "failed"}
                  onRemove={() => onRemove(asset.id)}
                  testId={`${testIdPrefix}-media-${asset.id}`}
                />
              </li>
            );
          })}
        </ul>
      )}

      {/* The ways out of a failure are words beside the row, never crammed
          into the tile — the tile only wears the badge. */}
      {failed.map((asset) => (
        <p
          key={asset.id}
          role="alert"
          data-testid={`${testIdPrefix}-media-error-${asset.id}`}
          className="m-0 flex flex-wrap items-center gap-2 text-label-small text-error"
        >
          {asset.upload.kind === "failed" ? asset.upload.message : ""}
          {asset.upload.kind === "failed" && asset.upload.retryable && (
            <PillButton
              variant="text"
              testId={`${testIdPrefix}-media-retry-${asset.id}`}
              onClick={() => onRetry(asset.id)}
            >
              Retry
            </PillButton>
          )}
          <PillButton
            variant="text"
            testId={`${testIdPrefix}-media-drop-${asset.id}`}
            onClick={() => onRemove(asset.id)}
          >
            Remove
          </PillButton>
        </p>
      ))}

      {/* Between the tray and the Add row, where ReplyPicturesWeb puts it. */}
      {onDescribe && media.length > 0 && (
        <DescribeCounter
          described={media.filter((asset) => asset.altText.trim() !== "").length}
          total={media.length}
          onDescribe={onDescribe}
          testId={`${testIdPrefix}-describe-counter`}
        />
      )}

      <div className="flex flex-wrap items-baseline gap-2">
        <label
          data-testid={`${testIdPrefix}-add-media`}
          className={`cg-state cg-focus-within cursor-pointer text-label-small text-primary ${
            full ? "pointer-events-none opacity-50" : ""
          }`}
        >
          {/* The platform's own dialog, opened by the label: there is no pick
              screen at comment scale. */}
          <input
            type="file"
            accept="image/*,video/mp4"
            multiple
            disabled={full}
            data-testid={`${testIdPrefix}-media-input`}
            onChange={(event) => {
              take(event.target.files);
              // So picking the same file twice in a row still fires.
              event.target.value = "";
            }}
            className="sr-only"
          />
          {/* THE LABEL FOLLOWS THE STATE (design/backlog.md item 31, round 2
              point 3): an empty composer offers both kinds, because both are
              still possible; once pictures are in, the count is the useful
              thing and a video is no longer on offer. */}
          {media.length === 0
            ? "+ Add pictures or a video"
            : `+ Add pictures · ${media.length} of ${COMMENT_ATTACHMENT_CAP}`}
        </label>
        {/* ReplyPicturesWeb's one addition. The target is the whole composer,
            drawn nowhere; this line is what says so. */}
        <span className="text-label-small text-on-surface-variant">
          …or drop pictures or a video here.
        </span>
      </div>

      <Refusals refusals={refusals} onDismiss={onDismissRefusal} testIdPrefix={testIdPrefix} />
    </div>
  );
}

/**
 * The files that did not get in — ReplyMediaErrors, at comment scale.
 *
 * One line per file, each carrying its own way out, sitting beside a composer
 * that went on accepting everything else. They PERSIST until dismissed: a file
 * refused mid-batch is easy to miss, and a banner that faded would leave an
 * author wondering where their picture went. No Retry — retrying cannot make a
 * file smaller or a format readable.
 */
function Refusals({
  refusals,
  onDismiss,
  testIdPrefix,
}: {
  refusals: readonly PickRefusal[];
  onDismiss?: (id: string) => void;
  testIdPrefix: string;
}) {
  if (refusals.length === 0 || !onDismiss) return null;
  return (
    <ul
      data-testid={`${testIdPrefix}-refusals`}
      className="m-0 flex list-none flex-col gap-1 p-0"
    >
      {refusals.map((refusal) => (
        <li key={refusal.id}>
          <UploadErrorLine
            message={refusal.reason}
            onRemove={() => onDismiss(refusal.id)}
            testId={`${testIdPrefix}-refusal-${refusal.id}`}
          />
        </li>
      ))}
    </ul>
  );
}

/**
 * The drop handlers the composer spreads onto itself.
 *
 * Separate from the row because the TARGET is the whole composer, not the row —
 * that is what "drop them anywhere on it" means, and a target that matched the
 * hint's own line would be a much worse one to hit.
 */
export function commentDropHandlers(onPick: (files: readonly File[]) => void) {
  return {
    onDragOver: (event: React.DragEvent) => {
      // Without this the browser navigates to the dropped file and the
      // half-written comment is gone.
      event.preventDefault();
    },
    onDrop: (event: React.DragEvent) => {
      event.preventDefault();
      // Unfiltered: a dropped video routes to the composer's video state, and
      // anything the screening refuses gets a line saying why rather than
      // disappearing.
      const files = [...event.dataTransfer.files];
      if (files.length > 0) onPick(files);
    },
  };
}
