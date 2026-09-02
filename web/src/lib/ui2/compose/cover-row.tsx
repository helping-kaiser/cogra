"use client";

// The cover row — ComposeCover's "Cover" block, and the same block inlined into
// the reply composer at comment scale (design/backlog.md item 31).
//
// ONE COMPONENT FOR BOTH because it is one design element: three frames pulled
// off the clip with the first selected, a dashed "A picture" tile beside them
// for a face of the author's own, and one line of help under it. The post gives
// it a whole screen and a comment gives it a row in the composer, but what the
// author chooses between is identical — and a second copy would be the place
// the two silently drift apart.
//
// NOT A SCRUBBER. A timeline that lets an author land on any frame is the
// obvious web idiom and it is not what the board draws: three offers plus a
// picture tile is a smaller decision, and the picture tile already covers the
// author who wants a face the clip does not contain.

import { useRef } from "react";

import { COVER_FROM_PICTURE, type CoverAsset } from "@/lib/compose/wizard";

export function CoverRow({
  framePreviews,
  cover,
  capturing,
  onPickFrame,
  onPickPicture,
  testIdPrefix = "wizard",
  /** The comment composer draws the row without its own heading. */
  heading = true,
}: {
  framePreviews: readonly string[];
  cover: CoverAsset | null;
  capturing: boolean;
  onPickFrame: (index: number) => void;
  onPickPicture: (file: File) => void;
  testIdPrefix?: string;
  heading?: boolean;
}) {
  const input = useRef<HTMLInputElement | null>(null);

  return (
    <div className="flex flex-col gap-2">
      {heading && <span className="text-label-large">Cover</span>}
      <div className="flex flex-wrap items-center gap-2">
        {framePreviews.map((src, index) => (
          // Keyed by position: the offers are a fixed list taken from one clip,
          // and two frames of an unchanging shot can produce identical bytes.
          <FrameTile
            key={index}
            src={src}
            index={index}
            selected={cover?.frame === index}
            onPick={() => onPickFrame(index)}
            testId={`${testIdPrefix}-cover-frame-${index}`}
          />
        ))}

        {capturing && framePreviews.length === 0 && (
          <span
            data-testid={`${testIdPrefix}-cover-capturing`}
            className="text-body-small text-on-surface-variant"
          >
            Reading the video…
          </span>
        )}

        <input
          ref={input}
          type="file"
          accept="image/*"
          data-testid={`${testIdPrefix}-cover-file-input`}
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
          data-testid={`${testIdPrefix}-cover-picture`}
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
    </div>
  );
}

function FrameTile({
  src,
  index,
  selected,
  onPick,
  testId,
}: {
  src: string;
  index: number;
  selected: boolean;
  onPick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
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
