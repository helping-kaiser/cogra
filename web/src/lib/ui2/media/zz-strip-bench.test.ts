// TEMPORARY BENCH — not for commit. Times the real stripVideoMetadata on real
// MP4 bytes, to see whether the web composer's client-side remux is what makes
// a video upload slow (F3-2).
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { stripVideoMetadata } from "./strip-video";

const DIR =
  "C:/Users/peerp/AppData/Local/Temp/claude/D--dev-cogra/ddc8c0d3-41a0-410a-ae17-3cacf09ff340/scratchpad/clips";

const CLIPS = ["lowres", "vertical", "landscape", "square", "big"];

describe("strip bench", () => {
  it("times the remux", async () => {
    for (const name of CLIPS) {
      let bytes: Buffer;
      try {
        bytes = readFileSync(`${DIR}/${name}.mp4`);
      } catch {
        continue;
      }
      const blob = new Blob([bytes], { type: "video/mp4" });
      const started = Date.now();
      try {
        const out = await stripVideoMetadata(blob);
        console.log(
          `BENCH ${name}: in=${bytes.length}B out=${out.blob.size}B tookMs=${out.tookMs} wall=${Date.now() - started}ms`,
        );
      } catch (error) {
        console.log(
          `BENCH ${name}: THREW after ${Date.now() - started}ms — ${(error as Error).message}`,
        );
      }
    }
    expect(true).toBe(true);
  }, 600_000);
});
