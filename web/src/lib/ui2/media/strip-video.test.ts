// @vitest-environment node
//
// The strip's CONTRACT WITH THE LIBRARY, not the library itself. mediabunny's
// own remuxing is its business and is tested upstream; what has to hold here is
// the four things this module is responsible for, each of which is a way the
// author's privacy or their video could be quietly lost:
//
//  · the conversion is asked to drop every metadata tag (`tags: {}`);
//  · it is never allowed to transcode, so the picture is bit-for-bit intact;
//  · only the MP4 demuxer is pulled in, so the bundle stays small;
//  · a discarded track is treated as a failure rather than shipped as a video
//    that silently lost its sound.
//
// The library is mocked so those become assertions about the CALL rather than
// about a real encode, which Node cannot do anyway.

import { beforeEach, describe, expect, it, vi } from "vitest";

const init = vi.fn();
const execute = vi.fn(async () => {});
const dispose = vi.fn();

vi.mock("mediabunny", () => {
  class Input {
    constructor(readonly options: unknown) {}
    dispose = dispose;
  }
  class Output {
    target = { buffer: new ArrayBuffer(8) as ArrayBuffer | null };
    constructor(readonly options: unknown) {}
  }
  return {
    Input,
    Output,
    BlobSource: class {
      constructor(readonly file: unknown) {}
    },
    BufferTarget: class {},
    Mp4OutputFormat: class {},
    MP4: "MP4-format",
    Conversion: { init },
  };
});

const { stripVideoMetadata } = await import("./strip-video");

/** A conversion that accepts everything, which is the ordinary case. */
function goodConversion() {
  init.mockResolvedValue({ isValid: true, discardedTracks: [], execute });
}

beforeEach(() => {
  vi.clearAllMocks();
  goodConversion();
});

const clip = () => new Blob([new Uint8Array(new ArrayBuffer(16)) as BlobPart], { type: "video/mp4" });

describe("stripVideoMetadata", () => {
  it("asks the conversion to drop every metadata tag", async () => {
    await stripVideoMetadata(clip());
    // The documented way to "remove all metadata". Without it the conversion
    // copies the input's tags — GPS included — straight into the output.
    expect(init.mock.calls[0]![0]).toMatchObject({ tags: {} });
  });

  it("never asks for a transcode, so the encoded streams are copied", async () => {
    await stripVideoMetadata(clip());
    const options = init.mock.calls[0]![0] as Record<string, unknown>;
    // `forceTranscode` is the only opt-out of copying, and setting it would
    // re-encode the author's video for a container-level change.
    expect(options.video).toBeUndefined();
    expect(options.audio).toBeUndefined();
    expect(JSON.stringify(options)).not.toContain("forceTranscode");
  });

  it("pulls in only the MP4 demuxer", async () => {
    await stripVideoMetadata(clip());
    // `ALL_FORMATS` would bundle every demuxer the library has for a path that
    // only ever sees MP4 — the pick screening sniffed the container already.
    const input = init.mock.calls[0]![0] as { input: { options: { formats: unknown } } };
    expect(input.input.options.formats).toEqual(["MP4-format"]);
  });

  it("returns MP4 bytes and how long the remux took", async () => {
    const result = await stripVideoMetadata(clip());
    expect(result.blob.type).toBe("video/mp4");
    expect(result.tookMs).toBeGreaterThanOrEqual(0);
  });

  it("refuses a conversion that dropped a track rather than shipping it", async () => {
    // A clip that lost its audio would upload silently without sound, which is
    // worse than being told it cannot be prepared.
    init.mockResolvedValue({
      isValid: true,
      discardedTracks: [{ reason: "undecodable_source_codec" }],
      execute,
    });
    await expect(stripVideoMetadata(clip())).rejects.toThrow("undecodable_source_codec");
    expect(execute).not.toHaveBeenCalled();
  });

  it("refuses an invalid conversion", async () => {
    init.mockResolvedValue({ isValid: false, discardedTracks: [], execute });
    await expect(stripVideoMetadata(clip())).rejects.toThrow();
  });

  it("releases the input whether it succeeded or failed", async () => {
    await stripVideoMetadata(clip());
    expect(dispose).toHaveBeenCalledTimes(1);

    init.mockResolvedValue({ isValid: false, discardedTracks: [], execute });
    await expect(stripVideoMetadata(clip())).rejects.toThrow();
    expect(dispose).toHaveBeenCalledTimes(2);
  });
});
