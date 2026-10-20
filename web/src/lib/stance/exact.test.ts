// @vitest-environment node
import { describe, expect, it } from "vitest";

import { decimalOf, netsToZero } from "./exact";

describe("exact decimal netting", () => {
  it("nets the known-dirty pattern to zero in every order", () => {
    expect(0.1 + 0.2 - 0.3).not.toBe(0);
    for (const order of [
      [0.1, 0.2, -0.3],
      [0.2, -0.3, 0.1],
      [-0.3, 0.1, 0.2],
    ]) {
      expect(netsToZero(order)).toBe(true);
    }
  });

  it("accepts a walk-back floating point would call short of zero", () => {
    expect(1.1 - 1 - 0.1).not.toBe(0);
    expect(netsToZero([1.1, -1, -0.1])).toBe(true);
  });

  it("refuses a walk-back that nets only in floating point", () => {
    const remainder = -(2.3 - 1 - 1);
    expect(2.3 - 1 - 1 + remainder).toBe(0);
    expect(netsToZero([2.3, -1, -1, remainder])).toBe(false);
  });

  it("holds an off-grid value to its last digit", () => {
    const legacy = 0.00047147125005719825;
    expect(decimalOf(legacy)).toEqual({ units: 47147125005719825n, scale: 20 });
    expect(netsToZero([legacy, 0.1, -legacy, -0.1])).toBe(true);
    expect(netsToZero([legacy, -0.0004714712500572])).toBe(false);
  });

  it("reads both zeros and exponent notation as the values they name", () => {
    expect(decimalOf(-0)).toEqual({ units: 0n, scale: 0 });
    expect(decimalOf(1e-7)).toEqual({ units: 1n, scale: 7 });
    expect(decimalOf(1e21)).toEqual({ units: 10n ** 21n, scale: 0 });
    expect(() => decimalOf(Number.NaN)).toThrow(RangeError);
  });
});
