// What a clip is sent as: the upload target, as arithmetic.
//
// THE SAME TARGET AS ANDROID, NUMBER FOR NUMBER. The Android composer encodes
// every clip to H.264 at 1080 on the short side, four megabits scaled down so a
// long clip still fits its cap, never below one megabit, with AAC at 128 kbps
// (`core:domain`'s `VideoBitrate` and `MediaGeometry`, driven by
// `AndroidVideoProcessor`). The server holds every upload to that same target.
// A web clip that arrived at a different one would be a second quality bar for
// the same feed, so the constants and the formula below are Android's,
// transcribed operation for operation — the same inputs give the same integer,
// and `video-target.test.ts` pins it.
//
// Pure functions over numbers, and deliberately so: the encode itself needs
// WebCodecs, which no test runtime has, so everything that DECIDES lives here
// where it can be stated as a test.

/** The everyday rate: 1080p at about four megabits (Android's `STANDARD_VIDEO_BPS`). */
export const STANDARD_VIDEO_BPS = 4_000_000;

/** AAC at 128 kbps (Android's `AUDIO_BPS`). */
export const AUDIO_BPS = 128_000;

/**
 * The lowest 1080p rate worth shipping (Android's `FLOOR_VIDEO_BPS`).
 *
 * Under it the clip would arrive as blocks; the encode holds here and lets the
 * cap do the refusing, because "too long" is a better answer than mush.
 */
export const FLOOR_VIDEO_BPS = 1_000_000;

/**
 * How much of the cap the planned video and audio may fill (Android's
 * `CAP_HEADROOM`). The rest absorbs container overhead and a VBR encoder
 * overshooting on a busy passage.
 */
export const CAP_HEADROOM = 0.92;

/** The upload resolution: 1080 on the short side (Android's `MAX_SHORT_SIDE_PX`). */
export const MAX_SHORT_SIDE_PX = 1080;

/**
 * Seconds between key frames. Android's encoder runs at Media3's default
 * `VideoEncoderSettings.DEFAULT_I_FRAME_INTERVAL_SECONDS`, which is 1 — so a
 * web clip seeks exactly as finely as an Android one.
 */
export const KEY_FRAME_INTERVAL_S = 1;

const BITS_PER_BYTE = 8;

/**
 * The video rate for a clip of `durationMs` going somewhere that holds at most
 * `capBytes` — Android's `VideoBitrate.forClip`.
 *
 * A clip of unknown length gets the standard rate: guessing lower for something
 * that may be five seconds long would degrade it for nothing, and the cap check
 * catches the rest. The operations run in Android's order, so the floating-point
 * result — and therefore the rounded integer — is the same.
 *
 * `audioBps` is the sound's share of the budget. It is Android's 128 kbps
 * whenever the sound is encoded here; a clip whose AAC is carried across
 * untouched (`compress-video.ts`, on a browser with no AAC encoder) brings its
 * own rate, and the picture gets what that leaves.
 */
export function videoBitrateForClip(
  durationMs: number,
  capBytes: number,
  audioBps: number = AUDIO_BPS,
): number {
  if (!(durationMs > 0)) return STANDARD_VIDEO_BPS;
  const seconds = durationMs / 1000.0;
  const budgetBits = CAP_HEADROOM * capBytes * BITS_PER_BYTE;
  const forVideo = budgetBits / seconds - audioBps;
  if (forVideo >= STANDARD_VIDEO_BPS) return STANDARD_VIDEO_BPS;
  if (forVideo <= FLOOR_VIDEO_BPS) return FLOOR_VIDEO_BPS;
  // Kotlin's `roundToInt` rounds half up, which is what `Math.round` does for
  // the positive numbers that reach this line.
  return Math.round(forVideo);
}

/**
 * Whether a clip of `durationMs` can land inside `capBytes` at all once
 * encoded — the one question the pick asks of a clip over the cap.
 *
 * THE CAP GOVERNS WHAT IS SENT, NOT WHAT WAS PICKED (jakob, 2026-09-23: "a
 * video with 300mb that compresses to less than 100mb is eligible"). The plan
 * scales the picture's rate down to fit any cap, but never below the floor, so
 * the only clip no encode can fit is one whose floor-rate picture plus its
 * sound, over its whole length, is already more than the cap holds. `audioBps`
 * is the sound the encode will carry: 128 kbps encoded, the measured rate of a
 * copied AAC track, or 0 for a silent clip.
 *
 * Against the cap itself, not the planned headroom: the question is whether
 * the clip is PROVABLY unfittable, and a clip inside the cap but past the
 * headroom may still land — the size check on the encoded bytes
 * (`runVideoUpload`) is what catches one that does not. A clip of unknown
 * length cannot be proven either way and is let through to that check.
 */
export function fitsAtFloor(durationMs: number, capBytes: number, audioBps: number): boolean {
  if (!(durationMs > 0)) return true;
  const floorBits = ((FLOOR_VIDEO_BPS + audioBps) * durationMs) / 1000;
  return floorBits <= capBytes * BITS_PER_BYTE;
}

/**
 * Whether a clip carries more bits than we mean to send — Android's
 * `richerThan`.
 *
 * Compared against the whole budget, video plus audio, because a container's
 * average covers both. A clip that will not say is treated as too rich: the
 * cost of re-encoding something already lean is a little quality, the cost of
 * waving through something that was not is the fault this exists to fix.
 */
export function richerThan(bitrate: number | null, targetVideoBps: number): boolean {
  return bitrate === null || bitrate > targetVideoBps + AUDIO_BPS;
}

/**
 * A container's average rate over all its tracks, in bits per second.
 *
 * The figure Android's `MediaMetadataRetriever.METADATA_KEY_BITRATE` reports for
 * a clip with a picture: the file's size in bits over its longest track's
 * duration (`StagefrightMetadataRetriever`, `sourceSize * 8E6 / maxDurationUs`).
 * Null when the duration is unknown — which `richerThan` reads as "too rich".
 */
export function containerBitrate(byteCount: number, durationMs: number): number | null {
  if (!(durationMs > 0)) return null;
  return Math.trunc((byteCount * BITS_PER_BYTE * 1000) / durationMs);
}

/**
 * The displayed dimensions of frames stored at `width` × `height` under a
 * `rotation` — Android's `rotatedDimensions`. A quarter turn swaps the sides
 * back before anything reasons about which one is short.
 */
export function rotatedDimensions(
  width: number,
  height: number,
  rotation: number,
): { readonly width: number; readonly height: number } {
  return rotation % 180 === 0 ? { width, height } : { width: height, height: width };
}

/** mediabunny rounds every encoded dimension UP to an even number; H.264 needs it. */
function ceilToEven(n: number): number {
  return Math.ceil(n / 2) * 2;
}

/** What the encoder is asked to produce: the size, and which axis is named. */
export type OutputSize = {
  readonly width: number;
  readonly height: number;
  /**
   * The one axis handed to the encoder. Naming only the short side lets the
   * library keep the aspect ratio, exactly as Media3's
   * `Presentation.createForShortSide` does on Android.
   */
  readonly axis: "width" | "height";
  /** The value for that axis. */
  readonly shortSide: number;
};

/**
 * The encoded size of a clip DISPLAYED at `width` × `height`.
 *
 * The short side is bounded at 1080, which makes a portrait clip 1080 wide and
 * a landscape one 1080 tall. A clip already inside it keeps its own size — the
 * encode then changes the bits, not the picture.
 *
 * The long side is derived the way mediabunny derives it when given one axis
 * (`Conversion`'s track sizing: the named axis rounded up to even, the other
 * from the aspect ratio, rounded, then rounded up to even), so the size the
 * capability check asks about is the size the encoder is then configured with.
 */
export function outputSize(width: number, height: number): OutputSize {
  const landscape = width > height;
  const short = Math.min(width, height);
  const aspect = width / height;
  const named = ceilToEven(Math.min(short, MAX_SHORT_SIDE_PX));
  if (landscape) {
    return {
      axis: "height",
      shortSide: named,
      height: named,
      width: ceilToEven(Math.round(named * aspect)),
    };
  }
  return {
    axis: "width",
    shortSide: named,
    width: named,
    height: ceilToEven(Math.round(named / aspect)),
  };
}

/** What a probe of the picked clip found, before anything is decoded. */
export type ClipProbe = {
  /** Displayed width and height — after the rotation the container states. */
  readonly width: number;
  readonly height: number;
  readonly durationMs: number;
  readonly byteCount: number;
  /** The video track's codec, as mediabunny names it (`avc`, `hevc`, …). */
  readonly videoCodec: string;
  /** The audio track's codec, or null when the clip is silent. */
  readonly audioCodec: string | null;
};

/** What to do with a clip. */
export type VideoPlan =
  | {
      /** Already within target: the container is rewritten and nothing is re-encoded. */
      readonly kind: "remux";
    }
  | {
      readonly kind: "encode";
      readonly size: OutputSize;
      readonly videoBps: number;
      /** Why the clip cannot pass through, for the console line. */
      readonly reason: "too-large" | "too-rich" | "codec";
    };

/**
 * Whether a clip is re-encoded, and to what — Android's `editedItem` decision.
 *
 * Asked in the same order: too big on screen, scale it; right size but carrying
 * more bits than we send, re-encode it at its own size; small and lean, pass it
 * through untouched. One question is added, and it is Android's too: its
 * Transformer names H.264 and AAC as the output formats, and a track in any
 * other codec is re-encoded whatever its size — so a clip whose streams are
 * not H.264 and AAC is never passed through here either.
 */
export function planVideo(probe: ClipProbe, capBytes: number): VideoPlan {
  const videoBps = videoBitrateForClip(probe.durationMs, capBytes);
  const size = outputSize(probe.width, probe.height);
  if (Math.min(probe.width, probe.height) > MAX_SHORT_SIDE_PX) {
    return { kind: "encode", size, videoBps, reason: "too-large" };
  }
  if (richerThan(containerBitrate(probe.byteCount, probe.durationMs), videoBps)) {
    return { kind: "encode", size, videoBps, reason: "too-rich" };
  }
  if (probe.videoCodec !== "avc" || (probe.audioCodec !== null && probe.audioCodec !== "aac")) {
    return { kind: "encode", size, videoBps, reason: "codec" };
  }
  return { kind: "remux" };
}
