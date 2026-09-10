import { describe, expect, it } from "vitest";

import {
  NO_PULL,
  PULL_THRESHOLD,
  pullMove,
  pullReleases,
  pullStart,
} from "./pull-to-refresh";

const AT_TOP = true;
const SCROLLED = false;

describe("the pull", () => {
  it("only begins at the top of the list", () => {
    expect(pullStart(100, AT_TOP)).toEqual({ startY: 100, travel: 0 });
    expect(pullStart(100, SCROLLED)).toEqual(NO_PULL);
  });

  it("measures how far the finger has come down", () => {
    const started = pullStart(100, AT_TOP);
    expect(pullMove(started, 150, AT_TOP).travel).toBe(50);
    expect(pullMove(started, 300, AT_TOP).travel).toBe(200);
  });

  it("asks for new posts once it passes the platform's threshold", () => {
    const pulled = pullMove(pullStart(100, AT_TOP), 100 + PULL_THRESHOLD, AT_TOP);
    expect(pullReleases(pulled)).toBe(true);
  });

  it("asks for nothing when the finger lifts short of it", () => {
    const short = pullMove(pullStart(100, AT_TOP), 100 + PULL_THRESHOLD - 1, AT_TOP);
    expect(pullReleases(short)).toBe(false);
  });

  it("ends the moment the finger turns back up — that is a scroll", () => {
    const turned = pullMove(pullStart(100, AT_TOP), 60, AT_TOP);
    expect(turned).toEqual(NO_PULL);
    expect(pullReleases(pullMove(turned, 400, AT_TOP))).toBe(false);
  });

  it("ends the moment the list leaves its top edge", () => {
    const started = pullStart(100, AT_TOP);
    expect(pullMove(started, 400, SCROLLED)).toEqual(NO_PULL);
  });

  it("is nothing at all when a finger that started mid-list travels far", () => {
    const midList = pullStart(100, SCROLLED);
    expect(pullReleases(pullMove(midList, 900, AT_TOP))).toBe(false);
  });

  it("takes Material's own 64dp threshold, the number Android pulls against", () => {
    expect(PULL_THRESHOLD).toBe(64);
  });
});
