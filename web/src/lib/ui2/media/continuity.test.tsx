// CONTINUITY — one clip, many presentations (the stage-law packet §6,
// `continuity.test.tsx`; FeedCover.md:7–13, PostDetailVideo.md:43–51,
// ViewerVideo.md:5). This file holds the rows that are true today; the
// carry rows — card → detail → viewer and back, the remount that keeps its
// frame, the refresh that restores the stills — arrive with the continuity PR,
// which wires `clip-memory.ts` into the player.

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const CLIP = "https://media.example/clip.mp4";
const COVER = "https://media.example/cover.webp";

describe("a new document (FeedCover.md:11)", () => {
  it("starts with the stills: the frame wears its stored still and the session remembers nothing", async () => {
    // A cold launch on the web is a fresh document — a fresh module graph.
    vi.resetModules();
    const clipMemory = await import("./clip-memory");
    const { VideoPlayer } = await import("./video-player");

    render(<VideoPlayer src={CLIP} poster={COVER} />);

    expect(screen.getByTestId("video-player")).toHaveAttribute("poster", COVER);
    expect(clipMemory.read("m1")).toBeUndefined();
  });
});
