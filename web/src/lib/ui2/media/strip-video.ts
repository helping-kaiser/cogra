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
// HOW THE TAGS GO: BY NEVER BEING WRITTEN. This copies the encoded packets into
// a brand-new `Output` and adds only the tracks themselves, so the metadata
// boxes are not stripped so much as never created — there is no code path by
// which a `udta`, `meta` or `ilst` box could reach the file, because nothing
// reads the input's tags at all. That is the same argument the picture encoder
// rests on, and it is stronger than deleting boxes after the fact.
//
// WHY NOT `Conversion` WITH `tags: {}`, which is the library's own one-liner
// for this: because it does not actually copy. Its fast path requires the
// track's first timestamp to be at or after the conversion's start, and an AAC
// track written by any ordinary encoder begins at a NEGATIVE timestamp — the
// 1024-sample priming delay, measured at -23.2 ms on a plain ffmpeg AAC track.
// That trips its `needsTrimming` condition, so the audio takes the
// decode-and-re-encode branch: the author's sound would be re-compressed for a
// container-level change, and on a browser with no AAC *encoder* the track
// would be discarded outright. Copying the packets by hand is what makes "never
// re-encode" true rather than aspirational — and it is what the fast path of
// `Conversion` does internally anyway, so this is the same operation without
// the condition that disqualifies it.
//
// `formats: [MP4]` rather than `ALL_FORMATS` is deliberate: the docs note "The
// `formats` parameter enables tree-shaking"
// (https://mediabunny.dev/guide/reading-media-files), and every other demuxer
// would otherwise be bundled for a path that only ever sees MP4 — which the
// pick screening has already guaranteed by sniffing the container from the
// bytes.
//
// WHAT THIS DOES NOT REMOVE, stated because a security claim must be honest.
// The output's `mvhd`/`tkhd` creation time is set to the moment of the remux by
// the muxer, with no option to override it — so the original RECORDING date is
// destroyed, which is the one that matters, and the upload time is stamped in
// its place. Track names and languages are never copied by this code, so they
// do not survive either.
//
// The server re-checks and re-strips regardless. This is the first line, not
// the only one.

import {
  BlobSource,
  BufferTarget,
  EncodedAudioPacketSource,
  EncodedPacketSink,
  EncodedVideoPacketSource,
  Input,
  MP4,
  Mp4OutputFormat,
  Output,
  type AudioCodec,
  type InputAudioTrack,
  type InputVideoTrack,
  type MediaCodec,
  type VideoCodec,
} from "mediabunny";

import { VIDEO_TYPE } from "./video";

/**
 * A track's codec, narrowed to the kind its packet source accepts.
 *
 * `getCodec` is typed across every media kind the library knows, while a video
 * source takes only video codecs. The narrowing is safe because it is applied
 * behind `isVideoTrack`/`isAudioTrack` — a video track cannot report an audio
 * codec — and the muxer refuses anything the output format does not support, so
 * a codec that slipped through would fail loudly rather than be written.
 */
function asVideoCodec(codec: MediaCodec): VideoCodec {
  return codec as VideoCodec;
}

function asAudioCodec(codec: MediaCodec): AudioCodec {
  return codec as AudioCodec;
}

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
    const tracks = await input.getTracks();
    // Every track is carried or the file is refused. Dropping one silently is
    // how a clip arrives on the server without its sound.
    const pumps: (() => Promise<void>)[] = [];

    // THE WHOLE FILE SHIFTS, OR NOTHING DOES. An AAC track begins at a negative
    // timestamp — the encoder's priming samples, about -23 ms — and the muxer
    // refuses a negative timestamp outright. The fix is not to clamp that one
    // track to zero: that would move the sound 23 ms later than the picture and
    // leave the file quietly out of sync. Instead every track is shifted by the
    // same amount, so the relative timing between them is exactly preserved and
    // the file simply starts a hair later than it did.
    let earliest = 0;
    for (const track of tracks) {
      earliest = Math.min(earliest, await track.getFirstTimestamp());
    }
    const shift = earliest < 0 ? -earliest : 0;

    for (const track of tracks) {
      const codec = await track.getCodec();
      if (codec === null) throw new Error("this video declares a codec we cannot read");

      // The library's own guards rather than a string compare: they narrow the
      // track type, which is what lets the codec reach a source that only
      // accepts codecs of its own kind.
      if (track.isVideoTrack()) {
        const source = new EncodedVideoPacketSource(asVideoCodec(codec));
        // The rotation rides as container metadata, exactly as it arrived —
        // dropping it would stand a phone's portrait clip on its side.
        output.addVideoTrack(source, { rotation: track.rotation });
        pumps.push(() => copyPackets(track, source, shift));
      } else if (track.isAudioTrack()) {
        const source = new EncodedAudioPacketSource(asAudioCodec(codec));
        output.addAudioTrack(source);
        pumps.push(() => copyPackets(track, source, shift));
      } else {
        // A subtitle or data track. Refused rather than dropped, so nothing
        // leaves this function quietly smaller than it arrived.
        throw new Error(`this video carries a ${track.type} track we cannot copy`);
      }
    }

    if (pumps.length === 0) throw new Error("this file carries no media tracks");

    await output.start();
    // The tracks are pumped together rather than one after the other: the muxer
    // interleaves by timestamp and applies backpressure per track, so draining
    // one to the end first would hold the whole file in memory.
    await Promise.all(pumps.map((pump) => pump()));
    await output.finalize();

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

/**
 * Move one track's encoded packets across, untouched.
 *
 * The decoder config rides the first `add` — it is what the output track's
 * sample description is written from, and without it the file would describe
 * bytes no player could set up a decoder for. The packet PAYLOADS are never
 * touched; only the timestamp moves, by the one shift the whole file shares.
 */
async function copyPackets(
  track: InputVideoTrack | InputAudioTrack,
  source: EncodedVideoPacketSource | EncodedAudioPacketSource,
  shift: number,
): Promise<void> {
  const sink = new EncodedPacketSink(track);
  const meta = { decoderConfig: (await track.getDecoderConfig()) ?? undefined };
  let first = true;
  for await (const packet of sink.packets()) {
    const moved = shift === 0 ? packet : packet.clone({ timestamp: packet.timestamp + shift });
    // Awaited per packet: the promise resolves when the writer is ready for
    // more, which is the library's documented backpressure signal.
    await (source as EncodedVideoPacketSource).add(
      moved,
      first ? (meta as never) : undefined,
    );
    first = false;
  }
  source.close();
}
