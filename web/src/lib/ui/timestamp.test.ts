import { describe, expect, it } from "vitest";

import { shortTimestamp } from "./timestamp";

const NOW = Date.parse("2026-09-09T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("shortTimestamp", () => {
  it("reads `now` under a minute", () => {
    expect(shortTimestamp(ago(59_000), NOW)).toBe("now");
  });

  it("counts minutes to the hour", () => {
    expect(shortTimestamp(ago(35 * MINUTE), NOW)).toBe("35m");
    expect(shortTimestamp(ago(59 * MINUTE), NOW)).toBe("59m");
  });

  it("counts hours to the day", () => {
    expect(shortTimestamp(ago(HOUR), NOW)).toBe("1h");
    expect(shortTimestamp(ago(23 * HOUR), NOW)).toBe("23h");
  });

  it("counts days past that", () => {
    expect(shortTimestamp(ago(3 * DAY), NOW)).toBe("3d");
    expect(shortTimestamp(ago(400 * DAY), NOW)).toBe("400d");
  });

  it("floors rather than rounds, so no card claims an age it has not reached", () => {
    expect(shortTimestamp(ago(119 * MINUTE), NOW)).toBe("1h");
  });

  it("reads a record ahead of this clock as `now`", () => {
    expect(shortTimestamp(new Date(NOW + HOUR).toISOString(), NOW)).toBe("now");
  });

  it("says nothing about an unparseable instant", () => {
    expect(shortTimestamp("not a date", NOW)).toBe("");
  });
});
