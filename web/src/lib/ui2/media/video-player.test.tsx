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
import { VeilContext } from "./body-veil";
import { isMuted, resetMuteForTests, setMuted } from "./mute";
import { VideoPlayer } from "./video-player";
import { MediaTile } from "./media-tile";
import { PORTRAIT_CAP } from "./aspect";
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

  it("asks for 70% of the frame before it plays — android's gate, blessed", () => {
    player();
    expect(observedThresholds()).toContain(0.7);
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
});

// The sensitive veil covers its clip the same way a sheet suspends the
// surface behind it (design/readme.md, backlog item 103): "a veiled clip
// sits fully out of the stage rotation — no playback, no sound-disc
// presence… Unveiling re-elects the surface's stage exactly as a sheet's
// dismissal does, so the unveiled clip autoplays iff it wins — no knob of
// its own. Preloading stays on." `VeilContext` stands in for `BodyVeil`
// here, the same way these tests drive the stage through bare DOM events
// rather than mounting a whole feed around the player.
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

    // Unveiling re-runs the autoplay effect, which re-observes and asks the
    // gate again — no separate election, the same claim it would make on a
    // fresh mount.
    rerender(
      <VeilContext.Provider value={false}>
        <VideoPlayer src={CLIP} />
      </VeilContext.Provider>,
    );
    expect(screen.getByTestId("video-player-sound")).toBeInTheDocument();
    act(() => intersect(true));
    expect(video.paused).toBe(false);
  });

  it("does not touch preload", () => {
    expect(veiledPlayer(true)).toHaveAttribute("preload", "metadata");
  });
});

// FE-28: one clip plays at a time. video-stage.test.ts pins the arbitration
// module's own edge cases (re-claims, stale surrenders); this just proves the
// wiring — a real claim through a real IntersectionObserver event pauses a
// real sibling player, not only a mocked stage.
describe("one clip at a time (FE-28)", () => {
  it("claiming the stage pauses whichever clip held it before", () => {
    render(
      <>
        <VideoPlayer src={CLIP} testId="first" />
        <VideoPlayer src={CLIP} testId="second" />
      </>,
    );
    const first = screen.getByTestId("first") as HTMLVideoElement;
    const second = screen.getByTestId("second") as HTMLVideoElement;

    // Both come into view in the same batch — the later-mounted clip claims
    // last, and the newest claimant always pauses whoever it replaces.
    act(() => intersect(true));

    expect(second.paused).toBe(false);
    expect(first.paused).toBe(true);
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
