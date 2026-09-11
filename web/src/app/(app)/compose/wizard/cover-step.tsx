"use client";

// ComposeCover — "The video's face".
//
// The choices are the frames pulled off the clip and a picture of the author's
// own. The board asks for four frames — "1s, 10%, 50%, 90%" (`CoverRow`) — and
// this screen offers the three fractional ones; the opening offer is a time
// rather than a fraction, which `FRAME_POINTS` has no duration to resolve.
//
// NOT a scrubber. A timeline that lets an author land on any frame is the
// obvious web idiom and it is NOT what the board asks for — a handful of offers
// and a picture tile is a smaller decision to make, and the "A picture" route
// already covers the author who wants a face the clip does not contain.
//
// THE COVER IS ITS OWN ASSET, never an attachment. It is uploaded first, and
// the video names it on its own upload (`coverMediaId`), because an asset row
// is immutable once written — so the poster is part of what the video IS rather
// than something hung on it afterwards.
//
// The captured frames are not held in the draft. They are derived from the clip
// and cost one decode to rebuild, so re-capturing them when the screen opens is
// cheaper than writing the stills to IndexedDB on every keystroke — and it
// cannot go stale. What the draft DOES keep is the choice: which offer was
// taken, and the bytes it produced.

import { useRef, useState } from "react";

import { PillButton } from "@/lib/ui2/pill-button";
import { CoverRow } from "@/lib/ui2/compose/cover-row";
import type { CoverAsset } from "@/lib/compose/wizard";
import { cssRatio, tileRatio } from "@/lib/ui2/media/aspect";
import { formatDuration } from "@/lib/ui2/media/video";

export function CoverStep({
  videoUrl,
  durationMs,
  clipRatio,
  framePreviews,
  cover,
  coverPreview,
  capturing,
  blocked,
  error,
  onPickFrame,
  onPickPicture,
  onNext,
}: {
  /** An object URL for the picked clip — the preview plays the local file. */
  videoUrl: string | null;
  durationMs: number;
  /**
   * The picked clip's own ratio, or null before the probe lands.
   *
   * THE PREVIEW SHOWS THE OUTPUT FORMAT, not a fixed frame (jakob 2026-09-11,
   * ruled final): landscape stays landscape, square stays square, and anything
   * taller than 4:5 shows at 4:5 — which is exactly what the post will be.
   */
  clipRatio: number | null;
  /** Object URLs for the offered frames, in the order they were taken. */
  framePreviews: readonly string[];
  cover: CoverAsset | null;
  /** An object URL for the author's own chosen picture — see `CoverRow`. */
  coverPreview: string | null;
  capturing: boolean;
  blocked: boolean;
  error: string | null;
  onPickFrame: (index: number) => void;
  onPickPicture: (file: File) => void;
  onNext: () => void;
}) {
  const video = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 pb-4 pt-2">
      {/* NO POSTER HERE, deliberately: the element shows its own first frame,
          and which face is chosen is said by the outlined tile below rather
          than by a still laid over the clip the author is previewing. */}
      <Preview
        ref={video}
        url={videoUrl}
        durationMs={durationMs}
        clipRatio={clipRatio}
        playing={playing}
        onPlaying={setPlaying}
      />

      <div className="flex flex-col gap-2">
        <CoverRow
          framePreviews={framePreviews}
          cover={cover}
          coverPreview={coverPreview}
          capturing={capturing}
          onPickFrame={onPickFrame}
          onPickPicture={onPickPicture}
          testIdPrefix="wizard"
        />
        {error && (
          <p role="alert" data-testid="wizard-cover-error" className="m-0 text-body-medium text-error">
            {error}
          </p>
        )}
      </div>

      <div className="flex-1" />

      <PillButton testId="wizard-next" full disabled={blocked} onClick={onNext}>
        Next
      </PillButton>
    </div>
  );
}

/**
 * The clip at rest, with the board's play affordance over it and its length in
 * the corner.
 *
 * NATIVE CONTROLS ARRIVE WITH PLAYBACK. The board draws only the resting state
 * — one play button, no scrubber — but a preview a reader cannot pause is a
 * worse screen than the board's silence implies, so the element's own controls
 * appear once it is running. Sound is allowed here because the press IS the
 * gesture: autoplay policy gates unmuted playback on user interaction, and
 * there is no autoplay on this screen at all.
 */
function Preview({
  ref,
  url,
  durationMs,
  clipRatio,
  playing,
  onPlaying,
}: {
  ref: React.RefObject<HTMLVideoElement | null>;
  url: string | null;
  durationMs: number;
  clipRatio: number | null;
  playing: boolean;
  onPlaying: (next: boolean) => void;
}) {
  // THE FRAME IS THE OUTPUT FORMAT. The element used to run at `w-full` under a
  // `max-h-96` with no ratio at all, and a replaced element sizes itself from
  // its intrinsic shape — so a 480x854 clip wanted 342x608, the cap took the
  // difference out of the HEIGHT alone, and `object-cover` cropped the result
  // into 342x384. Every vertical clip previewed as a square that way, and a
  // landscape one only looked right because it never reached the cap.
  //
  // `tileRatio` is the feed's own derivation rather than a second opinion:
  // whatever the post will be shaped like, this is shaped like it too.
  const reserved = tileRatio(clipRatio);
  return (
    <div
      style={{
        aspectRatio: url === null ? undefined : cssRatio(reserved),
        // The cap narrows the frame instead of reshaping it — the same bound,
        // for the same reason, as the feed tile's.
        maxWidth: url === null ? undefined : `calc(24rem * ${reserved})`,
        marginInline: "auto",
      }}
      data-testid="wizard-cover-preview-frame"
      className="relative w-full overflow-hidden rounded-medium bg-surface-container-high"
    >
      {url === null ? (
        <div className="grid h-80 place-items-center text-label-medium text-on-surface-variant">
          Video
        </div>
      ) : (
        <video
          ref={ref}
          src={url}
          controls={playing}
          playsInline
          data-testid="wizard-cover-preview"
          onPlay={() => onPlaying(true)}
          onPause={() => onPlaying(false)}
          onEnded={() => onPlaying(false)}
          // The frame above owns the shape now; the element fills it. Still
          // `object-cover`, because a clip taller than 4:5 centre-crops to it —
          // now against a frame that IS 4:5 rather than against a squashed box.
          className="block size-full object-cover"
        />
      )}
      {!playing && url !== null && (
        <button
          type="button"
          data-testid="wizard-cover-play"
          aria-label="Play the video"
          onClick={() => void ref.current?.play()}
          className="cg-focus absolute left-1/2 top-1/2 flex size-14 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-0 bg-scrim/55 text-white"
        >
          <svg viewBox="0 0 24 24" width={32} height={32} fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      )}
      {!playing && (
        <span
          data-testid="wizard-cover-duration"
          className="absolute bottom-2 right-2 rounded-extra-small bg-scrim/55 px-2 py-px text-label-small text-white"
        >
          {formatDuration(durationMs)}
        </span>
      )}
    </div>
  );
}

