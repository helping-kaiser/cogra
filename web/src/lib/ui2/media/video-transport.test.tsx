// THE CONTROL LADDER, asserted at its second rung (DV-03/DV-04/DV-05).
//
// A feed card wears the sound control and nothing else; the detail's pinned
// clip wears the real transport — play/pause, the two skips, and a timeline
// that is a SLIDER rather than a filled track. These are behaviours, so they
// are driven through the events a browser delivers, using the stubs in
// `src/test/media-env.ts`.

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { intersect, statesDuration } from "@/test/media-env";
import { isMuted, resetMuteForTests } from "./mute";
import { VideoPlayer } from "./video-player";
import { resetVideoStageForTests } from "./video-stage";
import { SKIP_SECONDS } from "./video-transport";

afterEach(() => {
  resetMuteForTests();
  resetVideoStageForTests();
  vi.useRealTimers();
});

const CLIP = "https://media.example/clip.mp4";

function transportPlayer(props: Partial<React.ComponentProps<typeof VideoPlayer>> = {}) {
  render(<VideoPlayer src={CLIP} surface="transport" {...props} />);
  const video = screen.getByTestId("video-player") as HTMLVideoElement;
  act(() => statesDuration(video, 41));
  return video;
}

describe("the ladder's rungs", () => {
  it("gives the detail's clip the transport and takes away the disc", () => {
    transportPlayer();
    expect(screen.getByTestId("video-player-transport")).toBeInTheDocument();
    // The sound moves INTO the bar; a disc beside a bar is two pieces of
    // chrome for one clip.
    expect(screen.queryByTestId("video-player-sound")).toBeNull();
    expect(screen.getByTestId("video-player-transport-sound")).toBeInTheDocument();
  });

  it("leaves a feed card's clip wearing the sound control and nothing else", () => {
    render(<VideoPlayer src={CLIP} testId="card" />);
    expect(screen.queryByTestId("card-transport")).toBeNull();
    expect(screen.getByTestId("card-sound")).toHaveAttribute("aria-label", "Turn sound on");
  });

  it("never falls back to the browser's own transport on any rung", () => {
    render(
      <>
        <VideoPlayer src={CLIP} surface="transport" testId="detail" />
        <VideoPlayer src={CLIP} surface="reading" testId="thread" />
        <VideoPlayer src={CLIP} testId="card" />
      </>,
    );
    for (const id of ["detail", "thread", "card"]) {
      expect(screen.getByTestId(id)).not.toHaveAttribute("controls");
    }
  });
});

describe("the timeline", () => {
  it("is a slider, and says where the clip is in clock time", () => {
    const video = transportPlayer();
    const timeline = screen.getByTestId("video-player-transport-timeline");
    expect(timeline).toHaveAttribute("role", "slider");
    expect(timeline).toHaveAttribute("aria-valuemin", "0");
    expect(timeline).toHaveAttribute("aria-valuemax", "100");
    expect(timeline).toHaveAttribute("aria-valuenow", "0");

    act(() => {
      video.currentTime = 14;
    });
    // 14 of 41 is the board's own 0.34 (`PostDetailVideo.jsx:25`).
    expect(timeline).toHaveAttribute("aria-valuenow", "34");
    expect(timeline).toHaveAttribute("aria-valuetext", "0:14 of 0:41");
  });

  it("seeks from the keyboard, which is what the slider role promises", () => {
    const video = transportPlayer();
    const timeline = screen.getByTestId("video-player-transport-timeline");

    fireEvent.keyDown(timeline, { key: "End" });
    expect(video.currentTime).toBe(41);

    fireEvent.keyDown(timeline, { key: "Home" });
    expect(video.currentTime).toBe(0);

    fireEvent.keyDown(timeline, { key: "PageUp" });
    expect(video.currentTime).toBeCloseTo(4.1, 5);

    fireEvent.keyDown(timeline, { key: "ArrowLeft" });
    expect(video.currentTime).toBeCloseTo(3.69, 5);
  });

  it("seeks where the reader put the pointer", () => {
    const video = transportPlayer();
    const timeline = screen.getByTestId("video-player-transport-timeline");
    // jsdom lays nothing out, so the track's box is stated here — the
    // component's arithmetic against it is what is under test.
    vi.spyOn(timeline, "getBoundingClientRect").mockReturnValue({
      left: 100,
      width: 200,
    } as DOMRect);
    timeline.setPointerCapture = () => {};
    timeline.hasPointerCapture = () => true;

    fireEvent.pointerDown(timeline, { clientX: 150, pointerId: 1 });
    expect(video.currentTime).toBeCloseTo(41 * 0.25, 5);

    // The drag continues the same gesture.
    fireEvent.pointerMove(timeline, { clientX: 300, pointerId: 1 });
    expect(video.currentTime).toBe(41);
  });

  it("never runs past either end of the clip", () => {
    const video = transportPlayer();
    const timeline = screen.getByTestId("video-player-transport-timeline");
    vi.spyOn(timeline, "getBoundingClientRect").mockReturnValue({
      left: 100,
      width: 200,
    } as DOMRect);
    timeline.setPointerCapture = () => {};

    fireEvent.pointerDown(timeline, { clientX: 0, pointerId: 1 });
    expect(video.currentTime).toBe(0);
    fireEvent.pointerDown(timeline, { clientX: 9_999, pointerId: 1 });
    expect(video.currentTime).toBe(41);
  });
});

describe("the transport's own controls", () => {
  it("steps ten seconds each way, and stops at the ends", () => {
    const video = transportPlayer();
    act(() => {
      video.currentTime = 14;
    });

    screen.getByTestId("video-player-transport-forward").click();
    expect(video.currentTime).toBe(14 + SKIP_SECONDS);

    screen.getByTestId("video-player-transport-rewind").click();
    expect(video.currentTime).toBe(14);

    // A rewind from inside the first ten seconds lands at the start rather
    // than at a negative time the element would refuse.
    screen.getByTestId("video-player-transport-rewind").click();
    screen.getByTestId("video-player-transport-rewind").click();
    expect(video.currentTime).toBe(0);
  });

  it("plays and pauses, and says which it will do", () => {
    const video = transportPlayer();
    const play = () => screen.getByTestId("video-player-transport-play");
    expect(play()).toHaveAttribute("aria-label", "Play");

    act(() => play().click());
    expect(video.paused).toBe(false);
    expect(play()).toHaveAttribute("aria-label", "Pause");

    act(() => play().click());
    expect(video.paused).toBe(true);
    expect(play()).toHaveAttribute("aria-label", "Play");
  });

  it("carries the sticky sound decision every clip shares", () => {
    render(
      <>
        <VideoPlayer src={CLIP} surface="transport" testId="detail" />
        <VideoPlayer src={CLIP} testId="card" />
      </>,
    );
    act(() => {
      screen.getByTestId("detail-transport-sound").click();
    });
    expect(isMuted()).toBe(false);
    expect((screen.getByTestId("card") as HTMLVideoElement).muted).toBe(false);
    expect(screen.getByTestId("detail-transport-sound")).toHaveAttribute(
      "aria-label",
      "Turn sound off",
    );
  });

  it("draws the elapsed and the total, which is what the bar is for", () => {
    const video = transportPlayer();
    act(() => {
      video.currentTime = 14.6;
    });
    // FLOORED, not rounded: a clock that ticks over half a second early is
    // reporting a second the clip has not reached.
    expect(screen.getByTestId("video-player-transport-elapsed")).toHaveTextContent("0:14");
    expect(screen.getByTestId("video-player-transport-duration")).toHaveTextContent("0:41");
  });

  it("stands on the record's own length until the element states one", () => {
    render(<VideoPlayer src={CLIP} surface="transport" durationMs={41_000} testId="detail" />);
    expect(screen.getByTestId("detail-transport-duration")).toHaveTextContent("0:41");
  });
});

// ONE CLIP PLAYS AT A TIME, however it was started (FE-28). The card's clip
// claims the stage by scrolling into view; the detail's claims it by being
// pressed, and a press that did not claim would leave two clips running.
describe("the reach", () => {
  // WCAG 2.2's enhanced target size is "at least 44 by 44 CSS pixels", and the
  // sound and fullscreen discs on the bar are drawn at 28. The board's geometry
  // is not the thing to change; the target is.
  it("gives the bar's small discs a 44px target without redrawing them", () => {
    transportPlayer({ onOpenViewer: () => {} });

    for (const control of ["sound", "fullscreen"]) {
      const button = screen.getByTestId(`video-player-transport-${control}`);
      // Drawn as the board draws it…
      expect(button.style.width).toBe("28px");
      // …and reachable as the guideline asks.
      const reach = button.querySelector("span[aria-hidden]") as HTMLElement | null;
      expect(reach, `${control} has no enlarged target`).not.toBeNull();
      expect(reach!.style.width).toBe("44px");
      expect(reach!.style.height).toBe("44px");
    }
  });

  it("leaves the controls already at the minimum alone", () => {
    transportPlayer();
    // The play button is drawn at 64 and the skips at 44: nothing to add.
    for (const control of ["play", "rewind", "forward"]) {
      const button = screen.getByTestId(`video-player-transport-${control}`);
      expect(button.querySelector("span[aria-hidden]")).toBeNull();
    }
  });

  // NOTHING SITS IN THE STRIP THE SYSTEM OWNS (jakob 2026-09-15, hand test: the
  // timeline was in the bottom gesture zone, so the app-switcher swipe took
  // every drag along it). The board's inset is measured from the FRAME; a
  // fullscreen layer's frame is the screen, and only the browser knows how much
  // of it the phone is keeping.
  it("clears the phone's own bottom strip where the transport is the screen", () => {
    render(<VideoPlayer src={CLIP} surface="transport" safeArea testId="fs" />);
    const bar = screen.getByTestId("fs-transport-timeline").parentElement as HTMLElement;
    expect(bar.style.bottom).toBe("calc(16px + env(safe-area-inset-bottom))");
  });

  it("leaves a framed clip's bar on the board's own inset", () => {
    transportPlayer();
    const bar = screen.getByTestId("video-player-transport-timeline")
      .parentElement as HTMLElement;
    expect(bar.style.bottom).toBe("16px");
  });
});

describe("the stage", () => {
  it("is claimed by a press on the transport, which pauses whatever held it", () => {
    render(
      <>
        <VideoPlayer src={CLIP} testId="card" />
        <VideoPlayer src={CLIP} surface="transport" autoplay={false} testId="detail" />
      </>,
    );
    const card = screen.getByTestId("card") as HTMLVideoElement;
    act(() => intersect(true));
    expect(card.paused).toBe(false);

    act(() => screen.getByTestId("detail-transport-play").click());
    expect((screen.getByTestId("detail") as HTMLVideoElement).paused).toBe(false);
    expect(card.paused).toBe(true);
  });
});

// The chrome auto-hides and a tap on the video brings it back
// (`screens/PostDetailVideo.jsx:12-15`). The board draws the REVEALED state,
// "because a board of the hidden state is a board of a video".
describe("the chrome", () => {
  it("is drawn revealed, hides itself over a running clip, and comes back on a tap", () => {
    vi.useFakeTimers();
    render(<VideoPlayer src={CLIP} surface="transport" autoplay={false} testId="detail" />);
    const video = screen.getByTestId("detail") as HTMLVideoElement;
    expect(screen.getByTestId("detail-transport")).toBeInTheDocument();

    act(() => {
      video.play();
    });
    act(() => vi.advanceTimersByTime(4_000));
    expect(screen.queryByTestId("detail-transport")).toBeNull();

    act(() => {
      video.click();
    });
    expect(screen.getByTestId("detail-transport")).toBeInTheDocument();
  });

  it("stays up over a paused clip, which has nothing else to offer the reader", () => {
    vi.useFakeTimers();
    render(<VideoPlayer src={CLIP} surface="transport" autoplay={false} testId="detail" />);
    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.getByTestId("detail-transport")).toBeInTheDocument();
  });
});
