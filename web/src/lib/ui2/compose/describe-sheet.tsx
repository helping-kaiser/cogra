// "Describe this picture" / "Describe the video" (design/components/compose/
// DescribeSheet) — where alt text is written.
//
// Reached PER PICTURE from the details step's describe counter and from the Show
// all sheet, and NEVER from the crop step: a geometry step is no place for a
// keyboard. The rule it makes enterable is the component rule — a description is
// authored, optional, and never invented; a picture without one is skipped by
// screen readers rather than guessed at.
//
// TWO SHAPES, ONE SHEET (jakob 2026-09-03). `video` swaps the subject: the
// title reads "Describe the video", the field asks what's in the video, and
// the preview wears the play disc. A clip is ONE thing to describe — there is
// no per-picture walk through the sheet and the cover is never offered,
// because the cover is the video's face, not a second picture.

import { useState } from "react";

import { BottomSheet } from "../bottom-sheet";
import { HelpDialog, HELP_TOPICS } from "../help-dialog";
import { PillButton } from "../pill-button";
import { TextField } from "../text-field";
import { ALT_TEXT_MAX_CHARS, altTextProblem } from "../media/caps";
import { cropAspect, cropPreviewStyle } from "../media/crop-preview";
import type { Crop } from "../media/crop";

/** The boarded height of the sheet's picture. Its width follows the framing. */
const PREVIEW_HEIGHT = 180;

export function DescribeSheet({
  open,
  onClose,
  src,
  crop,
  value,
  onChange,
  video = false,
  testId = "describe-sheet",
}: {
  open: boolean;
  onClose: () => void;
  src?: string | null;
  /** The framing the author chose, so the sheet describes what will be seen. */
  crop?: Crop | null;
  value: string;
  onChange: (next: string) => void;
  /**
   * "2 of 3" — retired by CW-15 (jakob 2026-09-03): the board never drew this
   * count, so the sheet no longer renders it. The prop stays accepted, unused,
   * because a caller outside this lane's scope still passes it.
   */
  position?: { index: number; total: number };
  /** A clip is ONE thing to describe, never a per-picture walk. */
  video?: boolean;
  testId?: string;
}) {
  const subject = video ? "video" : "picture";
  const [help, setHelp] = useState(false);
  // A DESCRIPTION IS OF WHAT WILL BE SEEN, so this shows the framing rather
  // than the source. The picture keeps the sheet's boarded height and takes the
  // framing's own width, which makes the box exactly the framing's shape — so
  // nothing is cropped a second time and nothing is squashed.
  const aspect = cropAspect(crop);
  const box =
    aspect === null
      ? null
      : { width: Math.round(PREVIEW_HEIGHT * aspect), height: PREVIEW_HEIGHT };
  const framing = box === null ? null : cropPreviewStyle(crop, box);
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={video ? "Describe the video" : "Describe this picture"}
      testId={testId}
    >
      <div className="flex flex-col gap-3">
        {/* THE REASON IS PERMANENT, NOT BEHIND THE "?" (jakob 2026-09-03) —
            it rides directly under the title on both shapes, because someone
            deciding whether to write a description needs the reason at the
            moment of deciding. */}
        <div className="flex items-start gap-2">
          <p className="m-0 flex-1 text-label-small text-on-surface-variant">
            Read aloud to people who can&apos;t see it.
          </p>
          {/* The sheet's own `?` — it carries the full explanation, so the
              field beneath it can stay one short line. */}
          <button
            type="button"
            data-testid={`${testId}-help`}
            aria-label="Describing pictures"
            onClick={() => setHelp(true)}
            className="cg-state cg-focus flex size-8 flex-none items-center justify-center rounded-full border border-outline-variant text-label-large text-primary"
          >
            ?
          </button>
        </div>
        <div className="relative flex h-[180px] items-center justify-center overflow-hidden rounded-medium bg-surface-container-high">
          {src && framing !== null && box !== null ? (
            <span
              data-testid={`${testId}-framed`}
              style={{ width: `${box.width}px`, height: `${box.height}px` }}
              className="relative block flex-none overflow-hidden"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- a blob:
                  URL for bytes that have not left the device. */}
              <img src={src} alt="" aria-hidden="true" style={framing} className="block" />
            </span>
          ) : src ? (
            // A blob: URL for bytes that have not left the device.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" aria-hidden="true" className="block max-h-full max-w-full" />
          ) : null}
          {/* The cover is the video's face, never offered a field of its own
              — the disc says "this is the clip", not "play it here". */}
          {video && (
            <span
              aria-hidden="true"
              data-testid={`${testId}-play-disc`}
              className="absolute left-1/2 top-1/2 grid size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-scrim/55 text-white"
            >
              <svg viewBox="0 0 24 24" width={28} height={28} fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          )}
        </div>
        <TextField
          label={`What's in the ${subject}`}
          optional
          multiline
          rows={2}
          value={value}
          onChange={onChange}
          testId={`${testId}-field`}
          cap={ALT_TEXT_MAX_CHARS}
          error={altTextProblem(value) ?? undefined}
        />
        <div className="flex justify-end">
          <PillButton testId={`${testId}-done`} variant="text" onClick={onClose}>
            Done
          </PillButton>
        </div>
      </div>

      <HelpDialog
        open={help}
        onClose={() => setHelp(false)}
        topic={HELP_TOPICS.describingPictures}
        testId={`${testId}-help-dialog`}
      />
    </BottomSheet>
  );
}
