"use client";

// ComposePick / ComposeWords — the body-first screen.
//
// One screen, two modes, because the canvas draws them as one: the same header,
// the same prompt row, and a text action that swaps sides. That IS the body XOR
// made visible — a reader never sees a words field beside a picture grid and has
// to infer that only one of them counts.
//
// WHERE THE WEB DIVERGES, and why. The phone board fills the lower two thirds
// with the device's own photo grid, which a browser has no API for and never
// will. The web idiom is the file picker plus a drop target, so that region
// becomes exactly that: the canvas's dashed tile opens the picker, the region
// around it takes a drop, and the picked pictures render in the canvas's own
// numbered tiles so the region is never an empty box. Nothing else about the
// screen moves.

import { useId, useRef, useState } from "react";

import { PillButton, TextAction } from "@/lib/ui2/pill-button";
import type { PickedAsset } from "@/lib/compose/wizard";
import { POST_ATTACHMENT_CAP } from "@/lib/compose/wizard";

/** What the picker accepts. The encoder re-writes everything to WebP anyway. */
const ACCEPT = "image/*";

export function PickStep({
  mode,
  words,
  assets,
  previews,
  error,
  onWords,
  onMode,
  onPick,
  onUnpick,
}: {
  mode: "words" | "media";
  words: string;
  assets: readonly PickedAsset[];
  previews: Readonly<Record<string, string>>;
  error: string | null;
  onWords: (next: string) => void;
  onMode: (next: "words" | "media") => void;
  onPick: (files: readonly File[]) => void;
  onUnpick: (id: string) => void;
}) {
  return mode === "words" ? (
    <WordsBody words={words} error={error} onWords={onWords} onMode={onMode} />
  ) : (
    <MediaBody
      assets={assets}
      previews={previews}
      error={error}
      onMode={onMode}
      onPick={onPick}
      onUnpick={onUnpick}
    />
  );
}

function Prompt({
  children,
  action,
  actionTestId,
  onAction,
}: {
  children: string;
  action: string;
  actionTestId: string;
  onAction: () => void;
}) {
  return (
    <div className="flex flex-none items-center gap-2 px-6 py-2">
      <p className="m-0 flex-1 text-body-medium text-on-surface-variant">{children}</p>
      <TextAction testId={actionTestId} onClick={onAction}>
        {action}
      </TextAction>
    </div>
  );
}

function WordsBody({
  words,
  error,
  onWords,
  onMode,
}: {
  words: string;
  error: string | null;
  onWords: (next: string) => void;
  onMode: (next: "words" | "media") => void;
}) {
  const id = useId();
  return (
    <>
      <Prompt action="Add pictures instead" actionTestId="wizard-to-media" onAction={() => onMode("media")}>
        The body is your words.
      </Prompt>
      <div className="flex flex-1 flex-col gap-1 px-6 pb-6 pt-2">
        <label htmlFor={id} className="text-label-large">
          What do you want to publish?
        </label>
        {/* The canvas gives the body the whole screen below the label — it is
            the post, not a field on a form. */}
        <textarea
          id={id}
          data-testid="wizard-words"
          value={words}
          onChange={(event) => onWords(event.target.value)}
          className="flex-1 resize-none rounded-extra-small border border-outline p-3 text-body-large"
        />
        {error && (
          <p role="alert" data-testid="wizard-body-error" className="text-body-medium text-error">
            {error}
          </p>
        )}
      </div>
    </>
  );
}

function MediaBody({
  assets,
  previews,
  error,
  onMode,
  onPick,
  onUnpick,
}: {
  assets: readonly PickedAsset[];
  previews: Readonly<Record<string, string>>;
  error: string | null;
  onMode: (next: "words" | "media") => void;
  onPick: (files: readonly File[]) => void;
  onUnpick: (id: string) => void;
}) {
  const input = useRef<HTMLInputElement | null>(null);
  const [over, setOver] = useState(false);
  const full = assets.length >= POST_ATTACHMENT_CAP;

  const take = (list: FileList | null) => {
    if (list === null) return;
    onPick(Array.from(list).filter((file) => file.type.startsWith("image/")));
  };

  return (
    <>
      <Prompt action="Write words instead" actionTestId="wizard-to-words" onAction={() => onMode("words")}>
        Pick one picture, several, or one video.
      </Prompt>

      {assets.length > 0 && (
        <div className="flex flex-none flex-col gap-1.5 border-b border-outline-variant px-6 pb-3 pt-1">
          <span className="text-label-medium text-on-surface-variant">
            Picked · {assets.length}
          </span>
          <div className="flex items-center gap-2">
            <ul className="m-0 flex list-none gap-2 overflow-x-auto p-0">
              {assets.map((asset, index) => (
                <li key={asset.id} className="relative size-12 flex-none overflow-hidden rounded-small">
                  {/* eslint-disable-next-line @next/next/no-img-element -- a
                      blob: URL for bytes that never left the device; the
                      optimizer has nothing to fetch and no size to reason about. */}
                  <img
                    src={previews[asset.id] ?? ""}
                    alt=""
                    className="block size-full object-cover"
                  />
                  {index === 0 ? (
                    <span className="absolute bottom-[3px] left-[3px] rounded-full bg-scrim/55 px-[5px] text-label-small text-white">
                      Cover
                    </span>
                  ) : null}
                  <button
                    type="button"
                    data-testid={`wizard-unpick-${asset.id}`}
                    aria-label={`Remove picture ${index + 1}`}
                    onClick={() => onUnpick(asset.id)}
                    className="cg-focus absolute right-[3px] top-[3px] flex size-4 items-center justify-center rounded-full bg-scrim/55 text-white"
                  >
                    <svg viewBox="0 0 24 24" width={10} height={10} fill="currentColor" aria-hidden="true">
                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
            <span className="flex-1 text-body-small text-on-surface-variant">
              The first one is the cover.
            </span>
          </div>
        </div>
      )}

      <div
        data-testid="wizard-drop"
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          take(event.dataTransfer.files);
        }}
        className={`flex flex-1 content-start flex-wrap gap-[3px] p-1 pb-0 ${over ? "bg-surface-container" : ""}`}
      >
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          multiple
          data-testid="wizard-file-input"
          onChange={(event) => {
            take(event.target.files);
            // Cleared so picking the same file twice in a row still fires.
            event.target.value = "";
          }}
          className="sr-only"
        />
        <button
          type="button"
          data-testid="wizard-open-picker"
          disabled={full}
          onClick={() => input.current?.click()}
          className="cg-state cg-focus flex size-[125px] flex-col items-center justify-center gap-1 border border-dashed border-outline text-primary disabled:opacity-40"
        >
          <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" aria-hidden="true">
            <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6 8h-2v2h-2v-2H8v-2h2v-2h2v2h2v2z" />
          </svg>
          <span className="text-label-medium">
            {full ? `${POST_ATTACHMENT_CAP} is the most` : "Choose pictures"}
          </span>
        </button>
        {assets.map((asset, index) => (
          <div key={asset.id} className="relative size-[125px] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element -- see above. */}
            <img src={previews[asset.id] ?? ""} alt="" className="block size-full object-cover" />
            <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-label-small text-on-primary">
              {index + 1}
            </span>
          </div>
        ))}
        <p className="w-full px-5 py-2 text-label-small text-on-surface-variant">
          Drag pictures here, or choose them. The order you pick is the order they appear.
        </p>
        {error && (
          <p role="alert" data-testid="wizard-body-error" className="w-full px-5 text-body-medium text-error">
            {error}
          </p>
        )}
      </div>
    </>
  );
}

/** The header's forward action, shared by both modes. */
export function PickAction({ onNext, disabled }: { onNext: () => void; disabled: boolean }) {
  return (
    <PillButton testId="wizard-next" size="sm" disabled={disabled} onClick={onNext}>
      Next
    </PillButton>
  );
}
