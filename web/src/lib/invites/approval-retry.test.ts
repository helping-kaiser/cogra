// The approval pad's Retry after an approval that landed asks the vouch's
// signing again, never the approval (ApprovePad.md:51-53, SigningAfterClose.md:27).
// `approveApplicants` IS the vouch's prepare, and the server marks the row
// approved there (crates/api onboarding.rs `still_waiting`): a second call
// answers BAD_INPUT "already approved", so a Retry that re-approves is dead.
// The app's twin is ApprovalPad.kt `approvalLanded`.

import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { HttpResponse } from "msw/http";
import { describe, expect, it, vi } from "vitest";

import type { ApplicationView } from "@/lib/api/invites-api";
import type { StagedWriteView } from "@/lib/api/writes-api";
import type { AuthGuard } from "@/lib/session/guard";
import { expectation, stanceRecord, type Expectation } from "@/lib/signing/intent";
import type { WriteResult, WriteSigner } from "@/lib/signing/write-signer";
import { gqlLink, startMswServer } from "@/test/msw";
import { createApprovalStanceData, createAskStanceData } from "./approval-stance-data";

const server = startMswServer();

const PICK = { pDirected: 0.1, pInterest: 0.1 };
const OTHER_PICK = { pDirected: 0.5, pInterest: 0.2 };
const NODE = "mint:act:a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1:0:profile";

const guard: AuthGuard = { run: (block) => block(), prime: async () => {}, refresh: async () => false };
const base = { keyBackedUp: async () => true };

function client() {
  return new ApolloClient({ cache: new InMemoryCache(), link: new HttpLink({ uri: "http://localhost/graphql" }) });
}

let rows = 0;
/** A fresh applicant per test, so no test meets another's memory. */
function application(): ApplicationView {
  rows += 1;
  return {
    __typename: "Application",
    id: `app-${rows}`,
    handle: "freshjoiner",
    emailVerified: true,
    keyAttached: true,
    graphId: NODE,
    createdAt: "2026-11-26T10:00:00Z",
    approvedAt: null,
    rejectedAt: null,
    landedAt: null,
    inviteLink: null,
  } as ApplicationView;
}

/** The server: the first approval stages the vouch and marks the row approved; every later one is refused. */
function host(row?: () => ApplicationView) {
  const approvals: { pDirected: number; pInterest: number }[] = [];
  const stages: string[] = [];
  server.use(
    gqlLink.mutation("ApproveApplicants", ({ variables }) => {
      const input = variables.input as { approvals: { pDirected: number; pInterest: number }[] };
      approvals.push({ pDirected: input.approvals[0].pDirected, pInterest: input.approvals[0].pInterest });
      const first = approvals.length === 1;
      return HttpResponse.json({
        data: {
          approveApplicants: {
            __typename: "PreparePayload",
            writes: first
              ? [{ __typename: "PreparedWrite", id: "v-1", family: "OPINION", canonicalProposal: "cHJvcG9zYWw=" }]
              : [],
            userErrors: first
              ? []
              : [{ __typename: "UserError", code: "BAD_INPUT", field: ["application"], message: "already approved" }],
          },
        },
      });
    }),
    gqlLink.mutation("StageApplicant", ({ variables }) => {
      stages.push((variables.input as { askLink: string }).askLink);
      return HttpResponse.json({
        data: { stageApplicant: { __typename: "StageApplicantPayload", application: row?.(), userErrors: [] } },
      });
    }),
  );
  return { approvals, stages };
}

type Answer = (id: string) => WriteResult;
const done: Answer = (id) => ({ kind: "done", id, state: "RELAYING" });
const lost: Answer = (id) => ({ kind: "failed", id, cause: new TypeError("Failed to fetch") });
const internal: Answer = (id) => ({
  kind: "refused",
  id,
  errors: [{ code: "INTERNAL", message: "relay unavailable", field: null }],
});

function signer(sign: Answer[], again: Answer[] = []) {
  const signedAgain: { ids: readonly string[]; expected: Expectation }[] = [];
  const signed: string[][] = [];
  const writes: WriteSigner = {
    signStaged: vi.fn(),
    sign: vi.fn(async (staged: readonly StagedWriteView[]) => {
      signed.push(staged.map((write) => write.id));
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
  return { writes, signed, signedAgain };
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

const TARGET = { kind: "profile", id: "applicant" } as const;
const VOUCH = expectation([stanceRecord(NODE, 0.1, 0.1)]);

describe("the approval pad's Retry after a landed approval", () => {
  it("asks the vouch's signing again when it was refused: the approval is sent once", async () => {
    const { approvals } = host();
    const { writes, signedAgain } = signer([internal]);
    const row = application();
    const data = createApprovalStanceData({ client: client(), guard, signer: writes, base }, row);

    expect((await data.commit(TARGET, PICK)).kind).toBe("refused");
    const retried = await data.commit(TARGET, PICK);

    expect(approvals).toEqual([PICK]);
    expect(signedAgain).toEqual([{ ids: ["v-1"], expected: VOUCH }]);
    expect(retried).toEqual({ kind: "success", value: { records: 1 } });
  });

  it("asks the vouch's signing again when its answer was lost", async () => {
    const { approvals } = host();
    const { writes, signedAgain } = signer([lost]);
    const data = createApprovalStanceData({ client: client(), guard, signer: writes, base }, application());

    expect((await data.commit(TARGET, PICK)).kind).toBe("failed");
    expect((await data.commit(TARGET, PICK)).kind).toBe("success");

    expect(approvals).toEqual([PICK]);
    expect(signedAgain.map((call) => call.ids)).toEqual([["v-1"]]);
  });

  it("holds the landed approval for the applicant across a re-read of the row", async () => {
    // Invites builds its seam from the row it read, so a re-read builds a new one.
    const { approvals } = host();
    const { writes, signedAgain } = signer([internal]);
    const row = application();
    await createApprovalStanceData({ client: client(), guard, signer: writes, base }, row).commit(TARGET, PICK);
    const reread = { ...row };
    const retried = await createApprovalStanceData({ client: client(), guard, signer: writes, base }, reread).commit(
      TARGET,
      PICK,
    );

    expect(approvals).toEqual([PICK]);
    expect(signedAgain.map((call) => call.ids)).toEqual([["v-1"]]);
    expect(retried.kind).toBe("success");
  });

  it("a Retry that is refused again keeps the vouch: the next Retry asks it once more", async () => {
    const { approvals } = host();
    const { writes, signedAgain } = signer([internal], [internal]);
    const data = createApprovalStanceData({ client: client(), guard, signer: writes, base }, application());

    await data.commit(TARGET, PICK);
    expect((await data.commit(TARGET, PICK)).kind).toBe("refused");
    expect((await data.commit(TARGET, PICK)).kind).toBe("success");

    expect(approvals).toEqual([PICK]);
    expect(signedAgain.map((call) => call.ids)).toEqual([["v-1"], ["v-1"]]);
  });

  it("the ask link's pad stages once and approves once, and its Retry signs the vouch", async () => {
    const row = application();
    const { approvals, stages } = host(() => row);
    const { writes, signedAgain } = signer([internal]);
    const data = createAskStanceData({ client: client(), guard, signer: writes, base }, "ask-1");

    await data.commit(TARGET, PICK);
    const retried = await data.commit(TARGET, PICK);

    expect(stages).toEqual(["ask-1"]);
    expect(approvals).toEqual([PICK]);
    expect(signedAgain.map((call) => call.ids)).toEqual([["v-1"]]);
    expect(retried.kind).toBe("success");
  });

  it("a changed pick over the landed approval signs nothing: the approval is asked as today and refused", async () => {
    // The undrawn moment (PadFailed.md:15 "Retry will sign the pick the pad
    // shows" against the vouch the approval already staged): kept as today.
    const { approvals } = host();
    const { writes, signedAgain, signed } = signer([internal]);
    const data = createApprovalStanceData({ client: client(), guard, signer: writes, base }, application());

    await data.commit(TARGET, PICK);
    const retried = await data.commit(TARGET, OTHER_PICK);

    expect(approvals).toEqual([PICK, OTHER_PICK]);
    expect(signedAgain).toEqual([]);
    expect(signed).toEqual([["v-1"]]);
    expect(retried.kind).toBe("refused");
  });

  it("an account boundary lets the landed approval go", async () => {
    const tab = accounts();
    const { approvals } = host();
    const { writes, signedAgain } = signer([internal]);
    const row = application();
    const data = createApprovalStanceData({ client: client(), guard, signer: writes, base, accounts: tab }, row);

    await data.commit(TARGET, PICK);
    tab.switchTo("acct-b");
    await data.commit(TARGET, PICK);

    expect(signedAgain).toEqual([]);
    expect(approvals).toEqual([PICK, PICK]);
  });
});
