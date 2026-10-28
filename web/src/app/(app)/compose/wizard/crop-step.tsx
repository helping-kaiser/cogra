"use client";

// ComposeCrop — one shape for the whole post, framing per picture.
//
// ALT TEXT IS NOT HERE, and its absence is the ruling: a description is written
// over the details step and from the Show all sheet, NEVER on crop — a geometry
// step is no place for a keyboard (design/readme.md §"The media slice").
//
// OPEN, AND REPORTED RATHER THAN PAPERED OVER: alt text rides `uploadMedia`, an
// asset row is immutable once written (D3), and ComposeUploading draws the
// uploads already running ON the details step ("Pictures upload while you
// write"). Those two together mean a description typed on details reaches the
// server only if that picture's upload has not finished yet. Nothing here
// invents a way out — the upload timing is left exactly as it shipped, and the
// race is the lane's question for jakob, who owns whether uploads wait for the
// details step or an `updateMedia` carries a late description.

import { Chip } from "@/lib/ui2/chip";
import { QuietNote } from "@/lib/ui2/quiet-note";
import { useCanPinch } from "@/lib/ui2/media/touch";
import { PillButton } from "@/lib/ui2/pill-button";
import { MediaThumb } from "@/lib/ui2/compose/media-thumb";
import { CropFrame } from "@/lib/ui2/media/crop-frame";
import { POST_SHAPES, POST_SHAPE_ORDER, type PostShape } from "@/lib/ui2/media/aspect";
import type { Crop } from "@/lib/ui2/media/crop";
import type { PickedAsset } from "@/lib/compose/wizard";

export function CropStep({
  assets,
  previews,
  shape,
  locked = false,
  focused,
  onShape,
  onFocus,
  onCrop,
  onNext,
  testIdPrefix = "wizard",
}: {
  assets: readonly PickedAsset[];
  previews: Readonly<Record<string, string>>;
  shape: PostShape;
  /**
   * The post's one shape already stands — pictures added to a published
   * post's edit (ComposeCrop.md: "the crop is locked to the post's one
   * shape") — so no chip is offered: a chip there could only make a picture
   * disagree with the ones the post already carries.
   */
  locked?: boolean;
  focused: number;
  onShape: (next: PostShape) => void;
  onFocus: (index: number) => void;
  onCrop: (id: string, crop: Crop) => void;
  onNext: () => void;
  testIdPrefix?: string;
}) {
  const canPinch = useCanPinch();
  const asset = assets[focused];
  if (asset === undefined) return null;

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-6 pb-4 pt-2">
      {/* A named group of the master's switches (`Chip.jsx`) rather than a
          radiogroup: a radiogroup whose children are not radios lies to a
          screen reader about what it will find inside. */}
      {!locked && (
        <div className="flex gap-2" role="group" aria-label="The post's shape">
          {POST_SHAPE_ORDER.map((option) => (
            <Chip
              key={option}
              testId={`${testIdPrefix}-shape-${option}`}
              selected={option === shape}
              onClick={() => onShape(option)}
            >
              {POST_SHAPES[option].label}
            </Chip>
          ))}
        </div>
      )}

      <CropFrame
        src={previews[asset.id] ?? ""}
        shape={shape}
        crop={asset.crop}
        onChange={(next) => onCrop(asset.id, next)}
        zoomSlider
        testId={`${testIdPrefix}-crop-frame`}
      />

      {/* The QuietNote under the zoom (ComposeCrop.jsx), its second sentence
          naming the gestures this device has (ComposeCrop.md; copy-voice,
          *The crops' how-to line*). */}
      <QuietNote testId={`${testIdPrefix}-crop-note`}>
        {canPinch
          ? "One shape for the whole post. Drag to move, pinch to zoom."
          : "One shape for the whole post. Drag or use the arrow keys to move, the slider to zoom."}
      </QuietNote>

      {assets.length > 1 && (
        <ul className="m-0 flex list-none gap-2 overflow-x-auto p-0">
          {assets.map((each, index) => (
            <li key={each.id} className="flex-none">
              <button
                type="button"
                data-testid={`${testIdPrefix}-crop-pick-${index}`}
                aria-label={`Frame picture ${index + 1} of ${assets.length}`}
                aria-current={index === focused}
                onClick={() => onFocus(index)}
                className={`cg-focus block rounded-small ${
                  index === focused ? "outline outline-2 outline-offset-1 outline-primary" : "opacity-65"
                }`}
              >
                {/* Each tile shows ITS OWN framing, so the strip reads as the
                    set of choices already made rather than as the originals. */}
                <MediaThumb src={previews[each.id] ?? null} crop={each.crop} testId={`${testIdPrefix}-crop-tile-${index}`} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex-1" />
      {/* THE FORWARD ACTION IS AT THE BOTTOM, on every stage (jakob 2026-09-01):
          the top-right corner used to mean Next here and X later, and an author
          trained on the corner left the flow by accident. */}
      <PillButton testId={`${testIdPrefix}-next`} full onClick={onNext}>
        Next
      </PillButton>
    </div>
  );
}
