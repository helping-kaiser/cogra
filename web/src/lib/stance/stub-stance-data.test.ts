// @vitest-environment node
// The stand-in is what every control test is driven against, so its own
// contract — what it records, what it reports, how it fails — is pinned
// here rather than assumed.

import { describe, expect, it } from "vitest";

import { ORIGIN, TAP_DEFAULT } from "./model";
import { createStubStanceData, sumFold } from "./stub-stance-data";
import type { StanceTarget } from "./stance-data";

const T: StanceTarget = { id: "t", kind: "post" };

describe("the stance stand-in", () => {
  it("folds no records toward a target never stanced", async () => {
    const data = createStubStanceData();
    expect(await data.bundle(T)).toEqual({
      kind: "success",
      value: {
        current: ORIGIN,
        records: 0,
        inert: true,
        severed: true,
        severance: { records: 0 },
      },
    });
  });

  it("reports the folded standing and what reaching zero would take", async () => {
    const data = createStubStanceData({
      seed: { t: { records: [TAP_DEFAULT, { pDirected: 0.4, pInterest: -0.5 }] } },
    });
    const outcome = await data.bundle(T);
    expect(outcome).toEqual({
      kind: "success",
      value: {
        current: sumFold([TAP_DEFAULT, { pDirected: 0.4, pInterest: -0.5 }]),
        records: 2,
        inert: false,
        severed: false,
        severance: { records: 2 },
      },
    });
  });

  it("states inertness and severance as flags the reader never recomputes", async () => {
    const oneAxisDead = createStubStanceData({
      seed: { t: { records: [{ pDirected: 0, pInterest: 0.4 }] } },
    });
    expect(await oneAxisDead.bundle(T)).toMatchObject({
      value: { inert: true, severed: false },
    });

    const atZero = createStubStanceData({
      seed: { t: { records: [TAP_DEFAULT, { pDirected: -0.1, pInterest: -0.1 }] } },
    });
    // Nothing left to walk back, so severance would stage nothing.
    expect(await atZero.bundle(T)).toMatchObject({
      value: { inert: true, severed: true, severance: { records: 0 } },
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
    await data.commit(T, TAP_DEFAULT);
    expect(data.sent).toEqual([{ target: "t", pick: TAP_DEFAULT }]);
    expect(data.recordsOf("t")).toEqual([{ pDirected: 0.8, pInterest: 0.8 }, TAP_DEFAULT]);
  });

  it("projects a pick against the standing without writing it", async () => {
    const data = createStubStanceData({ seed: { t: { records: [{ pDirected: 0.5, pInterest: 0.5 }] } } });
    expect(await data.project(T, { pDirected: -0.5, pInterest: -0.5 })).toEqual({
      kind: "success",
      value: { landing: { pDirected: 0, pInterest: 0 }, inert: true, severed: true },
    });
    expect(data.recordsOf("t")).toHaveLength(1);
  });

  it("severs as a batch, one step per live record", async () => {
    const data = createStubStanceData({
      seed: { t: { records: [TAP_DEFAULT, TAP_DEFAULT, TAP_DEFAULT] } },
    });
    expect(await data.sever(T)).toEqual({ kind: "success", value: { records: 3 } });
    expect(data.severed).toEqual(["t"]);
    expect(await data.bundle(T)).toMatchObject({ value: { records: 0, severed: true } });
  });

  it("records how each read asked about pending stances", async () => {
    const data = createStubStanceData();
    await data.bundle(T);
    await data.project(T, TAP_DEFAULT, { includePending: false });
    expect(data.pendingFlags).toEqual([true, false]);
  });

  it("fails every call while offline, so the fault branches are reachable", async () => {
    const data = createStubStanceData({ offline: true });
    for (const outcome of [
      await data.bundle(T),
      await data.project(T, TAP_DEFAULT),
      await data.commit(T, TAP_DEFAULT),
      await data.sever(T),
    ]) {
      expect(outcome.kind).toBe("failed");
    }
    expect(data.sent).toEqual([]);
  });
});
