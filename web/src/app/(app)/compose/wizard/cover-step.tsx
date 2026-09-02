"use client";

// ComposeCover — "The video's face".
//
// The board draws exactly four choices and this screen offers exactly four: the
// three frames pulled off the clip, and a picture of the author's own. NOT a
// scrubber. A timeline that lets an author land on any frame is the obvious
// web idiom and it is NOT what the board asks for — three offers and a picture
// tile is a smaller decision to make, and the "A picture" route already covers
// the author who wants a face the clip does not contain.
//
// THE COVER IS ITS OWN ASSET, never an attachment. It is uploaded first, and
// the video names it on its own upload (`coverMediaId`), because an asset row
// is immutable once written — so the poster is part of what the video IS rather
// than something hung on it afterwards.
//
// The captured frames are not held in the draft. They are derived from the clip
// and cost one decode to rebuild, so re-capturing them when the screen opens is
// cheaper than writing three stills to IndexedDB on every keystroke — and it
// cannot go stale. What the draft DOES keep is the choice: which offer was
// taken, and the bytes it produced.

import { useRef, useState } from "react";

import { PillButton } from "@/lib/ui2/pill-button";
import { COVER_FROM_PICTURE, type CoverAsset } from "@/lib/compose/wizard";
import { formatDuration } from "@/lib/ui2/media/video";

export function CoverStep({
  videoUrl,
  durationMs,
  framePreviews,
  cover,
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
  /** Object URLs for the offered frames, in the order they were taken. */
  framePreviews: readonly string[];
  cover: CoverAsset | null;
  capturing: boolean;
  blocked: boolean;
  error: string | null;
  onPickFrame: (index: number) => void;
  onPickPicture: (file: File) => void;
  onNext: () => void;
}) {
  const input = useRef<HTMLInputElement | null>(null);
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
        playing={playing}
        onPlaying={setPlaying}
      />

      <div className="flex flex-col gap-2">
        <span className="text-label-large">Cover</span>
        <div className="flex gap-2">
          {framePreviews.map((src, index) => (
            // Keyed by position: the offers are a fixed list of three taken
            // from one clip, and the position IS the identity — two frames of
            // an unchanging shot can produce identical bytes.
            <FrameTile
              key={index}
              src={src}
              index={index}
              selected={cover?.frame === index}
              onPick={() => onPickFrame(index)}
            />
          ))}
          {capturing && framePreviews.length === 0 && (
            <span
              data-testid="wizard-cover-capturing"
              className="text-body-small text-on-surface-variant"
            >
              Reading the video…
            </span>
          )}

          <input
            ref={input}
            type="file"
            accept="image/*"
            data-testid="wizard-cover-file-input"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onPickPicture(file);
              // Cleared so picking the same file twice in a row still fires.
              event.target.value = "";
            }}
            className="sr-only"
          />
          <button
            type="button"
            data-testid="wizard-cover-picture"
            aria-pressed={cover?.frame === COVER_FROM_PICTURE}
            onClick={() => input.current?.click()}
            style={
              cover?.frame === COVER_FROM_PICTURE
                ? { outline: "2px solid var(--primary)", outlineOffset: "1px" }
                : undefined
            }
            className="cg-state cg-focus flex size-19 flex-none cursor-pointer flex-col items-center justify-center gap-0.5 rounded-small border border-dashed border-outline bg-transparent text-on-surface-variant"
          >
            <svg viewBox="0 0 24 24" width={20} height={20} fill="currentColor" aria-hidden="true">
              <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
            </svg>
            <span className="text-label-small">A picture</span>
          </button>
        </div>
        <p className="m-0 text-body-small text-on-surface-variant">
          A frame, or a picture of your own.
        </p>
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
  playing,
  onPlaying,
}: {
  ref: React.RefObject<HTMLVideoElement | null>;
  url: string | null;
  durationMs: number;
  playing: boolean;
  onPlaying: (next: boolean) => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-medium bg-surface-container-high">
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
          className="block max-h-96 w-full object-cover"
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

function FrameTile({
  src,
  index,
  selected,
  onPick,
}: {
  src: string;
  index: number;
  selected: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={`wizard-cover-frame-${index}`}
      aria-label={`Frame ${index + 1}`}
      aria-pressed={selected}
      onClick={onPick}
      style={selected ? { outline: "2px solid var(--primary)", outlineOffset: "1px" } : undefined}
      className={`cg-focus size-19 flex-none cursor-pointer overflow-hidden rounded-small border-0 p-0 ${
        selected ? "" : "opacity-65"
      }`}
    >
      {/* A plain `img`: these are object URLs for bytes already in memory, so
          there is nothing for the image optimizer to fetch or resize. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="size-full object-cover" />
    </button>
  );
}
