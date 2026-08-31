"use client";

// ComposeCrop — one shape for the whole post, framing per picture.
//
// THE ALT-TEXT FIELD IS AN ADDITION TO THE CANVAS, and a deliberate one. No
// board in the set draws a slot for alt text anywhere, but the contract takes it
// on `uploadMedia` and there is no `updateMedia` to add it later — an asset row
// is immutable once written (D3) — so it has to be entered before the bytes go
// up. That puts it on this screen rather than on Details: this is where a
// picture is already selected one at a time, it is the last screen before the
// uploads start, and the board leaves an explicit empty region under the
// thumbnail strip. Flagged as a canvas gap rather than treated as settled.

import { Chip } from "@/lib/ui2/chip";
import { TextField } from "@/lib/ui2/text-field";
import { CropFrame } from "@/lib/ui2/media/crop-frame";
import { POST_SHAPES, POST_SHAPE_ORDER, type PostShape } from "@/lib/ui2/media/aspect";
import type { Crop } from "@/lib/ui2/media/crop";
import type { PickedAsset } from "@/lib/compose/wizard";

export function CropStep({
  assets,
  previews,
  shape,
  focused,
  onShape,
  onFocus,
  onCrop,
  onAltText,
}: {
  assets: readonly PickedAsset[];
  previews: Readonly<Record<string, string>>;
  shape: PostShape;
  focused: number;
  onShape: (next: PostShape) => void;
  onFocus: (index: number) => void;
  onCrop: (id: string, crop: Crop) => void;
  onAltText: (id: string, altText: string) => void;
}) {
  const asset = assets[focused];
  if (asset === undefined) return null;

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-6 pb-4 pt-2">
      {/* A named group of toggles rather than a radiogroup: the chips report
          `aria-pressed`, and a radiogroup whose children are not radios lies to
          a screen reader about what it will find inside. */}
      <div className="flex gap-2" role="group" aria-label="The post's shape">
        {POST_SHAPE_ORDER.map((option) => (
          <Chip
            key={option}
            testId={`wizard-shape-${option}`}
            selected={option === shape}
            onClick={() => onShape(option)}
          >
            {POST_SHAPES[option].label}
          </Chip>
        ))}
      </div>

      <CropFrame
        src={previews[asset.id] ?? ""}
        shape={shape}
        crop={asset.crop}
        onChange={(next) => onCrop(asset.id, next)}
        testId="wizard-crop-frame"
      />

      <p className="m-0 text-body-small text-on-surface-variant">
        One shape for the whole post. Drag to move, pinch to zoom.
      </p>

      {assets.length > 1 && (
        <ul className="m-0 flex list-none gap-2 overflow-x-auto p-0">
          {assets.map((each, index) => (
            <li key={each.id} className="flex-none">
              <button
                type="button"
                data-testid={`wizard-crop-pick-${index}`}
                aria-label={`Frame picture ${index + 1} of ${assets.length}`}
                aria-current={index === focused}
                onClick={() => onFocus(index)}
                className={`cg-focus block size-12 overflow-hidden rounded-small ${
                  index === focused ? "outline outline-2 outline-offset-1 outline-primary" : "opacity-65"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- a blob:
                    URL for local bytes; there is nothing for the optimizer to do. */}
                <img src={previews[each.id] ?? ""} alt="" className="block size-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Per picture, and it travels with the bytes. The label names WHICH
          picture, because a reader arriving by keyboard has no cursor to tell
          them which thumbnail is selected. */}
      <TextField
        label={
          assets.length > 1
            ? `Describe picture ${focused + 1} of ${assets.length}`
            : "Describe this picture"
        }
        optional
        value={asset.altText}
        onChange={(next) => onAltText(asset.id, next)}
        testId="wizard-alt-text"
        placeholder="What someone who can't see it would need to know"
      />
    </div>
  );
}
