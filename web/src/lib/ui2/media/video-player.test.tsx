// The playback ruling, asserted: autoplay muted on visibility, ONE global
// sticky mute across every player and every route, real controls, the cover as
// poster.
//
// These are behaviours rather than markup, so they are driven through the
// events a browser would actually deliver — an element scrolling into view, a
// reader pressing the element's own mute button — using the stubs in
// `src/test/media-env.ts`.

import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { intersect, observedThresholds } from "@/test/media-env";
import { isMuted, resetMuteForTests, setMuted } from "./mute";
import { VideoPlayer } from "./video-player";
import { MediaTile } from "./media-tile";

afterEach(() => resetMuteForTests());

const CLIP = "https://media.example/clip.mp4";
const COVER = "https://media.example/cover.webp";

function player(props: Partial<React.ComponentProps<typeof VideoPlayer>> = {}) {
  render(<VideoPlayer src={CLIP} {...props} />);
  return screen.getByTestId("video-player") as HTMLVideoElement;
}

describe("autoplay", () => {
  it("starts muted, which is the only autoplay a browser permits", () => {
    const video = player();
    expect(video.muted).toBe(true);
    expect(video).toHaveAttribute("playsinline");
  });

  it("plays when it comes into view and pauses when it leaves", () => {
    const video = player();
    expect(video.paused).toBe(true);

    act(() => intersect(true));
    expect(video.paused).toBe(false);

    // PAUSED, not stopped: coming back should resume where the reader was.
    act(() => intersect(false));
    expect(video.paused).toBe(true);
  });

  it("asks for half the frame before it plays, so two clips never fight", () => {
    player();
    expect(observedThresholds()).toContain(0.5);
  });

  it("does not observe at all where the caller turned autoplay off", () => {
    render(<VideoPlayer src={CLIP} autoplay={false} testId="still" />);
    const video = screen.getByTestId("still") as HTMLVideoElement;
    act(() => intersect(true));
    expect(video.paused).toBe(true);
  });

  it("carries the element's own controls — the ruling asks for real ones", () => {
    expect(player()).toHaveAttribute("controls");
  });
});

describe("the one global mute", () => {
  it("is shared by every player on screen", () => {
    render(
      <>
        <VideoPlayer src={CLIP} testId="one" />
        <VideoPlayer src={CLIP} testId="two" />
      </>,
    );
    const one = screen.getByTestId("one") as HTMLVideoElement;
    const two = screen.getByTestId("two") as HTMLVideoElement;

    act(() => setMuted(false));
    expect(one.muted).toBe(false);
    expect(two.muted).toBe(false);

    act(() => setMuted(true));
    expect(one.muted).toBe(true);
    expect(two.muted).toBe(true);
  });

  it("takes the reader's press on the element's own mute button", () => {
    // The native control is the one a reader actually reaches for, so it has to
    // be the global control: the press arrives as `volumechange`, not a click.
    const video = player();
    act(() => {
      video.muted = false;
      video.dispatchEvent(new Event("volumechange"));
    });
    expect(isMuted()).toBe(false);
  });

  it("survives a player unmounting, which is what makes it sticky across routes", () => {
    const first = render(<VideoPlayer src={CLIP} testId="one" />);
    act(() => setMuted(false));
    first.unmount();

    render(<VideoPlayer src={CLIP} testId="two" />);
    const later = screen.getByTestId("two") as HTMLVideoElement;
    act(() => intersect(true));
    expect(later.muted).toBe(false);
  });
});

describe("the poster", () => {
  it("shows the cover the video names", () => {
    expect(player({ poster: COVER })).toHaveAttribute("poster", COVER);
  });

  it("shows none where the asset names none", () => {
    expect(player({ poster: null })).not.toHaveAttribute("poster");
  });
});

// A COMMENT IS SOMETHING YOU READ PAST, not a player you operate (item 31,
// round 2, drawn by ReplyMedia). The clip wears one control — the sound — and
// the transport bar and duration pill are gone. What must NOT be lost with them
// is the muted autoplay or the shared decision the sound carries.
describe("the reading surface", () => {
  it("wears one control, and it is the sound", () => {
    const video = player({ surface: "reading" });
    expect(video).not.toHaveAttribute("controls");
    expect(screen.getByTestId("video-player-sound")).toHaveAttribute(
      "aria-label",
      "Turn sound on",
    );
  });

  it("shows no duration, which is authoring-side information", () => {
    player({ surface: "reading", durationMs: 18_000 });
    expect(screen.queryByTestId("video-player-duration")).toBeNull();
  });

  it("still autoplays muted when it comes into view", () => {
    // Losing the transport bar must not cost the clip its autoplay.
    const video = player({ surface: "reading" });
    expect(video.muted).toBe(true);
    act(() => intersect(true));
    expect(video.paused).toBe(false);
  });

  it("carries the sticky decision every video shares", () => {
    render(
      <>
        <VideoPlayer src={CLIP} surface="reading" testId="thread" />
        <VideoPlayer src={CLIP} testId="feed" />
      </>,
    );
    // Pressing the comment's sound control changes the sound everywhere, which
    // is the whole point of one global mute.
    act(() => {
      screen.getByTestId("thread-sound").click();
    });
    expect(isMuted()).toBe(false);
    expect((screen.getByTestId("feed") as HTMLVideoElement).muted).toBe(false);
    expect(screen.getByTestId("thread-sound")).toHaveAttribute("aria-label", "Turn sound off");
  });
});

describe("the tile", () => {
  it("renders a player for a video and an image for a picture", () => {
    render(
      <MediaTile src={CLIP} mimeType="video/mp4" poster={COVER} testId="moving" />,
    );
    expect(screen.getByTestId("moving").tagName).toBe("VIDEO");
  });

  it("never wraps a video in the open button, which would eat every control press", () => {
    render(
      <MediaTile src={CLIP} mimeType="video/mp4" testId="moving" onOpen={() => {}} />,
    );
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("draws the length where the contract states one", () => {
    render(<MediaTile src={CLIP} mimeType="video/mp4" durationMs={42_000} testId="moving" />);
    expect(screen.getByTestId("moving-duration")).toHaveTextContent("0:42");
  });
});
