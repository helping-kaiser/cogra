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

import { COMMENT_ATTACHMENT_CAP, type CommentMedia } from "@/lib/compose/comment-media";
import { PillButton } from "../pill-button";
import { MediaThumb } from "./media-thumb";

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
  onPick,
  onRemove,
  onRetry,
  testIdPrefix = "comment",
}: {
  media: CommentMedia;
  /** Asset id → object URL for the bytes on this device. */
  previews: Readonly<Record<string, string>>;
  onPick: (files: readonly File[]) => void;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  testIdPrefix?: string;
}) {
  const ratios = usePreviewRatios(previews);
  const full = media.length >= COMMENT_ATTACHMENT_CAP;
  const failed = media.filter((asset) => asset.upload.kind === "failed");

  const take = (files: FileList | null) => {
    if (files === null || files.length === 0) return;
    onPick([...files].filter((file) => file.type.startsWith("image/")));
  };

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
            accept="image/*"
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
          + Add pictures · {media.length} of {COMMENT_ATTACHMENT_CAP}
        </label>
        {/* ReplyPicturesWeb's one addition. The target is the whole composer,
            drawn nowhere; this line is what says so. */}
        <span className="text-label-small text-on-surface-variant">…or drop them here.</span>
      </div>
    </div>
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
      const files = [...event.dataTransfer.files].filter((file) => file.type.startsWith("image/"));
      if (files.length > 0) onPick(files);
    },
  };
}
