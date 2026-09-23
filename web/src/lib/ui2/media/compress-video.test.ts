// @vitest-environment node
//
// The compression step's DECISIONS, not the library's encoding. Node has no
// WebCodecs, so mediabunny is mocked at its boundary and these become
// assertions about which questions were asked and which way the clip went:
//
//  · no WebCodecs at all → the clip is not even opened;
//  · a clip already within target → passed on untouched, nothing encoded;
//  · the capability check asks at the EXACT size and rate the encode uses,
//    and asks the source side too — the picture must be decodable here;
//  · a clip with sound needs an AAC encoder, OR sound that is already AAC,
//    which is then copied across and planned at its own rate;
//  · anything the encoder cannot carry, or any failure mid-way, returns the
//    picked bytes — never a throw, never a clip without its sound.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type FakeTrack = {
  type: string;
  isVideoTrack: () => boolean;
  isAudioTrack: () => boolean;
  getCodec: () => Promise<string | null>;
  getSquarePixelWidth?: () => Promise<number>;
  getSquarePixelHeight?: () => Promise<number>;
  getRotation?: () => Promise<number>;
  getNumberOfChannels?: () => Promise<number>;
  getSampleRate?: () => Promise<number>;
  canDecode: () => Promise<boolean>;
  computePacketStats?: () => Promise<{ averageBitrate: number }>;
};

/** Whether this "browser" can decode each kind of track; reset per test. */
let decodes = { video: true, audio: true };
/** The measured rate of the clip's sound, as the packet table states it. */
let soundBps = 256_000;

function videoTrack(codec: string, width: number, height: number, rotation = 0): FakeTrack {
  return {
    type: "video",
    isVideoTrack: () => true,
    isAudioTrack: () => false,
    getCodec: async () => codec,
    getSquarePixelWidth: async () => width,
    getSquarePixelHeight: async () => height,
    getRotation: async () => rotation,
    canDecode: async () => decodes.video,
  };
}

function audioTrack(codec: string | null, channels = 2, rate = 44_100): FakeTrack {
  return {
    type: "audio",
    isVideoTrack: () => false,
    isAudioTrack: () => true,
    getCodec: async () => codec,
    getNumberOfChannels: async () => channels,
    getSampleRate: async () => rate,
    canDecode: async () => decodes.audio,
    computePacketStats: async () => ({ averageBitrate: soundBps }),
  };
}

let tracks: FakeTrack[] = [];
/** Set to make the demuxer fail, as it does on bytes it cannot parse. */
let unreadable: Error | null = null;
let durationS = 30;
const dispose = vi.fn();
const inputsOpened = vi.fn();
const canEncodeVideo = vi.fn();
const canEncodeAudio = vi.fn();
const init = vi.fn();
const execute = vi.fn();
const cancelConversion = vi.fn(async () => {});
const cancelOutput = vi.fn(async () => {});
let conversionValid = true;
let discarded: { track: { type: string }; reason: string }[] = [];
let encodedBuffer: ArrayBuffer | null = new ArrayBuffer(64);

vi.mock("mediabunny", () => ({
  MP4: "MP4-format",
  QTFF: "QTFF-format",
  BlobSource: class {
    constructor(readonly file: unknown) {}
  },
  BufferTarget: class {
    get buffer() {
      return encodedBuffer;
    }
  },
  Mp4OutputFormat: class {},
  Output: class {
    target: { buffer: ArrayBuffer | null };
    constructor(readonly options: { target: { buffer: ArrayBuffer | null } }) {
      this.target = options.target;
    }
    cancel = cancelOutput;
  },
  Quality: class {
    constructor(readonly options: unknown) {}
  },
  Input: class {
    constructor(readonly options: unknown) {
      inputsOpened(options);
    }
    getTracks = async () => {
      if (unreadable !== null) throw unreadable;
      return tracks;
    };
    getPrimaryVideoTrack = async () => tracks.find((t) => t.type === "video") ?? null;
    getPrimaryAudioTrack = async () => tracks.find((t) => t.type === "audio") ?? null;
    computeDuration = async () => durationS;
    dispose = dispose;
  },
  Conversion: {
    init: async (options: unknown) => {
      init(options);
      return {
        get isValid() {
          return conversionValid;
        },
        discardedTracks: discarded,
        execute,
        cancel: cancelConversion,
      };
    },
  },
  canEncodeVideo,
  canEncodeAudio,
}));

const { clipOutlook, compressVideo } = await import("./compress-video");

const POST_CAP = 100 * 1024 * 1024;

/** A picked clip of `bytes` bytes; only its size is ever read here. */
function clip(bytes: number): Blob {
  return { size: bytes } as Blob;
}

/** The option a `Quality` mock was built with. */
function qualityOf(value: unknown): unknown {
  return (value as { options: unknown }).options;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("VideoEncoder", class {});
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  // A phone's 4K landscape recording with sound: over the bound on both counts.
  tracks = [videoTrack("avc", 3840, 2160), audioTrack("aac")];
  durationS = 30;
  unreadable = null;
  conversionValid = true;
  discarded = [];
  encodedBuffer = new ArrayBuffer(64);
  decodes = { video: true, audio: true };
  soundBps = 256_000;
  canEncodeVideo.mockResolvedValue(true);
  canEncodeAudio.mockResolvedValue(true);
  execute.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("compressVideo — the capability gate", () => {
  it("does not open the clip when the browser has no VideoEncoder at all", async () => {
    vi.stubGlobal("VideoEncoder", undefined);
    const picked = clip(200_000_000);

    const result = await compressVideo(picked, POST_CAP);

    expect(result).toMatchObject({ blob: picked, path: "unsupported" });
    expect(inputsOpened).not.toHaveBeenCalled();
    expect(init).not.toHaveBeenCalled();
  });

  it("asks for H.264 at the exact size and rate the encode will use", async () => {
    await compressVideo(clip(200_000_000), POST_CAP);

    expect(canEncodeVideo).toHaveBeenCalledOnce();
    const [codec, options] = canEncodeVideo.mock.calls[0]!;
    expect(codec).toBe("avc");
    expect(options).toMatchObject({ width: 1920, height: 1080 });
    expect(qualityOf(options.quality)).toEqual({ bitrate: 4_000_000, bitrateMode: "variable" });

    // …and the same Quality object is what the encode is configured with, so
    // the question and the configuration cannot drift apart.
    const conversion = init.mock.calls[0]![0];
    expect(conversion.video.quality).toBe(options.quality);
  });

  it("asks for AAC at the clip's own channels and rate, then at stereo 48 kHz", async () => {
    tracks = [videoTrack("avc", 3840, 2160), audioTrack("aac", 1, 22_050)];
    canEncodeAudio.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    const result = await compressVideo(clip(200_000_000), POST_CAP);

    expect(canEncodeAudio.mock.calls.map(([codec, o]) => [codec, o.numberOfChannels, o.sampleRate])).toEqual([
      ["aac", 1, 22_050],
      ["aac", 2, 48_000],
    ]);
    expect(qualityOf(canEncodeAudio.mock.calls[0]![1].quality)).toEqual({ bitrate: 128_000 });
    expect(result.path).toBe("encoded");
  });

  it("falls back to the remux when there is no H.264 encoder for this clip", async () => {
    canEncodeVideo.mockResolvedValue(false);
    const picked = clip(200_000_000);

    const result = await compressVideo(picked, POST_CAP);

    expect(result).toMatchObject({ blob: picked, path: "unsupported" });
    expect(init).not.toHaveBeenCalled();
  });

  it("falls back when the sound is neither AAC nor encodable here", async () => {
    // Firefox desktop and desktop Linux: H.264 yes, AAC no — and a sound that
    // cannot be copied either. Encoding the picture alone would drop it.
    tracks = [videoTrack("avc", 3840, 2160), audioTrack("opus")];
    canEncodeAudio.mockResolvedValue(false);
    const picked = clip(200_000_000);

    const result = await compressVideo(picked, POST_CAP);

    expect(result).toMatchObject({ blob: picked, path: "unsupported" });
    expect(init).not.toHaveBeenCalled();
  });

  it("falls back when this browser cannot decode the picture", async () => {
    // An HEVC clip where WebCodecs has no HEVC decoder.
    tracks = [videoTrack("hevc", 3840, 2160), audioTrack("aac")];
    decodes.video = false;
    const picked = clip(200_000_000);

    const result = await compressVideo(picked, POST_CAP);

    expect(result).toMatchObject({ blob: picked, path: "unsupported" });
    expect(canEncodeVideo).not.toHaveBeenCalled();
    expect(init).not.toHaveBeenCalled();
  });

  it("needs only H.264 for a silent clip", async () => {
    tracks = [videoTrack("avc", 3840, 2160)];
    canEncodeAudio.mockResolvedValue(false);

    const result = await compressVideo(clip(200_000_000), POST_CAP);

    expect(canEncodeAudio).not.toHaveBeenCalled();
    expect(result.path).toBe("encoded");
  });
});

describe("compressVideo — AAC carried across (no AAC encoder)", () => {
  beforeEach(() => {
    // Firefox desktop, desktop Linux, Safari 16.4–18: H.264 yes, AAC no.
    canEncodeAudio.mockResolvedValue(false);
  });

  it("encodes the picture and copies the AAC sound untouched", async () => {
    const result = await compressVideo(clip(200_000_000), POST_CAP);

    expect(result.path).toBe("encoded");
    const options = init.mock.calls[0]![0];
    expect(options.video).toMatchObject({ codec: "avc", forceTranscode: true });
    // Only the codec: a quality or forceTranscode would each force a re-encode.
    expect(options.audio).toEqual({ codec: "aac" });
  });

  it("copies the sound, too, where the encoder exists but cannot read it", async () => {
    canEncodeAudio.mockResolvedValue(true);
    decodes.audio = false;

    await compressVideo(clip(200_000_000), POST_CAP);

    expect(init.mock.calls[0]![0].audio).toEqual({ codec: "aac" });
  });

  it("plans the picture in what the copied sound leaves of the cap", async () => {
    // 6:28 against the post cap, with 256 kbps of AAC carried across: 128 kbps
    // more than Android's audio budget, taken from the picture.
    durationS = 388;
    soundBps = 256_000;

    await compressVideo(clip(900_000_000), POST_CAP);

    const [, asked] = canEncodeVideo.mock.calls[0]!;
    expect(qualityOf(asked.quality)).toEqual({ bitrate: 1_733_051, bitrateMode: "variable" });
    expect(init.mock.calls[0]![0].video.quality).toBe(asked.quality);
  });

  it("falls back when the copy would be discarded after all", async () => {
    discarded = [{ track: { type: "audio" }, reason: "no_encodable_target_codec" }];
    const picked = clip(200_000_000);

    const result = await compressVideo(picked, POST_CAP);

    expect(result).toMatchObject({ blob: picked, path: "unsupported" });
    expect(execute).not.toHaveBeenCalled();
  });
});

// The pick's question of an over-cap clip, answered from the same probe and
// the same capability checks the encode itself will run.
describe("clipOutlook — can the encode bring it inside the cap?", () => {
  it("settles a clip within the cap without opening it", async () => {
    await expect(clipOutlook(clip(POST_CAP), POST_CAP)).resolves.toBe("as-picked");
    expect(inputsOpened).not.toHaveBeenCalled();
  });

  it("weighs the picked bytes where the browser has no VideoEncoder", async () => {
    vi.stubGlobal("VideoEncoder", undefined);
    await expect(clipOutlook(clip(200_000_000), POST_CAP)).resolves.toBe("as-picked");
    expect(inputsOpened).not.toHaveBeenCalled();
  });

  it("lets in an over-cap clip this browser will encode inside the cap", async () => {
    await expect(clipOutlook(clip(300 * 1024 * 1024), POST_CAP)).resolves.toBe("compressible");
    // Asked, never encoded.
    expect(canEncodeVideo).toHaveBeenCalledOnce();
    expect(init).not.toHaveBeenCalled();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it("names the clip even the floor rate cannot fit", async () => {
    // 800 s × (1 Mbps + 128 kbps) = 902.4 Mbit, over the post cap's 838.9.
    durationS = 800;
    await expect(clipOutlook(clip(900_000_000), POST_CAP)).resolves.toBe("too-long");
  });

  it("counts no sound for a silent clip", async () => {
    // 800 s × 1 Mbps = 800 Mbit: inside the cap once there is no sound to carry.
    tracks = [videoTrack("avc", 3840, 2160)];
    durationS = 800;
    await expect(clipOutlook(clip(900_000_000), POST_CAP)).resolves.toBe("compressible");
  });

  it("counts a copied AAC track at its own measured rate", async () => {
    // 700 s: fits with 128 kbps encoded (789.6 Mbit), not with 256 kbps
    // carried across (879.2 Mbit).
    durationS = 700;
    await expect(clipOutlook(clip(900_000_000), POST_CAP)).resolves.toBe("compressible");
    canEncodeAudio.mockResolvedValue(false);
    await expect(clipOutlook(clip(900_000_000), POST_CAP)).resolves.toBe("too-long");
  });

  it("weighs the picked bytes where this browser cannot encode the clip", async () => {
    canEncodeVideo.mockResolvedValue(false);
    await expect(clipOutlook(clip(200_000_000), POST_CAP)).resolves.toBe("as-picked");
  });

  it("never throws, and weighs the picked bytes when the clip cannot be read", async () => {
    unreadable = new Error("not a movie");
    await expect(clipOutlook(clip(200_000_000), POST_CAP)).resolves.toBe("as-picked");
    expect(dispose).toHaveBeenCalledOnce();
  });
});

describe("compressVideo — pass-through", () => {
  it("passes a clip already within target on untouched, encoding nothing", async () => {
    // 720p, H.264 + AAC, 30 s at 2 Mbps overall.
    tracks = [videoTrack("avc", 1280, 720), audioTrack("aac")];
    const picked = clip(7_500_000);

    const result = await compressVideo(picked, POST_CAP);

    expect(result).toMatchObject({ blob: picked, path: "within-target" });
    expect(canEncodeVideo).not.toHaveBeenCalled();
    expect(init).not.toHaveBeenCalled();
  });

  it("opens the clip as MP4 or an iPhone's QuickTime, and nothing else", async () => {
    await compressVideo(clip(7_500_000), POST_CAP);
    expect(inputsOpened).toHaveBeenCalledWith(
      expect.objectContaining({ formats: ["MP4-format", "QTFF-format"] }),
    );
  });

  it("reads the size after rotation, as the clip is displayed", async () => {
    // A portrait phone clip stored landscape with a quarter turn: 1080 wide as
    // shown, so the short side is not over the bound…
    tracks = [videoTrack("avc", 1920, 1080, 90), audioTrack("aac")];
    // …and lean, so it passes through.
    const result = await compressVideo(clip(7_500_000), POST_CAP);
    expect(result.path).toBe("within-target");
  });

  it("leaves a track layout it does not describe to the remux", async () => {
    tracks = [videoTrack("avc", 3840, 2160), audioTrack("aac"), audioTrack("aac")];
    const picked = clip(200_000_000);

    const result = await compressVideo(picked, POST_CAP);

    expect(result).toMatchObject({ blob: picked, path: "unsupported" });
    expect(init).not.toHaveBeenCalled();
  });
});

describe("compressVideo — the encode", () => {
  it("configures H.264 + AAC at the target and writes no file metadata", async () => {
    await compressVideo(clip(200_000_000), POST_CAP);

    const options = init.mock.calls[0]![0];
    // Landscape: the short side is the height, and only it is named.
    expect(options.video).toMatchObject({
      codec: "avc",
      height: 1080,
      keyFrameInterval: 1,
      forceTranscode: true,
    });
    expect(options.video).not.toHaveProperty("width");
    expect(options.audio).toMatchObject({ codec: "aac", forceTranscode: true });
    expect(qualityOf(options.audio.quality)).toEqual({ bitrate: 128_000 });
    expect(options.tags).toEqual({});
  });

  it("names the width for a portrait clip", async () => {
    tracks = [videoTrack("avc", 2160, 3840), audioTrack("aac")];
    await compressVideo(clip(200_000_000), POST_CAP);
    const options = init.mock.calls[0]![0];
    expect(options.video).toMatchObject({ width: 1080 });
    expect(options.video).not.toHaveProperty("height");
  });

  it("plans a long clip at the rate that fits its cap", async () => {
    durationS = 388;
    await compressVideo(clip(900_000_000), POST_CAP);
    expect(qualityOf(init.mock.calls[0]![0].video.quality)).toEqual({
      bitrate: 1_861_051,
      bitrateMode: "variable",
    });
  });

  it("returns the encoded MP4 bytes", async () => {
    const result = await compressVideo(clip(200_000_000), POST_CAP);
    expect(result.path).toBe("encoded");
    expect(result.blob.size).toBe(64);
    expect(result.blob.type).toBe("video/mp4");
    expect(result.tookMs).toBeGreaterThanOrEqual(0);
  });

  it("falls back when the conversion would discard a track", async () => {
    // `Conversion.init` answering no where the capability checks said yes.
    discarded = [{ track: { type: "video" }, reason: "undecodable_source_codec" }];
    conversionValid = false;
    const picked = clip(200_000_000);

    const result = await compressVideo(picked, POST_CAP);

    expect(result).toMatchObject({ blob: picked, path: "unsupported" });
    expect(execute).not.toHaveBeenCalled();
    expect(cancelOutput).toHaveBeenCalled();
  });

  it("falls back, logging why, when the encoder fails half-way", async () => {
    execute.mockRejectedValue(new Error("EncodingError: the encoder crashed"));
    const picked = clip(200_000_000);

    const result = await compressVideo(picked, POST_CAP);

    expect(result).toMatchObject({ blob: picked, path: "failed" });
    expect(cancelConversion).toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("the encoder crashed"));
  });

  it("falls back when the encode produced nothing", async () => {
    encodedBuffer = null;
    const picked = clip(200_000_000);
    const result = await compressVideo(picked, POST_CAP);
    expect(result).toMatchObject({ blob: picked, path: "failed" });
  });

  it("never throws, and releases the input whichever way it went", async () => {
    execute.mockRejectedValue(new RangeError("Array buffer allocation failed"));
    await expect(compressVideo(clip(200_000_000), POST_CAP)).resolves.toMatchObject({
      path: "failed",
    });
    expect(dispose).toHaveBeenCalledOnce();

    await compressVideo(clip(200_000_000), POST_CAP);
    expect(dispose).toHaveBeenCalledTimes(2);
  });
});
