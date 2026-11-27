// A stance pick's Retry asks the same signing again (SigningAfterClose.md:27,
// PadFailed.md:51, RowSigning.md:23). Every Retry of the control — the pad's,
// the row line's, the empty sign's — is another `commit` toward the same
// target, so the seam is where the first attempt is remembered and asked
// again. A stance sums its records, so a second prepare beside a first the
// server already took would sum the pick twice.

import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { HttpResponse } from "msw/http";
import { describe, expect, it, vi } from "vitest";

import type { AuthGuard } from "@/lib/session/guard";
import { expectation, stanceRecord, type Expectation } from "@/lib/signing/intent";
import type { WriteResult, WriteSigner } from "@/lib/signing/write-signer";
import type { StagedWriteView } from "@/lib/api/writes-api";
import { gqlLink, startMswServer } from "@/test/msw";
import { createApolloStanceData } from "./apollo-stance-data";
import type { StanceTarget } from "./stance-data";

const server = startMswServer();

const POST: StanceTarget = { id: "post-1", kind: "post" };
const POST_GRAPH_ID = "mint:act:b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0:3:publish";
const PICK = { pDirected: 0.4, pInterest: 0.2 };
const OTHER_PICK = { pDirected: -0.3, pInterest: 0.1 };

const guard: AuthGuard = { run: (block) => block(), prime: async () => {}, refresh: async () => false };

function client() {
  return new ApolloClient({ cache: new InMemoryCache(), link: new HttpLink({ uri: "http://localhost/graphql" }) });
}

/** The server: every prepare stages a NEW write, as `prepare_stance` does; each write's state as set. */
function host(states: Record<string, string> = {}) {
  const prepares: { pDirected: number; pInterest: number }[] = [];
  server.use(
    gqlLink.query("PostStance", () =>
      HttpResponse.json({
        data: {
          post: {
            __typename: "Post",
            id: "post-1",
            viewerStance: {
              __typename: "StanceBundle",
              targetGraphId: POST_GRAPH_ID,
              pDirected: 0,
              pInterest: 0,
              rawPDirected: 0,
              rawPInterest: 0,
              recordCount: 0,
              inert: true,
              severed: false,
              severanceCost: 0,
              projected: null,
            },
          },
        },
      }),
    ),
    gqlLink.mutation("PrepareStance", ({ variables }) => {
      const input = variables.input as { pDirected: number; pInterest: number };
      prepares.push({ pDirected: input.pDirected, pInterest: input.pInterest });
      const id = `w-${prepares.length}`;
      return HttpResponse.json({
        data: {
          prepareStance: {
            __typename: "PreparePayload",
            writes: [{ __typename: "PreparedWrite", id, family: "OPINION", canonicalProposal: "cHJvcG9zYWw=", carried: false }],
            userErrors: [],
          },
        },
      });
    }),
    gqlLink.query("StagedWrite", ({ variables }) => {
      const id = variables.id as string;
      return HttpResponse.json({
        data: {
          stagedWrite: {
            __typename: "StagedWrite",
            id,
            state: states[id] ?? "AWAITING_APPROVAL",
            carried: false,
            family: "OPINION",
            canonicalProposal: "cHJvcG9zYWw=",
            verifiedAct: null,
            record: null,
          },
        },
      });
    }),
  );
  return prepares;
}

type Answer = (id: string) => WriteResult;
const done: Answer = (id) => ({ kind: "done", id, state: "RELAYING" });
const lost: Answer = (id) => ({ kind: "failed", id, cause: new TypeError("Failed to fetch") });
const deviceRefused: Answer = (id) => ({ kind: "rejectedByDevice", id, reason: "verification failed" });

/** A signer answering each call from the queue; `signAgain` reads as the real one's scoped re-sign. */
function signer(sign: Answer[], again: Answer[] = []) {
  const signedAgain: { ids: readonly string[]; expected: Expectation }[] = [];
  const signer: WriteSigner = {
    signStaged: vi.fn(),
    sign: vi.fn(async (writes: readonly StagedWriteView[]) => {
      const answer = sign.shift() ?? done;
      return writes.map((write) => answer(write.id));
    }),
    signAgain: vi.fn(async (ids: readonly string[], expected: Expectation) => {
      signedAgain.push({ ids, expected });
      const answer = again.shift() ?? done;
      return ids.map((id) => answer(id));
    }),
    signCarriedAtLanding: vi.fn(async () => []),
    resume: vi.fn(async () => []),
  };
  return { signer, signedAgain };
}

function accounts(start: string | null = "acct-a") {
  let active = start;
  const listeners = new Set<() => void>();
  return {
    activeAccountId: () => active,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    switchTo(next: string | null) {
      active = next;
      for (const listener of listeners) listener();
    },
  };
}

function seam(writes: WriteSigner, tab = accounts()) {
  const retired: string[] = [];
  const data = createApolloStanceData({
    client: client(),
    guard,
    signer: writes,
    store: { clearHandshake: async (id: string) => void retired.push(id) },
    accounts: tab,
  });
  return { data, retired, tab };
}

describe("a stance pick's Retry asks the same signing again", () => {
  it("a pick whose answer was lost is asked again on Retry: one prepare, the pick summed once", async () => {
    const prepares = host();
    const { signer: writes, signedAgain } = signer([lost]);
    const { data } = seam(writes);

    expect((await data.commit(POST, PICK)).kind).toBe("failed");
    const retried = await data.commit(POST, PICK);

    expect(prepares).toEqual([PICK]);
    expect(signedAgain).toEqual([
      { ids: ["w-1"], expected: expectation([stanceRecord(POST_GRAPH_ID, 0.4, 0.2)]) },
    ]);
    expect(retried).toEqual({ kind: "success", value: { records: 1 } });
  });

  it("a Retry that still gets no answer keeps the attempt: the next Retry asks it again", async () => {
    const prepares = host();
    const { signer: writes, signedAgain } = signer([lost], [lost]);
    const { data } = seam(writes);

    await data.commit(POST, PICK);
    expect((await data.commit(POST, PICK)).kind).toBe("failed");
    expect((await data.commit(POST, PICK)).kind).toBe("success");

    expect(prepares).toEqual([PICK]);
    expect(signedAgain.map((call) => call.ids)).toEqual([["w-1"], ["w-1"]]);
  });

  it("a signature the device refused is spent: Retry retires it and prepares the pick afresh", async () => {
    const prepares = host();
    const { signer: writes, signedAgain } = signer([deviceRefused], [deviceRefused]);
    const { data, retired } = seam(writes);

    await data.commit(POST, PICK);
    const retried = await data.commit(POST, PICK);

    expect(signedAgain.map((call) => call.ids)).toEqual([["w-1"]]);
    expect(retired).toEqual(["w-1"]);
    expect(prepares).toEqual([PICK, PICK]);
    expect(retried).toEqual({ kind: "success", value: { records: 1 } });
  });

  // K-REJECTED-SAME-INTENT-SKIPS-STATE-READ: the same pick, refused by the
  // device's intent check on its re-ask (the target's facts moved between the
  // presses), over a first attempt whose approval went out with its answer
  // lost. Retiring it unread would sum the pick twice.
  it("a re-ask the device refuses reads the states first: a first attempt already relaying is landing", async () => {
    const prepares = host({ "w-1": "RELAYING" });
    const { signer: writes, signedAgain } = signer([lost], [deviceRefused]);
    const { data, retired } = seam(writes);

    await data.commit(POST, PICK);
    const retried = await data.commit(POST, PICK);

    expect(signedAgain.map((call) => call.ids)).toEqual([["w-1"]]);
    expect(prepares).toEqual([PICK]);
    expect(retired).toEqual([]);
    expect(retried).toEqual({ kind: "success", value: { records: 1 } });
  });

  it("a changed pick over a first attempt the server already took signs nothing new: it is landing", async () => {
    const prepares = host({ "w-1": "RELAYING" });
    const { signer: writes, signedAgain } = signer([lost]);
    const { data, retired } = seam(writes);

    await data.commit(POST, PICK);
    const retried = await data.commit(POST, OTHER_PICK);

    expect(prepares).toEqual([PICK]);
    expect(signedAgain).toEqual([]);
    expect(retired).toEqual([]);
    expect(retried).toEqual({ kind: "success", value: { records: 1 } });
  });

  it("a changed pick over an unapproved first attempt retires it first, then signs the new pick alone", async () => {
    const prepares = host({ "w-1": "AWAITING_APPROVAL" });
    const { signer: writes, signedAgain } = signer([lost]);
    const { data, retired } = seam(writes);

    await data.commit(POST, PICK);
    const retried = await data.commit(POST, OTHER_PICK);

    expect(retired).toEqual(["w-1"]);
    expect(prepares).toEqual([PICK, OTHER_PICK]);
    expect(signedAgain).toEqual([]);
    expect(retried).toEqual({ kind: "success", value: { records: 1 } });
  });

  it("a pick that signed leaves nothing to ask again: the next pick is its own record", async () => {
    const prepares = host();
    const { signer: writes, signedAgain } = signer([done, done]);
    const { data } = seam(writes);

    await data.commit(POST, PICK);
    await data.commit(POST, PICK);

    expect(prepares).toEqual([PICK, PICK]);
    expect(signedAgain).toEqual([]);
  });

  describe("a commit while the first is still signing is not a Retry", () => {
    // The anchor refuses a second act while it signs (PadFailed.md:17, :37,
    // :41) — per control. The seam is shared, so a second surface showing the
    // same target can commit meanwhile: that is an act of its own, as on main.
    function holding() {
      let release: (answer: Answer) => void = () => {};
      const first = new Promise<Answer>((resolve) => (release = resolve));
      const signedAgain: string[][] = [];
      let calls = 0;
      const writes: WriteSigner = {
        signStaged: vi.fn(),
        sign: vi.fn(async (staged: readonly StagedWriteView[]) => {
          calls += 1;
          const answer = calls === 1 ? await first : done;
          return staged.map((write) => answer(write.id));
        }),
        signAgain: vi.fn(async (ids: readonly string[]) => {
          signedAgain.push([...ids]);
          return ids.map((id) => done(id));
        }),
        signCarriedAtLanding: vi.fn(async () => []),
        resume: vi.fn(async () => []),
      };
      return { writes, signedAgain, release: (answer: Answer) => release(answer) };
    }

    /** Lets the first commit reach its signing before the second starts. */
    const reachSigning = (writes: WriteSigner) => vi.waitFor(() => expect(writes.sign).toHaveBeenCalledTimes(1));

    it("the same pick is its own record: nothing of the first is signed twice at once", async () => {
      const prepares = host();
      const { writes, signedAgain, release } = holding();
      const { data, retired } = seam(writes);

      const first = data.commit(POST, PICK);
      await reachSigning(writes);
      const second = await data.commit(POST, PICK);

      expect(signedAgain).toEqual([]);
      expect(retired).toEqual([]);
      expect(prepares).toEqual([PICK, PICK]);
      expect(second).toEqual({ kind: "success", value: { records: 1 } });
      release(done);
      expect((await first).kind).toBe("success");
    });

    it("a changed pick never retires the material the first is signing with", async () => {
      const prepares = host({ "w-1": "AWAITING_APPROVAL" });
      const { writes, signedAgain, release } = holding();
      const { data, retired } = seam(writes);

      const first = data.commit(POST, PICK);
      await reachSigning(writes);
      await data.commit(POST, OTHER_PICK);

      expect(retired).toEqual([]);
      expect(signedAgain).toEqual([]);
      expect(prepares).toEqual([PICK, OTHER_PICK]);
      release(done);
      await first;
    });

    it("a changed pick is signed, not dropped as landing, when the first is already relaying", async () => {
      const prepares = host({ "w-1": "RELAYING" });
      const { writes, release } = holding();
      const { data } = seam(writes);

      const first = data.commit(POST, PICK);
      await reachSigning(writes);
      const second = await data.commit(POST, OTHER_PICK);

      expect(prepares).toEqual([PICK, OTHER_PICK]);
      expect(second).toEqual({ kind: "success", value: { records: 1 } });
      release(done);
      await first;
    });

    it("the first keeps its own memory: once it answers not done, a Retry asks it again", async () => {
      const prepares = host();
      const { writes, signedAgain, release } = holding();
      const { data } = seam(writes);

      const first = data.commit(POST, PICK);
      await reachSigning(writes);
      await data.commit(POST, PICK);
      release(lost);
      expect((await first).kind).toBe("failed");
      await data.commit(POST, PICK);

      expect(prepares).toEqual([PICK, PICK]);
      expect(signedAgain).toEqual([["w-1"]]);
    });
  });

  it("an account boundary never hands the attempt over: the next account's pick is prepared for it", async () => {
    const prepares = host();
    const { signer: writes, signedAgain } = signer([lost]);
    const { data, tab } = seam(writes);

    await data.commit(POST, PICK);
    tab.switchTo("acct-b");
    await data.commit(POST, PICK);

    expect(signedAgain).toEqual([]);
    expect(prepares).toEqual([PICK, PICK]);
  });

  // THE ATTEMPT IS THE PRESSING ACCOUNT'S (auth.md "Multi-account device
  // custody": bound "to the account it belongs to, never to a device-global
  // slot"): never asked under another account, there again under its own,
  // so its Retry asks the same signing (SigningAfterClose.md:27) rather than
  // preparing afresh beside stagings the server may still hold.
  describe("an attempt is kept beside the account that pressed it", () => {
    it("comes back with its account: the Retry asks the same signing, prepared once", async () => {
      const prepares = host();
      const { signer: writes, signedAgain } = signer([lost]);
      const { data, tab } = seam(writes);

      expect((await data.commit(POST, PICK)).kind).toBe("failed");
      tab.switchTo("acct-b");
      tab.switchTo("acct-a");
      const retried = await data.commit(POST, PICK);

      expect(prepares).toEqual([PICK]);
      expect(signedAgain.map((call) => call.ids)).toEqual([["w-1"]]);
      expect(retried).toEqual({ kind: "success", value: { records: 1 } });
    });

    it("is never asked under another account's commit, and is still there for its own", async () => {
      const prepares = host();
      const { signer: writes, signedAgain } = signer([lost]);
      const { data, tab } = seam(writes);

      await data.commit(POST, PICK);
      tab.switchTo("acct-b");
      expect((await data.commit(POST, PICK)).kind).toBe("success");
      expect(signedAgain).toEqual([]);
      tab.switchTo("acct-a");
      await data.commit(POST, PICK);

      expect(prepares).toEqual([PICK, PICK]);
      expect(signedAgain.map((call) => call.ids)).toEqual([["w-1"]]);
    });

    it("answers into its own account's memory when the switch comes while it signs", async () => {
      const prepares = host();
      let release: (answer: Answer) => void = () => {};
      const first = new Promise<Answer>((resolve) => (release = resolve));
      const signedAgain: string[][] = [];
      let calls = 0;
      const writes: WriteSigner = {
        signStaged: vi.fn(),
        sign: vi.fn(async (staged: readonly StagedWriteView[]) => {
          calls += 1;
          const answer = calls === 1 ? await first : lost;
          return staged.map((write) => answer(write.id));
        }),
        signAgain: vi.fn(async (ids: readonly string[]) => {
          signedAgain.push([...ids]);
          return ids.map((id) => done(id));
        }),
        signCarriedAtLanding: vi.fn(async () => []),
        resume: vi.fn(async () => []),
      };
      const { data, tab } = seam(writes);

      const pressedByA = data.commit(POST, PICK);
      await vi.waitFor(() => expect(writes.sign).toHaveBeenCalledTimes(1));
      tab.switchTo("acct-b");
      // B's own pick toward the same target fails too: its attempt is B's.
      expect((await data.commit(POST, OTHER_PICK)).kind).toBe("failed");
      release(lost);
      expect((await pressedByA).kind).toBe("failed");

      tab.switchTo("acct-a");
      await data.commit(POST, PICK);
      expect(signedAgain).toEqual([["w-1"]]);
      tab.switchTo("acct-b");
      await data.commit(POST, OTHER_PICK);
      expect(signedAgain).toEqual([["w-1"], ["w-2"]]);
      expect(prepares).toEqual([PICK, OTHER_PICK]);
    });
  });
});
