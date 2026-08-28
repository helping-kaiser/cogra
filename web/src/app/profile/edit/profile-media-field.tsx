"use client";

// The avatar and cover pickers (D13) — the post picker's parts at a fixed shape.
//
// THE THREE VALUES ARE THE WHOLE POINT of this component. A profile update is
// three-valued where a content edit is two-valued: omitted leaves the picture
// alone, an explicit null CLEARS it back to the monogram, and an id replaces
// it. The difference is easy to get wrong in exactly one direction — treating
// "the author didn't touch it" as "the author cleared it" — so the field never
// reports a value it was not given, and the three states are named rather than
// inferred from an empty string.
//
// The monogram is not a gap: it is the designed placeholder and stays the
// permanent fallback for an actor with no avatar, so "Remove" is a real, calm
// choice rather than an incomplete state.

import { useEffect, useRef, useState } from "react";

import { Button } from "@/lib/ui/button";
import { MonogramAvatar } from "@/lib/ui2/monogram-avatar";
import { CropFrame } from "@/lib/ui2/media/crop-frame";
import { MediaTile } from "@/lib/ui2/media/media-tile";
import { CENTERED, type Crop } from "@/lib/ui2/media/crop";
import { AVATAR_RATIO, COVER_RATIO } from "@/lib/ui2/media/aspect";

/** What the field is holding, before any of it has been uploaded. */
export type ProfileMediaChoice =
  | { readonly kind: "unchanged" }
  | { readonly kind: "cleared" }
  | { readonly kind: "picked"; readonly file: Blob; readonly crop: Crop };

export const UNCHANGED: ProfileMediaChoice = { kind: "unchanged" };

export const PROFILE_RATIOS = { avatar: AVATAR_RATIO, cover: COVER_RATIO } as const;

export function ProfileMediaField({
  kind,
  name,
  currentUrl,
  choice,
  onChoice,
  testIdPrefix,
}: {
  kind: "avatar" | "cover";
  /** For the monogram the avatar falls back to. */
  name: string;
  /** What the profile carries today, or null where it carries nothing. */
  currentUrl: string | null;
  choice: ProfileMediaChoice;
  onChoice: (next: ProfileMediaChoice) => void;
  testIdPrefix: string;
}) {
  const input = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // One object URL per pick, revoked when it is replaced or the field goes.
  useEffect(() => {
    if (choice.kind !== "picked") {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(choice.file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [choice]);

  const label = kind === "avatar" ? "Avatar" : "Cover";
  const showing = choice.kind === "cleared" ? null : (preview ?? currentUrl);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-label-large">{label}</span>

      {choice.kind === "picked" && preview !== null ? (
        // Framing happens in place: a sheet over a form the reader is already
        // filling in would hide the rest of their edits behind a scrim.
        <CropFrame
          src={preview}
          shape={kind}
          crop={choice.crop}
          onChange={(crop) => onChoice({ ...choice, crop })}
          testId={`${testIdPrefix}-${kind}-crop`}
        />
      ) : kind === "avatar" ? (
        <MonogramAvatar
          name={name}
          src={showing}
          size={96}
          testId={`${testIdPrefix}-avatar-preview`}
        />
      ) : (
        <MediaTile
          src={showing}
          altText=""
          ratio={COVER_RATIO}
          fit="cover"
          testId={`${testIdPrefix}-cover-preview`}
        />
      )}

      <input
        ref={input}
        type="file"
        accept="image/*"
        data-testid={`${testIdPrefix}-${kind}-input`}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onChoice({ kind: "picked", file, crop: CENTERED });
          event.target.value = "";
        }}
        className="sr-only"
      />

      <div className="flex gap-2">
        <Button
          testId={`${testIdPrefix}-${kind}-choose`}
          variant="outline"
          size="sm"
          onClick={() => input.current?.click()}
        >
          {showing === null ? "Choose" : "Replace"}
        </Button>
        {/* Only offered where there is something to remove — and a fresh pick
            is undone rather than cleared, because clearing would ALSO throw away
            the picture the profile already carries. */}
        {choice.kind === "picked" ? (
          <Button
            testId={`${testIdPrefix}-${kind}-undo`}
            variant="text"
            size="sm"
            onClick={() => onChoice(UNCHANGED)}
          >
            Undo
          </Button>
        ) : (
          (currentUrl !== null || choice.kind === "cleared") && (
            <Button
              testId={`${testIdPrefix}-${kind}-remove`}
              variant="text"
              size="sm"
              onClick={() => onChoice(choice.kind === "cleared" ? UNCHANGED : { kind: "cleared" })}
            >
              {choice.kind === "cleared" ? "Keep it" : "Remove"}
            </Button>
          )
        )}
      </div>

      {choice.kind === "cleared" && (
        <p className="m-0 text-label-small text-on-surface-variant">
          {kind === "avatar"
            ? "Saving replaces it with your monogram."
            : "Saving removes the cover."}
        </p>
      )}
    </div>
  );
}
