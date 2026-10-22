"use client";

// ComposeCover — "The video's face".
//
// The choices are the frames pulled off the clip and a picture of the author's
// own. The board asks for four frames — "1s, 10%, 50%, 90%" (`CoverRow`) —
// and `captureFrames` takes all four: the opening second, clamped to the
// clip's own length, then the three fractional points.
//
// NOT a scrubber. A timeline that lets an author land on any frame is the
// obvious web idiom and it is NOT what the board asks for — a handful of offers
// and a picture tile is a smaller decision to make, and the "A picture" route
// already covers the author who wants a face the clip does not contain.
//
// THE COVER IS ITS OWN ASSET, never an attachment. It goes up as an ordinary
// upload of its own and the clip's placement names it at prepare
// (`AttachmentInput.coverMediaId`) — which is what lets an edit put a different
// face on a clip whose bytes never move.
//
// The captured frames are not held in the draft. They are derived from the clip
// and cost one decode to rebuild, so re-capturing them when the screen opens is
// cheaper than writing the stills to IndexedDB on every keystroke — and it
// cannot go stale. What the draft DOES keep is the choice: which offer was
// taken, and the bytes it produced.

import { useEffect, useRef, useState } from "react";

import { PillButton } from "@/lib/ui2/pill-button";
import { CoverRow } from "@/lib/ui2/compose/cover-row";
import type { CoverAsset } from "@/lib/compose/wizard";
import { cssRatio, tileRatio } from "@/lib/ui2/media/aspect";
import { formatDuration } from "@/lib/ui2/media/video";
import { setMuted, useMuted } from "@/lib/ui2/media/mute";
import { VideoTransport } from "@/lib/ui2/media/video-transport";
import { LABEL_SMALL_PLAIN } from "@/lib/ui2/plain-type";

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
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 pb-4 pt-4">
      {/* NO POSTER HERE, deliberately: the element shows its own first frame,
          and which face is chosen is said by the outlined tile below rather
          than by a still laid over the clip the author is previewing. */}
      <Preview
        ref={video}
        url={videoUrl}
        durationMs={durationMs}
        clipRatio={clipRatio}
        // Extraction is done and came back with nothing (ComposeCoverNoFrames).
        noFrames={!capturing && framePreviews.length === 0}
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

/** The marks laid over the clip wear the snackbar pair (`MediaThumb.jsx`). */
const SNACKBAR = "bg-[var(--surface-snackbar)] text-[color:var(--on-surface-snackbar)]";

/**
 * The clip at rest — `MediaThumb`'s video state at post scale: the play disc
 * on its scrim and the duration in the trailing corner — and, once the play is
 * pressed, the clip running under the house transport.
 *
 * THE CHROME WHILE IT RUNS IS THE POST DETAIL'S (ComposeCoverPlaying):
 * `MediaAttachment`'s transport rung — play/pause between the two skips, the
 * inset bar with elapsed · timeline · total and the sound control — drawn
 * revealed, and with NO fullscreen toggle: the clip is not a post yet, so
 * there is nowhere for that control to go. Once playback has started the
 * cover never comes back. Sound is the one sticky decision every video
 * shares (`mute.ts`).
 *
 * THE NEUTRAL TILE where the device cut no frames (ComposeCoverNoFrames):
 * the clip's own shape reserved, `No frame` on it and the duration, and no
 * play disc — a control drawn on an empty tile is chrome.
 */
function Preview({
  ref,
  url,
  durationMs,
  clipRatio,
  noFrames,
  playing,
  onPlaying,
}: {
  ref: React.RefObject<HTMLVideoElement | null>;
  url: string | null;
  durationMs: number;
  clipRatio: number | null;
  noFrames: boolean;
  playing: boolean;
  onPlaying: (next: boolean) => void;
}) {
  // THE FRAME IS THE OUTPUT FORMAT. `tileRatio` is the feed's own derivation
  // rather than a second opinion: whatever the post will be shaped like, this
  // is shaped like it too, and the cap narrows the frame instead of
  // reshaping it.
  const reserved = tileRatio(clipRatio);
  const muted = useMuted();
  const [started, setStarted] = useState(false);
  const [ended, setEnded] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const total = durationMs / 1000;

  useEffect(() => {
    if (ref.current) ref.current.muted = muted;
  }, [ref, muted]);

  const seekTo = (to: number) => {
    const video = ref.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(total || video.duration || 0, to));
    setSeconds(video.currentTime);
  };

  return (
    <div
      style={{
        aspectRatio: url === null ? undefined : cssRatio(reserved),
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
      ) : noFrames && !started ? (
        <div
          data-testid="wizard-cover-no-frame"
          className={`grid size-full place-items-center px-2 text-center ${LABEL_SMALL_PLAIN} text-on-surface-variant`}
        >
          No frame
        </div>
      ) : (
        <video
          ref={ref}
          src={url}
          playsInline
          muted={muted}
          data-testid="wizard-cover-preview"
          onPlay={() => {
            setStarted(true);
            setEnded(false);
            onPlaying(true);
          }}
          onPause={() => onPlaying(false)}
          onEnded={() => {
            setEnded(true);
            onPlaying(false);
          }}
          onTimeUpdate={(event) => setSeconds(event.currentTarget.currentTime)}
          // The frame above owns the shape; the element fills it, and a clip
          // taller than 4:5 centre-crops to it.
          className="block size-full object-cover"
        />
      )}
      {!started && url !== null && !noFrames && (
        <button
          type="button"
          data-testid="wizard-cover-play"
          aria-label="Play the video"
          onClick={() => void ref.current?.play()}
          className={`cg-focus absolute left-1/2 top-1/2 flex size-14 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-0 ${SNACKBAR}`}
        >
          <svg viewBox="0 0 24 24" width={32} height={32} fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      )}
      {!started && (
        <span
          data-testid="wizard-cover-duration"
          className={`absolute bottom-[6px] right-[6px] rounded-small px-[6px] text-label-small ${SNACKBAR}`}
        >
          {formatDuration(durationMs)}
        </span>
      )}
      {started && url !== null && (
        <VideoTransport
          playing={playing}
          ended={ended}
          elapsed={formatDuration(seconds * 1000)}
          duration={formatDuration(durationMs)}
          progress={total > 0 ? Math.min(1, seconds / total) : 0}
          muted={muted}
          onTogglePlay={() => {
            const video = ref.current;
            if (!video) return;
            if (video.paused) void video.play();
            else video.pause();
          }}
          onToggleMute={() => setMuted(!muted)}
          onSeek={(fraction) => seekTo(fraction * total)}
          onSkip={(by) => seekTo((ref.current?.currentTime ?? 0) + by)}
          testId="wizard-cover-transport"
        />
      )}
    </div>
  );
}
