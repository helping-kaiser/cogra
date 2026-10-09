// THE STAGE ON A SURFACE — android's `ScrollStageTest` twin (the stage-law
// packet §6 `stage-host.test.tsx` row), driven through the browser's own
// events with the RF-1 environment: one batched observer callback per frame
// (`intersectEach`), a scroller that moves and settles (`scrollsTo`,
// `settlesScroll`), and the app's own pull at the top (`pullsAtTop`).
//
// The first half is the election on a hosted list; the second runs the
// hard-top rows once per scroll surface that hosts a stage — "every scroll
// surface that hosts a stage re-elects at its hard top" (draft GAP-10 A).

import { act, fireEvent, render, screen } from "@testing-library/react";
import { useRef, type ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { ScrollHostProvider } from "@/lib/ui/scroll-host";
import {
  intersectEach,
  liveObserverCount,
  pullsAtTop,
  scrollsTo,
  setsPageVisibility,
  settlesScroll,
  suppressesAutoplay,
  type Intersection,
} from "@/test/media-env";

import { BottomSheet } from "../bottom-sheet";
import { coverListenersForTests } from "../covering-layer";
import { VeilContext } from "./body-veil";
import { MediaGallery } from "./media-gallery";
import { StageHost } from "./stage-host";
import { VideoPlayer } from "./video-player";

const CLIP = "https://media.example/clip.mp4";
const noop = () => {};

/** A list surface: its own scroller, the stage on it, the clips in order. */
function List({ ids, children }: { ids: readonly string[]; children?: ReactNode }) {
  const scroller = useRef<HTMLDivElement | null>(null);
  return (
    <ScrollHostProvider value={scroller}>
      <div ref={scroller} data-testid="scroller">
        <StageHost>
          {ids.map((id) => (
            <VideoPlayer key={id} src={CLIP} testId={id} />
          ))}
          {children}
        </StageHost>
      </div>
    </ScrollHostProvider>
  );
}

const clip = (id: string) => screen.getByTestId(id) as HTMLVideoElement;
const plays = (id: string) => !clip(id).paused;
/** Who is playing, in order — the one stage holds at most one. */
const playing = (...ids: string[]) => ids.filter(plays);

/** One observer batch: each clip at the ratio given. */
function frame(ratios: Record<string, number>) {
  const places: Intersection[] = Object.entries(ratios).map(([id, ratio]) => ({
    target: clip(id),
    ratio,
  }));
  act(() => intersectEach(places));
}

describe("the election on a hosted surface (ScrollStageTest)", () => {
  it("an empty stage goes to the topmost qualifying clip, never the most visible (F08 Feed.md:17)", () => {
    render(<List ids={["a", "b"]} />);
    frame({ a: 0.75, b: 1 });
    expect(playing("a", "b")).toEqual(["a"]);
  });

  it("one batched callback with A and B qualifying elects A — no last-one-wins (W2, rule 3)", () => {
    render(<List ids={["a", "b"]} />);
    // B listed first in the batch: the order is the document's, not the batch's.
    act(() =>
      intersectEach([
        { target: clip("b"), ratio: 1 },
        { target: clip("a"), ratio: 1 },
      ]),
    );
    expect(playing("a", "b")).toEqual(["a"]);
  });

  it("a second clip arriving in view changes nothing (F05 Feed.md:11)", () => {
    render(<List ids={["a", "b"]} />);
    frame({ a: 1 });
    frame({ a: 0.8, b: 1 });
    expect(playing("a", "b")).toEqual(["a"]);
  });

  it("hands over mid-scroll, in the same moment, without waiting for scrollend (F06 Feed.md:13, L03)", () => {
    render(<List ids={["a", "b"]} />);
    frame({ a: 1, b: 0.8 });
    scrollsTo(screen.getByTestId("scroller"), 200);
    frame({ a: 0.5 });
    // No `scrollend` was fired: the handover is the batch's own decision.
    expect(playing("a", "b")).toEqual(["b"]);
  });

  it("with no successor the outgoing clip freezes and nothing plays (F07 Feed.md:15, rule 4)", () => {
    render(<List ids={["a", "b"]} />);
    frame({ a: 1, b: 0.2 });
    frame({ a: 0.4 });
    expect(playing("a", "b")).toEqual([]);
  });

  it("scrolling back up never ricochets: the clip above re-qualifying takes nothing (F12 Feed.md:29, W3)", () => {
    render(<List ids={["a", "b"]} />);
    const scroller = screen.getByTestId("scroller");
    frame({ a: 1, b: 0.3 });
    scrollsTo(scroller, 400);
    frame({ a: 0.1, b: 1 });
    expect(playing("a", "b")).toEqual(["b"]);
    scrollsTo(scroller, 150);
    frame({ a: 1, b: 0.9 });
    settlesScroll(scroller);
    expect(playing("a", "b")).toEqual(["b"]);
  });

  it("an incumbent leaving the surface hands the stage to the topmost qualifying clip (rule 2)", () => {
    const { rerender } = render(<List ids={["a", "b", "c"]} />);
    frame({ a: 1, b: 1, c: 1 });
    expect(playing("a", "b", "c")).toEqual(["a"]);
    rerender(<List ids={["b", "c"]} />);
    expect(playing("b", "c")).toEqual(["b"]);
  });

  it("a gallery's pages and the clip beside it compete for the one stage (L01)", () => {
    render(
      <List ids={["card"]}>
        <MediaGallery
          testId="gallery"
          items={[
            { src: CLIP, mimeType: "video/mp4" },
            { src: CLIP, mimeType: "video/mp4" },
          ]}
        />
      </List>,
    );
    frame({ card: 1, "gallery-page-0": 1, "gallery-page-1": 0 });
    expect(playing("card", "gallery-page-0", "gallery-page-1")).toEqual(["card"]);
    // One observer for the whole surface — the gallery made no stage of its own.
    expect(liveObserverCount()).toBe(1);
  });

  it("a wheel tick at the top that moves nothing re-elects nothing (GAP-12)", () => {
    render(<List ids={["a", "b"]} />);
    const scroller = screen.getByTestId("scroller");
    scrollsTo(scroller, 300);
    frame({ a: 0.5, b: 1 });
    scrollsTo(scroller, 0);
    frame({ a: 1, b: 0.9 });
    fireEvent.wheel(scroller, { deltaY: -40 });
    expect(playing("a", "b")).toEqual(["b"]);
  });

  it("resting at the top is not a landing: arriving there at mount re-elects nothing (SL-1 flag f)", () => {
    render(<List ids={["a", "b"]} />);
    const scroller = screen.getByTestId("scroller");
    // The surface mounts at its top and never leaves it.
    frame({ a: 0.5, b: 1 });
    frame({ a: 1, b: 0.9 });
    settlesScroll(scroller);
    expect(playing("a", "b")).toEqual(["b"]);
  });
});

// THE BELOW-GATE HAND START (Feed.md:25/27, FeedCover.md:29/31): a play-disc
// tap is the one way a clip takes the stage under suppressed autoplay.
describe("a clip started by its play disc", () => {
  function tapped(id: string) {
    fireEvent.click(screen.getByTestId(`${id}-play`));
  }

  it("below the gate, keeps the stage while any of it stands on screen (F20 Feed.md:25)", () => {
    suppressesAutoplay({ reducedMotion: true });
    render(<List ids={["a", "b"]} />);
    frame({ a: 0.4, b: 1 });
    tapped("a");
    expect(playing("a", "b")).toEqual(["a"]);
    frame({ a: 0.05 });
    expect(playing("a", "b")).toEqual(["a"]);
  });

  it("below the gate, freezes once it leaves the screen and the ordinary succession takes over (F21 Feed.md:27)", () => {
    suppressesAutoplay({ reducedMotion: true });
    render(<List ids={["a", "b"]} />);
    frame({ a: 0.4, b: 1 });
    tapped("a");
    frame({ a: 0 });
    // Suppressed, the succession is nobody (Feed.md:15), and the frame wears
    // its play disc again.
    expect(playing("a", "b")).toEqual([]);
    expect(screen.getByTestId("a-play")).toBeInTheDocument();
  });

  it("once it has qualified since the tap, falling below the gate hands the stage on (C12 FeedCover.md:29)", () => {
    suppressesAutoplay({ reducedMotion: true });
    render(<List ids={["a", "b"]} />);
    frame({ a: 0.4, b: 1 });
    tapped("a");
    frame({ a: 0.8 });
    frame({ a: 0.5 });
    expect(playing("a", "b")).toEqual([]);
  });

  it("is never stolen by a landing at the hard top (F11 Feed.md:23, C13 FeedCover.md:31, L07)", () => {
    suppressesAutoplay({ reducedMotion: true });
    render(<List ids={["a", "b"]} />);
    const scroller = screen.getByTestId("scroller");
    scrollsTo(scroller, 300);
    frame({ a: 0.2, b: 1 });
    tapped("b");
    // Autoplay comes back while the tapped clip plays; the landing still
    // moves autoplay-eligible stages only.
    act(() => suppressesAutoplay({ reducedMotion: false }));
    scrollsTo(scroller, 0);
    frame({ a: 1, b: 0.9 });
    settlesScroll(scroller);
    expect(playing("a", "b")).toEqual(["b"]);
  });

  it("under suppression a landing neither stops it nor starts another (C13 FeedCover.md:31)", () => {
    suppressesAutoplay({ reducedMotion: true });
    render(<List ids={["a", "b"]} />);
    const scroller = screen.getByTestId("scroller");
    scrollsTo(scroller, 300);
    frame({ a: 0.2, b: 1 });
    tapped("b");
    scrollsTo(scroller, 0);
    frame({ a: 1, b: 0.9 });
    settlesScroll(scroller);
    expect(playing("a", "b")).toEqual(["b"]);
  });

  it("becomes the incumbent over an autoplayed one — and the deposed clip freezes (C11 FeedCover.md:27)", () => {
    // The device can ask, and does not yet.
    suppressesAutoplay({});
    render(<List ids={["a", "b"]} />);
    frame({ a: 1, b: 1 });
    expect(playing("a", "b")).toEqual(["a"]);
    // Suppression arrives with A still playing: nothing it says stops A, and
    // B's frame — not playing — offers its play disc.
    act(() => suppressesAutoplay({ saveData: true }));
    tapped("b");
    expect(playing("a", "b")).toEqual(["b"]);
  });
});

/** A hard-top surface, as each host stands in the app. */
type Surface = {
  name: string;
  mount: (ids: readonly string[]) => void;
  scroller: () => HTMLElement;
};

/** The thread stands on its sheet and scrolls in the sheet's body. */
function Thread({ ids }: { ids: readonly string[] }) {
  return (
    <BottomSheet open onClose={noop} title="Comments" testId="thread">
      <StageHost>
        {ids.map((id) => (
          <VideoPlayer key={id} src={CLIP} surface="reading" testId={id} />
        ))}
      </StageHost>
    </BottomSheet>
  );
}

const onList = (ids: readonly string[]) => void render(<List ids={ids} />);
const listScroller = () => screen.getByTestId("scroller");

const SURFACES: Surface[] = [
  { name: "the feed (F09 Feed.md:19, F10 Feed.md:21)", mount: onList, scroller: listScroller },
  {
    name: "the thread (R01 ReplyEntry.md:3, R02 ReplyEntry.md:5)",
    mount: (ids) => void render(<Thread ids={ids} />),
    scroller: () => screen.getByTestId("thread-body"),
  },
  // The tag page, the profile's posts and History wrap their lists in the
  // same host (`topic-view.tsx`; the profile's posts view and History are not
  // drawn on the web yet and inherit it — the packet's §1 rows G and H).
  { name: "the tag page (T02 TagPage.md:25, T03 TagPage.md:27)", mount: onList, scroller: listScroller },
  { name: "the profile's posts (P02 ProfilePosts.md:7, P03 ProfilePosts.md:9)", mount: onList, scroller: listScroller },
  { name: "History (H03 History.md:69, H04 History.md:71)", mount: onList, scroller: listScroller },
];

describe.each(SURFACES)("the hard top of $name", ({ mount, scroller }) => {
  /** B holds the stage below the top; A, above it, qualifies again. */
  function bHoldsWithAQualifying(from: number) {
    mount(["a", "b"]);
    scrollsTo(scroller(), from);
    frame({ a: 0.5, b: 1 });
    scrollsTo(scroller(), 0);
    frame({ a: 1, b: 0.9 });
    expect(playing("a", "b")).toEqual(["b"]);
  }

  it("re-elects the first qualifying clip in order when scroll settles there", () => {
    bHoldsWithAQualifying(300);
    settlesScroll(scroller());
    expect(playing("a", "b")).toEqual(["a"]);
  });

  it("counts the release of a pull at the top as settling back there", () => {
    mount(["a", "b"]);
    frame({ a: 0.5, b: 1 });
    frame({ a: 1, b: 0.9 });
    pullsAtTop(scroller(), 80);
    expect(playing("a", "b")).toEqual(["a"]);
  });

  it("re-elects nothing at a settle one pixel below it (L08, F12 Feed.md:29)", () => {
    mount(["a", "b"]);
    scrollsTo(scroller(), 300);
    frame({ a: 0.5, b: 1 });
    scrollsTo(scroller(), 1);
    frame({ a: 1, b: 0.9 });
    settlesScroll(scroller());
    expect(playing("a", "b")).toEqual(["b"]);
  });

  it("does nothing at a landing under suppressed autoplay (C10 FeedCover.md:25)", () => {
    suppressesAutoplay({ reducedMotion: true });
    mount(["a", "b"]);
    scrollsTo(scroller(), 300);
    frame({ a: 0.5, b: 1 });
    scrollsTo(scroller(), 0);
    frame({ a: 1, b: 0.9 });
    settlesScroll(scroller());
    expect(playing("a", "b")).toEqual([]);
  });
});

// PAGE VISIBILITY (the packet's §6 RF-7 row; §3.2 rule 11). Written in Feed.md
// and applied page-wide (flag §7.2-a): "It only plays while it is actually on
// screen" (`MediaAttachment.jsx:45`, L09).
describe("page visibility", () => {
  const hosts: [string, (ids: readonly string[]) => void][] = [
    ["on the feed", onList],
    ["in the thread", (ids) => void render(<Thread ids={ids} />)],
    [
      "the detail's pinned clip, on its own stage",
      (ids) =>
        void render(
          <>
            {ids.map((id) => (
              <VideoPlayer key={id} src={CLIP} surface="transport" testId={id} />
            ))}
          </>,
        ),
    ],
  ];

  it.each(hosts)("hiding the page pauses the playing clip on its frame — %s (F25 Feed.md:51)", (_, mount) => {
    mount(["a"]);
    frame({ a: 1 });
    act(() => {
      clip("a").currentTime = 6;
    });
    act(() => setsPageVisibility("hidden"));
    expect(playing("a")).toEqual([]);
    expect(clip("a").currentTime).toBe(6);
  });

  it("showing it again resumes that same clip from its frame, never re-electing (F26 Feed.md:53)", () => {
    render(<List ids={["a", "b"]} />);
    frame({ a: 1, b: 1 });
    act(() => {
      clip("a").currentTime = 6;
    });
    act(() => setsPageVisibility("hidden"));
    // Whatever the observer reports while hidden decides nothing.
    frame({ a: 0.5, b: 1 });
    expect(playing("a", "b")).toEqual([]);

    act(() => setsPageVisibility("visible"));
    expect(playing("a", "b")).toEqual(["a"]);
    expect(clip("a").currentTime).toBe(6);
  });

  it("showing it under suppressed autoplay plays nothing; the clip stands frozen wearing its play disc (F27 Feed.md:55)", () => {
    suppressesAutoplay({ reducedMotion: true });
    render(<List ids={["a"]} />);
    frame({ a: 1 });
    fireEvent.click(screen.getByTestId("a-play"));
    act(() => setsPageVisibility("hidden"));
    act(() => setsPageVisibility("visible"));
    expect(playing("a")).toEqual([]);
    expect(screen.getByTestId("a-play")).toBeInTheDocument();
  });

  it("a clip the reader paused stays paused when the page shows again", () => {
    render(<VideoPlayer src={CLIP} surface="transport" testId="a" />);
    frame({ a: 1 });
    fireEvent.click(screen.getByTestId("a-transport-play"));
    expect(playing("a")).toEqual([]);
    act(() => setsPageVisibility("hidden"));
    act(() => setsPageVisibility("visible"));
    expect(playing("a")).toEqual([]);
  });
});

// SUPPRESSION (the packet's §6 RF-4 row): "ALWAYS no clip starts on its own on
// any surface GIVEN the device suppresses autoplay" (FeedCover.md:25) — the
// rows the other suites do not already carry (landing: the hard-top suite;
// dismissal: `covering-layer.test.tsx`; page show: above; the live signal and
// the disc: `video-player.test.tsx`).
describe("suppressed autoplay starts nothing on its own", () => {
  it("on the detail's pinned clip arriving — the transport's play still starts it (C10, rule 12)", () => {
    suppressesAutoplay({ saveData: true });
    render(<VideoPlayer src={CLIP} surface="transport" testId="a" />);
    frame({ a: 1 });
    expect(playing("a")).toEqual([]);
    fireEvent.click(screen.getByTestId("a-transport-play"));
    expect(playing("a")).toEqual(["a"]);
  });

  it("on an unveil (C10; Feed.md:49 GIVEN the device allows autoplay)", () => {
    suppressesAutoplay({ reducedMotion: true });
    function Veiled({ veiled }: { veiled: boolean }) {
      return (
        <StageHost>
          <VeilContext.Provider value={veiled}>
            <VideoPlayer src={CLIP} testId="a" />
          </VeilContext.Provider>
        </StageHost>
      );
    }
    const { rerender } = render(<Veiled veiled />);
    frame({ a: 1 });
    rerender(<Veiled veiled={false} />);
    expect(playing("a")).toEqual([]);
    expect(screen.getByTestId("a-play")).toBeInTheDocument();
  });

  it("when autoplay is allowed again, an empty stage goes to the topmost qualifying clip (rule 3)", () => {
    suppressesAutoplay({ reducedMotion: true });
    render(<List ids={["a", "b"]} />);
    frame({ a: 1, b: 1 });
    expect(playing("a", "b")).toEqual([]);
    act(() => suppressesAutoplay({ reducedMotion: false }));
    expect(playing("a", "b")).toEqual(["a"]);
  });
});

// A LAYER SHIELDS WHAT IT DRAWS (SL-1 flag d): a clip on a layer raised over a
// host is not on the covered surface, so it never joins — and is never
// suspended with — the stage the layer covers.
describe("a clip drawn on a layer over a host", () => {
  function Covered({ sheetOpen }: { sheetOpen: boolean }) {
    return (
      <List ids={["page"]}>
        <BottomSheet open={sheetOpen} onClose={noop} title="Sheet" testId="sheet">
          <VideoPlayer src={CLIP} testId="drawn" />
        </BottomSheet>
      </List>
    );
  }

  it("plays on the sheet while the page's stage beneath stands suspended (L04, Feed.md:33)", () => {
    const { rerender } = render(<Covered sheetOpen={false} />);
    frame({ page: 1 });
    expect(playing("page")).toEqual(["page"]);

    rerender(<Covered sheetOpen />);
    frame({ page: 1, drawn: 1 });
    // The page's clip stopped for the sheet; the sheet's own clip is not
    // suspended by the very layer it is drawn on.
    expect(playing("page", "drawn")).toEqual(["drawn"]);
  });

  it("makes a stage of its own rather than joining the page's — one observer more", () => {
    const observers = liveObserverCount();
    render(<Covered sheetOpen />);
    frame({ page: 1, drawn: 1 });
    expect(liveObserverCount()).toBe(observers + 2);
  });
});

// TEARDOWN HYGIENE (the packet's §6 row; seam 024's teardown-race class).
describe("teardown hygiene", () => {
  it("a host that leaves takes its observer and its subscriptions with it", () => {
    const observers = liveObserverCount();
    const covers = coverListenersForTests();
    const { unmount } = render(<List ids={["a", "b"]} />);
    frame({ a: 1 });
    expect(liveObserverCount()).toBe(observers + 1);
    unmount();
    expect(liveObserverCount()).toBe(observers);
    expect(coverListenersForTests()).toBe(covers);
  });
});
