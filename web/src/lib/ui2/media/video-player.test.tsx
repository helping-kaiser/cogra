// The playback ruling, asserted: autoplay muted on visibility, ONE global
// sticky mute across every player and every route, real controls, the cover as
// poster.
//
// These are behaviours rather than markup, so they are driven through the
// events a browser would actually deliver — an element scrolling into view, a
// reader pressing the element's own mute button — using the stubs in
// `src/test/media-env.ts`.

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  intersect,
  intersectEach,
  liveObserverCount,
  observedThresholds,
  refusesPlay,
  suppressesAutoplay,
} from "@/test/media-env";
import { VeilContext } from "./body-veil";
import { isMuted, resetMuteForTests, setMuted } from "./mute";
import { VideoPlayer } from "./video-player";
import { MediaTile } from "./media-tile";
import { PORTRAIT_CAP } from "./aspect";
import { StageHost } from "./stage-host";
import { resetVideoStageForTests } from "./video-stage";

afterEach(() => {
  resetMuteForTests();
  resetVideoStageForTests();
});

const CLIP = "https://media.example/clip.mp4";
const COVER = "https://media.example/cover.webp";

function player(props: Partial<React.ComponentProps<typeof VideoPlayer>> = {}) {
  render(<VideoPlayer src={CLIP} {...props} />);
  return screen.getByTestId("video-player") as HTMLVideoElement;
}

/**
 * The disc's corner, read where it is actually decided — the inline style,
 * the way the master writes it (`MediaAttachment.jsx:117-122`).
 *
 * The `absolute` assertion runs the other way on purpose: the utility must be
 * ABSENT. It is the class that lost to `.cg-state`'s unlayered `position:
 * relative`, so leaving it in the list would put the fix one careless
 * "tidy-up" away from silently reverting to a disc in normal flow.
 */
function expectDiscInTheCorner(disc: HTMLElement) {
  expect(disc.style.position).toBe("absolute");
  expect(disc.style.bottom).toBe("8px");
  expect(disc.style.right).toBe("8px");
  expect(disc.style.left).toBe("");
  expect(disc.style.top).toBe("");
  expect(disc.className).not.toMatch(/\babsolute\b/);
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

  it("asks its stage's observer for 70% of the frame — android's gate, blessed (L02)", () => {
    player();
    // One observer per stage, reporting the gate and the frame leaving the
    // screen (the below-gate hand start holds until ratio 0, Feed.md:25/27).
    expect(observedThresholds()).toContainEqual([0, 0.7]);
  });

  it("decides by the ratio, not by `isIntersecting` — 69% does not qualify (W5, L02)", () => {
    const video = player();
    act(() => intersectEach([{ target: video, ratio: 0.69, isIntersecting: true }]));
    expect(video.paused).toBe(true);
    act(() => intersectEach([{ target: video, ratio: 0.7 }]));
    expect(video.paused).toBe(false);
  });

  it("does not observe at all where the caller turned autoplay off", () => {
    render(<VideoPlayer src={CLIP} autoplay={false} testId="still" />);
    const video = screen.getByTestId("still") as HTMLVideoElement;
    act(() => intersect(true));
    expect(video.paused).toBe(true);
  });

  it("never carries the native transport — every card wears the sound disc instead", () => {
    expect(player()).not.toHaveAttribute("controls");
  });

  // FeedCover.md:25 "ALWAYS no clip starts on its own on any surface GIVEN the
  // device suppresses autoplay", and the frame wears the play disc instead
  // (FeedCover.md:21) — the FE-32 web half, which is what lets a clip be
  // started at all under reduced motion (W9).
  it("does not start on its own where the reader asks for reduced motion — the play disc waits instead (C10, C08)", () => {
    suppressesAutoplay({ reducedMotion: true });
    const video = player();
    act(() => intersect(true));
    expect(video.paused).toBe(true);
    expect(screen.getByTestId("video-player-play")).toBeInTheDocument();
    expect(screen.queryByTestId("video-player-sound")).toBeNull();
  });

  it("does not start on its own where the reader asks to save data (C09 FeedCover.md:23, W10)", () => {
    suppressesAutoplay({ saveData: true });
    const video = player();
    act(() => intersect(true));
    expect(video.paused).toBe(true);
    expect(screen.getByTestId("video-player-play")).toBeInTheDocument();
  });
});

// THE DISC ANATOMY (the stage-law packet §3.2 rule 9; the control ladder,
// `MediaAttachment.prompt.md:17`): which one disc an unveiled card or comment
// frame wears, on every frame — not only the stage holder's.
describe("the disc matrix", () => {
  function two() {
    render(
      <StageHost>
        <VideoPlayer src={CLIP} testId="first" />
        <VideoPlayer src={CLIP} surface="reading" testId="second" />
      </StageHost>,
    );
    return {
      first: screen.getByTestId("first") as HTMLVideoElement,
      second: screen.getByTestId("second") as HTMLVideoElement,
    };
  }

  it("allowed: every unveiled frame wears the sound disc, playing or not (C06 FeedCover.md:17, M02 ReplyMedia.md:9, K01)", () => {
    const { first, second } = two();
    act(() => intersectEach([{ target: first, ratio: 1 }, { target: second, ratio: 1 }]));
    expect(first.paused).toBe(false);
    expect(second.paused).toBe(true);
    for (const id of ["first", "second"]) {
      expect(screen.getByTestId(`${id}-sound`)).toBeInTheDocument();
      expect(screen.queryByTestId(`${id}-play`)).toBeNull();
    }
  });

  it("suppressed and not playing: the play disc in the sound disc's place (C08 FeedCover.md:21, M04 ReplyMedia.md:11, K03)", () => {
    suppressesAutoplay({ reducedMotion: true });
    two();
    for (const id of ["first", "second"]) {
      expect(screen.getByTestId(`${id}-play`)).toHaveAccessibleName("Play this video");
      expect(screen.queryByTestId(`${id}-sound`)).toBeNull();
    }
  });

  it("suppressed and playing: the sound disc again, so the sound can be turned on (C06 FeedCover.md:17, K04 FeedCommentShapes.md:11)", () => {
    suppressesAutoplay({ reducedMotion: true });
    const { first } = two();
    act(() => intersectEach([{ target: first, ratio: 1 }]));
    fireEvent.click(screen.getByTestId("first-play"));
    expect(first.paused).toBe(false);
    expect(screen.getByTestId("first-sound")).toHaveAccessibleName("Turn sound on");
    expect(screen.queryByTestId("first-play")).toBeNull();
    // The clip that is not playing keeps its play disc: never both on one frame.
    expect(screen.getByTestId("second-play")).toBeInTheDocument();
  });

  it("never draws play, pause, a duration or a timeline on a card (C07 FeedCover.md:19)", () => {
    suppressesAutoplay({ reducedMotion: true });
    player({ durationMs: 18_000 });
    expect(screen.queryByTestId("video-player-transport")).toBeNull();
    expect(screen.queryByTestId("video-player-duration")).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("names the registered play disc where the frame is registered (`feed.card.media.frame.playDisc`)", () => {
    suppressesAutoplay({ reducedMotion: true });
    render(
      <MediaTile
        src={CLIP}
        mimeType="video/mp4"
        node={{ path: "feed.card.media.frame", key: "p1/1" }}
      />,
    );
    const disc = screen.getByTestId("feed.card.media.frame.playDisc");
    expect(disc).toHaveAttribute("data-testid-key", "p1/1");
  });
});

// THE PLAY DISC'S TAP (FeedCover.md:27 "WHEN tap feed.card.media.frame.playDisc
// -> feed.card.media.frame's clip plays where it stands in the feed AND it
// becomes the stage's incumbent AND NEVER the post opens"; ReplyMedia.md:13,
// FeedCommentShapes.md:13).
describe("the play disc", () => {
  it("plays the clip where it stands, without reaching the card's open-the-post link (C11, K05, M05)", () => {
    suppressesAutoplay({ reducedMotion: true });
    const opened = vi.fn();
    render(
      // The card's link stands around the frame on the feed (`post-card.tsx`).
      <div onClick={opened}>
        <StageHost>
          <VideoPlayer src={CLIP} testId="clip" />
        </StageHost>
      </div>,
    );
    const video = screen.getByTestId("clip") as HTMLVideoElement;
    act(() => intersectEach([{ target: video, ratio: 1 }]));
    fireEvent.click(screen.getByTestId("clip-play"));
    expect(video.paused).toBe(false);
    expect(opened).not.toHaveBeenCalled();
  });

  it("resumes a frozen clip from the frame it reached, never from the top (rule 10, draft GAP-2 A)", () => {
    suppressesAutoplay({ reducedMotion: true });
    render(
      <StageHost>
        <VideoPlayer src={CLIP} testId="clip" />
      </StageHost>,
    );
    const video = screen.getByTestId("clip") as HTMLVideoElement;
    act(() => intersectEach([{ target: video, ratio: 1 }]));
    fireEvent.click(screen.getByTestId("clip-play"));
    act(() => {
      video.currentTime = 7;
    });
    // It leaves the screen and freezes on its frame, wearing its play disc.
    act(() => intersectEach([{ target: video, ratio: 0 }]));
    expect(video.paused).toBe(true);
    expect(screen.getByTestId("clip-play")).toBeInTheDocument();

    act(() => intersectEach([{ target: video, ratio: 1 }]));
    fireEvent.click(screen.getByTestId("clip-play"));
    expect(video.paused).toBe(false);
    expect(video.currentTime).toBe(7);
  });

  it("is a focusable native button whose name says what the press does (N2)", () => {
    suppressesAutoplay({ reducedMotion: true });
    player();
    const disc = screen.getByRole("button", { name: "Play this video" });
    expect(disc.tagName).toBe("BUTTON");
    expect(disc).toHaveAttribute("type", "button");
    disc.focus();
    expect(disc).toHaveFocus();
    expect(disc.closest("[aria-hidden='true']")).toBeNull();
    expect(disc.closest("[inert]")).toBeNull();
  });

  it("follows the device's preference live (RF-4, matchMedia `change`)", () => {
    suppressesAutoplay({ reducedMotion: false });
    player();
    expect(screen.getByTestId("video-player-sound")).toBeInTheDocument();
    act(() => suppressesAutoplay({ reducedMotion: true }));
    expect(screen.getByTestId("video-player-play")).toBeInTheDocument();
    act(() => suppressesAutoplay({ reducedMotion: false }));
    expect(screen.getByTestId("video-player-sound")).toBeInTheDocument();
  });
});

// C19 (FeedCover.md:41; RULINGS.md l.7 "A12 = play muted + global sound flips
// off"): "WHEN the browser refuses sound to a clip taking the stage GIVEN the
// web and sound is on -> the clip plays muted AND sound turns off for every
// clip on every surface AND NEVER the clip stays frozen". Today's swallowed
// rejection (W12) left it frozen.
describe("a browser refusing sound (C19)", () => {
  it("plays the clip muted and turns the sound off for every clip, every disc reading `Turn sound on`", async () => {
    refusesPlay("unmuted");
    setMuted(false);
    render(
      <StageHost>
        <VideoPlayer src={CLIP} testId="first" />
        <VideoPlayer src={CLIP} surface="reading" testId="second" />
      </StageHost>,
    );
    const first = screen.getByTestId("first") as HTMLVideoElement;
    expect(screen.getByTestId("second-sound")).toHaveAccessibleName("Turn sound off");

    await act(async () => {
      intersectEach([{ target: first, ratio: 1 }]);
    });

    expect(first.paused).toBe(false);
    expect(first.muted).toBe(true);
    expect(isMuted()).toBe(true);
    expect(screen.getByTestId("first-sound")).toHaveAccessibleName("Turn sound on");
    expect(screen.getByTestId("second-sound")).toHaveAccessibleName("Turn sound on");
  });

  it("leaves a muted start alone — only sound is ever refused", async () => {
    refusesPlay("unmuted");
    const video = player();
    await act(async () => intersect(true));
    expect(video.paused).toBe(false);
    expect(isMuted()).toBe(true);
  });

  it("never restarts a clip that lost the stage while the refusal was on its way", async () => {
    refusesPlay("unmuted");
    setMuted(false);
    const video = player();
    await act(async () => {
      intersect(true);
      // Gone again before the browser answered.
      intersect(false);
    });
    expect(video.paused).toBe(true);
    // The decision still flipped: the browser said no to sound.
    expect(isMuted()).toBe(true);
  });
});

// N2 (the stage-law packet §2.10; RULINGS night 2d): mute and unmute stay
// reachable by assistive technology on the playing clip. On the web that is
// the disc itself — a native button naming what a press does, with nothing
// over the frame hiding it from the accessibility tree.
describe("the sound disc's accessibility (N2)", () => {
  it("is a focusable native button whose name says what the press does", () => {
    player();
    const disc = screen.getByRole("button", { name: "Turn sound on" });
    expect(disc.tagName).toBe("BUTTON");
    expect(disc).toHaveAttribute("type", "button");
    disc.focus();
    expect(disc).toHaveFocus();
  });

  it("sits in no subtree hidden from assistive technology", () => {
    player();
    const disc = screen.getByTestId("video-player-sound");
    expect(disc.closest("[aria-hidden='true']")).toBeNull();
    expect(disc.closest("[inert]")).toBeNull();
  });
});

// Ruling 92 (seam 109): "48dp targets grow invisibly where space allows". The
// disc's plate is 36px and stands 8px in from the frame's corner, so its press
// area grows to the 48px minimum (`cg-hit`) without moving the ink — the same
// trade the transport's controls make (`video-transport.test.tsx`).
describe("the disc's target (ruling 92)", () => {
  it("both discs grow their press area to the touch-target minimum", () => {
    suppressesAutoplay({});
    render(<VideoPlayer src={CLIP} />);
    expect(screen.getByTestId("video-player-sound").className).toContain("cg-hit");

    act(() => suppressesAutoplay({ reducedMotion: true }));
    expect(screen.getByTestId("video-player-play").className).toContain("cg-hit");
  });
});

// The sensitive veil takes its clip out of the rotation (design/readme.md,
// backlog item 103): "ALWAYS a veiled clip has no playback and no sound-disc
// presence" (Feed.md:43). "The unveil is an eligibility change, not a
// suspension lift" (design/readme.md §13, overruling 2026-09-24 the earlier
// "re-elects exactly as a sheet's dismissal does"): the unveiled clip joins
// the rotation exactly as a clip scrolling into view does. Preloading stays
// on. `VeilContext` stands in for `BodyVeil` here, the same way these tests
// drive the stage through bare DOM events rather than mounting a whole feed
// around the player.
describe("the sensitive veil (backlog 103)", () => {
  function veiledPlayer(veiled: boolean, testId = "video-player") {
    render(
      <VeilContext.Provider value={veiled}>
        <VideoPlayer src={CLIP} testId={testId} />
      </VeilContext.Provider>,
    );
    return screen.getByTestId(testId) as HTMLVideoElement;
  }

  it("does not play while veiled, even at full visibility", () => {
    const video = veiledPlayer(true);
    act(() => intersect(true));
    expect(video.paused).toBe(true);
  });

  it("shows no sound disc while veiled", () => {
    veiledPlayer(true);
    expect(screen.queryByTestId("video-player-sound")).toBeNull();
  });

  it("plays after reveal, iff still visible at that moment", () => {
    const { rerender } = render(
      <VeilContext.Provider value={true}>
        <VideoPlayer src={CLIP} />
      </VeilContext.Provider>,
    );
    const video = screen.getByTestId("video-player") as HTMLVideoElement;

    // Already past the visibility gate while still veiled — must not play.
    act(() => intersect(true));
    expect(video.paused).toBe(true);

    // "WHEN a veiled clip unveils GIVEN the stage is empty and the device
    // allows autoplay -> the topmost qualifying clip takes the stage"
    // (Feed.md:49): it already stands past the gate, so it plays at once.
    rerender(
      <VeilContext.Provider value={false}>
        <VideoPlayer src={CLIP} />
      </VeilContext.Provider>,
    );
    expect(screen.getByTestId("video-player-sound")).toBeInTheDocument();
    expect(video.paused).toBe(false);
  });

  it("unveiling a clip takes nothing from an incumbent that still qualifies (F18 Feed.md:47, W8)", () => {
    function Surface({ veiled }: { veiled: boolean }) {
      return (
        <StageHost>
          <VeilContext.Provider value={veiled}>
            <VideoPlayer src={CLIP} testId="above" />
          </VeilContext.Provider>
          <VideoPlayer src={CLIP} testId="incumbent" />
        </StageHost>
      );
    }
    const { rerender } = render(<Surface veiled />);
    const above = screen.getByTestId("above") as HTMLVideoElement;
    const incumbent = screen.getByTestId("incumbent") as HTMLVideoElement;
    act(() => intersectEach([{ target: above, ratio: 1 }, { target: incumbent, ratio: 1 }]));
    expect(incumbent.paused).toBe(false);

    rerender(<Surface veiled={false} />);
    expect(incumbent.paused).toBe(false);
    expect(above.paused).toBe(true);
    // The unveiled clip is the same element — no remount, no fresh claim.
    expect(screen.getByTestId("above")).toBe(above);
  });

  it("a veil coming down over the incumbent hands the stage on (Feed.md:43, rule 8)", () => {
    function Surface({ veiled }: { veiled: boolean }) {
      return (
        <StageHost>
          <VeilContext.Provider value={veiled}>
            <VideoPlayer src={CLIP} testId="first" />
          </VeilContext.Provider>
          <VideoPlayer src={CLIP} testId="second" />
        </StageHost>
      );
    }
    const { rerender } = render(<Surface veiled={false} />);
    const first = screen.getByTestId("first") as HTMLVideoElement;
    const second = screen.getByTestId("second") as HTMLVideoElement;
    act(() => intersectEach([{ target: first, ratio: 1 }, { target: second, ratio: 1 }]));
    expect(first.paused).toBe(false);

    rerender(<Surface veiled />);
    expect(first.paused).toBe(true);
    expect(second.paused).toBe(false);
  });

  it("does not touch preload", () => {
    expect(veiledPlayer(true)).toHaveAttribute("preload", "metadata");
  });
});

// FE-28, FLIPPED (the stage-law packet §3.3; seam 021/028): one clip plays at
// a time, and on a surface's stage it is the TOPMOST, not the newest claimant
// — "WHEN a clip starts to qualify GIVEN the stage is empty and the device
// allows autoplay -> the topmost qualifying clip takes the stage" (Feed.md:17),
// and "WHEN a second clip scrolls into view GIVEN the incumbent still
// qualifies -> NEVER the stage changes hands" (Feed.md:11). video-stage.test.ts
// keeps the player layer's own newest-claimant contract (rule 15).
describe("one clip at a time (FE-28)", () => {
  function both() {
    render(
      <StageHost>
        <VideoPlayer src={CLIP} testId="first" />
        <VideoPlayer src={CLIP} testId="second" />
      </StageHost>,
    );
    return {
      first: screen.getByTestId("first") as HTMLVideoElement,
      second: screen.getByTestId("second") as HTMLVideoElement,
    };
  }

  it("both qualifying on an empty stage: the topmost plays (F08 Feed.md:17)", () => {
    const { first, second } = both();
    act(() => intersect(true));
    expect(first.paused).toBe(false);
    expect(second.paused).toBe(true);
  });

  it("a second clip entering later never takes the stage (F05 Feed.md:11)", () => {
    const { first, second } = both();
    act(() => intersectEach([{ target: first, ratio: 1 }]));
    act(() => intersectEach([{ target: second, ratio: 1 }]));
    expect(first.paused).toBe(false);
    expect(second.paused).toBe(true);
  });

  it("losing the stage freezes the clip on its frame: `pause()`, never `load()`, the element untouched (C04 FeedCover.md:9)", () => {
    render(
      <StageHost>
        <VideoPlayer src={CLIP} poster={COVER} testId="first" />
        <VideoPlayer src={CLIP} testId="second" />
      </StageHost>,
    );
    const first = screen.getByTestId("first") as HTMLVideoElement;
    const second = screen.getByTestId("second") as HTMLVideoElement;
    const load = vi.spyOn(first, "load");
    act(() => intersectEach([{ target: first, ratio: 1 }, { target: second, ratio: 1 }]));
    act(() => {
      first.currentTime = 4;
    });
    act(() => intersectEach([{ target: first, ratio: 0.2 }]));

    expect(first.paused).toBe(true);
    expect(second.paused).toBe(false);
    expect(load).not.toHaveBeenCalled();
    expect(first.currentTime).toBe(4);
    expect(first).toHaveAttribute("src", CLIP);
    expect(first).toHaveAttribute("poster", COVER);
    expect(screen.getByTestId("first")).toBe(first);
  });

  it("a newly elected clip plays with the reader's current sound (C14–C16, M03, K02)", () => {
    const { first, second } = both();
    act(() => intersectEach([{ target: first, ratio: 1 }, { target: second, ratio: 1 }]));
    act(() => setMuted(false));
    act(() => intersectEach([{ target: first, ratio: 0 }]));
    expect(second.paused).toBe(false);
    expect(second.muted).toBe(false);
  });
});

// TEARDOWN HYGIENE (the stage-law packet's §6 row; seam 024's teardown-race
// class): a player that leaves takes its observer with it, so nothing keeps
// answering for a clip that is gone.
describe("teardown hygiene", () => {
  it("disconnects its observer when it unmounts", () => {
    const before = liveObserverCount();
    const { unmount } = render(<VideoPlayer src={CLIP} />);
    expect(liveObserverCount()).toBe(before + 1);
    unmount();
    expect(liveObserverCount()).toBe(before);
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

  it("takes an out-of-band mute change, e.g. from picture-in-picture", () => {
    // Nothing in this component itself changes `.muted` except the sound
    // disc, but an external `volumechange` must still sync into the store
    // rather than silently diverging from every other player on screen.
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

  // G1 / design/components/media/MediaAttachment.jsx:105 — the MediaDisc
  // master's default corner is bottom-right (the thumb's side while
  // scrolling), not bottom-left.
  //
  // WEB-DISC-FLOW (jakob 2026-09-22): this test used to read `bottom-2` and
  // `right-2` off the class list and passed while the disc sat at the
  // frame's bottom-LEFT, half off-screen — because `.cg-state`'s unlayered
  // `position: relative` outranked the layered `absolute` utility and the
  // button fell into normal flow. A class-name assertion cannot see a class
  // that lost the cascade, which is the same blind spot WEB-DISC-MISSING
  // below was written for; the corner is read off the inline style now,
  // because that is where it is decided.
  it("sits at the master's bottom-right corner", () => {
    player({ surface: "reading" });
    expectDiscInTheCorner(screen.getByTestId("video-player-sound"));
  });

  // WEB-DISC-MISSING (jakob 2026-09-22): `bg-surface-snackbar` and
  // `text-on-surface-snackbar` compiled to no CSS at all — tokens-2.css's
  // semantic aliases are never bridged into Tailwind's `@theme`, so the
  // disc's plate had no background and no icon colour on every web surface,
  // even though the position test above kept passing (a class *name*
  // assertion cannot see that Tailwind dropped the class). Pinning the
  // resolved `var()` — read exactly as the master does
  // (`design/components/media/MediaAttachment.jsx:127-128`, and the way
  // `pager-dots.tsx` already reads `--border-hairline`) — is what makes a
  // silently-dead utility class impossible to reintroduce here.
  it("paints its plate from var(), not a Tailwind colour class", () => {
    player({ surface: "reading" });
    const disc = screen.getByTestId("video-player-sound");
    expect(disc.style.background).toBe("var(--surface-snackbar)");
    expect(disc.style.color).toBe("var(--on-surface-snackbar)");
    expect(disc.className).not.toMatch(/\bbg-surface-snackbar\b/);
    expect(disc.className).not.toMatch(/\btext-on-surface-snackbar\b/);
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

// FE-26/H-04: a feed card wears the sound control and nothing else — no
// play/pause, no duration pill, at both scales (design/readme.md, "the video
// conform round"). The reading surface never had a transport; the full/card
// surface loses its native one here, so both land on the same one control.
describe("the full surface (a feed card's clip)", () => {
  it("wears one control, and it is the sound", () => {
    const video = player();
    expect(video).not.toHaveAttribute("controls");
    expect(screen.getByTestId("video-player-sound")).toHaveAttribute(
      "aria-label",
      "Turn sound on",
    );
  });

  it("shows no duration, which the detail surface owns for now (W3-6)", () => {
    player({ durationMs: 18_000 });
    expect(screen.queryByTestId("video-player-duration")).toBeNull();
  });

  // G1 / design/components/media/MediaAttachment.jsx:105 — the MediaDisc
  // master's default corner is bottom-right (the thumb's side while
  // scrolling), not bottom-left. WEB-DISC-FLOW: see the matching test on the
  // reading surface above for why the corner is read off the style.
  it("sits at the master's bottom-right corner", () => {
    player();
    expectDiscInTheCorner(screen.getByTestId("video-player-sound"));
  });

  // WEB-DISC-MISSING (jakob 2026-09-22) — see the matching test on the
  // reading surface above for the full mechanism. The full surface is the
  // feed card's own clip, so this is the disc jakob actually scrolls past.
  it("paints its plate from var(), not a Tailwind colour class", () => {
    player();
    const disc = screen.getByTestId("video-player-sound");
    expect(disc.style.background).toBe("var(--surface-snackbar)");
    expect(disc.style.color).toBe("var(--on-surface-snackbar)");
    expect(disc.className).not.toMatch(/\bbg-surface-snackbar\b/);
    expect(disc.className).not.toMatch(/\btext-on-surface-snackbar\b/);
  });
});

// THE CLIP-LOOP RULING (jakob 2026-09-14, via the design loop): a clip under
// the real transport STOPS at its end and the transport stands at replay; a
// feed clip keeps looping. Reels are the vertical scroller's grammar, videos
// the player's, and this is where the two part.
describe("looping", () => {
  it("loops in a card and in a comment — a moment, not a programme", () => {
    expect(player()).toHaveProperty("loop", true);
    render(<VideoPlayer src={CLIP} surface="reading" testId="thread" />);
    expect(screen.getByTestId("thread")).toHaveProperty("loop", true);
  });

  it("stops under the real transport", () => {
    render(<VideoPlayer src={CLIP} surface="transport" testId="pinned" />);
    expect(screen.getByTestId("pinned")).toHaveProperty("loop", false);
  });

  // THE END IS ITS OWN REST (jakob 2026-09-15, hand test). "Play" is the offer
  // to resume where the reader paused; at the end the same press starts the
  // clip over, and the control says so rather than leaving one word to mean
  // both.
  it("stands the transport at Replay when the clip runs out", () => {
    render(<VideoPlayer src={CLIP} surface="transport" testId="pinned" />);
    const video = screen.getByTestId("pinned") as HTMLVideoElement;
    act(() => intersect(true));
    expect(screen.getByTestId("pinned-transport-play")).toHaveAttribute("aria-label", "Pause");

    act(() => {
      video.dispatchEvent(new Event("ended"));
    });
    expect(screen.getByTestId("pinned-transport-play")).toHaveAttribute("aria-label", "Replay");

    // And it is Play again the moment the clip is running, so the word never
    // outlives the state it describes.
    act(() => {
      video.dispatchEvent(new Event("play"));
    });
    expect(screen.getByTestId("pinned-transport-play")).toHaveAttribute("aria-label", "Pause");
  });

  it("replays from the start when Play is pressed on a clip that ended", () => {
    render(<VideoPlayer src={CLIP} surface="transport" testId="pinned" />);
    const video = screen.getByTestId("pinned") as HTMLVideoElement;
    // The stub element reports `ended` off its own clock, so the clip is put
    // at its end the way a finished clip sits there.
    Object.defineProperty(video, "ended", { value: true, configurable: true });
    video.currentTime = 30;

    act(() => screen.getByTestId("pinned-transport-play").click());
    expect(video.currentTime).toBe(0);
    expect(screen.getByTestId("pinned-transport-elapsed").textContent).toBe("0:00");
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
    // The sound disc is a real button now that native controls are gone; what
    // must still never happen is MediaTile's own onOpen wrapper around it.
    expect(screen.queryByRole("button", { name: /open the picture/i })).toBeNull();
    expect(screen.getByTestId("moving").closest("button")).toBeNull();
  });

  it("shows no duration pill — the sound disc is the only control a tile's clip wears", () => {
    render(<MediaTile src={CLIP} mimeType="video/mp4" durationMs={42_000} testId="moving" />);
    expect(screen.queryByTestId("moving-duration")).toBeNull();
  });
});

// HT-21: clips rendered SQUISHED — wider than the clip actually is. The cause
// was the CSS default `object-fit: fill` on a box the height cap had shortened,
// so the picture was scaled to the box instead of cropped to it. The ruling (the
// reel round) is a clamp-and-crop: native ratio, anything taller than 4:5
// centre-cropped to it, and letterboxing nowhere.
describe("a clip's shape", () => {
  it("never scale-distorts, on either surface", () => {
    render(
      <>
        <VideoPlayer src={CLIP} testId="post" />
        <VideoPlayer src={CLIP} surface="reading" testId="thread" />
      </>,
    );
    expect(screen.getByTestId("post").className).toContain("object-cover");
    expect(screen.getByTestId("thread").className).toContain("object-cover");
  });

  it("reserves the clip's own shape, full-width and uncapped", () => {
    render(<MediaTile src={CLIP} mimeType="video/mp4" sourceRatio={16 / 9} testId="moving" />);
    const frame = screen.getByTestId("moving-frame");
    expect(frame.style.aspectRatio).toBe(`${16 / 9} / 1`);
    // The default frame's ratio is already clamped by `tileRatio`, so no
    // separate height cap competes with it here.
    expect(frame.style.maxHeight).toBe("");
    expect(screen.getByTestId("moving").className).toContain("size-full");
  });

  it("clamps a clip taller than 4:5 to the cap and crops it there", () => {
    render(<MediaTile src={CLIP} mimeType="video/mp4" sourceRatio={9 / 16} testId="moving" />);
    expect(screen.getByTestId("moving-frame").style.aspectRatio).toBe(`${PORTRAIT_CAP} / 1`);
    expect(screen.getByTestId("moving").className).toContain("object-cover");
  });

  it("reserves the portrait cap for an unprobed clip, until the probe lands", () => {
    // The media law leaves no unbounded case now that letterboxing is gone
    // (FE-30): 4:5 is the tallest a clip is ever shown, so it is the honest
    // reservation for "shape unknown" too — the same framing path a probed
    // clip already takes, not a separate unbounded one.
    render(<MediaTile src={CLIP} mimeType="video/mp4" testId="moving" />);
    expect(screen.getByTestId("moving-frame").style.aspectRatio).toBe(`${PORTRAIT_CAP} / 1`);
    expect(screen.getByTestId("moving").className).toContain("size-full");
  });
});
