// The walk-back's Retry asks the same signing again (SigningAfterClose.md:27;
// SeveranceConfirm.md:33-35: "Walk it back reads Retry AND nothing is walked
// back"). The server computes a severance batch against the PENDING-INCLUSIVE
// standing (crates/api stance.rs `prepare_severance`): a first batch it holds
// nets the bundle to (0, 0), so a second prepare is refused BAD_INPUT "the
// bundle toward this target already nets to (0, 0)" — a Retry that prepares
// afresh is dead while the first is landing or parked. And a first batch the
// server never saw (its submit died unseen) is not counted, so a fresh prepare
// stages the whole walk-back a second time beside it, which Home's Resume would
// land too: the bundle walked back twice, past (0, 0).

import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { HttpResponse } from "msw/http";
import { describe, expect, it, vi } from "vitest";

import type { AuthGuard } from "@/lib/session/guard";
import { expectation, severance, type Expectation } from "@/lib/signing/intent";
import type { WriteResult, WriteSigner } from "@/lib/signing/write-signer";
import type { StagedWriteView } from "@/lib/api/writes-api";
import { gqlLink, startMswServer } from "@/test/msw";
import { createApolloStanceData } from "./apollo-stance-data";
import type { StanceBundle, StanceTarget } from "./stance-data";

const server = startMswServer();

const POST: StanceTarget = { id: "post-1", kind: "post" };
const POST_GRAPH_ID = "mint:act:b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0:3:publish";

/** What the reader confirmed: (1.4, 0.6) in two records' cost. */
const SHOWN: StanceBundle = {
  current: { pDirected: 1, pInterest: 0.6 },
  rawSum: { pDirected: 1.4, pInterest: 0.6 },
  records: 2,
  inert: false,
  severed: false,
  severance: { records: 2 },
};
const WALK_BACK = expectation([], [severance(POST_GRAPH_ID, { rawPDirected: 1.4, rawPInterest: 0.6, cost: 2 })]);

const guard: AuthGuard = { run: (block) => block(), prime: async () => {}, refresh: async () => false };

function client() {
  return new ApolloClient({ cache: new InMemoryCache(), link: new HttpLink({ uri: "http://localhost/graphql" }) });
}

/**
 * The server: a severance batch it holds (`held`) is in the pending-inclusive
 * standing, so the next prepare is refused; one it never saw is not, and the
 * next prepare stages the whole walk-back again.
 */
function host(opts: { held: boolean; states?: Record<string, string> }) {
  const batches: string[][] = [];
  const stances: { pDirected: number; pInterest: number }[] = [];
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
              pDirected: 1,
              pInterest: 0.6,
              rawPDirected: 1.4,
              rawPInterest: 0.6,
              recordCount: 2,
              inert: false,
              severed: false,
              severanceCost: 2,
              projected: null,
            },
          },
        },
      }),
    ),
    gqlLink.mutation("PrepareSeverance", () => {
      if (batches.length > 0 && opts.held) {
        return HttpResponse.json({
          data: {
            prepareSeverance: {
              __typename: "PreparePayload",
              writes: [],
              userErrors: [
                {
                  __typename: "UserError",
                  code: "BAD_INPUT",
                  field: ["target"],
                  message: "the bundle toward this target already nets to (0, 0)",
                },
              ],
            },
          },
        });
      }
      const n = batches.length;
      const ids = [`s-${n * 2 + 1}`, `s-${n * 2 + 2}`];
      batches.push(ids);
      return HttpResponse.json({
        data: {
          prepareSeverance: {
            __typename: "PreparePayload",
            writes: ids.map((id) => ({
              __typename: "PreparedWrite",
              id,
              family: "OPINION",
              canonicalProposal: "cHJvcG9zYWw=",
              carried: false,
            })),
            userErrors: [],
          },
        },
      });
    }),
    gqlLink.mutation("PrepareStance", ({ variables }) => {
      const input = variables.input as { pDirected: number; pInterest: number };
      stances.push({ pDirected: input.pDirected, pInterest: input.pInterest });
      return HttpResponse.json({
        data: {
          prepareStance: {
            __typename: "PreparePayload",
            writes: [{ __typename: "PreparedWrite", id: `p-${stances.length}`, family: "OPINION", canonicalProposal: "cHJvcG9zYWw=", carried: false }],
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
            state: opts.states?.[id] ?? "AWAITING_APPROVAL",
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
  return { batches, stances };
}

type Answer = (id: string) => WriteResult;
const done: Answer = (id) => ({ kind: "done", id, state: "RELAYING" });
const lost: Answer = (id) => ({ kind: "failed", id, cause: new TypeError("Failed to fetch") });
const deviceRefused: Answer = (id) => ({ kind: "rejectedByDevice", id, reason: "verification failed" });

function signer(sign: Answer[], again: Answer[] = []) {
  const signedAgain: { ids: readonly string[]; expected: Expectation }[] = [];
  const writes: WriteSigner = {
    signStaged: vi.fn(),
    sign: vi.fn(async (staged: readonly StagedWriteView[]) => {
      const answer = sign.shift() ?? done;
      return staged.map((write) => answer(write.id));
    }),
    signAgain: vi.fn(async (ids: readonly string[], expected: Expectation) => {
      signedAgain.push({ ids, expected });
      const answer = again.shift() ?? done;
      return ids.map((id) => answer(id));
    }),
    signCarriedAtLanding: vi.fn(async () => []),
    resume: vi.fn(async () => []),
  };
  return { writes, signedAgain };
}

function seam(writes: WriteSigner) {
  const retired: string[] = [];
  const data = createApolloStanceData({
    client: client(),
    guard,
    signer: writes,
    store: { clearHandshake: async (id: string) => void retired.push(id) },
    accounts: { activeAccountId: () => "acct-a", subscribe: () => () => {} },
  });
  return { data, retired };
}

describe("the walk-back's Retry asks the same signing again", () => {
  it("a walk-back whose answer was lost is asked again, not refused as already netted", async () => {
    const { batches } = host({ held: true });
    const { writes, signedAgain } = signer([lost]);
    const { data } = seam(writes);

    expect((await data.sever(POST, SHOWN)).kind).toBe("failed");
    const retried = await data.sever(POST, SHOWN);

    expect(batches).toEqual([["s-1", "s-2"]]);
    expect(signedAgain).toEqual([{ ids: ["s-1", "s-2"], expected: WALK_BACK }]);
    expect(retried).toEqual({ kind: "success", value: { records: 2 } });
  });

  it("a walk-back the server never saw is asked again: one batch, never two that Resume would both land", async () => {
    const { batches } = host({ held: false });
    const { writes, signedAgain } = signer([lost]);
    const { data } = seam(writes);

    await data.sever(POST, SHOWN);
    await data.sever(POST, SHOWN);

    expect(batches).toEqual([["s-1", "s-2"]]);
    expect(signedAgain.map((call) => call.ids)).toEqual([["s-1", "s-2"]]);
  });

  it("a walk-back the device refused is spent: Retry retires it and prepares the walk-back afresh", async () => {
    const { batches } = host({ held: false });
    const { writes } = signer([deviceRefused], [deviceRefused]);
    const { data, retired } = seam(writes);

    await data.sever(POST, SHOWN);
    const retried = await data.sever(POST, SHOWN);

    expect(retired).toEqual(["s-1", "s-2"]);
    expect(batches).toEqual([
      ["s-1", "s-2"],
      ["s-3", "s-4"],
    ]);
    expect(retried.kind).toBe("success");
  });

  // K-REJECTED-SAME-INTENT-SKIPS-STATE-READ: the same walk-back, its re-ask
  // refused by the device's intent check, over a first walk-back whose
  // approvals went out with their answer lost.
  it("a re-ask the device refuses reads the states first: a walk-back already relaying is landing", async () => {
    const { batches } = host({ held: true, states: { "s-1": "RELAYING", "s-2": "RELAYING" } });
    const { writes } = signer([lost], [deviceRefused]);
    const { data, retired } = seam(writes);

    await data.sever(POST, SHOWN);
    const retried = await data.sever(POST, SHOWN);

    expect(batches).toEqual([["s-1", "s-2"]]);
    expect(retired).toEqual([]);
    expect(retried).toEqual({ kind: "success", value: { records: 2 } });
  });

  describe("a pick and a walk-back are different gestures: across kinds, main's road", () => {
    // This fixes the same-kind Retry only. A gesture of the other kind toward
    // the same target neither retires nor lands on the other's attempt: it
    // is prepared and signed as on main, and the server nets what it holds.
    const PICK = { pDirected: 0.2, pInterest: 0.1 };

    it("A1: a pick after a walk-back the server is relaying IS signed, the walk-back untouched", async () => {
      const { batches, stances } = host({ held: true, states: { "s-1": "RELAYING", "s-2": "RELAYING" } });
      const { writes, signedAgain } = signer([lost]);
      const { data, retired } = seam(writes);

      await data.sever(POST, SHOWN);
      const picked = await data.commit(POST, PICK);

      expect(stances).toEqual([PICK]);
      expect(picked).toEqual({ kind: "success", value: { records: 1 } });
      expect(batches).toHaveLength(1);
      expect(retired).toEqual([]);
      expect(signedAgain).toEqual([]);
    });

    it("A: a pick after an unapproved walk-back is prepared, and the walk-back stays parked", async () => {
      const { batches, stances } = host({ held: false });
      const { writes, signedAgain } = signer([lost]);
      const { data, retired } = seam(writes);

      await data.sever(POST, SHOWN);
      await data.commit(POST, PICK);

      expect(signedAgain).toEqual([]);
      expect(retired).toEqual([]);
      expect(batches).toHaveLength(1);
      expect(stances).toEqual([PICK]);
    });

    it("B1: a walk-back after a pick the server is relaying IS prepared and signed", async () => {
      const { batches } = host({ held: false, states: { "p-1": "RELAYING" } });
      const { writes, signedAgain } = signer([lost]);
      const { data, retired } = seam(writes);

      await data.commit(POST, PICK);
      const walked = await data.sever(POST, SHOWN);

      expect(batches).toHaveLength(1);
      expect(walked).toEqual({ kind: "success", value: { records: 2 } });
      expect(retired).toEqual([]);
      expect(signedAgain).toEqual([]);
    });

    it("B2: a walk-back after a pick the server never saw is signed; the pick is neither retired nor asked", async () => {
      const { batches } = host({ held: false, states: { "p-1": "AWAITING_PRE_SIGN" } });
      const { writes, signedAgain } = signer([lost]);
      const { data, retired } = seam(writes);

      await data.commit(POST, PICK);
      const walked = await data.sever(POST, SHOWN);

      expect(retired).toEqual([]);
      expect(signedAgain).toEqual([]);
      expect(batches).toHaveLength(1);
      expect(walked.kind).toBe("success");
    });

    it("a walk-back's own Retry still asks its own batch after a pick in between", async () => {
      const { batches, stances } = host({ held: false });
      const { writes, signedAgain } = signer([lost]);
      const { data } = seam(writes);

      await data.sever(POST, SHOWN);
      await data.commit(POST, PICK);
      await data.sever(POST, SHOWN);

      expect(stances).toEqual([PICK]);
      expect(batches).toHaveLength(1);
      expect(signedAgain.map((call) => call.ids)).toEqual([["s-1", "s-2"]]);
    });
  });

  it("a walk-back while another toward the target still signs is an act of its own", async () => {
    const { batches } = host({ held: false });
    let release: (answer: Answer) => void = () => {};
    const first = new Promise<Answer>((resolve) => (release = resolve));
    let calls = 0;
    const signedAgain: string[][] = [];
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
    const { data, retired } = seam(writes);

    const asking = data.sever(POST, SHOWN);
    await vi.waitFor(() => expect(writes.sign).toHaveBeenCalledTimes(1));
    await data.sever(POST, SHOWN);

    expect(signedAgain).toEqual([]);
    expect(retired).toEqual([]);
    expect(batches).toHaveLength(2);
    release(done);
    await asking;
  });
});
