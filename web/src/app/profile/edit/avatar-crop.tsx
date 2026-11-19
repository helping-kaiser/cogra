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
// THE WAYS OUT (AvatarCrop.md:17-23) belong to the entrance, so the screen
// takes them as props. From Change picture on the profile edit, Next brings
// the picture back to the edit, to be signed with the fields under one seal —
// never the picture's own seal; from the head's change badge, Next opens the
// picture's own seal (`AvatarSeal`, `/profile/picture`). The arrow goes "one
// stage back, to where the picture was chosen": on the web the picker is the
// platform's own file dialog, a surface with no screen of its own to return
// to, so the arrow returns to the screen that opened it — the edit or the
// profile — the picture unused (seam 335, 325-2). The X leaves the flow,
// nothing signed.

import type { ReactNode } from "react";

import { HeaderBar } from "@/lib/ui2/header-bar";
import { PillButton } from "@/lib/ui2/pill-button";
import { CropFrame } from "@/lib/ui2/media/crop-frame";
import type { Crop } from "@/lib/ui2/media/crop";
import { PINNED_PAGE } from "@/lib/ui2/screen-layer";

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
  problem,
}: {
  /** The picked picture, as an object URL. */
  src: string;
  crop: Crop;
  onCrop: (next: Crop) => void;
  /** Hands the framed picture on: back to the edit, or to its own seal. */
  onNext: () => void;
  /** Back to the screen that opened the picker, the picture unused. */
  onBack: () => void;
  /** Leaves the flow; nothing is signed. */
  onLeave: () => void;
  /** What stopped Next, standing over it; nothing stands there otherwise. */
  problem?: ReactNode;
}) {
  return (
    <main
      data-testid="avatar-crop"
      className={`mx-auto flex ${PINNED_PAGE} w-full max-w-2xl flex-col bg-surface text-on-surface`}
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
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto *:shrink-0 px-6 pb-4 pt-2">
        <CropFrame src={src} shape="avatar" crop={crop} onChange={onCrop} zoomSlider testId="avatar-crop-frame" />
        <div className="flex-1" />
        {problem}
        <PillButton testId="avatar-crop-next" full onClick={onNext}>
          Next
        </PillButton>
      </div>
    </main>
  );
}
