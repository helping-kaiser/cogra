// Compress a picked clip to the upload target, wherever this browser can.
//
// THE RULE (jakob, 2026-09-23): "the non compressed web upload only ever
// happens if your browser truly can't do it." A clip leaves the device at the
// same bar an Android clip does — H.264 at 1080 on the short side, four
// megabits scaled to fit the cap, never under one, AAC at 128 kbps
// (`video-target.ts`) — and the only clips that go up as they were picked are
// the ones already inside that bar, and the ones a browser has no encoder for.
// The server holds the same target and transcodes whatever arrives outside
// it, so a browser that cannot encode still ends at the same bytes; encoding
// here is what saves its author the upload of a camera original.
//
// THIS STEP ONLY EVER SHRINKS OR CONFORMS; IT NEVER STRIPS. Its output — or the
// untouched pick, when it declines — goes on to `strip-video.ts` exactly as a
// picked clip always has, so the metadata promise lives in one place and is
// kept whichever way this went. That matters here in particular: mediabunny's
// `Conversion` copies each track's `udta/name` box across even with `tags: {}`,
// and the strip is what drops it.
//
// NEVER THROWS. Every way this can end short of an encoded clip — no WebCodecs,
// no H.264 encoder at the clip's configuration, a sound that is neither AAC
// nor encodable here, a source this browser cannot decode, an encoder that fails
// half-way, the tab running out of memory — returns the picked bytes with the
// reason on the console, and the upload carries on down the path it took
// before this step existed. A failed compression is never the author's error.
//
// CAPABILITY IS ASKED PER CONFIGURATION, NEVER BY BROWSER NAME. WebCodecs
// support is uneven in ways a user-agent string cannot predict: AAC encoding
// needs a platform encoder that desktop Linux lacks in every browser and that
// Firefox has on no platform; Safari shipped `VideoEncoder` in 16.4 but
// `AudioEncoder` only in 26; hardware H.264 encoders refuse sizes and rates
// their neighbours take. So the question is put to the browser at the exact
// size and rate this clip will be encoded at — mediabunny's `canEncodeVideo` /
// `canEncodeAudio`, which build the same encoder configuration `Conversion`
// then uses and hand it to `VideoEncoder.isConfigSupported` /
// `AudioEncoder.isConfigSupported` (the check MDN's codec-selection guide
// prescribes), adding a one-frame trial encode on Firefox, whose answer to
// `isConfigSupported` the library documents as unreliable. The source side is
// asked too — `canDecode` on each track that is re-encoded, since an HEVC
// clip can only become H.264 where the browser can read HEVC. `Conversion.init`
// then asks again, per track, and anything it would discard sends the clip
// back to the remux rather than up without its sound.
//
// NO AAC ENCODER IS NOT NO ENCODE (jakob, 2026-09-23). Firefox desktop, desktop
// Linux and Safari 16.4–18 can encode the picture but not the sound. A clip
// whose sound is ALREADY AAC does not need that encoder: its packets are
// carried across untouched while the picture is encoded, and the server takes
// AAC as it is. The planned video rate then leaves room for the copied track's
// own measured rate rather than Android's 128 kbps. Only a clip whose sound is
// neither AAC nor encodable here goes up as picked.
//
// THE LIBRARY is mediabunny's own conversion machinery
// (https://mediabunny.dev/guide/converting-media-files): the muxer the remux
// already uses, driving WebCodecs underneath. Nothing is hand-plumbed; every
// option below is one the guide documents.

import {
  BlobSource,
  BufferTarget,
  Conversion,
  Input,
  MP4,
  Mp4OutputFormat,
  Output,
  QTFF,
  Quality,
  canEncodeAudio,
  canEncodeVideo,
  type InputAudioTrack,
  type InputVideoTrack,
} from "mediabunny";

import { VIDEO_TYPE } from "./video";
import {
  AUDIO_BPS,
  KEY_FRAME_INTERVAL_S,
  fitsAtFloor,
  planVideo,
  rotatedDimensions,
  videoBitrateForClip,
  type VideoPlan,
} from "./video-target";

/** Which way a clip went, for the console line and the tests. */
export type CompressPath =
  /** Encoded to the upload target here. */
  | "encoded"
  /** Already inside the target: passed on untouched, for the remux alone. */
  | "within-target"
  /** This browser cannot encode this clip at the target. */
  | "unsupported"
  /** The encode started and did not finish. */
  | "failed";

export type CompressResult = {
  /** The encoded clip, or the picked bytes whenever the encode did not happen. */
  readonly blob: Blob;
  readonly path: CompressPath;
  /** Wall time this step took, whichever way it went. */
  readonly tookMs: number;
};

/**
 * The audio configuration `Conversion` falls back to when an encoder refuses
 * the source's own channel count or sample rate — the library resamples to
 * stereo 48 kHz and tries again, so the capability check asks the same two
 * questions in the same order.
 */
const FALLBACK_AUDIO = { numberOfChannels: 2, sampleRate: 48_000 } as const;

const TAG = "[compress-video]";

/**
 * The clip at the upload target, or the picked bytes with the reason logged.
 *
 * `capBytes` is the destination's cap — a post's or a comment's — because the
 * rate a long clip is planned at depends on how much room it is going into.
 */
export async function compressVideo(file: Blob, capBytes: number): Promise<CompressResult> {
  const started = performance.now();
  const keep = (path: Exclude<CompressPath, "encoded">, reason: string): CompressResult => {
    const log = path === "failed" ? console.warn : console.info;
    log(`${TAG} uploading the clip as picked (${path}): ${reason}`);
    return { blob: file, path, tookMs: Math.round(performance.now() - started) };
  };

  // The cheapest honest answer first: a browser with no WebCodecs video encoder
  // at all (Firefox on Android, an insecure origin — WebCodecs is
  // secure-context only) is not asked anything further, and the clip is not
  // even opened.
  if (typeof VideoEncoder === "undefined") {
    return keep("unsupported", "this browser has no VideoEncoder");
  }

  // The two containers the pick admits (`video.ts`); an iPhone's QuickTime is
  // read by `QTFF`, and the output is MP4 whichever came in.
  const input = new Input({ formats: [MP4, QTFF], source: new BlobSource(file) });
  try {
    const probed = await probe(input, file.size);
    if (typeof probed === "string") return keep("unsupported", probed);

    const ready = await readiness(probed, capBytes);
    if (ready.kind === "remux") return keep("within-target", "already H.264 + AAC within target");
    if (ready.kind === "refused") return keep("unsupported", ready.reason);
    const { plan, audio, videoQuality, audioQuality } = ready;

    let blob: Blob;
    try {
      blob = await encode(input, plan, audio, videoQuality, audioQuality);
    } catch (error) {
      if (error instanceof Unencodable) return keep("unsupported", error.message);
      return keep("failed", describe(error));
    }

    console.info(
      `${TAG} encoded (${plan.reason}) to ${plan.size.width}x${plan.size.height} at ` +
        `${plan.videoBps} bps, sound ${audio.kind}: ${file.size} -> ${blob.size} bytes`,
    );
    return { blob, path: "encoded", tookMs: Math.round(performance.now() - started) };
  } catch (error) {
    // The probe itself failed — a container the demuxer cannot read. The strip
    // reads it the same way and is where that becomes the author's refusal.
    return keep("failed", describe(error));
  } finally {
    input.dispose();
  }
}

/**
 * What the pick is told about a clip before it is let in.
 *
 * THE CAP IS WEIGHED ON THE COMPRESSED CLIP (jakob, 2026-09-23: "what matters
 * is the size after compression and before upload"). So a clip over the cap as
 * picked is asked the same questions `compressVideo` will ask — can this
 * browser encode it, and at what rate — and the answer says whether the encode
 * can bring it inside.
 */
export type ClipOutlook =
  /**
   * The picked bytes are what will be weighed: this browser cannot encode the
   * clip, it needs no encode to be sent, or it could not be read here — in
   * which case the strip is where that becomes a refusal.
   */
  | "as-picked"
  /** Over the cap as picked, but this browser encodes it and the encode can fit. */
  | "compressible"
  /** This browser encodes it, but even the floor rate is more than the cap holds. */
  | "too-long";

/**
 * The outlook for a picked clip bound for `capBytes`.
 *
 * Reads the header only — tracks, codecs, length, the sound's packet table —
 * and asks the encoder questions, never encodes; the pick stays quick. Never
 * throws: anything short of an answer is `as-picked`, which is the screening
 * the pick always did.
 */
export async function clipOutlook(file: Blob, capBytes: number): Promise<ClipOutlook> {
  // Within the cap as picked, the answer is settled before anything is read.
  if (file.size <= capBytes) return "as-picked";
  if (typeof VideoEncoder === "undefined") return "as-picked";

  const input = new Input({ formats: [MP4, QTFF], source: new BlobSource(file) });
  try {
    const probed = await probe(input, file.size);
    if (typeof probed === "string") return "as-picked";
    const ready = await readiness(probed, capBytes);
    if (ready.kind !== "encode") return "as-picked";
    const soundBps =
      ready.audio.kind === "none" ? 0 : ready.audio.kind === "copy" ? ready.audio.bps : AUDIO_BPS;
    return fitsAtFloor(probed.clip.durationMs, capBytes, soundBps) ? "compressible" : "too-long";
  } catch (error) {
    console.info(`${TAG} no outlook for this clip: ${describe(error)}`);
    return "as-picked";
  } finally {
    input.dispose();
  }
}

/** Thrown when `Conversion.init` would drop or cannot carry a track. */
class Unencodable extends Error {}

function describe(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

type Probed = {
  readonly clip: Parameters<typeof planVideo>[0];
  readonly video: InputVideoTrack;
  readonly audio: InputAudioTrack | null;
};

/**
 * What the header says, or the reason the encode is not attempted.
 *
 * One picture and at most one sound is what the encode plan and the capability
 * check describe; anything richer — a second angle, a subtitle track — is left
 * to the remux, which carries or refuses it exactly as it always has.
 */
async function probe(input: Input, byteCount: number): Promise<Probed | string> {
  const tracks = await input.getTracks();
  const videos = tracks.filter((t) => t.isVideoTrack());
  const audios = tracks.filter((t) => t.isAudioTrack());
  if (videos.length !== 1 || audios.length > 1 || videos.length + audios.length !== tracks.length) {
    return `a track layout the encode does not describe (${tracks.map((t) => t.type).join(", ")})`;
  }
  const video = await input.getPrimaryVideoTrack();
  const audio = audios.length === 1 ? await input.getPrimaryAudioTrack() : null;
  if (video === null) return "no video track";

  const videoCodec = await video.getCodec();
  if (videoCodec === null) return "a video codec mediabunny cannot name";
  const audioCodec = audio === null ? null : await audio.getCodec();
  if (audio !== null && audioCodec === null) return "an audio codec mediabunny cannot name";

  // The square-pixel size turned by the stated rotation — the size
  // `Conversion` itself reasons about, so the plan and the encoder agree.
  const { width, height } = rotatedDimensions(
    await video.getSquarePixelWidth(),
    await video.getSquarePixelHeight(),
    await video.getRotation(),
  );
  // The longest track's end, which is what Android's retriever divides by.
  const durationMs = Math.round((await input.computeDuration()) * 1000);

  return {
    clip: { width, height, durationMs, byteCount, videoCodec, audioCodec },
    video,
    audio,
  };
}

/** How the clip's sound reaches the encoded file. */
type SoundRoute =
  /** A silent clip. */
  | { readonly kind: "none" }
  /** Re-encoded to AAC at the target rate. */
  | { readonly kind: "encode" }
  /**
   * Already AAC, on a browser that cannot encode it: the packets are carried
   * across untouched, at the rate they were recorded at.
   */
  | { readonly kind: "copy"; readonly bps: number };

/** Whether and how this browser brings this clip to the target. */
type Readiness =
  /** Already within target; nothing to encode. */
  | { readonly kind: "remux" }
  /** This browser cannot encode this clip at the target. */
  | { readonly kind: "refused"; readonly reason: string }
  | {
      readonly kind: "encode";
      readonly plan: Extract<VideoPlan, { kind: "encode" }>;
      readonly audio: SoundRoute;
      readonly videoQuality: Quality;
      readonly audioQuality: Quality;
    };

/**
 * The plan, and whether this browser can carry it out.
 *
 * The sound is settled first, because it decides the picture's rate: a copied
 * AAC track keeps its own bits, and the picture is planned in what is left.
 * Then the picture is asked about at exactly that size and rate.
 */
async function readiness(probed: Probed, capBytes: number): Promise<Readiness> {
  const planned = planVideo(probed.clip, capBytes);
  if (planned.kind === "remux") return planned;

  const audioQuality = new Quality({ bitrate: AUDIO_BPS });
  const audio = await soundRoute(probed.audio, probed.clip.audioCodec, audioQuality);
  if (typeof audio === "string") return { kind: "refused", reason: audio };

  const plan =
    audio.kind === "copy"
      ? {
          ...planned,
          videoBps: videoBitrateForClip(probed.clip.durationMs, capBytes, audio.bps),
        }
      : planned;
  const videoQuality = new Quality({ bitrate: plan.videoBps, bitrateMode: "variable" });

  const { width, height } = plan.size;
  if (!(await probed.video.canDecode())) {
    return { kind: "refused", reason: `this browser cannot decode ${probed.clip.videoCodec}` };
  }
  if (!(await canEncodeVideo("avc", { width, height, quality: videoQuality }))) {
    return {
      kind: "refused",
      reason: `no H.264 encoder for ${width}x${height} at ${plan.videoBps} bps`,
    };
  }
  return { kind: "encode", plan, audio, videoQuality, audioQuality };
}

/**
 * How the sound goes, or why it cannot go at all.
 *
 * Encoding it is preferred wherever the browser can both read and write it —
 * that is the Android target. Where it cannot, AAC is copied; anything else
 * would have to be dropped, and a clip is never sent without its sound.
 */
async function soundRoute(
  audio: InputAudioTrack | null,
  codec: string | null,
  quality: Quality,
): Promise<SoundRoute | string> {
  if (audio === null) return { kind: "none" };

  const numberOfChannels = await audio.getNumberOfChannels();
  const sampleRate = await audio.getSampleRate();
  const encodable =
    (await canEncodeAudio("aac", { numberOfChannels, sampleRate, quality })) ||
    (await canEncodeAudio("aac", { ...FALLBACK_AUDIO, quality }));
  if (encodable && (await audio.canDecode())) return { kind: "encode" };

  if (codec === "aac") {
    // The packet table alone, read from the header: no sample is loaded.
    const { averageBitrate } = await audio.computePacketStats();
    return { kind: "copy", bps: averageBitrate > 0 ? Math.round(averageBitrate) : AUDIO_BPS };
  }
  return `no AAC encoder at ${AUDIO_BPS} bps (${numberOfChannels} ch, ${sampleRate} Hz), and the sound is ${codec}`;
}

/**
 * The encode itself: one `Conversion`, the picture forced through the encoder.
 *
 * - `codec` names H.264 and AAC — the server's accepted streams.
 * - Only the short side is given, so the library keeps the aspect ratio.
 * - `quality` carries an explicit bitrate. `new Quality(n)` would be read as a
 *   qualitative LEVEL, not a rate, so the object form is required.
 * - `keyFrameInterval` matches Media3's default on Android.
 * - A copied sound names only its codec. `forceTranscode`, a `quality`, or a
 *   changed channel count or rate each force a re-encode (the library's
 *   `ConversionAudioOptions`); with none of them and the source already AAC,
 *   the packets are copied. An MP4 output takes the priming samples' negative
 *   start as an edit list, so nothing forces the decode path — measured with
 *   no `AudioEncoder` present at all, the AAC arrived packet for packet.
 * - `tags: {}` writes no file-level metadata. Track names still ride through
 *   `Conversion`; the strip afterwards is what removes them.
 * - `Mp4OutputFormat` into a `BufferTarget` defaults to in-memory fast start,
 *   `moov` at the front.
 */
async function encode(
  input: Input,
  plan: Extract<VideoPlan, { kind: "encode" }>,
  sound: SoundRoute,
  videoQuality: Quality,
  audioQuality: Quality,
): Promise<Blob> {
  const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
  const conversion = await Conversion.init({
    input,
    output,
    video: {
      codec: "avc",
      ...(plan.size.axis === "width"
        ? { width: plan.size.shortSide }
        : { height: plan.size.shortSide }),
      quality: videoQuality,
      keyFrameInterval: KEY_FRAME_INTERVAL_S,
      forceTranscode: true,
    },
    audio:
      sound.kind === "copy"
        ? { codec: "aac" }
        : { codec: "aac", quality: audioQuality, forceTranscode: true },
    tags: {},
    // `discardedTracks` is read below; the library's own console warning
    // would only repeat it.
    showWarnings: false,
  });

  if (!conversion.isValid || conversion.discardedTracks.length > 0) {
    const reasons = conversion.discardedTracks
      .map((d) => `${d.track.type} track: ${d.reason}`)
      .join("; ");
    await output.cancel().catch(() => {});
    throw new Unencodable(reasons === "" ? "the conversion has no valid output" : reasons);
  }

  try {
    await conversion.execute();
  } catch (error) {
    await conversion.cancel().catch(() => {});
    throw error;
  }

  const buffer = output.target.buffer;
  if (buffer === null || buffer.byteLength === 0) throw new Error("the encode produced no bytes");
  return new Blob([buffer], { type: VIDEO_TYPE });
}
