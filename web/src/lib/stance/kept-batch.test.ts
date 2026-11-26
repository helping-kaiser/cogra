// The kept picks' batch after its seal closed (KeptPicksSeal.md:57-63,
// Settings.md:205-207, SigningAfterClose.md): the runner owns the signing and
// its account; the seal, Settings' row and the target rows only read it.

import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Outcome } from "@/lib/api/outcome";
import { tokenStore } from "@/lib/session/token-store";
import {
  closeKeptBatchSeal,
  keptBatchSigning,
  readKeptBatch,
  resetKeptBatchForTests,
  signKeptBatch,
} from "./kept-batch";
import { keepPick, listKeptPicks } from "./kept-picks";
import { resetSettlingForTests } from "./settling";
import type { KeptEntry, StanceCommit } from "./stance-data";

const ADA = { kind: "post" as const, id: "post-ada" };
const MIRA = { kind: "profile" as const, id: "user-mira" };
const OTHER = { kind: "post" as const, id: "post-other" };
const BATCH: readonly KeptEntry[] = [
  { target: ADA, pick: { pDirected: 0.1, pInterest: 0.1 } },
  { target: MIRA, pick: { pDirected: 0.55, pInterest: 0.2 } },
];

const signInAs = (accountId: string) =>
  tokenStore.save({ accessToken: `access-${accountId}`, refreshToken: `refresh-${accountId}`, accountId });

const TAKEN: Outcome<StanceCommit> = { kind: "success", value: { records: 2 } };
const NO_ANSWER: Outcome<StanceCommit> = { kind: "failed", cause: new Error("offline") };

/** A commit the test answers when it chooses. */
function held() {
  const answers: ((outcome: Outcome<StanceCommit>) => void)[] = [];
  const commit = vi.fn(
    (_entries: readonly KeptEntry[]) =>
      new Promise<Outcome<StanceCommit>>((resolve) => {
        answers.push(resolve);
      }),
  );
  const answer = async (outcome: Outcome<StanceCommit>) => {
    await act(async () => {
      answers.shift()?.(outcome);
    });
  };
  return { commit, answer };
}

beforeEach(async () => {
  resetKeptBatchForTests();
  resetSettlingForTests();
  signInAs("u1");
  await keepPick("u1", ADA, BATCH[0].pick);
  await keepPick("u1", MIRA, BATCH[1].pick);
});

describe("the kept batch while its seal is open", () => {
  it("answers the seal, keeps nothing, and a taken batch drops its picks", async () => {
    const { commit, answer } = held();
    const signing = signKeptBatch(commit, BATCH);
    expect(readKeptBatch()).toMatchObject({ kind: "signing", closed: false });
    // An open seal carries its own wait: no target row reads Signing….
    expect(keptBatchSigning(ADA)).toBe(false);
    await answer(TAKEN);
    expect(await signing).toEqual(TAKEN);
    expect(readKeptBatch()).toBeNull();
    expect(await listKeptPicks("u1")).toEqual([]);
  });

  it("leaves a failure to the seal's own states, every pick still kept", async () => {
    const { commit, answer } = held();
    const signing = signKeptBatch(commit, BATCH);
    await answer(NO_ANSWER);
    expect(await signing).toEqual(NO_ANSWER);
    expect(readKeptBatch()).toBeNull();
    expect(await listKeptPicks("u1")).toHaveLength(2);
  });
});

describe("the kept batch after its seal closed", () => {
  it("reads Signing… on each target's row while it signs, and nowhere else (KeptPicksSeal.md:59)", async () => {
    const { commit, answer } = held();
    void signKeptBatch(commit, BATCH);
    closeKeptBatchSeal();
    expect(keptBatchSigning(ADA)).toBe(true);
    expect(keptBatchSigning(MIRA)).toBe(true);
    expect(keptBatchSigning(OTHER)).toBe(false);
    await answer(TAKEN);
    expect(keptBatchSigning(ADA)).toBe(false);
  });

  it("lands a taken batch: its picks are kept no longer, and no line stands", async () => {
    const { commit, answer } = held();
    void signKeptBatch(commit, BATCH);
    closeKeptBatchSeal();
    await answer(TAKEN);
    expect(readKeptBatch()).toBeNull();
    await vi.waitFor(async () => expect(await listKeptPicks("u1")).toEqual([]));
  });

  it("stands as the failed line when it does not go through, every pick still kept (KeptPicksSeal.md:61)", async () => {
    const { commit, answer } = held();
    void signKeptBatch(commit, BATCH);
    closeKeptBatchSeal();
    await answer(NO_ANSWER);
    expect(readKeptBatch()).toMatchObject({ kind: "failed" });
    expect(keptBatchSigning(ADA)).toBe(false);
    expect(await listKeptPicks("u1")).toHaveLength(2);
  });

  it("asks the whole batch again on Retry, once, the rows reading Signing… until it answers (KeptPicksSeal.md:63)", async () => {
    const { commit, answer } = held();
    void signKeptBatch(commit, BATCH);
    closeKeptBatchSeal();
    await answer(NO_ANSWER);
    const failed = readKeptBatch();
    if (failed?.kind !== "failed") throw new Error("no failed line");
    act(() => {
      failed.retry();
      failed.retry();
    });
    expect(commit).toHaveBeenCalledTimes(2);
    expect(commit.mock.calls[1][0]).toBe(commit.mock.calls[0][0]);
    expect(keptBatchSigning(ADA)).toBe(true);
    await answer(TAKEN);
    expect(readKeptBatch()).toBeNull();
  });

  it("refuses a second batch while one still signs", async () => {
    const { commit, answer } = held();
    const first = signKeptBatch(commit, BATCH);
    closeKeptBatchSeal();
    const second = signKeptBatch(commit, BATCH);
    expect(commit).toHaveBeenCalledTimes(1);
    await answer(TAKEN);
    expect(await second).toEqual(await first);
  });
});

// auth.md "Multi-account device custody"; Profile.md:101's family rule.
describe("the kept batch belongs to the account that pressed", () => {
  it("hides its line under another account, stands again under its own, and never erases it on a switch", async () => {
    const { commit, answer } = held();
    void signKeptBatch(commit, BATCH);
    closeKeptBatchSeal();
    signInAs("u2");
    expect(readKeptBatch()).toBeNull();
    expect(keptBatchSigning(ADA)).toBe(false);
    // The owner guard stops the act under another account: it ends as the owner's failed line.
    await answer(NO_ANSWER);
    expect(readKeptBatch()).toBeNull();
    signInAs("u1");
    expect(readKeptBatch()).toMatchObject({ kind: "failed" });
  });

  it("does nothing on Retry under another account", async () => {
    const { commit, answer } = held();
    void signKeptBatch(commit, BATCH);
    closeKeptBatchSeal();
    await answer(NO_ANSWER);
    const failed = readKeptBatch();
    if (failed?.kind !== "failed") throw new Error("no failed line");
    signInAs("u2");
    act(() => failed.retry());
    expect(commit).toHaveBeenCalledTimes(1);
    signInAs("u1");
    expect(readKeptBatch()).toMatchObject({ kind: "failed" });
  });

  it("drops the owner's picks when taken under another account, and lands nothing on that account", async () => {
    const { commit, answer } = held();
    void signKeptBatch(commit, BATCH);
    closeKeptBatchSeal();
    signInAs("u2");
    await answer(TAKEN);
    await vi.waitFor(async () => expect(await listKeptPicks("u1")).toEqual([]));
    expect(readKeptBatch()).toBeNull();
  });
});
