// What the browser can learn about a picked video, and what it can take out of
// one — the client half of the video contract.
//
// THE CONTRACT THIS MIRRORS. The server accepts exactly one moving format: an
// MP4 container carrying H.264 video and AAC audio, at most 100 MiB, with no
// duration cap at all (`crates/api/src/media/video.rs`, and the 100 MiB /
// no-duration ruling recorded for slice 2.5.2). Everything here exists so a
// reader is told what is wrong with their file BEFORE a hundred megabytes go up
// the wire and come back refused — the server stays the authority, the client
// stays the courtesy.
//
// WHY THE SNIFF IS BYTES AND NOT `file.type`. A File's `type` is the operating
// system's guess from the extension; renaming `clip.mkv` to `clip.mp4` produces
// a File that claims `video/mp4` and is not one. The server reads the container
// header, so the client reads the same header — the `ftyp` box at offset 4 and
// the brand list after it — and the two agree by construction because the brand
// set below is copied from the server's own.
// (ISO/IEC 14496-12 §4.3 defines the FileTypeBox; the server's `sniff` is the
// reference implementation this mirrors.)
//
// WHAT THE CLIENT DELIBERATELY DOES NOT CHECK: the codecs. Reading whether the
// video track is H.264 means parsing the sample-description boxes, and a wrong
// answer here is worse than no answer — refusing a file the server would have
// taken is a defect the reader cannot work around. The container check catches
// the common mistake (a `.mkv`, a `.mov`); a codec the server refuses comes
// back as the server's own words, which is exactly how every other refusal on
// this surface already reads.

/** The one accepted moving format, matching the server's `video::MIME`. */
export const VIDEO_TYPE = "video/mp4";

/**
 * The per-asset byte cap for video, mirroring the server's
 * `DEFAULT_MAX_VIDEO_UPLOAD_BYTES`. Ten stills at their 10 MiB cap and one
 * video at this one are the same hundred megabytes — the parity is with the
 * post's BODY, not with one picture.
 */
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

/**
 * The `ftyp` brands an MP4 may announce — the server's `BRANDS`, verbatim.
 *
 * The ISO base media grammar is wider than MP4: QuickTime (`qt  `) and the
 * still formats (`avif`, `heic`) wear the same boxes, so the brand is what
 * separates the container clients are asked to produce from its relatives.
 */
const BRANDS = ["isom", "iso2", "iso4", "iso6", "mp41", "mp42", "avc1"] as const;

/** `ftyp` at offset 4, four bytes of size before it, the major brand after. */
const HEADER_LEN = 12;

function ascii(bytes: Uint8Array, from: number, to: number): string {
  return String.fromCharCode(...bytes.slice(from, to));
}

/**
 * Whether these leading bytes are an MP4 container.
 *
 * Both the major brand and the compatible-brand list count: a writer states the
 * strictest brand it meets as the major one and lists the rest, so a file that
 * merely mentions `mp42` among its compatible brands is an MP4 whatever it
 * leads with. The declared box size bounds the list so a corrupt header cannot
 * walk the whole file.
 */
export function sniffMp4(bytes: Uint8Array): boolean {
  if (bytes.length < HEADER_LEN || ascii(bytes, 4, 8) !== "ftyp") return false;
  const declared =
    (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
  const end = Math.max(HEADER_LEN, Math.min(declared >>> 0, bytes.length));
  for (let at = 8; at + 4 <= end; at += 4) {
    if ((BRANDS as readonly string[]).includes(ascii(bytes, at, at + 4))) return true;
  }
  return false;
}

/** Enough of the file to carry `ftyp` and a generous compatible-brand list. */
const SNIFF_BYTES = 256;

export async function looksLikeMp4(file: Blob): Promise<boolean> {
  const head = await file.slice(0, SNIFF_BYTES).arrayBuffer();
  return sniffMp4(new Uint8Array(head));
}

/** A picked file the composer should treat as the moving kind rather than a still. */
export function isVideoFile(file: Blob): boolean {
  return file.type.startsWith("video/");
}

export type VideoRefusal = { readonly ok: false; readonly reason: string };
export type VideoAccepted = { readonly ok: true };
export type VideoCheck = VideoAccepted | VideoRefusal;

/**
 * The pre-upload gate, in the order a reader can act on.
 *
 * Size first: it is the refusal that costs nothing to check and the one most
 * likely to bite, and telling someone their two-gigabyte export is too large
 * before reading its header is faster and no less true.
 */
export async function checkVideo(file: Blob): Promise<VideoCheck> {
  if (file.size > MAX_VIDEO_BYTES) {
    return {
      ok: false,
      reason: `That video is larger than ${formatBytes(MAX_VIDEO_BYTES)}.`,
    };
  }
  if (!(await looksLikeMp4(file))) {
    return { ok: false, reason: "Only MP4 video is accepted." };
  }
  return { ok: true };
}

/** Whole mebibytes, which is the only granularity the cap is ever stated in. */
export function formatBytes(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

/**
 * `0:42`, `1:05:03` — the duration badge the cover board draws.
 *
 * Hours appear only when there are any: a ten-second clip reading `0:00:10`
 * would be a padded number pretending to be precision, and there is no duration
 * cap, so the hour case is real and has to be drawn rather than clamped.
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0:00";
  const total = Math.round(ms / 1000);
  const seconds = total % 60;
  const minutes = Math.floor(total / 60) % 60;
  const hours = Math.floor(total / 3600);
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

export type VideoProbe = {
  readonly durationMs: number;
  readonly width: number;
  readonly height: number;
};

/**
 * Load just enough of the file for the browser to state its shape and length.
 *
 * `preload = "metadata"` is the documented way to ask for the header and no
 * more, and `loadedmetadata` is the event that fires once duration and
 * intrinsic dimensions are known
 * (https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/loadedmetadata_event).
 *
 * DURATION CAN BE `Infinity`, and that is not an error. A file written by a
 * live recorder carries no duration in its header, and MDN documents the
 * property as reading `Infinity` for an unbounded stream
 * (https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/duration).
 * The probe reports it as 0 rather than failing: the duration is a display
 * detail here, the server writes the authoritative `durationMs` off the
 * container, and refusing an otherwise good upload over a badge would be the
 * wrong trade.
 */
export function probeVideo(file: Blob): Promise<VideoProbe> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    const done = (finish: () => void) => {
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
      finish();
    };
    video.preload = "metadata";
    // Muted so a browser never treats the probe as an attempt to make noise.
    video.muted = true;
    video.addEventListener(
      "loadedmetadata",
      () => {
        const duration = video.duration;
        const probe: VideoProbe = {
          durationMs: Number.isFinite(duration) ? Math.round(duration * 1000) : 0,
          width: video.videoWidth,
          height: video.videoHeight,
        };
        done(() => resolve(probe));
      },
      { once: true },
    );
    video.addEventListener(
      "error",
      () => done(() => reject(new Error("this browser couldn't read that video"))),
      { once: true },
    );
    video.src = url;
  });
}

/**
 * Where the offered cover frames are taken from, as fractions of the clip.
 *
 * NOT ZERO, deliberately. A great many clips open on a fade from black, and a
 * black poster is the one cover that tells a reader nothing at all — so the
 * earliest offer sits just inside the opening. Three of them, evenly placed, is
 * what the ComposeCover board draws, and the first is the one selected when the
 * screen opens.
 */
export const FRAME_POINTS = [0.1, 0.5, 0.9] as const;

/**
 * Pull stills out of a clip at the given fractions of its length.
 *
 * HOW A FRAME IS TAKEN. Seek, wait for `seeked`, then draw the video element
 * into a canvas with `drawImage` — which MDN documents as accepting an
 * `HTMLVideoElement` as its source and painting the frame currently displayed
 * (https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage).
 * The `seeked` event is what makes the wait correct rather than a guess: it
 * fires once the seek has completed and the new frame is available
 * (https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/seeked_event).
 *
 * THE CANVAS IS NOT TAINTED. A blob: URL minted from a File the reader picked
 * is same-origin, so `toBlob` is allowed to read the pixels back; the
 * cross-origin rules that break frame capture for remote video do not apply on
 * this path
 * (https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_enabled_image).
 *
 * Frames come back as raw canvas blobs. They go through the ordinary image
 * encoder afterwards, so the cover that is uploaded is downscaled, re-encoded
 * to WebP and stripped exactly like any other picture — one path, not two.
 */
export async function captureFrames(
  file: Blob,
  points: readonly number[] = FRAME_POINTS,
): Promise<readonly Blob[]> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  // Required for the element to decode frames without being in the document on
  // mobile Safari, which otherwise hands back a blank canvas.
  video.playsInline = true;
  try {
    await new Promise<void>((resolve, reject) => {
      video.addEventListener("loadeddata", () => resolve(), { once: true });
      video.addEventListener(
        "error",
        () => reject(new Error("this browser couldn't read that video")),
        { once: true },
      );
      video.src = url;
    });
    const duration = video.duration;
    const length = Number.isFinite(duration) && duration > 0 ? duration : 0;
    const frames: Blob[] = [];
    for (const point of points) {
      const frame = await frameAt(video, length * point);
      if (frame) frames.push(frame);
    }
    return frames;
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

async function frameAt(video: HTMLVideoElement, time: number): Promise<Blob | null> {
  await new Promise<void>((resolve) => {
    // A seek to where the head already is fires no event, so the wait would
    // hang; resolving immediately is correct because the frame is already there.
    if (Math.abs(video.currentTime - time) < 0.001) {
      resolve();
      return;
    }
    video.addEventListener("seeked", () => resolve(), { once: true });
    video.currentTime = time;
  });
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (width === 0 || height === 0) return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(video, 0, 0, width, height);
  return new Promise<Blob | null>((resolve) => {
    // PNG, not WebP: this blob is an intermediate that `encodeForUpload`
    // immediately re-encodes, so a lossy step here would be a generation of
    // quality thrown away for nothing.
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}
