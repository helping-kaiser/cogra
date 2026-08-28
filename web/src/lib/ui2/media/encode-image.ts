// Client-side image processing: downscale, re-encode to WebP, and drop the
// metadata — on the device, before a single byte is uploaded (D11).
//
// WHY ON THE DEVICE. Two reasons, and the second is the one that matters.
// Uploading a 10 MiB phone original so a feed can render a 400px tile makes the
// feed expensive for everyone; that is the performance argument. The privacy
// argument is sharper: a phone photo carries GPS coordinates and a device
// serial, the graph is public and reads need no account, so publishing an
// untouched original publishes the author's home address. Stripping here is
// what makes that impossible rather than merely discouraged. The server
// re-checks and re-strips — a client is never the only guard — but the bytes
// that leave the device are already clean.
//
// HOW THE METADATA GOES. Not by parsing EXIF and deleting tags: by re-encoding.
// Drawing onto a canvas takes the DECODED PIXELS and nothing else, so the
// encoder writes a fresh file with no EXIF, no XMP, no GPS, and no maker note —
// there is no code path by which a tag could survive, because no tag is ever
// read. `encode-image.test.ts` asserts that over real fixture bytes rather than
// trusting the reasoning.
//
// Orientation is handled for us: `createImageBitmap` applies the EXIF
// orientation tag by default when decoding, so the pixels drawn are already
// upright and dropping the tag afterwards cannot produce the classic sideways
// photo.
//
// THE NUMBERS, and where they come from:
//
// · WIDTH 1080. Instagram publishes the envelope its own uploads live in:
//   photos are uploaded and displayed at up to 1080 pixels wide, and an image
//   between 320 and 1080 wide is kept at its original resolution as long as its
//   aspect ratio is between 1.91:1 and 4:5.
//   (https://help.instagram.com/1631821640426723 — "Image resolution of photos
//   you share on Instagram".) That ratio band is exactly the three shapes the
//   composer crops to, which is the strongest evidence available that 1080 is
//   the right width for this tier of product rather than a number picked to
//   feel modern.
//
// · LONG-EDGE CEILING 1440. The three post shapes at 1080 wide land at
//   1080x1350 (4:5), 1080x1080, and 1080x566 — every long edge at or under
//   1440. The ceiling exists for the paths that do NOT go through the post
//   crop (a cover, an avatar source), so nothing can arrive at 1080 wide and
//   4000 tall.
//
// · QUALITY 0.80. Google's own encoder documents `-q` as "the compression
//   factor for RGB channels between 0 and 100. The default is 75"
//   (https://developers.google.com/speed/webp/docs/cwebp). 75 is the right
//   default for a FIRST encode; this is a second-generation encode over an
//   already-lossy phone JPEG, where the two quantisation passes compound, so
//   one modest step above the default buys back the generation loss while
//   staying well inside the band where WebP beats JPEG at equal quality. The
//   canvas API takes the same factor on a 0..1 scale
//   (https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob).
//
// · WEBP, single format. One stored format keeps the server dumb and the
//   redaction path short, and WebP is the one modern format with universal
//   support that every browser can also ENCODE from a canvas.

// · THE CROP IS BAKED HERE, not layered on top. D17 rules that the client
//   crops and the uploaded bytes ARE the post's bytes, so the framing has to
//   reach the encoder rather than staying a display transform. Doing it in this
//   one pass matters: cropping to an intermediate blob and re-encoding it would
//   put a third lossy generation between the phone and the feed, and would decode
//   the same picture twice for no gain.

import { CENTERED, clampCrop, type Crop } from "./crop";

export const MAX_WIDTH = 1080;
export const MAX_LONG_EDGE = 1440;
export const WEBP_QUALITY = 0.8;
export const OUTPUT_TYPE = "image/webp";

export type EncodedImage = {
  blob: Blob;
  width: number;
  height: number;
};

export type EncodeOptions = {
  maxWidth?: number;
  maxLongEdge?: number;
  quality?: number;
  /**
   * The output's aspect ratio (width / height). Omitted, the source's own
   * shape is kept — the path a picture that never went through the crop step
   * takes.
   */
  ratio?: number;
  /** The framing inside that ratio; ignored without `ratio`. */
  crop?: Crop;
};

/**
 * The rectangle of the source the frame actually shows, in source pixels.
 *
 * It inverts what `cropStyle` does on screen, so what uploads is what the
 * author framed. Two steps, in the order the browser applies them: the picture
 * is cover-fitted to the frame, then scaled about the focal point. Cover-fitting
 * first is what bounds the result — every focal point in the unit square keeps
 * the frame covered, so the rectangle can never run off the source.
 */
export function sourceRect(
  imageWidth: number,
  imageHeight: number,
  ratio: number,
  crop: Crop = CENTERED,
): { x: number; y: number; width: number; height: number } {
  if (!Number.isFinite(ratio) || ratio <= 0) throw new Error("crop ratio is not usable");
  const { zoom, x, y } = clampCrop(crop);
  // The cover fit, expressed as the source region the frame sees at zoom 1:
  // whichever axis is proportionally longer than the frame gets trimmed.
  const sourceRatio = imageWidth / imageHeight;
  const coverWidth = sourceRatio > ratio ? imageHeight * ratio : imageWidth;
  const coverHeight = sourceRatio > ratio ? imageHeight : imageWidth / ratio;
  const width = coverWidth / zoom;
  const height = coverHeight / zoom;
  // `transform-origin` keeps the focal point fixed, so the window slides across
  // the trimmed region in proportion to how much slack the zoom opened up.
  const slack = 1 - 1 / zoom;
  return {
    x: (imageWidth - coverWidth) / 2 + x * slack * coverWidth,
    y: (imageHeight - coverHeight) / 2 + y * slack * coverHeight,
    width,
    height,
  };
}

/**
 * The scaled size for a source, honouring both caps and never enlarging.
 *
 * Upscaling a small picture wastes bytes and invents detail that is not there,
 * so a source already inside the caps is re-encoded at its own size.
 */
export function targetSize(
  width: number,
  height: number,
  { maxWidth = MAX_WIDTH, maxLongEdge = MAX_LONG_EDGE }: EncodeOptions = {},
): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("image has no usable dimensions");
  }
  const scale = Math.min(1, maxWidth / width, maxLongEdge / Math.max(width, height));
  return {
    // At least one pixel each way: a 1x2000 source scaled by the long-edge cap
    // would otherwise round to zero and produce a canvas that cannot be drawn.
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** OffscreenCanvas where the browser has it, the DOM canvas where it does not. */
async function drawToCanvas(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  from: { x: number; y: number; width: number; height: number },
): Promise<OffscreenCanvas | HTMLCanvasElement> {
  const paint = (context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) => {
    context.drawImage(bitmap, from.x, from.y, from.width, from.height, 0, 0, width, height);
  };
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("no 2d context");
    paint(context);
    return canvas;
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("no 2d context");
  paint(context);
  return canvas;
}

async function toBlob(
  canvas: OffscreenCanvas | HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  if ("convertToBlob" in canvas) {
    return canvas.convertToBlob({ type: OUTPUT_TYPE, quality });
  }
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        // A browser that cannot encode WebP hands back null (or silently gives
        // PNG). Failing loudly is right: uploading a format the contract does
        // not admit is worse than telling the reader their browser cannot do
        // this.
        if (blob && blob.type === OUTPUT_TYPE) resolve(blob);
        else reject(new Error("this browser cannot encode WebP"));
      },
      OUTPUT_TYPE,
      quality,
    );
  });
}

/**
 * Downscale and re-encode one picked file to the upload format.
 *
 * Throws rather than falling back to the original: a silent fallback would ship
 * the untouched bytes — and their GPS tag — which is the exact outcome this
 * function exists to prevent.
 */
export async function encodeForUpload(
  source: Blob,
  options: EncodeOptions = {},
): Promise<EncodedImage> {
  // `imageOrientation: "from-image"` is the default, and is what applies the
  // EXIF rotation to the pixels before we lose the tag. Stated explicitly
  // because the whole orientation argument rests on it.
  const bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
  try {
    const from =
      options.ratio === undefined
        ? { x: 0, y: 0, width: bitmap.width, height: bitmap.height }
        : sourceRect(bitmap.width, bitmap.height, options.ratio, options.crop);
    // The caps apply to what is being WRITTEN, so they read the cropped size:
    // a wide crop out of a tall original is a wide picture, and capping the
    // original's dimensions instead would shrink it for a height it no longer
    // has.
    const { width, height } = targetSize(from.width, from.height, options);
    const canvas = await drawToCanvas(bitmap, width, height, from);
    const blob = await toBlob(canvas, options.quality ?? WEBP_QUALITY);
    return { blob, width, height };
  } finally {
    // The decoded bitmap can be many megabytes; a picker that runs this over
    // ten selections would hold them all until GC noticed.
    bitmap.close();
  }
}
