// THE STAGE LAW, clause by clause, asked of the pure decision with no surface
// in the way. The first seventeen cases are a 1:1 port of android's
// `StageElectionTest` (`android/core/designsystem/src/test/.../StageElectionTest.kt`);
// the rest are what the web's executed law adds — suppressed autoplay and the
// play-disc hand start (Feed.md, FeedCover.md; the stage-law packet §6).

import { describe, expect, it } from "vitest";

import { documentOrder, elect, GATE, type StageEntry, type StagePlace } from "./stage-election";

const ABOVE = "above";
const INCUMBENT = "incumbent";
const BELOW = "below";
const FURTHER = "further";

/**
 * A clip at android's coordinates. `top` and `page` only decide the ORDER the
 * places are handed over in — in a vertical list the order of the tops is the
 * list order, and the gallery's page breaks a tie — which is what document
 * order is on the web.
 */
type At = {
  key: string;
  top: number;
  visible: number;
  page?: number;
  veiled?: boolean;
  handStarted?: boolean;
  qualifiedSinceTap?: boolean;
};

function places(...clips: At[]): StageEntry<string>[] {
  return [...clips]
    .sort((a, b) => a.top - b.top || (a.page ?? 0) - (b.page ?? 0))
    .map((clip) => ({
      key: clip.key,
      place: {
        ratio: clip.visible,
        veiled: clip.veiled ?? false,
        handStarted: clip.handStarted ?? false,
        qualifiedSinceTap: clip.qualifiedSinceTap ?? false,
      } satisfies StagePlace,
    }));
}

function electAllowed(
  incumbent: string | null,
  standing: StageEntry<string>[],
  landedAtHardTop = false,
): string | null {
  return elect({ incumbent, places: standing, landedAtHardTop, autoplayAllowed: true });
}

function electSuppressed(
  incumbent: string | null,
  standing: StageEntry<string>[],
  landedAtHardTop = false,
): string | null {
  return elect({ incumbent, places: standing, landedAtHardTop, autoplayAllowed: false });
}

describe("android's StageElectionTest, ported", () => {
  // (a) Incumbency.

  it("an incumbent that still qualifies keeps the stage against a clip above it", () => {
    const standing = places(
      { key: ABOVE, top: 0, visible: 1 },
      { key: INCUMBENT, top: 500, visible: 0.8 },
    );
    expect(electAllowed(INCUMBENT, standing)).toBe(INCUMBENT);
  });

  it("a second clip arriving fully in view changes nothing", () => {
    const standing = places(
      { key: INCUMBENT, top: 0, visible: 0.7 },
      { key: BELOW, top: 600, visible: 1 },
    );
    expect(electAllowed(INCUMBENT, standing)).toBe(INCUMBENT);
  });

  it("the gate itself still qualifies", () => {
    const standing = places(
      { key: ABOVE, top: 0, visible: 1 },
      { key: INCUMBENT, top: 500, visible: GATE },
    );
    expect(electAllowed(INCUMBENT, standing)).toBe(INCUMBENT);
  });

  // (b) Instant succession.

  it("an incumbent below the gate hands the stage to the topmost qualifying clip", () => {
    const standing = places(
      { key: INCUMBENT, top: -400, visible: 0.69 },
      { key: BELOW, top: 300, visible: 1 },
      { key: FURTHER, top: 900, visible: 0.9 },
    );
    expect(electAllowed(INCUMBENT, standing)).toBe(BELOW);
  });

  it("an incumbent that left the list hands the stage on", () => {
    expect(electAllowed(INCUMBENT, places({ key: BELOW, top: 300, visible: 1 }))).toBe(BELOW);
  });

  it("an incumbent below the gate with no successor leaves the stage empty", () => {
    const standing = places(
      { key: INCUMBENT, top: -400, visible: 0.3 },
      { key: BELOW, top: 900, visible: 0.5 },
    );
    expect(electAllowed(INCUMBENT, standing)).toBeNull();
  });

  // (c) Topmost when empty.

  it("an empty stage goes to the topmost qualifying clip, not the most visible", () => {
    const standing = places(
      { key: BELOW, top: 700, visible: 1 },
      { key: ABOVE, top: 0, visible: 0.75 },
      { key: FURTHER, top: 1400, visible: 0.2 },
    );
    expect(electAllowed(null, standing)).toBe(ABOVE);
  });

  it("clips side by side in one gallery rank by their page", () => {
    const standing = places(
      { key: BELOW, top: 100, visible: 1, page: 1 },
      { key: ABOVE, top: 100, visible: 1, page: 0 },
    );
    expect(electAllowed(null, standing)).toBe(ABOVE);
  });

  it("a clip above the top of the screen is still topmost while it qualifies", () => {
    const standing = places(
      { key: ABOVE, top: -50, visible: 0.9 },
      { key: BELOW, top: 600, visible: 1 },
    );
    expect(electAllowed(null, standing)).toBe(ABOVE);
  });

  // (d) Nothing qualifies, nothing plays.

  it("nothing qualifying means nothing plays", () => {
    const standing = places(
      { key: ABOVE, top: -300, visible: 0.4 },
      { key: BELOW, top: 900, visible: 0.69 },
    );
    expect(electAllowed(null, standing)).toBeNull();
  });

  it("a surface without clips has nobody on stage", () => {
    expect(electAllowed(null, [])).toBeNull();
    expect(electAllowed(INCUMBENT, [])).toBeNull();
  });

  // (e) The hard top re-elects.

  it("landing at the hard top hands the stage to the first qualifying clip over a qualifying incumbent", () => {
    const standing = places(
      { key: ABOVE, top: 0, visible: 1 },
      { key: INCUMBENT, top: 400, visible: 1 },
    );
    expect(electAllowed(INCUMBENT, standing, true)).toBe(ABOVE);
    // Resting there without landing again is plain incumbency.
    expect(electAllowed(INCUMBENT, standing, false)).toBe(INCUMBENT);
  });

  it("landing at the hard top passes over a veiled first clip", () => {
    const standing = places(
      { key: ABOVE, top: 0, visible: 1, veiled: true },
      { key: INCUMBENT, top: 400, visible: 1 },
      { key: BELOW, top: 800, visible: 0.2 },
    );
    expect(electAllowed(INCUMBENT, standing, true)).toBe(INCUMBENT);
  });

  it("landing at the hard top with nothing qualifying leaves the stage empty", () => {
    const standing = places(
      { key: ABOVE, top: 0, visible: 0.5 },
      { key: BELOW, top: 600, visible: 0.1 },
    );
    expect(electAllowed(INCUMBENT, standing, true)).toBeNull();
  });

  // The veil: out of the rotation; the unveil is an eligibility change.

  it("a veiled clip is never elected however much of it shows", () => {
    const veiledAbove = { key: ABOVE, top: 0, visible: 1, veiled: true };
    expect(electAllowed(null, places(veiledAbove, { key: BELOW, top: 600, visible: 0.8 }))).toBe(
      BELOW,
    );
    expect(electAllowed(null, places(veiledAbove))).toBeNull();
  });

  it("an incumbent the veil falls over surrenders the stage", () => {
    const standing = places(
      { key: INCUMBENT, top: 0, visible: 1, veiled: true },
      { key: BELOW, top: 600, visible: 0.8 },
    );
    expect(electAllowed(INCUMBENT, standing)).toBe(BELOW);
  });

  it("an unveiled clip changes nothing while the incumbent qualifies", () => {
    const standing = places(
      { key: ABOVE, top: 0, visible: 0.8 },
      { key: INCUMBENT, top: 400, visible: 0.9 },
      { key: BELOW, top: 900, visible: 0.3 },
    );
    expect(electAllowed(INCUMBENT, standing)).toBe(INCUMBENT);
  });
});

describe("suppressed autoplay (FeedCover.md:23/25)", () => {
  it("succession yields nobody (Feed.md:15)", () => {
    const standing = places(
      { key: INCUMBENT, top: -400, visible: 0.3 },
      { key: BELOW, top: 300, visible: 1 },
    );
    expect(electSuppressed(INCUMBENT, standing)).toBeNull();
  });

  it("an empty stage stays empty until a play-disc tap", () => {
    const standing = places(
      { key: ABOVE, top: 0, visible: 1 },
      { key: BELOW, top: 600, visible: 1 },
    );
    expect(electSuppressed(null, standing)).toBeNull();
  });

  it("a landing at the hard top is a no-op", () => {
    const standing = places(
      { key: ABOVE, top: 0, visible: 1 },
      { key: INCUMBENT, top: 400, visible: 1, handStarted: true, qualifiedSinceTap: true },
    );
    expect(electSuppressed(INCUMBENT, standing, true)).toBe(INCUMBENT);
    expect(electSuppressed(null, standing, true)).toBeNull();
  });
});

describe("the play-disc hand start", () => {
  it("a hand-started incumbent that still qualifies survives a landing at the hard top (Feed.md:23, FeedCover.md:31)", () => {
    const standing = places(
      { key: ABOVE, top: 0, visible: 1 },
      { key: INCUMBENT, top: 400, visible: 1, handStarted: true, qualifiedSinceTap: true },
    );
    expect(electAllowed(INCUMBENT, standing, true)).toBe(INCUMBENT);
  });

  it("started below the gate, it holds while any of it is on screen and it has not qualified (Feed.md:25)", () => {
    const standing = places(
      { key: ABOVE, top: 0, visible: 1 },
      { key: INCUMBENT, top: 700, visible: 0.1, handStarted: true },
    );
    expect(electAllowed(INCUMBENT, standing)).toBe(INCUMBENT);
    expect(electSuppressed(INCUMBENT, standing)).toBe(INCUMBENT);
    // A landing does not take it either: it still stands on screen.
    expect(electAllowed(INCUMBENT, standing, true)).toBe(INCUMBENT);
  });

  it("leaving the screen without having qualified, it gives way to ordinary succession (Feed.md:27)", () => {
    const standing = places(
      { key: ABOVE, top: 0, visible: 1 },
      { key: INCUMBENT, top: 900, visible: 0, handStarted: true },
    );
    expect(electAllowed(INCUMBENT, standing)).toBe(ABOVE);
    expect(electSuppressed(INCUMBENT, standing)).toBeNull();
  });

  it("once it has qualified, falling below the gate hands the stage on (FeedCover.md:29)", () => {
    const standing = places(
      { key: INCUMBENT, top: -300, visible: 0.5, handStarted: true, qualifiedSinceTap: true },
      { key: BELOW, top: 400, visible: 1 },
    );
    expect(electAllowed(INCUMBENT, standing)).toBe(BELOW);
    expect(electSuppressed(INCUMBENT, standing)).toBeNull();
  });

  it("a veil over it ends its hold like any incumbent's (Feed.md:43)", () => {
    const standing = places(
      { key: INCUMBENT, top: 0, visible: 0.4, handStarted: true, veiled: true },
      { key: BELOW, top: 400, visible: 1 },
    );
    expect(electAllowed(INCUMBENT, standing)).toBe(BELOW);
  });
});

describe("the gate reads the ratio", () => {
  it("0.69 does not qualify, whatever the observer's isIntersecting says (W5)", () => {
    // The place carries the ratio alone: an observer that reports
    // `isIntersecting: true` at 0.69 still hands over a place below the gate.
    expect(electAllowed(null, places({ key: ABOVE, top: 0, visible: 0.69 }))).toBeNull();
  });
});

describe("document order", () => {
  it("orders frames as the document does — nested threads and side-by-side pages included", () => {
    document.body.innerHTML = `
      <ul>
        <li><div id="post"></div>
          <ul><li><div id="reply"></div></li></ul>
        </li>
        <li><div id="page0"></div><div id="page1"></div></li>
      </ul>`;
    const byId = (id: string) => document.getElementById(id) as HTMLElement;
    const shuffled = [byId("page1"), byId("reply"), byId("page0"), byId("post")];

    expect(shuffled.sort(documentOrder).map((node) => node.id)).toEqual([
      "post",
      "reply",
      "page0",
      "page1",
    ]);
    expect(documentOrder(byId("post"), byId("post"))).toBe(0);
    document.body.innerHTML = "";
  });

  it("breaks a tie between two qualifying clips by document order", () => {
    document.body.innerHTML = `<div id="a"></div><div id="b"></div>`;
    const a = document.getElementById("a") as HTMLElement;
    const b = document.getElementById("b") as HTMLElement;
    const place: StagePlace = { ratio: 1, veiled: false, handStarted: false, qualifiedSinceTap: false };
    const standing = [
      { key: b, place },
      { key: a, place },
    ].sort((x, y) => documentOrder(x.key, y.key));

    expect(elect({ incumbent: null, places: standing, autoplayAllowed: true })).toBe(a);
    document.body.innerHTML = "";
  });
});
