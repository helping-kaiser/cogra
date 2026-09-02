// Strip an MP4's metadata on the device, before a byte is uploaded.
//
// WHY ON THE DEVICE, AND WHY THIS SHAPE. Pictures are already stripped here:
// the encoder re-draws them through a canvas, which takes the decoded pixels
// and nothing else, so no EXIF tag can survive. Video has no equivalent — a
// canvas cannot hold a clip — and the ruling is that the strip is nonetheless
// done on the device first, with the server checking and re-stripping only when
// the client's strip was faulty. That makes this the video half of the same
// promise: what leaves the device is already clean.
//
// A REMUX, NOT A RE-ENCODE, and the distinction is the whole design. The
// encoded H.264 and AAC packets are copied from the input's demuxer straight
// into a fresh MP4 muxer; no frame is decoded, no frame is encoded, and the
// picture quality is bit-for-bit what the author's camera produced. Only the
// CONTAINER is rewritten — which is exactly what a metadata strip needs, since
// the metadata lives in container boxes rather than in the video stream.
//
// This is also why the web does not compress video the way it downscales
// pictures: a re-encode would need an H.264 encoder, which means WebCodecs, and
// that path is unavailable on Firefox Android and carries a documented
// patent/royalty caveat. Remuxing needs neither.
//
// THE LIBRARY: mediabunny 1.55.5, MPL-2.0, pinned exactly.
// (https://mediabunny.dev · https://github.com/Vanilagy/mediabunny)
// Chosen because it is the muxer MDN's own WebCodecs guide points to, it ships
// ZERO WebAssembly and no worker asset on this path — so nothing has to be
// fetched at runtime or configured in the bundler — and its conversion is
// documented to copy rather than transcode by default:
// "Unconfigured, the conversion process handles all the details automatically,
// such as: Copying media data whenever possible, otherwise transcoding it"
// (https://mediabunny.dev/guide/converting-media-files). The only opt-out is
// `forceTranscode`, which we never set.
//
// HOW THE TAGS GO. `tags: {}` on the conversion — the documented way to "remove
// all metadata" (same page, Metadata tags section). With it the `udta` builder
// emits nothing at all, so the output carries no `udta`, no `meta` and no
// `ilst` box rather than empty ones. That is where a phone writes its GPS
// coordinates and its device identity.
//
// `formats: [MP4]` rather than `ALL_FORMATS` is deliberate: the docs note "The
// `formats` parameter enables tree-shaking"
// (https://mediabunny.dev/guide/reading-media-files), and every other demuxer
// would otherwise be bundled for a path that only ever sees MP4 — which the
// pick screening has already guaranteed by sniffing the container from the
// bytes.
//
// WHAT THIS DOES NOT REMOVE, stated because a security claim must be honest and
// neither point is documented by the library — both were read from its source:
//
//  · A per-TRACK name (`trak/udta/name`) is carried across by the conversion,
//    which copies each track's name and language. Phones put their identity in
//    `moov/udta/meta/ilst`, which `tags: {}` does remove, so this is a narrow
//    hole rather than the common case.
//  · The output's `mvhd`/`tkhd` creation time is set to the moment of the
//    remux. The original RECORDING date is therefore destroyed, which is the
//    one that matters; the upload time is stamped in its place.
//
// The server re-checks and re-strips regardless. This is the first line, not
// the only one.

import {
  BlobSource,
  BufferTarget,
  Conversion,
  Input,
  MP4,
  Mp4OutputFormat,
  Output,
} from "mediabunny";

import { VIDEO_TYPE } from "./video";

export type StripResult = {
  readonly blob: Blob;
  /** Wall time the remux took, so the composer can report what it cost. */
  readonly tookMs: number;
};

/**
 * Rewrite the container without its metadata, keeping the encoded streams.
 *
 * Throws rather than falling back to the original bytes. A silent fallback
 * would upload the untouched file — with its GPS tag — which is the exact
 * outcome this function exists to prevent; the composer turns the throw into a
 * refusal the author can read.
 */
export async function stripVideoMetadata(file: Blob): Promise<StripResult> {
  const started = performance.now();
  const input = new Input({ formats: [MP4], source: new BlobSource(file) });
  const output = new Output({
    // With `BufferTarget` the default fast-start behaviour is "in-memory",
    // which writes the `moov` box at the FRONT — so the uploaded file begins
    // playing without a second range request.
    // (https://mediabunny.dev/guide/output-formats)
    format: new Mp4OutputFormat(),
    target: new BufferTarget(),
  });

  try {
    const conversion = await Conversion.init({ input, output, tags: {} });

    // A DISCARDED TRACK IS NOT AN ERROR to this library — it simply does not
    // arrive in the output. Left unchecked, a clip whose audio the conversion
    // could not carry would upload silently without its sound, which is worse
    // than refusing it. Both the validity flag and the discard list are read.
    if (!conversion.isValid || conversion.discardedTracks.length > 0) {
      const why = conversion.discardedTracks.map((track) => track.reason).join(", ");
      throw new Error(why === "" ? "this video cannot be prepared" : why);
    }

    // `execute` finalizes the output itself, so the buffer is there afterwards.
    await conversion.execute();
    const buffer = output.target.buffer;
    if (buffer === null) throw new Error("the remux produced no bytes");

    return {
      blob: new Blob([buffer], { type: VIDEO_TYPE }),
      tookMs: Math.round(performance.now() - started),
    };
  } finally {
    input.dispose();
  }
}
