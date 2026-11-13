"use client";

// AvatarCrop — the profile picture's crop, a screen of its own in the edit's
// flow (design/designs/canonical/screens/AvatarCrop.jsx; seam 324, 323-11:
// "No inline crop is drawn; build the screen").
//
// ONE CROP MODEL (seam 301; AvatarCrop.md:3-15): the circle is a FIXED frame,
// 342 × 342 at 24 in the 390 × 390 stage, and the picture moves and zooms
// under it, the rest of it in view under the 45 % scrim — `CropFrame`'s
// `avatar` shape, whose geometry and output `crop.test.ts` and
// `crop-output.test.ts` pin. The zoom track stands under it; Next is pinned
// in the foot; no line says how to move the picture (round 44).
//
// THE WAYS OUT (AvatarCrop.md:17-23). This entrance is Change picture on the
// profile edit, so Next brings the picture back to the edit, to be signed
// with the fields under one seal — never the picture's own seal. The arrow
// goes "one stage back, to where the picture was chosen": on the web the
// picker is the platform's own file dialog, a surface with no screen of its
// own to return to, so the arrow returns to the edit that opened it, the
// picture unused. The X leaves the flow, nothing signed.

import { HeaderBar } from "@/lib/ui2/header-bar";
import { PillButton } from "@/lib/ui2/pill-button";
import { CropFrame } from "@/lib/ui2/media/crop-frame";
import type { Crop } from "@/lib/ui2/media/crop";

/** The screen's title and its X's spoken name (AvatarCrop.jsx `WizardHeader`). */
export const AVATAR_CROP_TITLE = "Your picture";
export const AVATAR_CROP_LEAVE = "Leave";

export function AvatarCrop({
  src,
  crop,
  onCrop,
  onNext,
  onBack,
  onLeave,
}: {
  /** The picked picture, as an object URL. */
  src: string;
  crop: Crop;
  onCrop: (next: Crop) => void;
  /** Hands the framed picture back to the edit. */
  onNext: () => void;
  /** Back to the edit that opened the picker, the picture unused. */
  onBack: () => void;
  /** Leaves the flow; nothing is signed. */
  onLeave: () => void;
}) {
  return (
    <main
      data-testid="avatar-crop"
      className="mx-auto flex h-dvh w-full max-w-2xl flex-col bg-surface text-on-surface"
    >
      <HeaderBar
        title={AVATAR_CROP_TITLE}
        backLabel="Back a step"
        onBack={onBack}
        onLeave={onLeave}
        leaveLabel={AVATAR_CROP_LEAVE}
        testId="avatar-crop-header"
        focusTitle
      />
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 pb-4 pt-2">
        <CropFrame src={src} shape="avatar" crop={crop} onChange={onCrop} zoomSlider testId="avatar-crop-frame" />
        <div className="flex-1" />
        <PillButton testId="avatar-crop-next" full onClick={onNext}>
          Next
        </PillButton>
      </div>
    </main>
  );
}
