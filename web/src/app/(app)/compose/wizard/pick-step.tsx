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
import { MediaThumb } from "@/lib/ui2/compose/media-thumb";
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
  onManage,
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
  onManage: () => void;
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
      onManage={onManage}
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
  onManage,
}: {
  assets: readonly PickedAsset[];
  previews: Readonly<Record<string, string>>;
  error: string | null;
  onMode: (next: "words" | "media") => void;
  onPick: (files: readonly File[]) => void;
  onUnpick: (id: string) => void;
  onManage: () => void;
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
          <div className="flex items-baseline gap-2">
            <span className="flex-1 text-label-medium text-on-surface-variant">
              Picked · {assets.length}
            </span>
            {/* The way into the per-picture manager: reorder (first is the
                cover), remove, describe. The tray itself stays a summary. */}
            <button
              type="button"
              data-testid="wizard-show-all"
              onClick={onManage}
              className="cg-state cg-focus cursor-pointer border-0 bg-transparent p-0 text-label-small text-primary"
            >
              Show all
            </button>
          </div>
          <div className="flex items-center gap-2">
            <ul className="m-0 flex list-none gap-2 overflow-x-auto p-0">
              {assets.map((asset, index) => (
                <li key={asset.id} className="flex-none">
                  <MediaThumb
                    src={previews[asset.id] ?? null}
                    cover={index === 0}
                    onRemove={() => onUnpick(asset.id)}
                    removeLabel={`Remove picture ${index + 1}`}
                    testId={`wizard-unpick-${asset.id}`}
                  />
                </li>
              ))}
            </ul>
            <span className="flex-1 text-label-small text-on-surface-variant">
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
        className="flex flex-1 flex-col px-6 pb-6 pt-4"
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
        {/* ONE CALM REGION, not the app's newest-images grid: a browser has no
            device-gallery API, so the web's equivalent of the grid is the file
            picker and a drop target (ComposePickWeb). Dropping works where a
            desktop exists and costs nothing on a phone. */}
        <div
          className={`flex flex-1 flex-col items-center justify-center gap-3 rounded-medium border border-dashed p-6 ${
            over ? "border-primary bg-surface-container" : "border-outline"
          }`}
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant">
            <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" aria-hidden="true">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
            </svg>
          </span>
          <PillButton
            testId="wizard-open-picker"
            variant="outlined"
            disabled={full}
            onClick={() => input.current?.click()}
          >
            {full ? `${POST_ATTACHMENT_CAP} is the most` : "Choose from your files"}
          </PillButton>
          <span className="text-label-small text-on-surface-variant">…or drop them here.</span>
          {error && (
            <p role="alert" data-testid="wizard-body-error" className="m-0 text-body-medium text-error">
              {error}
            </p>
          )}
        </div>
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
