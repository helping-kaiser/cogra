import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { graphql, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { hasCode } from "./outcome";
import { approveAct, fetchStagedWrite, hostPublicKey, submitProposal } from "./writes-api";
import { startMswServer } from "@/test/msw";

const server = startMswServer();

function client() {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({ uri: "http://localhost/graphql" }),
  });
}

function stagedWrite(id: string, state: string) {
  return {
    __typename: "StagedWrite",
    id,
    state,
    family: "REGISTRATION",
    canonicalProposal: "cHJvcG9zYWw=",
    verifiedAct: null,
    record: null,
  };
}

describe("hostPublicKey", () => {
  it("fetches once per client and caches", async () => {
    let calls = 0;
    server.use(
      graphql.query("HostPublicKey", () => {
        calls += 1;
        return HttpResponse.json({ data: { hostPublicKey: "aG9zdA==" } });
      }),
    );
    const c = client();
    expect(await hostPublicKey(c)).toEqual({ kind: "success", value: "aG9zdA==" });
    expect(await hostPublicKey(c)).toEqual({ kind: "success", value: "aG9zdA==" });
    expect(calls).toBe(1);
  });

  it("does not cache a failure", async () => {
    server.use(graphql.query("HostPublicKey", () => HttpResponse.error()));
    const c = client();
    expect((await hostPublicKey(c)).kind).toBe("failed");
    server.use(
      graphql.query("HostPublicKey", () => HttpResponse.json({ data: { hostPublicKey: "aA==" } })),
    );
    expect((await hostPublicKey(c)).kind).toBe("success");
  });
});

describe("submitProposal", () => {
  it("unwraps the single staged write", async () => {
    server.use(
      graphql.mutation("SubmitProposals", () =>
        HttpResponse.json({
          data: {
            submitProposals: {
              __typename: "SubmitProposalsPayload",
              stagedWrites: [stagedWrite("sw-1", "AWAITING_APPROVAL")],
              userErrors: [],
            },
          },
        }),
      ),
    );
    const outcome = await submitProposal(client(), "sw-1", "c2ln");
    expect(outcome.kind).toBe("success");
    if (outcome.kind === "success") expect(outcome.value.state).toBe("AWAITING_APPROVAL");
  });

  it("treats a wrong-arity payload as a contract break", async () => {
    server.use(
      graphql.mutation("SubmitProposals", () =>
        HttpResponse.json({
          data: {
            submitProposals: {
              __typename: "SubmitProposalsPayload",
              stagedWrites: [],
              userErrors: [],
            },
          },
        }),
      ),
    );
    expect((await submitProposal(client(), "sw-1", "c2ln")).kind).toBe("failed");
  });

  it("surfaces a signature refusal", async () => {
    server.use(
      graphql.mutation("SubmitProposals", () =>
        HttpResponse.json({
          data: {
            submitProposals: {
              __typename: "SubmitProposalsPayload",
              stagedWrites: null,
              userErrors: [
                { __typename: "UserError", message: "bad", code: "SIGNATURE_INVALID", field: null },
              ],
            },
          },
        }),
      ),
    );
    expect(hasCode(await submitProposal(client(), "sw-1", "c2ln"), "SIGNATURE_INVALID")).toBe(true);
  });
});

describe("approveAct", () => {
  it("unwraps the single staged write", async () => {
    server.use(
      graphql.mutation("ApproveActs", () =>
        HttpResponse.json({
          data: {
            approveActs: {
              __typename: "ApproveActsPayload",
              stagedWrites: [stagedWrite("sw-1", "RELAYING")],
              userErrors: [],
            },
          },
        }),
      ),
    );
    const outcome = await approveAct(client(), "sw-1", "c2ln");
    if (outcome.kind === "success") expect(outcome.value.state).toBe("RELAYING");
    expect(outcome.kind).toBe("success");
  });

  it("surfaces an expiry refusal", async () => {
    server.use(
      graphql.mutation("ApproveActs", () =>
        HttpResponse.json({
          data: {
            approveActs: {
              __typename: "ApproveActsPayload",
              stagedWrites: null,
              userErrors: [
                {
                  __typename: "UserError",
                  message: "gone",
                  code: "STAGED_WRITE_EXPIRED",
                  field: null,
                },
              ],
            },
          },
        }),
      ),
    );
    expect(hasCode(await approveAct(client(), "sw-1", "c2ln"), "STAGED_WRITE_EXPIRED")).toBe(true);
  });
});

describe("fetchStagedWrite", () => {
  it("returns the view when found", async () => {
    server.use(
      graphql.query("StagedWrite", () =>
        HttpResponse.json({ data: { stagedWrite: stagedWrite("sw-1", "SEALING") } }),
      ),
    );
    const outcome = await fetchStagedWrite(client(), "sw-1");
    if (outcome.kind === "success") expect(outcome.value?.state).toBe("SEALING");
    expect(outcome.kind).toBe("success");
  });

  it("returns success(null) for a vanished staging", async () => {
    server.use(
      graphql.query("StagedWrite", () => HttpResponse.json({ data: { stagedWrite: null } })),
    );
    expect(await fetchStagedWrite(client(), "sw-1")).toEqual({ kind: "success", value: null });
  });
});
