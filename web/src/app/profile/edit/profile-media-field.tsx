"use client";

// The profile edit's picture row (D13; ProfileEdit.jsx): the profile's one
// picture at 64px and the outline `Change picture`, which opens the device's
// picker and then the picture's own crop screen (`AvatarCrop`) — no crop is
// drawn inline (seam 324, 323-11).
//
// THE THREE VALUES ARE THE WHOLE POINT of this component. A profile update is
// three-valued where a content edit is two-valued: omitted leaves the picture
// alone, an explicit null CLEARS it back to the monogram, and an id replaces
// it. The difference is easy to get wrong in exactly one direction — treating
// "the author didn't touch it" as "the author cleared it" — so the field never
// reports a value it was not given, and the three states are named rather than
// inferred from an empty string.
//
// REMOVE AND UNDO ARE NOT DRAWN, AND STAY (seam 325, G-A1: kept as today, open
// at design). The board's row holds the picture and `Change picture` only;
// clearing a picture is a capability the API offers and the web always had, so
// it is not cut here. It stands where it disturbs the board least: one quiet
// text button AFTER `Change picture` in the same row — `Remove` while the
// profile carries a picture, `Keep it` once removed, `Undo` for a fresh pick —
// and the removal's one line under the row.

import { useEffect, useMemo, useRef, useState } from "react";

import { PillButton } from "@/lib/ui2/pill-button";
import { MonogramAvatar } from "@/lib/ui2/monogram-avatar";
import { cropPreviewStyle } from "@/lib/ui2/media/crop-preview";
import type { Crop } from "@/lib/ui2/media/crop";
import { AVATAR_RATIO } from "@/lib/ui2/media/aspect";

/** What the field is holding, before any of it has been uploaded. */
export type ProfileMediaChoice =
  | { readonly kind: "unchanged" }
  | { readonly kind: "cleared" }
  | { readonly kind: "picked"; readonly file: Blob; readonly crop: Crop };

export const UNCHANGED: ProfileMediaChoice = { kind: "unchanged" };

export const PROFILE_RATIOS = { avatar: AVATAR_RATIO } as const;

/** The row's disc (ProfileEdit.jsx `MonogramAvatar size={64}`). */
const DISC = 64;

export function ProfileMediaField({
  name,
  currentUrl,
  choice,
  onChoice,
  onPick,
  testIdPrefix,
}: {
  /** For the monogram the avatar falls back to. */
  name: string;
  /** What the profile carries today, or null where it carries nothing. */
  currentUrl: string | null;
  choice: ProfileMediaChoice;
  onChoice: (next: ProfileMediaChoice) => void;
  /** A picture the picker handed back, for its crop screen. */
  onPick: (file: File) => void;
  testIdPrefix: string;
}) {
  const input = useRef<HTMLInputElement | null>(null);

  // One object URL per PICKED FILE. Derived rather than stored in state — an
  // effect that set it would render once with the old picture still showing.
  const file = choice.kind === "picked" ? choice.file : null;
  const preview = useMemo(() => (file === null ? null : URL.createObjectURL(file)), [file]);
  useEffect(() => {
    if (preview === null) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  const showing = choice.kind === "cleared" ? null : (preview ?? currentUrl);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4">
        {choice.kind === "picked" && preview !== null ? (
          <FramedDisc src={preview} crop={choice.crop} testId={`${testIdPrefix}-avatar-preview`} />
        ) : (
          <MonogramAvatar name={name} src={showing} size={DISC} testId={`${testIdPrefix}-avatar-preview`} />
        )}
        <PillButton
          testId={`${testIdPrefix}-avatar-choose`}
          variant="outlined"
          size="sm"
          onClick={() => input.current?.click()}
        >
          Change picture
        </PillButton>
        {choice.kind === "picked" ? (
          <PillButton testId={`${testIdPrefix}-avatar-undo`} variant="text" size="sm" onClick={() => onChoice(UNCHANGED)}>
            Undo
          </PillButton>
        ) : (
          (currentUrl !== null || choice.kind === "cleared") && (
            // A fresh pick is undone rather than cleared: clearing would ALSO
            // throw away the picture the profile already carries.
            <PillButton
              testId={`${testIdPrefix}-avatar-remove`}
              variant="text"
              size="sm"
              onClick={() => onChoice(choice.kind === "cleared" ? UNCHANGED : { kind: "cleared" })}
            >
              {choice.kind === "cleared" ? "Keep it" : "Remove"}
            </PillButton>
          )
        )}
      </div>

      <input
        ref={input}
        type="file"
        accept="image/*"
        data-testid={`${testIdPrefix}-avatar-input`}
        onChange={(event) => {
          const picked = event.target.files?.[0];
          if (picked) onPick(picked);
          event.target.value = "";
        }}
        className="sr-only"
      />

      {choice.kind === "cleared" && (
        <p className="m-0 text-label-small text-on-surface-variant">Saving replaces it with your monogram.</p>
      )}
    </div>
  );
}

/**
 * A fresh pick in the row's disc, showing the framing the crop gave it rather
 * than the whole picture (`crop-preview.ts`) — the bytes are cut only at Save.
 */
function FramedDisc({ src, crop, testId }: { src: string; crop: Crop; testId: string }) {
  const [failed, setFailed] = useState(false);
  const placed = cropPreviewStyle(crop, { width: DISC, height: DISC });
  return (
    <span
      data-testid={testId}
      style={{ width: DISC, height: DISC }}
      className="relative flex flex-none overflow-hidden rounded-full bg-secondary-container"
    >
      {!failed && (
        // eslint-disable-next-line @next/next/no-img-element -- a device-local object URL, never served media
        <img
          src={src}
          alt=""
          onError={() => setFailed(true)}
          style={placed ?? undefined}
          className={placed === null ? "size-full object-cover" : undefined}
        />
      )}
    </span>
  );
}
