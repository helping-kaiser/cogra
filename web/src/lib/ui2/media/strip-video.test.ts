// @vitest-environment node
//
// The strip's CONTRACT, not the library's remuxing. mediabunny's muxer is
// tested upstream; what has to hold here is what this module is responsible
// for, and every one of these is a way the author's privacy, their sound, or
// their sync could be quietly lost:
//
//  · nothing is ever decoded or re-encoded — only packet SOURCES are used;
//  · every track is carried, or the file is refused rather than shipped short;
//  · a negative priming timestamp moves the WHOLE file, never one track;
//  · the decoder config rides the first packet, or the output describes bytes
//    no player can set up;
//  · only the MP4 demuxer is pulled in;
//  · the input is released either way.
//
// The library is mocked so these become assertions about the calls, which is
// also the only way to run them: Node has no WebCodecs and no real muxer here.

import { beforeEach, describe, expect, it, vi } from "vitest";

type Packet = { timestamp: number; clone: (over: { timestamp: number }) => Packet };

const added: { kind: string; timestamp: number; meta: unknown }[] = [];
const addedTracks: string[] = [];
/** Which demuxers each `Input` was built with — the tree-shaking contract. */
const inputFormats: unknown[][] = [];
const started = vi.fn();
const finalized = vi.fn();
const dispose = vi.fn();
let tracks: unknown[] = [];

function packet(timestamp: number): Packet {
  return { timestamp, clone: ({ timestamp: t }) => packet(t) };
}

function track(type: string, codec: string | null, firstTimestamp: number, packets: number[]) {
  return {
    type,
    rotation: 90,
    isVideoTrack: () => type === "video",
    isAudioTrack: () => type === "audio",
    getCodec: async () => codec,
    getFirstTimestamp: async () => firstTimestamp,
    getDecoderConfig: async () => ({ codec: `${codec}-config` }),
    _packets: packets.map(packet),
  };
}

vi.mock("mediabunny", () => {
  class PacketSource {
    constructor(
      readonly kind: string,
      readonly codec: string,
    ) {}
    async add(p: Packet, meta: unknown) {
      added.push({ kind: this.kind, timestamp: p.timestamp, meta });
    }
    close() {}
  }
  return {
    MP4: "MP4-format",
    BlobSource: class {
      constructor(readonly file: unknown) {}
    },
    BufferTarget: class {},
    Mp4OutputFormat: class {},
    Input: class {
      constructor(readonly options: { formats: unknown[] }) {
        inputFormats.push(options.formats);
      }
      getTracks = async () => tracks;
      dispose = dispose;
    },
    Output: class {
      target = { buffer: new ArrayBuffer(8) as ArrayBuffer | null };
      constructor(readonly options: unknown) {}
      addVideoTrack(_s: unknown, meta: unknown) {
        addedTracks.push(`video:${JSON.stringify(meta)}`);
      }
      addAudioTrack() {
        addedTracks.push("audio");
      }
      start = started;
      finalize = finalized;
    },
    EncodedVideoPacketSource: class extends PacketSource {
      constructor(codec: string) {
        super("video", codec);
      }
    },
    EncodedAudioPacketSource: class extends PacketSource {
      constructor(codec: string) {
        super("audio", codec);
      }
    },
    EncodedPacketSink: class {
      constructor(readonly t: { _packets: Packet[] }) {}
      async *packets() {
        for (const p of this.t._packets) yield p;
      }
    },
  };
});

const { stripVideoMetadata } = await import("./strip-video");

const clip = () => new Blob([new Uint8Array(new ArrayBuffer(16)) as BlobPart], { type: "video/mp4" });

beforeEach(() => {
  added.length = 0;
  addedTracks.length = 0;
  inputFormats.length = 0;
  vi.clearAllMocks();
  tracks = [
    track("video", "avc", 0, [0, 0.033, 0.066]),
    track("audio", "aac", -0.0232, [-0.0232, 0.0, 0.023]),
  ];
});

describe("stripVideoMetadata", () => {
  it("copies encoded packets and never decodes or re-encodes", async () => {
    await stripVideoMetadata(clip());
    // Every packet went through a packet SOURCE. A sample source would mean the
    // author's video was decoded and compressed again for a container change.
    expect(added).toHaveLength(6);
    expect(new Set(added.map((a) => a.kind))).toEqual(new Set(["video", "audio"]));
  });

  it("carries every track, keeping the sound", async () => {
    await stripVideoMetadata(clip());
    expect(addedTracks.some((t) => t.startsWith("video:"))).toBe(true);
    expect(addedTracks).toContain("audio");
  });

  it("shifts the whole file, never one track, when a track primes negative", async () => {
    // An AAC track starts about -23 ms before zero. Clamping only that track
    // would move the sound later than the picture and leave the file out of
    // sync; shifting everything by the same amount preserves the relationship.
    await stripVideoMetadata(clip());
    const video = added.filter((a) => a.kind === "video").map((a) => a.timestamp);
    const audio = added.filter((a) => a.kind === "audio").map((a) => a.timestamp);
    expect(Math.min(...video, ...audio)).toBeCloseTo(0, 6);
    // The gap between the first video and first audio packet is unchanged.
    expect(video[0]! - audio[0]!).toBeCloseTo(0.0232, 6);
  });

  it("leaves timestamps alone when nothing primes negative", async () => {
    tracks = [track("video", "avc", 0, [0, 0.5])];
    await stripVideoMetadata(clip());
    expect(added.map((a) => a.timestamp)).toEqual([0, 0.5]);
  });

  it("sends the decoder config with the first packet only", async () => {
    await stripVideoMetadata(clip());
    const video = added.filter((a) => a.kind === "video");
    // Without it the output describes bytes no player could set up a decoder
    // for; repeating it on every packet would be noise.
    expect(video[0]!.meta).toEqual({ decoderConfig: { codec: "avc-config" } });
    expect(video[1]!.meta).toBeUndefined();
  });

  it("keeps the rotation the clip arrived with", async () => {
    await stripVideoMetadata(clip());
    // Dropping it stands a phone's portrait clip on its side.
    expect(addedTracks[0]).toContain('"rotation":90');
  });

  it("pulls in only the MP4 demuxer", async () => {
    await stripVideoMetadata(clip());
    // `ALL_FORMATS` would bundle every demuxer the library has for a path that
    // only ever sees MP4 — the pick screening sniffed the container already.
    expect(inputFormats).toEqual([["MP4-format"]]);
  });

  it("refuses a track whose codec it cannot read", async () => {
    tracks = [track("video", null, 0, [0])];
    await expect(stripVideoMetadata(clip())).rejects.toThrow("codec");
  });

  it("refuses a file with no media tracks rather than writing an empty one", async () => {
    tracks = [];
    await expect(stripVideoMetadata(clip())).rejects.toThrow("no media tracks");
  });

  it("refuses a track kind it cannot copy instead of dropping it", async () => {
    tracks = [track("video", "avc", 0, [0]), track("subtitle", "webvtt", 0, [0])];
    await expect(stripVideoMetadata(clip())).rejects.toThrow("subtitle");
  });

  it("returns MP4 bytes and how long the remux took", async () => {
    const result = await stripVideoMetadata(clip());
    expect(result.blob.type).toBe("video/mp4");
    expect(result.tookMs).toBeGreaterThanOrEqual(0);
    expect(started).toHaveBeenCalledOnce();
    expect(finalized).toHaveBeenCalledOnce();
  });

  it("releases the input whether it succeeded or failed", async () => {
    await stripVideoMetadata(clip());
    expect(dispose).toHaveBeenCalledTimes(1);

    tracks = [];
    await expect(stripVideoMetadata(clip())).rejects.toThrow();
    expect(dispose).toHaveBeenCalledTimes(2);
  });
});
