// A CHANGED KEPT BATCH THAT FINDS THE FIRST ONE LANDING (K-KEPT-BATCH-LANDING-
// DROPS-UNSIGNED; seam 495.5 / 496 / 498). The seal's first batch is taken
// with its answer lost; the reader changes the kept set before Retry; the
// re-ask finds the first batch relaying, and nothing else is signed
// (SigningAfterClose.md:27). "The count of the batch" (KeptPicksSeal.md:31) is
// the batch that was TAKEN: count and drop what the first batch held. A pick
// it did not hold was never signed and stays kept — dropping it would erase
// it silently.

import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { HttpResponse } from "msw/http";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { StagedWriteView } from "@/lib/api/writes-api";
import type { AuthGuard } from "@/lib/session/guard";
import { tokenStore } from "@/lib/session/token-store";
import type { WriteResult, WriteSigner } from "@/lib/signing/write-signer";
import { carrySnackbar } from "@/lib/ui/carried-snackbar";
import { gqlLink, startMswServer } from "@/test/msw";
import { createApolloStanceData } from "./apollo-stance-data";
import { resetKeptBatchForTests, signKeptBatch } from "./kept-batch";
import { dropKeptPicks, keepPick, listKeptPicks } from "./kept-picks";
import { markSettling } from "./settling";
import type { KeptEntry, StanceTarget } from "./stance-data";

vi.mock("@/lib/ui/carried-snackbar", () => ({ carrySnackbar: vi.fn() }));
vi.mock("./settling", () => ({ markSettling: vi.fn() }));

const server = startMswServer();

const ACCOUNT = "acct-a";
const ADA: StanceTarget = { kind: "post", id: "post-ada" };
const MIRA: StanceTarget = { kind: "post", id: "post-mira" };
const NEW: StanceTarget = { kind: "post", id: "post-new" };
const pickOf = (pDirected: number) => ({ pDirected, pInterest: 0.2 });
const FIRST: readonly KeptEntry[] = [
  { target: ADA, pick: pickOf(0.1) },
  { target: MIRA, pick: pickOf(0.5) },
];

const guard: AuthGuard = { run: (block) => block(), prime: async () => {}, refresh: async () => false };

function bundle(id: string) {
  return {
    __typename: "Post",
    id,
    viewerStance: {
      __typename: "StanceBundle",
      targetGraphId: `mint:act:${id}:1:publish`,
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

/** The server: every prepare stages one write; every staged write reads RELAYING (the first batch was taken). */
function host() {
  const prepares: string[] = [];
  server.use(
    gqlLink.query("PostStance", ({ variables }) => HttpResponse.json({ data: { post: bundle(variables.id as string) } })),
    gqlLink.mutation("PrepareStance", ({ variables }) => {
      prepares.push((variables.input as { target: string }).target);
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
    gqlLink.query("StagedWrite", ({ variables }) =>
      HttpResponse.json({
        data: {
          stagedWrite: {
            __typename: "StagedWrite",
            id: variables.id as string,
            state: "RELAYING",
            carried: false,
            family: "OPINION",
            canonicalProposal: "cHJvcG9zYWw=",
            verifiedAct: null,
            record: null,
          },
        },
      }),
    ),
  );
  return prepares;
}

/** The first signing's answer is lost on the way back; the server took it. */
function lostOnce(): WriteSigner {
  let calls = 0;
  const answer = (id: string): WriteResult =>
    calls === 1 ? { kind: "failed", id, cause: new TypeError("Failed to fetch") } : { kind: "done", id, state: "RELAYING" };
  return {
    signStaged: vi.fn(),
    sign: vi.fn(async (staged: readonly StagedWriteView[]) => {
      calls += 1;
      return staged.map((write) => answer(write.id));
    }),
    signAgain: vi.fn(async (ids: readonly string[]) => ids.map((id) => answer(id))),
    signCarriedAtLanding: vi.fn(async () => []),
    resume: vi.fn(async () => []),
  };
}

function seam() {
  const data = createApolloStanceData({
    client: new ApolloClient({ cache: new InMemoryCache(), link: new HttpLink({ uri: "http://localhost/graphql" }) }),
    guard,
    signer: lostOnce(),
    store: { clearHandshake: async () => {} },
    accounts: { activeAccountId: () => ACCOUNT, subscribe: () => () => {} },
  });
  return (entries: readonly KeptEntry[]) => data.commitBatch(entries);
}

/** The kept store's opinions, by target id and pair. */
async function kept() {
  return (await listKeptPicks(ACCOUNT)).map((pick) => [pick.target.id, pick.pick.pDirected]);
}

beforeEach(async () => {
  resetKeptBatchForTests();
  vi.mocked(carrySnackbar).mockClear();
  vi.mocked(markSettling).mockClear();
  tokenStore.save({ accessToken: "access", refreshToken: "refresh", accountId: ACCOUNT });
  for (const { target, pick } of FIRST) await keepPick(ACCOUNT, target, pick);
});

describe("a changed kept batch over a first batch that is landing", () => {
  it("keeps a pick the first batch never held, and counts only the first batch", async () => {
    const prepares = host();
    const commit = seam();
    expect((await signKeptBatch(commit, FIRST)).kind).toBe("failed");
    // The key went and came back; a new pick was kept meanwhile.
    await keepPick(ACCOUNT, NEW, pickOf(0.9));
    const changed = [...FIRST, { target: NEW, pick: pickOf(0.9) }];

    expect((await signKeptBatch(commit, changed)).kind).toBe("success");

    expect(prepares).toHaveLength(2);
    expect(await kept()).toEqual([["post-new", 0.9]]);
    expect(carrySnackbar).toHaveBeenCalledWith("Signed 2 things, still settling.");
    expect(markSettling).toHaveBeenCalledWith([ADA, MIRA]);
  });

  it("counts a pick removed since, which landed with the first batch", async () => {
    host();
    const commit = seam();
    await signKeptBatch(commit, FIRST);
    await dropKeptPicks(ACCOUNT, [MIRA]);

    expect((await signKeptBatch(commit, FIRST.slice(0, 1))).kind).toBe("success");

    expect(await kept()).toEqual([]);
    expect(carrySnackbar).toHaveBeenCalledWith("Signed 2 things, still settling.");
    expect(markSettling).toHaveBeenCalledWith([ADA, MIRA]);
  });

  it("keeps a target's pick that changed since: the first batch signed the old pair, not the kept one", async () => {
    host();
    const commit = seam();
    await signKeptBatch(commit, FIRST);
    await keepPick(ACCOUNT, MIRA, pickOf(-0.3));
    const changed = [FIRST[0], { target: MIRA, pick: pickOf(-0.3) }];

    expect((await signKeptBatch(commit, changed)).kind).toBe("success");

    expect(await kept()).toEqual([["post-mira", -0.3]]);
    expect(carrySnackbar).toHaveBeenCalledWith("Signed 2 things, still settling.");
  });
});
