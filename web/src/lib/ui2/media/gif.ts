// Is this GIF animated? Counted from the bytes, with no decoder and no
// dependency.
//
// WHY THIS EXISTS. The image encoder re-encodes every picked picture through a
// canvas, and a canvas holds ONE frame — so an animated GIF that goes down that
// path arrives on the server as a still, silently, with the animation gone and
// nothing said. That silence is the defect: an author who posts a GIF and gets
// a frozen picture was never told. Android converts animated GIFs on the device;
// the browser has no animated encoder at all (WebCodecs ships `ImageDecoder`
// and no `ImageEncoder`), so the web's honest answer is to REFUSE an animated
// GIF in words and keep converting a still one exactly as before.
//
// HOW A GIF IS READ. The format is a header, a logical screen descriptor, then
// a sequence of blocks until the trailer — and an animated GIF is simply one
// with more than one Image Descriptor block. The structure is fully specified
// by GIF89a (https://www.w3.org/Graphics/GIF/spec-gif89a.txt), and the four
// facts this scanner needs are all in it:
//
//  · §18 Logical Screen Descriptor — 7 bytes after the 6-byte signature. Its
//    packed field bit 7 says a Global Color Table follows, and bits 0-2 give
//    its size as 3 · 2^(N+1) bytes.
//  · §20 Image Descriptor — introduced by 0x2C. Its own packed field bit 7
//    says a Local Color Table follows, sized the same way. THIS is what is
//    counted.
//  · §16 Block structure — blocks are chained as sub-blocks: a length byte,
//    that many bytes, repeating until a zero-length terminator.
//  · §23-27 Extensions — introduced by 0x21 with a label byte, then sub-blocks.
//    Skipped wholesale; a Graphic Control Extension precedes each frame but
//    counting those instead would miss a frame that carries none.
//
// The scan is bounded and reads no pixels: it walks block headers only, and
// stops the moment a second image is found — so an animated GIF costs a few
// hundred bytes of walking rather than a decode.
//
// It reads only the HEAD of the file (`ANIMATION_SCAN_BYTES`), which is what
// keeps a 50 MB GIF from being pulled into memory to answer a yes/no question.
// A file whose second frame lies past that window reads as "not proven
// animated" and converts as a still — the same outcome the app had before this
// existed, so the failure mode is the old behaviour rather than a new one.

const SIGNATURE = "GIF";
const IMAGE_DESCRIPTOR = 0x2c;
const EXTENSION = 0x21;
const TRAILER = 0x3b;

/** Enough to carry the palette and the first frames of any ordinary GIF. */
export const ANIMATION_SCAN_BYTES = 512 * 1024;

function ascii(bytes: Uint8Array, from: number, to: number): string {
  return String.fromCharCode(...bytes.slice(from, to));
}

export function isGifFile(file: Blob): boolean {
  return file.type === "image/gif";
}

/** GIF87a or GIF89a, read from the bytes rather than from the file's name. */
export function sniffGif(bytes: Uint8Array): boolean {
  return bytes.length >= 6 && ascii(bytes, 0, 3) === SIGNATURE;
}

/** A colour table of 3 · 2^(N+1) bytes, where N is the low three bits. */
function colorTableBytes(packed: number): number {
  return (packed & 0x80) === 0 ? 0 : 3 * 2 ** ((packed & 0x07) + 1);
}

/**
 * Walk the sub-block chain from `at`, returning the offset just past its
 * terminator — or the end of the buffer if the chain runs off it.
 */
function skipSubBlocks(bytes: Uint8Array, at: number): number {
  let cursor = at;
  while (cursor < bytes.length) {
    const size = bytes[cursor]!;
    if (size === 0) return cursor + 1;
    cursor += size + 1;
  }
  return bytes.length;
}

/**
 * How many frames these bytes contain, counted up to `stopAt`.
 *
 * Bounded so the common question — "is there more than one?" — costs two
 * frames of walking rather than a full parse of a long animation.
 */
export function countGifFrames(bytes: Uint8Array, stopAt = 2): number {
  if (!sniffGif(bytes)) return 0;
  // The signature is 6 bytes; the logical screen descriptor is 7 more, and its
  // packed field is the fifth of them.
  if (bytes.length < 13) return 0;
  let cursor = 13 + colorTableBytes(bytes[10]!);
  let frames = 0;

  while (cursor < bytes.length && frames < stopAt) {
    const marker = bytes[cursor]!;
    if (marker === TRAILER) break;

    if (marker === EXTENSION) {
      // 0x21, a label byte, then the sub-block chain.
      cursor = skipSubBlocks(bytes, cursor + 2);
      continue;
    }

    if (marker === IMAGE_DESCRIPTOR) {
      frames += 1;
      // 0x2C, then 8 bytes of position and size, then the packed field.
      const packed = bytes[cursor + 9];
      if (packed === undefined) break;
      // …the local colour table, the LZW minimum-code-size byte, and the
      // image's own sub-block chain.
      cursor = skipSubBlocks(bytes, cursor + 10 + colorTableBytes(packed) + 1);
      continue;
    }

    // A byte that is none of the three is a GIF this scanner cannot follow.
    // Stopping is right: claiming "one frame" for a file we stopped
    // understanding would be the silent flattening this module exists to end.
    break;
  }

  return frames;
}

/**
 * Whether the picked file is an animated GIF.
 *
 * False for a still GIF, for a GIF this scanner could not follow, and for
 * anything that is not a GIF at all — every one of which keeps the behaviour
 * the app already had.
 */
export async function isAnimatedGif(file: Blob): Promise<boolean> {
  if (!isGifFile(file)) return false;
  const head = await file.slice(0, ANIMATION_SCAN_BYTES).arrayBuffer();
  return countGifFrames(new Uint8Array(head)) > 1;
}
