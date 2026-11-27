// The kept picks' seal Retry asks the whole batch to sign again — the SAME
// batch (KeptPicksSeal.md:33, :63: "the whole batch is asked to sign again";
// SigningAfterClose.md:27). Each pick in it is its own `prepareStance`, and the
// server stages every one as a new record (crates/api stance.rs
// `prepare_stance`: no in-flight rule) in a bundle that SUMS: a Retry that
// prepares the batch afresh after a first one the server took sums every pick
// in it twice.

import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { HttpResponse } from "msw/http";
import { describe, expect, it, vi } from "vitest";

import type { AuthGuard } from "@/lib/session/guard";
import { expectation, joinExpectations, stanceRecord, type Expectation } from "@/lib/signing/intent";
import type { WriteResult, WriteSigner } from "@/lib/signing/write-signer";
import type { StagedWriteView } from "@/lib/api/writes-api";
import { gqlLink, startMswServer } from "@/test/msw";
import { createApolloStanceData } from "./apollo-stance-data";
import type { StanceTarget } from "./stance-data";

const server = startMswServer();

const POST: StanceTarget = { id: "post-1", kind: "post" };
const OTHER: StanceTarget = { id: "post-2", kind: "post" };
const NODE_1 = "mint:act:b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0:3:publish";
const NODE_2 = "mint:act:c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0:4:publish";
const BATCH = [
  { target: POST, pick: { pDirected: 0.4, pInterest: 0.2 } },
  { target: OTHER, pick: { pDirected: -0.1, pInterest: 0.3 } },
];
const BATCH_EXPECTED = joinExpectations([
  expectation([stanceRecord(NODE_1, 0.4, 0.2)]),
  expectation([stanceRecord(NODE_2, -0.1, 0.3)]),
]);

const guard: AuthGuard = { run: (block) => block(), prime: async () => {}, refresh: async () => false };

function client() {
  return new ApolloClient({ cache: new InMemoryCache(), link: new HttpLink({ uri: "http://localhost/graphql" }) });
}

function bundle(id: string, node: string) {
  return {
    __typename: "Post",
    id,
    viewerStance: {
      __typename: "StanceBundle",
      targetGraphId: node,
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
  };
}

/** The server: every prepare stages a new record; each write's state as set. */
function host(states: Record<string, string> = {}) {
  const prepares: { target: string; pDirected: number; pInterest: number }[] = [];
  server.use(
    gqlLink.query("PostStance", ({ variables }) =>
      HttpResponse.json({
        data: { post: variables.id === "post-1" ? bundle("post-1", NODE_1) : bundle("post-2", NODE_2) },
      }),
    ),
    gqlLink.mutation("PrepareStance", ({ variables }) => {
      const input = variables.input as { target: string; pDirected: number; pInterest: number };
      prepares.push({ target: input.target, pDirected: input.pDirected, pInterest: input.pInterest });
      return HttpResponse.json({
        data: {
          prepareStance: {
            __typename: "PreparePayload",
            writes: [
              { __typename: "PreparedWrite", id: `w-${prepares.length}`, family: "OPINION", canonicalProposal: "cHJvcG9zYWw=", carried: false },
            ],
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

describe("the kept picks' Retry asks the same batch again", () => {
  it("a batch whose answer was lost is asked again whole: each pick prepared once", async () => {
    const prepares = host();
    const { writes, signedAgain } = signer([lost]);
    const { data } = seam(writes);

    expect((await data.commitBatch(BATCH)).kind).toBe("failed");
    const retried = await data.commitBatch(BATCH);

    expect(prepares).toHaveLength(2);
    expect(signedAgain).toEqual([{ ids: ["w-1", "w-2"], expected: BATCH_EXPECTED }]);
    expect(retried).toEqual({ kind: "success", value: { records: 2 } });
  });

  // K-ASKED-AGAIN-MIXED-EXPIRY: one pick's write expired while another's is
  // still unanswered has not expired whole: the batch reads as no answer —
  // the Settings row's `That didn't sign.` with Retry (KeptPicksSeal.md:63) —
  // never the bug notice a lone refusal reads as, and its Retry asks the same
  // batch again.
  it("a re-ask with one write expired and one unanswered reads as no answer and keeps the batch", async () => {
    const prepares = host();
    const mixed: Answer = (id) =>
      id === "w-1"
        ? { kind: "refused", id, errors: [{ code: "STAGED_WRITE_EXPIRED", message: "garbage-collected unlanded", field: null }] }
        : lost(id);
    const { writes, signedAgain } = signer([lost], [mixed]);
    const { data, retired } = seam(writes);

    await data.commitBatch(BATCH);
    const reasked = await data.commitBatch(BATCH);
    const again = await data.commitBatch(BATCH);

    expect(reasked.kind).toBe("failed");
    expect(retired).toEqual([]);
    expect(prepares).toHaveLength(2);
    expect(signedAgain.map((call) => call.ids)).toEqual([
      ["w-1", "w-2"],
      ["w-1", "w-2"],
    ]);
    expect(again).toEqual({ kind: "success", value: { records: 2 } });
  });

  it("a batch the device refused is spent: Retry retires it and prepares the batch afresh", async () => {
    const prepares = host();
    const { writes } = signer([deviceRefused], [deviceRefused]);
    const { data, retired } = seam(writes);

    await data.commitBatch(BATCH);
    const retried = await data.commitBatch(BATCH);

    expect(retired).toEqual(["w-1", "w-2"]);
    expect(prepares).toHaveLength(4);
    expect(retried.kind).toBe("success");
  });

  it("a batch whose picks changed retires an unapproved first batch, then signs the new one alone", async () => {
    const prepares = host();
    const { writes, signedAgain } = signer([lost]);
    const { data, retired } = seam(writes);

    await data.commitBatch(BATCH);
    const retried = await data.commitBatch(BATCH.slice(0, 1));

    expect(signedAgain).toEqual([]);
    expect(retired).toEqual(["w-1", "w-2"]);
    expect(prepares).toHaveLength(3);
    expect(retried).toEqual({ kind: "success", value: { records: 1 } });
  });

  it("a batch whose picks changed over a first batch already relaying signs nothing new: it is landing", async () => {
    const prepares = host({ "w-1": "RELAYING", "w-2": "RELAYING" });
    const { writes } = signer([lost]);
    const { data, retired } = seam(writes);

    await data.commitBatch(BATCH);
    const retried = await data.commitBatch(BATCH.slice(0, 1));

    expect(prepares).toHaveLength(2);
    expect(retired).toEqual([]);
    expect(retried).toEqual({ kind: "success", value: { records: 2 } });
  });

  it("a batch while another is still signing is an act of its own", async () => {
    const prepares = host();
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

    const asking = data.commitBatch(BATCH);
    await vi.waitFor(() => expect(writes.sign).toHaveBeenCalledTimes(1));
    await data.commitBatch(BATCH);

    expect(signedAgain).toEqual([]);
    expect(retired).toEqual([]);
    expect(prepares).toHaveLength(4);
    release(done);
    await asking;
  });
});
