// @vitest-environment node
//
// The upload target, pinned as arithmetic — and pinned to ANDROID's. Every case
// in `VideoBitrateTest.kt` is restated here against the same inputs, and the
// integers below are what `VideoBitrate.forClip` computes for them: the formula
// is the same sequence of double-precision operations on both platforms, so a
// web clip and an Android clip of the same length are encoded at the same rate.

import { describe, expect, it } from "vitest";

import {
  AUDIO_BPS,
  CAP_HEADROOM,
  FLOOR_VIDEO_BPS,
  KEY_FRAME_INTERVAL_S,
  MAX_SHORT_SIDE_PX,
  STANDARD_VIDEO_BPS,
  containerBitrate,
  fitsAtFloor,
  outputSize,
  planVideo,
  richerThan,
  rotatedDimensions,
  videoBitrateForClip,
  type ClipProbe,
} from "./video-target";

const postCap = 100 * 1024 * 1024;
const commentCap = 50 * 1024 * 1024;

describe("the constants are Android's", () => {
  it("names the same target", () => {
    // VideoBitrate.kt and AndroidVideoProcessor.kt, value for value.
    expect(STANDARD_VIDEO_BPS).toBe(4_000_000);
    expect(AUDIO_BPS).toBe(128_000);
    expect(FLOOR_VIDEO_BPS).toBe(1_000_000);
    expect(CAP_HEADROOM).toBe(0.92);
    expect(MAX_SHORT_SIDE_PX).toBe(1080);
    // Media3's VideoEncoderSettings.DEFAULT_I_FRAME_INTERVAL_SECONDS.
    expect(KEY_FRAME_INTERVAL_S).toBe(1);
  });
});

describe("videoBitrateForClip — VideoBitrate.forClip", () => {
  it("gives an everyday clip the standard rate", () => {
    expect(videoBitrateForClip(30_000, postCap)).toBe(STANDARD_VIDEO_BPS);
    expect(videoBitrateForClip(30_000, commentCap)).toBe(STANDARD_VIDEO_BPS);
  });

  it("scales a long clip down to fit rather than refusing it", () => {
    // The 6:28 clip from Android's hand test.
    const rate = videoBitrateForClip(388_000, postCap);
    expect(rate).toBe(1_861_051);
    expect(rate).toBeLessThan(STANDARD_VIDEO_BPS);
    expect(rate).toBeGreaterThan(FLOOR_VIDEO_BPS);
    const plannedBytes = ((rate + AUDIO_BPS) * 388) / 8;
    expect(plannedBytes).toBeLessThan(postCap);
  });

  it("stops at the floor and lets the cap refuse", () => {
    const rate = videoBitrateForClip(388_000, commentCap);
    expect(rate).toBe(FLOOR_VIDEO_BPS);
    const plannedBytes = ((rate + AUDIO_BPS) * 388) / 8;
    expect(plannedBytes).toBeGreaterThan(commentCap);
  });

  it("does not degrade a clip of unknown length on suspicion", () => {
    expect(videoBitrateForClip(0, postCap)).toBe(STANDARD_VIDEO_BPS);
    expect(videoBitrateForClip(-1, postCap)).toBe(STANDARD_VIDEO_BPS);
    expect(videoBitrateForClip(Number.NaN, postCap)).toBe(STANDARD_VIDEO_BPS);
  });

  it("falls as the clip grows", () => {
    const rates = [60_000, 120_000, 240_000, 480_000, 960_000].map((ms) =>
      videoBitrateForClip(ms, postCap),
    );
    for (let i = 1; i < rates.length; i += 1) {
      expect(rates[i]!).toBeLessThanOrEqual(rates[i - 1]!);
    }
  });

  it("leaves headroom for the container", () => {
    const seconds = 200;
    const rate = videoBitrateForClip(seconds * 1_000, postCap);
    expect(rate).toBe(3_730_760);
    const plannedBytes = ((rate + AUDIO_BPS) * seconds) / 8;
    expect(plannedBytes).toBeLessThan(postCap * 0.93);
  });

  it("lands on the exact integers Android computes", () => {
    // 0.92 × cap × 8 / seconds − 128 000, rounded half up — evaluated in
    // Android's operation order, so the double and the integer agree.
    expect(videoBitrateForClip(120_000, commentCap)).toBe(3_087_633);
    expect(videoBitrateForClip(240_000, postCap)).toBe(3_087_633);
    expect(videoBitrateForClip(200_000, commentCap)).toBe(1_801_380);
    expect(videoBitrateForClip(240_000, commentCap)).toBe(1_479_817);
  });

  it("gives the picture what a carried-across sound track leaves", () => {
    // The Android rate is the default: naming 128 kbps changes nothing.
    expect(videoBitrateForClip(388_000, postCap, AUDIO_BPS)).toBe(1_861_051);
    // A 256 kbps AAC track copied untouched takes 128 kbps more of the budget…
    expect(videoBitrateForClip(388_000, postCap, 256_000)).toBe(1_733_051);
    // …and a leaner one gives it back.
    expect(videoBitrateForClip(388_000, postCap, 96_000)).toBe(1_893_051);
  });
});

// The pick's one question of an over-cap clip. Pinned at the millisecond the
// answer turns: (1 Mbps floor + sound) × length against the cap's bits.
describe("fitsAtFloor — the provably unfittable clip", () => {
  it("turns where the floor rate and encoded sound fill a post's cap", () => {
    // 838 860 800 bits ÷ 1 128 000 bps = 743.67 s.
    expect(fitsAtFloor(743_670, postCap, AUDIO_BPS)).toBe(true);
    expect(fitsAtFloor(743_671, postCap, AUDIO_BPS)).toBe(false);
  });

  it("turns at half the length for a comment's half cap", () => {
    expect(fitsAtFloor(371_835, commentCap, AUDIO_BPS)).toBe(true);
    expect(fitsAtFloor(371_836, commentCap, AUDIO_BPS)).toBe(false);
  });

  it("counts a copied sound at its own rate, and a silent clip at none", () => {
    expect(fitsAtFloor(667_882, postCap, 256_000)).toBe(true);
    expect(fitsAtFloor(667_883, postCap, 256_000)).toBe(false);
    expect(fitsAtFloor(838_860, postCap, 0)).toBe(true);
    expect(fitsAtFloor(838_861, postCap, 0)).toBe(false);
  });

  it("lets a clip of unknown length through to the check on the encoded bytes", () => {
    expect(fitsAtFloor(0, postCap, AUDIO_BPS)).toBe(true);
    expect(fitsAtFloor(Number.NaN, postCap, AUDIO_BPS)).toBe(true);
  });

  it("agrees with the plan: past the turn, the plan is already at the floor", () => {
    expect(videoBitrateForClip(743_671, postCap)).toBe(FLOOR_VIDEO_BPS);
  });
});

describe("richerThan — MediaGeometry.richerThan", () => {
  it("compares against video plus audio", () => {
    expect(richerThan(STANDARD_VIDEO_BPS + AUDIO_BPS, STANDARD_VIDEO_BPS)).toBe(false);
    expect(richerThan(STANDARD_VIDEO_BPS + AUDIO_BPS + 1, STANDARD_VIDEO_BPS)).toBe(true);
  });

  it("treats a clip that will not say as too rich", () => {
    expect(richerThan(null, STANDARD_VIDEO_BPS)).toBe(true);
  });
});

describe("containerBitrate — METADATA_KEY_BITRATE", () => {
  it("is the file's bits over its duration", () => {
    // 10 MB over 20 s is 4 Mbps.
    expect(containerBitrate(10_000_000, 20_000)).toBe(4_000_000);
  });

  it("is unknown when the duration is", () => {
    expect(containerBitrate(10_000_000, 0)).toBeNull();
  });
});

describe("rotatedDimensions — MediaGeometry.rotatedDimensions", () => {
  it("swaps the sides for a quarter turn and keeps them otherwise", () => {
    expect(rotatedDimensions(1920, 1080, 90)).toEqual({ width: 1080, height: 1920 });
    expect(rotatedDimensions(1920, 1080, 270)).toEqual({ width: 1080, height: 1920 });
    expect(rotatedDimensions(1920, 1080, 180)).toEqual({ width: 1920, height: 1080 });
    expect(rotatedDimensions(1920, 1080, 0)).toEqual({ width: 1920, height: 1080 });
  });
});

describe("outputSize — Presentation.createForShortSide(1080)", () => {
  it("bounds a 4K landscape clip at 1080 tall", () => {
    expect(outputSize(3840, 2160)).toEqual({
      axis: "height",
      shortSide: 1080,
      width: 1920,
      height: 1080,
    });
  });

  it("bounds a 4K portrait clip at 1080 wide", () => {
    expect(outputSize(2160, 3840)).toEqual({
      axis: "width",
      shortSide: 1080,
      width: 1080,
      height: 1920,
    });
  });

  it("keeps a clip already inside the bound at its own size", () => {
    expect(outputSize(1280, 720)).toEqual({ axis: "height", shortSide: 720, width: 1280, height: 720 });
    expect(outputSize(1080, 1920)).toEqual({ axis: "width", shortSide: 1080, width: 1080, height: 1920 });
  });

  it("rounds to even sides, the way the encoder is configured", () => {
    // An odd short side is rounded UP to even, and the long side follows the
    // aspect ratio before being rounded up too — mediabunny's own sizing.
    expect(outputSize(641, 479)).toEqual({ axis: "height", shortSide: 480, width: 642, height: 480 });
    // A 4:3 source at 4032 × 3024 → 1080 short side, 1440 long.
    expect(outputSize(4032, 3024)).toEqual({ axis: "height", shortSide: 1080, width: 1440, height: 1080 });
  });

  it("treats a square clip as portrait, naming its width", () => {
    expect(outputSize(2000, 2000)).toEqual({ axis: "width", shortSide: 1080, width: 1080, height: 1080 });
  });
});

describe("planVideo — AndroidVideoProcessor.editedItem", () => {
  // A lean 720p clip: 30 s at 2 Mbps overall, H.264 + AAC.
  const lean: ClipProbe = {
    width: 1280,
    height: 720,
    durationMs: 30_000,
    byteCount: 7_500_000,
    videoCodec: "avc",
    audioCodec: "aac",
  };

  it("passes a small, lean H.264 + AAC clip through to the remux", () => {
    expect(planVideo(lean, postCap)).toEqual({ kind: "remux" });
  });

  it("passes a silent clip through on its video alone", () => {
    expect(planVideo({ ...lean, audioCodec: null }, postCap)).toEqual({ kind: "remux" });
  });

  it("scales a clip whose short side is over 1080", () => {
    const plan = planVideo({ ...lean, width: 3840, height: 2160 }, postCap);
    expect(plan).toMatchObject({ kind: "encode", reason: "too-large", videoBps: STANDARD_VIDEO_BPS });
    expect(plan.kind === "encode" && plan.size).toMatchObject({ width: 1920, height: 1080 });
  });

  it("re-encodes a right-sized clip carrying more bits than we send, at its own size", () => {
    // A phone's own 1080p recording: short side exactly 1080, but ~17 Mbps.
    const plan = planVideo(
      { ...lean, width: 1080, height: 1920, byteCount: 65_000_000 },
      postCap,
    );
    expect(plan).toMatchObject({ kind: "encode", reason: "too-rich" });
    expect(plan.kind === "encode" && plan.size).toMatchObject({ width: 1080, height: 1920 });
  });

  it("measures richness against the rate THIS clip would get, not the standard", () => {
    // Six and a half minutes at 2.5 Mbps overall is lean against 4 Mbps but
    // rich against the 1.86 Mbps a clip that long is planned at.
    const long: ClipProbe = { ...lean, durationMs: 388_000, byteCount: (2_500_000 * 388) / 8 };
    expect(planVideo(long, postCap)).toMatchObject({
      kind: "encode",
      reason: "too-rich",
      videoBps: 1_861_051,
    });
  });

  it("re-encodes a clip of unknown length rather than guessing it lean", () => {
    expect(planVideo({ ...lean, durationMs: 0 }, postCap)).toMatchObject({
      kind: "encode",
      reason: "too-rich",
    });
  });

  it("re-encodes a stream that is not H.264 + AAC, however lean", () => {
    expect(planVideo({ ...lean, videoCodec: "hevc" }, postCap)).toMatchObject({
      kind: "encode",
      reason: "codec",
    });
    expect(planVideo({ ...lean, audioCodec: "opus" }, postCap)).toMatchObject({
      kind: "encode",
      reason: "codec",
    });
  });
});
