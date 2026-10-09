// THE VEIL AND THE STAGE — android's `VeiledStageTest` twin (the stage-law
// packet §6 `veiled-stage.test.tsx` row; §3.2 rule 8). "ALWAYS a veiled clip
// has no playback and no sound-disc presence" (Feed.md:43–45, History.md:73),
// and "the unveil is an eligibility change, not a suspension lift"
// (design/readme.md §13, L05): an unveiled clip joins the rotation as a clip
// scrolling into view does — it takes nothing from an incumbent that still
// qualifies (Feed.md:47) and takes an empty stage only where the device allows
// autoplay (Feed.md:49). "Preloading stays on … and makes the unveil instant"
// (L06): the clip under the veil is the one that plays after it.
//
// Driven through the real `BodyVeil`, not its context alone: the veil keeping
// the clip at one place in the tree is part of what is proved here.

import { act, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { ScrollHostProvider } from "@/lib/ui/scroll-host";
import {
  intersectEach,
  scrollsTo,
  settlesScroll,
  suppressesAutoplay,
} from "@/test/media-env";

import { BottomSheet } from "../bottom-sheet";
import { BodyVeil } from "./body-veil";
import { resetMuteForTests } from "./mute";
import { StageHost } from "./stage-host";
import { VideoPlayer } from "./video-player";
import { resetVideoStageForTests } from "./video-stage";

afterEach(() => {
  resetMuteForTests();
  resetVideoStageForTests();
});

const CLIP = "https://media.example/clip.mp4";
const COVER = "https://media.example/cover.webp";
const noop = () => {};

/**
 * A list surface whose clips each sit in their post's body veil — veiled
 * where `veiled` names them, the reveal held by the test the way a screen
 * holds it (`BodyVeil`'s `revealed`).
 */
function List({
  ids,
  veiled = [],
  surface,
}: {
  ids: readonly string[];
  veiled?: readonly string[];
  surface?: "reading";
}) {
  const scroller = useRef<HTMLDivElement | null>(null);
  return (
    <ScrollHostProvider value={scroller}>
      <div ref={scroller} data-testid="scroller">
        <StageHost>
          {ids.map((id) => (
            <BodyVeil key={id} revealed={!veiled.includes(id)} onReveal={noop} testId={`${id}-veil`}>
              <VideoPlayer src={CLIP} poster={COVER} surface={surface} testId={id} />
            </BodyVeil>
          ))}
        </StageHost>
      </div>
    </ScrollHostProvider>
  );
}

/** The comment thread on its sheet, the same veiled clips on its own stage. */
function Thread(props: { ids: readonly string[]; veiled?: readonly string[] }) {
  return (
    <BottomSheet open onClose={noop} title="Comments">
      <List {...props} surface="reading" />
    </BottomSheet>
  );
}

const clip = (id: string) => screen.getByTestId(id) as HTMLVideoElement;
const playing = (...ids: string[]) => ids.filter((id) => !clip(id).paused);
const discOf = (id: string) =>
  screen.queryByTestId(`${id}-sound`) ?? screen.queryByTestId(`${id}-play`);

function frame(ratios: Record<string, number>) {
  act(() =>
    intersectEach(Object.entries(ratios).map(([id, ratio]) => ({ target: clip(id), ratio }))),
  );
}

describe("a veiled clip is out of the rotation (Feed.md:43/45, H02 History.md:73)", () => {
  it("is never elected and wears no disc — the clip below it takes the stage instead", () => {
    render(<List ids={["a", "b"]} veiled={["a"]} />);
    frame({ a: 1, b: 1 });
    expect(playing("a", "b")).toEqual(["b"]);
    expect(discOf("a")).toBeNull();
    expect(discOf("b")).not.toBeNull();
  });

  it("wears no play disc under suppressed autoplay either (C08 FeedCover.md:21, F16)", () => {
    suppressesAutoplay({ reducedMotion: true });
    render(<List ids={["a", "b"]} veiled={["a"]} />);
    frame({ a: 1, b: 1 });
    expect(discOf("a")).toBeNull();
    expect(screen.getByTestId("b-play")).toBeInTheDocument();
  });

  it("a veil coming down over the incumbent hands the stage on, and the veiled clip freezes (Feed.md:43, rule 8)", () => {
    const { rerender } = render(<List ids={["a", "b"]} />);
    frame({ a: 1, b: 1 });
    expect(playing("a", "b")).toEqual(["a"]);

    rerender(<List ids={["a", "b"]} veiled={["a"]} />);
    expect(playing("a", "b")).toEqual(["b"]);
    expect(discOf("a")).toBeNull();
  });

  it("keeps preloading its metadata under the veil (L06)", () => {
    render(<List ids={["a"]} veiled={["a"]} />);
    expect(clip("a")).toHaveAttribute("preload", "metadata");
  });
});

describe("the unveil is an eligibility change (L05)", () => {
  it("revealing the only qualifying clip plays it where the device allows autoplay (F19 Feed.md:49)", () => {
    const { rerender } = render(<List ids={["a"]} veiled={["a"]} />);
    frame({ a: 1 });
    expect(playing("a")).toEqual([]);

    rerender(<List ids={["a"]} />);
    expect(playing("a")).toEqual(["a"]);
  });

  it("revealing it under suppressed autoplay starts nothing; its play disc appears (C10 FeedCover.md:25, C08)", () => {
    suppressesAutoplay({ saveData: true });
    const { rerender } = render(<List ids={["a"]} veiled={["a"]} />);
    frame({ a: 1 });

    rerender(<List ids={["a"]} />);
    expect(playing("a")).toEqual([]);
    expect(screen.getByTestId("a-play")).toBeInTheDocument();
  });

  it("unveiling the topmost clip takes nothing from the incumbent below it (F18 Feed.md:47)", () => {
    const { rerender } = render(<List ids={["a", "b"]} veiled={["a"]} />);
    frame({ a: 1, b: 1 });
    expect(playing("a", "b")).toEqual(["b"]);

    rerender(<List ids={["a", "b"]} />);
    expect(playing("a", "b")).toEqual(["b"]);
  });

  it("unveiling a clip below the incumbent changes nothing (F18 Feed.md:47)", () => {
    const { rerender } = render(<List ids={["a", "b"]} veiled={["b"]} />);
    frame({ a: 1, b: 1 });
    expect(playing("a", "b")).toEqual(["a"]);

    rerender(<List ids={["a", "b"]} />);
    expect(playing("a", "b")).toEqual(["a"]);
    expect(discOf("b")).not.toBeNull();
  });

  it("the unveiled clip is the same element — the reveal moves nothing, reloads nothing (L05, L06)", () => {
    // The veil governing itself: the reader's own tap on the veil face.
    function Lone() {
      return (
        <StageHost>
          <BodyVeil testId="a-veil">
            <VideoPlayer src={CLIP} poster={COVER} testId="a" />
          </BodyVeil>
        </StageHost>
      );
    }
    render(<Lone />);
    frame({ a: 1 });
    const element = clip("a");
    let loads = 0;
    element.load = () => {
      loads += 1;
    };

    fireEvent.click(screen.getByTestId("a-veil-reveal"));

    expect(screen.queryByTestId("a-veil")).toBeNull();
    expect(clip("a")).toBe(element);
    expect(clip("a")).toHaveAttribute("src", CLIP);
    expect(clip("a")).toHaveAttribute("poster", COVER);
    expect(loads).toBe(0);
    expect(playing("a")).toEqual(["a"]);
  });

  it("a reveal in the thread joins its stage without displacing the clip playing there (ReplyMedia.md:7, F18)", () => {
    const { rerender } = render(<Thread ids={["t1", "t2"]} veiled={["t1"]} />);
    frame({ t1: 1, t2: 1 });
    expect(playing("t1", "t2")).toEqual(["t2"]);

    rerender(<Thread ids={["t1", "t2"]} />);
    expect(playing("t1", "t2")).toEqual(["t2"]);
  });

  it("an unveil while resting at the hard top steals nothing — it is not a landing (L05, L08)", () => {
    const { rerender } = render(<List ids={["a", "b"]} veiled={["a"]} />);
    const scroller = screen.getByTestId("scroller");
    scrollsTo(scroller, 300);
    frame({ a: 0.3, b: 1 });
    scrollsTo(scroller, 0);
    frame({ a: 1, b: 0.9 });
    // The landing skips the veiled first clip (StageElectionTest "landing
    // skips a veiled first clip").
    settlesScroll(scroller);
    expect(playing("a", "b")).toEqual(["b"]);

    rerender(<List ids={["a", "b"]} />);
    expect(playing("a", "b")).toEqual(["b"]);
  });
});
