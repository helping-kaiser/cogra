// CONTINUITY — one clip, many presentations (the stage-law packet §6,
// `continuity.test.tsx`; FeedCover.md:7–13, PostDetailVideo.md:43–51,
// ViewerVideo.md:5). The session's clip memory (`clip-memory.ts`) carries a
// clip's reached frame card → detail → back, across remounts, and — with the
// play state — pinned clip → viewer → pinned clip. The feed's refresh reset
// (FeedCover.md:13) is pinned where the refresh lives, `feed-view.test.tsx`.

import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { intersectEach, suppressesAutoplay } from "@/test/media-env";

import * as clipMemory from "./clip-memory";
import { MediaViewer } from "./media-viewer";
import { resetMuteForTests } from "./mute";
import { PinnedClip } from "./pinned-clip";
import { StageHost } from "./stage-host";
import { VideoPlayer } from "./video-player";
import { resetVideoStageForTests } from "./video-stage";

afterEach(() => {
  resetMuteForTests();
  resetVideoStageForTests();
});

const CLIP = "https://media.example/clip.mp4";
const COVER = "https://media.example/cover.webp";
const ID = "m1";

const video = (testId: string) => screen.getByTestId(testId) as HTMLVideoElement;
const onScreen = (testId: string, ratio = 1) =>
  act(() => intersectEach([{ target: video(testId), ratio }]));

/** A feed card's clip, on its list's stage. */
function Card() {
  return (
    <StageHost>
      <VideoPlayer src={CLIP} poster={COVER} mediaId={ID} testId="card" />
    </StageHost>
  );
}

/** The detail as `post-view.tsx` wires it: the pinned clip, and the viewer over it. */
function Detail() {
  const [viewer, setViewer] = useState(false);
  return (
    <>
      <PinnedClip
        src={CLIP}
        mimeType="video/mp4"
        poster={COVER}
        mediaId={ID}
        behindViewer={viewer}
        onOpenViewer={() => setViewer(true)}
        testId="pinned"
      />
      {viewer && (
        <MediaViewer
          items={[{ src: CLIP, mimeType: "video/mp4", poster: COVER, mediaId: ID }]}
          onClose={() => setViewer(false)}
          testId="viewer"
        />
      )}
    </>
  );
}

/**
 * One route at a time, as the app router swaps them: the outgoing page is
 * removed in the same commit that mounts the incoming one, so the incoming
 * presentation RENDERS before the outgoing one's unmount has written anything.
 */
function Route({ at, era = 0 }: { at: "card" | "detail"; era?: number }) {
  return at === "card" ? <Card key={`card-${era}`} /> : <Detail key={`detail-${era}`} />;
}

const pinned = () => video("pinned-media");
const viewerClip = () => video("viewer-video");
const openViewer = () => fireEvent.click(screen.getByTestId("pinned-media-transport-fullscreen"));
const closeViewer = () => fireEvent.click(screen.getByTestId("viewer-close"));

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

describe("a card's remount (C04 FeedCover.md:9)", () => {
  it("a clip that played comes back at the frame it reached, never on its still", () => {
    const { rerender } = render(<Route at="card" />);
    onScreen("card");
    expect(video("card").paused).toBe(false);
    video("card").currentTime = 7;

    rerender(<Route at="card" era={1} />);
    expect(video("card")).not.toHaveAttribute("poster");
    expect(video("card").currentTime).toBe(7);
  });

  it("a clip that never played comes back on its still (C01 FeedCover.md:3)", () => {
    suppressesAutoplay({ reducedMotion: true });
    const { rerender } = render(<Route at="card" />);
    onScreen("card");

    rerender(<Route at="card" era={1} />);
    expect(video("card")).toHaveAttribute("poster", COVER);
    expect(video("card").currentTime).toBe(0);
  });

  it("a clip that played wears no still even standing frozen under suppression (C04, C10)", () => {
    const { rerender } = render(<Route at="card" />);
    onScreen("card");
    video("card").currentTime = 3;

    act(() => suppressesAutoplay({ saveData: true }));
    rerender(<Route at="card" era={1} />);
    onScreen("card");
    expect(video("card").paused).toBe(true);
    expect(video("card")).not.toHaveAttribute("poster");
    expect(video("card").currentTime).toBe(3);
  });
});

describe("card → detail → back (PostDetailVideo.md:43/45)", () => {
  it("the detail opens with the pinned clip at the card's frame and plays on from there (D11)", () => {
    const { rerender } = render(<Route at="card" />);
    onScreen("card");
    video("card").currentTime = 5;

    rerender(<Route at="detail" />);
    expect(pinned()).not.toHaveAttribute("poster");
    expect(pinned().currentTime).toBe(5);
    onScreen("pinned-media");
    expect(pinned().paused).toBe(false);
    expect(pinned().currentTime).toBe(5);
  });

  it("back leaves the card at the frame the pinned clip reached, never its still (D12)", () => {
    const { rerender } = render(<Route at="detail" />);
    onScreen("pinned-media");
    pinned().currentTime = 9;

    rerender(<Route at="card" />);
    expect(video("card")).not.toHaveAttribute("poster");
    expect(video("card").currentTime).toBe(9);
  });
});

describe("detail → viewer → detail (PostDetailVideo.md:47–51, ViewerVideo.md:5)", () => {
  it("the viewer opens at the pinned clip's position and playing, and the pinned clip stops (D13, W02, N1)", () => {
    render(<Detail />);
    onScreen("pinned-media");
    pinned().currentTime = 6;
    expect(pinned().paused).toBe(false);

    openViewer();

    expect(pinned().paused).toBe(true);
    expect(viewerClip().currentTime).toBe(6);
    expect(viewerClip().paused).toBe(false);
  });

  it("the viewer opens paused on a pinned clip the reader paused (N1, the ruled GAP-8 carry)", () => {
    render(<Detail />);
    onScreen("pinned-media");
    pinned().currentTime = 4;
    fireEvent.click(screen.getByTestId("pinned-media-transport-play"));
    expect(pinned().paused).toBe(true);

    openViewer();
    // The viewer's own frame reporting in view starts nothing: the carried
    // pause is the reader's.
    onScreen("viewer-video");

    expect(viewerClip().paused).toBe(true);
    expect(viewerClip().currentTime).toBe(4);
  });

  it("the pinned clip never plays behind the viewer — not when the page shows again, not when autoplay comes back (D13)", () => {
    suppressesAutoplay({ reducedMotion: true });
    render(<Detail />);
    onScreen("pinned-media");
    openViewer();
    let behind = 0;
    pinned().addEventListener("play", () => {
      behind += 1;
    });

    onScreen("pinned-media");
    act(() => suppressesAutoplay({ reducedMotion: false }));
    onScreen("pinned-media");

    expect(behind).toBe(0);
    expect(pinned().paused).toBe(true);
  });

  it("closing a playing viewer: the pinned clip plays on from the viewer's position (D14 PostDetailVideo.md:49)", () => {
    render(<Detail />);
    onScreen("pinned-media");
    pinned().currentTime = 2;
    openViewer();
    viewerClip().currentTime = 11;
    expect(viewerClip().paused).toBe(false);

    closeViewer();

    expect(screen.queryByTestId("viewer")).toBeNull();
    expect(pinned().currentTime).toBe(11);
    expect(pinned().paused).toBe(false);
  });

  it("closing a paused viewer: the pinned clip stands paused at the viewer's position, even though it was playing when the viewer rose (D16 PostDetailVideo.md:51)", () => {
    render(<Detail />);
    onScreen("pinned-media");
    openViewer();
    viewerClip().currentTime = 8;
    fireEvent.click(screen.getByTestId("viewer-video-transport-play"));
    expect(viewerClip().paused).toBe(true);

    closeViewer();
    // The pinned clip reporting in view again elects nothing over the
    // carried pause.
    onScreen("pinned-media");

    expect(pinned().currentTime).toBe(8);
    expect(pinned().paused).toBe(true);
  });

  it("under suppressed autoplay a viewer the reader started carries its playing back — the reader's start continuing (N1, flag §7.2-b)", () => {
    suppressesAutoplay({ saveData: true });
    render(<Detail />);
    onScreen("pinned-media");
    expect(pinned().paused).toBe(true);
    openViewer();
    expect(viewerClip().paused).toBe(true);
    fireEvent.click(screen.getByTestId("viewer-video-transport-play"));
    viewerClip().currentTime = 3;

    closeViewer();

    expect(pinned().paused).toBe(false);
    expect(pinned().currentTime).toBe(3);
  });

  it("the viewer is a covering layer while it stands, and its own clip is not suspended by it (rule 13, SL-1 flag d)", () => {
    render(<Detail />);
    onScreen("pinned-media");
    openViewer();
    expect(clipMemory.read(ID)?.playing).toBe(true);
    // The viewer's clip plays on the viewer's own layer.
    onScreen("viewer-video");
    expect(viewerClip().paused).toBe(false);
  });
});
