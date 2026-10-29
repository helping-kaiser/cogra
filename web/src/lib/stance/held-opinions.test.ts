// @vitest-environment node
import { describe, expect, it } from "vitest";

import { foldHeldOpinions, type OpinionRecord } from "./held-opinions";

let clock = 0;
function record(
  holderId: string,
  pDirected: number,
  pInterest: number,
  extra: Partial<OpinionRecord<string>> = {},
): OpinionRecord<string> {
  clock += 1;
  return {
    holderId,
    holder: holderId,
    pDirected,
    pInterest,
    severed: false,
    payloadMarked: false,
    landingEpoch: 1,
    actTime: clock,
    position: 0,
    ...extra,
  };
}

describe("the held-opinions fold", () => {
  it("draws one row per person, however many records their bundle holds", () => {
    const held = foldHeldOpinions([
      record("mira", 0.5, 0.2),
      record("mira", 0.4, 0.05),
      record("ada", 0.3, 0.3),
    ]);
    expect(held.map((row) => row.holderId)).toEqual(["mira", "ada"]);
    expect(held[0]!.pair).toEqual({ pDirected: 0.9, pInterest: 0.25 });
  });

  it("sums exactly and clips the sum, never the records", () => {
    const [row] = foldHeldOpinions([record("kel", 0.7, 0.1), record("kel", 0.6, 0.2)]);
    expect(row!.pair).toEqual({ pDirected: 1, pInterest: 0.3 });
  });

  it("stands strongest first, down past nothing into the ones held against", () => {
    const held = foldHeldOpinions([
      record("juno", -0.55, 0.25),
      record("sol", 0.55, 0.2),
      record("wren", 0.1, 0.1),
      record("wren", -0.1, -0.1, { severed: true }),
      record("mira", 0.9, 0.25),
    ]);
    expect(held.map((row) => row.holderId)).toEqual(["mira", "sol", "wren", "juno"]);
  });

  it("keeps a walked-back standing as a row and says it was walked back", () => {
    const held = foldHeldOpinions([
      record("wren", 0.1, 0.1),
      record("wren", -0.1, -0.1, { severed: true }),
      record("nadia", 0, 0),
    ]);
    const byId = new Map(held.map((row) => [row.holderId, row]));
    expect(byId.get("wren")).toMatchObject({ pair: { pDirected: 0, pInterest: 0 }, severed: true });
    expect(byId.get("nadia")).toMatchObject({ pair: { pDirected: 0, pInterest: 0 }, severed: false });
  });

  it("reads severed off the newest record by the causal key, not the arrival order", () => {
    const older = record("wren", -0.1, -0.1, { severed: true, landingEpoch: 1 });
    const newer = record("wren", 0.2, 0.2, { severed: false, landingEpoch: 2 });
    const [row] = foldHeldOpinions([newer, older]);
    expect(row!.severed).toBe(false);
    expect(row!.pair).toEqual({ pDirected: 0.1, pInterest: 0.1 });
  });

  it("leaves payload-marked records out of the bundle", () => {
    const held = foldHeldOpinions([record("ada", 0.3, 0.3), record("ada", 0.5, 0.5, { payloadMarked: true })]);
    expect(held[0]!.pair).toEqual({ pDirected: 0.3, pInterest: 0.3 });
    expect(foldHeldOpinions([record("tobias", 0.2, 0.2, { payloadMarked: true })])).toEqual([]);
  });
});
