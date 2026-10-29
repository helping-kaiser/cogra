"use client";

// CoverCrop — the crop a picture of the author's own passes before it becomes
// a clip's face (design/designs/canonical/screens/CoverCrop.jsx).
//
// THE SHAPE IS LOCKED (CoverCrop.md): the window wears the clip's display
// shape — the clip's own ratio in a post, the comment pager's square in a
// comment — and no shape chip is offered, because a cover that disagreed with
// its clip would be the face of something else. A frame cut from the clip
// needs no crop; only a picture of your own is asked to fit.
//
// THE BODY ONLY. The header belongs to the flow that opened the crop: its X
// says what leaving that flow keeps, by entrance (CoverCrop.jsx's docblock),
// so the host draws it — the post edit's and the comment edit's alike read
// `Leave — the edit is discarded` and raise the edit's own ask.

import { QuietNote } from "@/lib/ui2/quiet-note";
import { PillButton } from "@/lib/ui2/pill-button";
import { CropFrame } from "@/lib/ui2/media/crop-frame";
import { useCanPinch } from "@/lib/ui2/media/touch";
import type { Crop } from "@/lib/ui2/media/crop";
import { part, type DataNode } from "@/lib/ui/data-node";

/** The registered CoverCrop screen (nodes.json, round 23). */
const NODE: DataNode = { path: "coverCrop" };

/** The cover's how-to and what-for lines (copy-voice, *The crops' how-to line*, *The cover's own words*). */
export const COVER_CROP_TOUCH = "Drag to move, pinch to zoom.";
export const COVER_CROP_NO_TOUCH = "Drag or use the arrow keys to move, the slider to zoom.";
export const COVER_CROP_WHY = "The cover takes the video's shape.";

export function CoverCrop({
  src,
  ratio,
  crop,
  onCrop,
  onNext,
  testIdPrefix,
}: {
  /** The picked picture, as an object URL. */
  src: string;
  /** The clip's display ratio — the window's, locked. */
  ratio: number;
  crop: Crop;
  onCrop: (next: Crop) => void;
  /** Sets the cover and gives the step that asked for it back. */
  onNext: () => void;
  testIdPrefix: string;
}) {
  const canPinch = useCanPinch();
  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-6 pb-4 pt-2">
      <CropFrame
        src={src}
        shape={{ ratio }}
        crop={crop}
        onChange={onCrop}
        zoomSlider
        testId={`${testIdPrefix}-cover-crop-frame`}
        node={NODE}
      />
      <QuietNote testId={`${testIdPrefix}-cover-crop-how`} node={part(NODE, "howTo")}>
        {canPinch ? COVER_CROP_TOUCH : COVER_CROP_NO_TOUCH}
      </QuietNote>
      <QuietNote testId={`${testIdPrefix}-cover-crop-why`} node={part(NODE, "shapeNote")}>
        {COVER_CROP_WHY}
      </QuietNote>
      <div className="flex-1" />
      <PillButton testId={`${testIdPrefix}-cover-crop-next`} node={part(NODE, "next")} full onClick={onNext}>
        Next
      </PillButton>
    </div>
  );
}
