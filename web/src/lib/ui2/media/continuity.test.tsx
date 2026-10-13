// CONTINUITY — one clip, many presentations (the stage-law packet §6,
// `continuity.test.tsx`; FeedCover.md:7–13, PostDetailVideo.md:43–51,
// ViewerVideo.md:5). The session's clip memory (`clip-memory.ts`) carries a
// clip's reached frame card → detail → back, across remounts, and — with the
// play state — detail clip → viewer → detail clip. The feed's refresh reset
// (FeedCover.md:13) is pinned where the refresh lives, `feed-view.test.tsx`.

import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { intersectEach, setsPageVisibility, suppressesAutoplay } from "@/test/media-env";

import * as clipMemory from "./clip-memory";
import { MediaViewer } from "./media-viewer";
import { resetMuteForTests } from "./mute";
import { DetailClip } from "./detail-clip";
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

/** The detail as `post-view.tsx` wires it: the detail clip, and the viewer over it. */
function Detail() {
  const [viewer, setViewer] = useState(false);
  return (
    <>
      <DetailClip
        src={CLIP}
        mimeType="video/mp4"
        poster={COVER}
        mediaId={ID}
        behindViewer={viewer}
        onOpenViewer={() => setViewer(true)}
        testId="detail"
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

const detailClip = () => video("detail-media");
const viewerClip = () => video("viewer-video");
const openViewer = () => fireEvent.click(screen.getByTestId("detail-media-transport-fullscreen"));
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
  it("the detail opens with the detail clip at the card's frame and plays on from there (D11)", () => {
    const { rerender } = render(<Route at="card" />);
    onScreen("card");
    video("card").currentTime = 5;

    rerender(<Route at="detail" />);
    expect(detailClip()).not.toHaveAttribute("poster");
    expect(detailClip().currentTime).toBe(5);
    onScreen("detail-media");
    expect(detailClip().paused).toBe(false);
    expect(detailClip().currentTime).toBe(5);
  });

  it("back leaves the card at the frame the detail clip reached, never its still (D12)", () => {
    const { rerender } = render(<Route at="detail" />);
    onScreen("detail-media");
    detailClip().currentTime = 9;

    rerender(<Route at="card" />);
    expect(video("card")).not.toHaveAttribute("poster");
    expect(video("card").currentTime).toBe(9);
  });
});

describe("detail → viewer → detail (PostDetailVideo.md:47–51, ViewerVideo.md:5)", () => {
  it("the viewer opens at the detail clip's position and playing, and the detail clip'stops (D13, W02, N1)", () => {
    render(<Detail />);
    onScreen("detail-media");
    detailClip().currentTime = 6;
    expect(detailClip().paused).toBe(false);

    const element = detailClip();

    openViewer();

    // The clip's one element moved into the viewer (`video-stage.ts`): the
    // detail frame behind it holds none, so nothing of it plays there.
    expect(screen.queryByTestId("detail-media")).toBeNull();
    expect(viewerClip()).toBe(element);
    expect(viewerClip().currentTime).toBe(6);
    expect(viewerClip().paused).toBe(false);
  });

  it("the viewer opens paused on a detail clip the reader paused (N1, the ruled GAP-8 carry)", () => {
    render(<Detail />);
    onScreen("detail-media");
    detailClip().currentTime = 4;
    fireEvent.click(screen.getByTestId("detail-media-transport-play"));
    expect(detailClip().paused).toBe(true);

    openViewer();
    // The viewer's own frame reporting in view starts nothing: the carried
    // pause is the reader's.
    onScreen("viewer-video");

    expect(viewerClip().paused).toBe(true);
    expect(viewerClip().currentTime).toBe(4);
  });

  it("the detail clip never plays behind the viewer — not when the page shows again, not when autoplay comes back (D13)", () => {
    suppressesAutoplay({ reducedMotion: true });
    render(<Detail />);
    onScreen("detail-media");
    openViewer();
    // The element is the viewer's now; behind it the detail frame holds none,
    // and nothing the page or the device says puts one back.
    expect(screen.queryByTestId("detail-media")).toBeNull();

    act(() => setsPageVisibility("hidden"));
    act(() => setsPageVisibility("visible"));
    act(() => suppressesAutoplay({ reducedMotion: false }));

    expect(screen.queryByTestId("detail-media")).toBeNull();
  });

  it("closing a playing viewer: the detail clip plays on from the viewer's position (D14 PostDetailVideo.md:49)", () => {
    render(<Detail />);
    onScreen("detail-media");
    detailClip().currentTime = 2;
    openViewer();
    viewerClip().currentTime = 11;
    expect(viewerClip().paused).toBe(false);

    closeViewer();

    expect(screen.queryByTestId("viewer")).toBeNull();
    expect(detailClip().currentTime).toBe(11);
    expect(detailClip().paused).toBe(false);
  });

  it("closing a paused viewer: the detail clip'stands paused at the viewer's position, even though it was playing when the viewer rose (D16 PostDetailVideo.md:51)", () => {
    render(<Detail />);
    onScreen("detail-media");
    openViewer();
    viewerClip().currentTime = 8;
    fireEvent.click(screen.getByTestId("viewer-video-transport-play"));
    expect(viewerClip().paused).toBe(true);

    closeViewer();
    // The detail clip reporting in view again elects nothing over the
    // carried pause.
    onScreen("detail-media");

    expect(detailClip().currentTime).toBe(8);
    expect(detailClip().paused).toBe(true);
  });

  it("under suppressed autoplay a viewer the reader started carries its playing back — the reader's start continuing (N1, flag §7.2-b)", () => {
    suppressesAutoplay({ saveData: true });
    render(<Detail />);
    onScreen("detail-media");
    expect(detailClip().paused).toBe(true);
    openViewer();
    expect(viewerClip().paused).toBe(true);
    fireEvent.click(screen.getByTestId("viewer-video-transport-play"));
    viewerClip().currentTime = 3;

    closeViewer();

    expect(detailClip().paused).toBe(false);
    expect(detailClip().currentTime).toBe(3);
  });

  it("the viewer is a covering layer while it stands, and its own clip is not suspended by it (rule 13, SL-1 flag d)", () => {
    render(<Detail />);
    onScreen("detail-media");
    openViewer();
    expect(clipMemory.read(ID)?.playing).toBe(true);
    // The viewer's clip plays on the viewer's own layer.
    onScreen("viewer-video");
    expect(viewerClip().paused).toBe(false);
  });
});
