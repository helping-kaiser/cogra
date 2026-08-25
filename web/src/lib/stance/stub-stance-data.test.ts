// @vitest-environment node
// The stand-in is what every control test is driven against, so its own
// contract — what it records, what it reports, how it fails — is pinned
// here rather than assumed.

import { describe, expect, it } from "vitest";

import { TAP_DEFAULT } from "./model";
import { createStubStanceData, sumFold } from "./stub-stance-data";

describe("the stance stand-in", () => {
  it("reports no standing toward a target never stanced", async () => {
    const data = createStubStanceData();
    expect(await data.bundle("t")).toEqual({ kind: "success", value: null });
  });

  it("reports the folded standing and what reaching zero would take", async () => {
    const data = createStubStanceData({
      seed: { t: { records: [TAP_DEFAULT, { pDirected: 0.4, pInterest: -0.5 }] } },
    });
    const outcome = await data.bundle("t");
    expect(outcome).toEqual({
      kind: "success",
      value: { current: sumFold([TAP_DEFAULT, { pDirected: 0.4, pInterest: -0.5 }]), severance: { records: 2 } },
    });
  });

  it("bounds the fold to the field", () => {
    expect(
      sumFold([
        { pDirected: 0.9, pInterest: -0.9 },
        { pDirected: 0.9, pInterest: -0.9 },
      ]),
    ).toEqual({ pDirected: 1, pInterest: -1 });
  });

  it("keeps the pick verbatim, so a delta anywhere would show", async () => {
    const data = createStubStanceData({ seed: { t: { records: [{ pDirected: 0.8, pInterest: 0.8 }] } } });
    await data.commit("t", TAP_DEFAULT);
    expect(data.sent).toEqual([{ target: "t", pick: TAP_DEFAULT }]);
    expect(data.recordsOf("t")).toEqual([{ pDirected: 0.8, pInterest: 0.8 }, TAP_DEFAULT]);
  });

  it("projects a pick against the standing without writing it", async () => {
    const data = createStubStanceData({ seed: { t: { records: [{ pDirected: 0.5, pInterest: 0.5 }] } } });
    expect(await data.project("t", { pDirected: -0.5, pInterest: -0.5 })).toEqual({
      kind: "success",
      value: { pDirected: 0, pInterest: 0 },
    });
    expect(data.recordsOf("t")).toHaveLength(1);
  });

  it("severs as a batch, one step per live record", async () => {
    const data = createStubStanceData({
      seed: { t: { records: [TAP_DEFAULT, TAP_DEFAULT, TAP_DEFAULT] } },
    });
    expect(await data.sever("t")).toEqual({ kind: "success", value: { records: 3 } });
    expect(data.severed).toEqual(["t"]);
    expect(await data.bundle("t")).toEqual({ kind: "success", value: null });
  });

  it("records how each read asked about pending stances", async () => {
    const data = createStubStanceData();
    await data.bundle("t");
    await data.project("t", TAP_DEFAULT, { includePending: false });
    expect(data.pendingFlags).toEqual([true, false]);
  });

  it("fails every call while offline, so the fault branches are reachable", async () => {
    const data = createStubStanceData({ offline: true });
    for (const outcome of [
      await data.bundle("t"),
      await data.project("t", TAP_DEFAULT),
      await data.commit("t", TAP_DEFAULT),
      await data.sever("t"),
    ]) {
      expect(outcome.kind).toBe("failed");
    }
    expect(data.sent).toEqual([]);
  });
});
