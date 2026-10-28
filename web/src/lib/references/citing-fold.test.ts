// @vitest-environment node
import { describe, expect, it } from "vitest";

import { foldCitingArtifacts, type ReferenceRecord } from "./citing-fold";

let clock = 0;
function record(
  authorId: string,
  artifact: string,
  pDirected: number,
  pInterest: number,
  extra: Partial<ReferenceRecord<string>> = {},
): ReferenceRecord<string> {
  clock += 1;
  return {
    id: `r${clock}`,
    authorId,
    targetId: artifact,
    target: artifact,
    pDirected,
    pInterest,
    payloadMarked: false,
    landingEpoch: 1,
    actTime: clock,
    position: 0,
    ...extra,
  };
}

describe("the citing-artifacts fold", () => {
  it("draws a revised citation once, at the net of its records", () => {
    const rows = foldCitingArtifacts([record("sol", "p1", 0.4, 0.2), record("sol", "p1", 0.3, 0.3)]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.pair).toEqual({ pDirected: 0.7, pInterest: 0.5 });
  });

  it("drops a withdrawn citation — its records net to (0, 0)", () => {
    const rows = foldCitingArtifacts([
      record("sol", "p1", 0.4, 0.2),
      record("sol", "p1", -0.4, -0.2),
      record("ada", "c1", 0.4, 0.65),
    ]);
    expect(rows.map((row) => row.target)).toEqual(["c1"]);
  });

  it("keeps two artifacts by one author as two citations", () => {
    const rows = foldCitingArtifacts([record("sol", "p1", 0.4, 0.2), record("sol", "p2", 0.1, 0.9)]);
    expect(rows.map((row) => row.target)).toEqual(["p2", "p1"]);
  });

  it("stands newest first, by each citation's newest act", () => {
    const rows = foldCitingArtifacts([
      record("sol", "p1", 0.4, 0.2, { landingEpoch: 1 }),
      record("ada", "p2", 0.1, 0.9, { landingEpoch: 2 }),
      record("sol", "p1", 0.1, 0.1, { landingEpoch: 3 }),
    ]);
    expect(rows.map((row) => row.target)).toEqual(["p1", "p2"]);
  });

  it("leaves payload-marked records out", () => {
    expect(foldCitingArtifacts([record("sol", "p1", 0.4, 0.2, { payloadMarked: true })])).toEqual([]);
  });
});
