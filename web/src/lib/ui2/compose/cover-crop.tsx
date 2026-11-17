"use client";

// CoverCrop — the crop a picture of the author's own passes before it becomes
// a clip's face (design/designs/canonical/screens/CoverCrop.jsx).
//
// THE SHAPE IS LOCKED (CoverCrop.md:3-7): the frame always has the clip's
// shape as the clip stands in a card — the clip's own ratio in a post, a clip
// taller than 4:5 at 4:5, the comment pager's square in a comment — and only
// that shape is exported; no shape chip is offered, because a cover that
// disagreed with its clip would be the face of something else. A frame cut
// from the clip needs no crop; only a picture of your own is asked to fit.
// No line explains any of it (round 44, the removable-text pass).
//
// THE BODY ONLY. The header belongs to the flow that opened the crop: its X
// says what leaving that flow keeps, by entrance (CoverCrop.jsx's docblock),
// so the host draws it — the post edit's and the comment edit's alike read
// `Leave — the edit is discarded` and raise the edit's own ask.

import { PillButton } from "@/lib/ui2/pill-button";
import { CropFrame } from "@/lib/ui2/media/crop-frame";
import type { Crop } from "@/lib/ui2/media/crop";
import { part, type DataNode } from "@/lib/ui/data-node";

/** The registered CoverCrop screen (nodes.json, round 23). */
const NODE: DataNode = { path: "coverCrop" };

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
  /** The clip's shape as it stands in a card — the frame's, locked. */
  ratio: number;
  crop: Crop;
  onCrop: (next: Crop) => void;
  /** Sets the cover and gives the step that asked for it back. */
  onNext: () => void;
  testIdPrefix: string;
}) {
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
      <div className="flex-1" />
      <PillButton testId={`${testIdPrefix}-cover-crop-next`} node={part(NODE, "next")} full onClick={onNext}>
        Next
      </PillButton>
    </div>
  );
}
