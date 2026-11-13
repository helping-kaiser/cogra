// @vitest-environment node
import { describe, expect, it } from "vitest";

import { laterThan, newestOf } from "./causal-key";

describe("the key of record", () => {
  // A record as the API serves it also carries its act time, and on the real
  // Layer 1 a later position can carry a lower one: the key never reads it.
  const earlier = { landingEpoch: 4, position: 1, actTime: 900 };
  const later = { landingEpoch: 4, position: 2, actTime: 300 };

  it("puts the later position later inside one epoch, whatever act time it carries", () => {
    expect(laterThan(later, earlier)).toBe(true);
    expect(laterThan(earlier, later)).toBe(false);
    expect(newestOf([later, earlier])).toBe(later);
    expect(newestOf([earlier, later])).toBe(later);
  });

  it("lets the epoch lead the position", () => {
    expect(laterThan({ landingEpoch: 5, position: 1 }, { landingEpoch: 4, position: 9 })).toBe(true);
  });

  it("holds one key equal to itself", () => {
    expect(laterThan(earlier, { landingEpoch: 4, position: 1 })).toBe(false);
  });
});
