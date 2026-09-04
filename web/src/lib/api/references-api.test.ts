// The reference surface: the finder's lookup gate and projection, and the two
// standalone gestures the edit surfaces stage.

import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { graphql, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import {
  CANDIDATE_LIMIT,
  fetchReferenceCandidates,
  prepareReference,
  prepareReferenceWithdrawal,
} from "./references-api";
import { startMswServer } from "@/test/msw";

const server = startMswServer();

function client() {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({ uri: "http://localhost/graphql" }),
  });
}

function preparedWrites() {
  return [
    {
      __typename: "StagedWrite",
      id: "sw-1",
      family: "REFERENCE",
      canonicalProposal: "AA==",
      gcAfterEpochs: 3,
    },
  ];
}

describe("fetchReferenceCandidates", () => {
  // A finder runs on every keystroke, and a query that resolves nothing would
  // come back empty anyway — so it never leaves the browser.
  it("answers empty without asking the server for an unresolvable query", async () => {
    let asked = false;
    server.use(
      graphql.query("ReferenceCandidates", () => {
        asked = true;
        return HttpResponse.json({ data: { referenceCandidates: [] } });
      }),
    );
    // D21: a topic is tagged, never referenced.
    expect(await fetchReferenceCandidates(client(), "#rust")).toEqual({
      kind: "success",
      value: [],
    });
    expect(await fetchReferenceCandidates(client(), "   ")).toEqual({
      kind: "success",
      value: [],
    });
    expect(asked).toBe(false);
  });

  it("trims the query and asks for the finder's own limit", async () => {
    let variables: { query: string; limit: number } | undefined;
    server.use(
      graphql.query("ReferenceCandidates", (info) => {
        variables = info.variables as { query: string; limit: number };
        return HttpResponse.json({ data: { referenceCandidates: [] } });
      }),
    );
    await fetchReferenceCandidates(client(), "  @ada  ");
    expect(variables).toEqual({ query: "@ada", limit: CANDIDATE_LIMIT });
  });

  // D20: a reference whose target is a person is a MENTION, and the chip is
  // built ready to draft.
  it("projects a person candidate into a mention draft", async () => {
    server.use(
      graphql.query("ReferenceCandidates", () =>
        HttpResponse.json({
          data: {
            referenceCandidates: [
              {
                __typename: "ReferenceCandidate",
                targetId: "u-1",
                target: {
                  __typename: "User",
                  id: "u-1",
                  handle: "ada",
                  displayName: { __typename: "ModeratedText", value: "Ada" },
                },
              },
            ],
          },
        }),
      ),
    );
    const outcome = await fetchReferenceCandidates(client(), "@ada");
    expect(outcome.kind).toBe("success");
    if (outcome.kind !== "success") return;
    expect(outcome.value).toHaveLength(1);
    expect(outcome.value[0]?.targetId).toBe("u-1");
    expect(outcome.value[0]?.target).toMatchObject({
      kind: "User",
      label: "@ada",
      href: "/u/ada",
    });
  });

  it("reports a transport fault as failed", async () => {
    server.use(graphql.query("ReferenceCandidates", () => HttpResponse.error()));
    expect((await fetchReferenceCandidates(client(), "@ada")).kind).toBe("failed");
  });
});

describe("prepareReference", () => {
  // Omitting a parameter means "the server's default" and is sent as null,
  // which is what the input's nullable fields mean.
  it("sends nulls for the parameters the author left alone", async () => {
    let input: Record<string, unknown> | undefined;
    server.use(
      graphql.mutation("PrepareReference", ({ variables }) => {
        input = (variables as { input: Record<string, unknown> }).input;
        return HttpResponse.json({
          data: {
            prepareReference: {
              __typename: "PrepareReferencePayload",
              writes: preparedWrites(),
              userErrors: [],
            },
          },
        });
      }),
    );
    const outcome = await prepareReference(client(), { artifact: "p-1", target: "u-1" });
    expect(outcome.kind).toBe("success");
    if (outcome.kind !== "success") return;
    expect(outcome.value.map((write) => write.id)).toEqual(["sw-1"]);
    expect(input).toEqual({
      artifact: "p-1",
      target: "u-1",
      relevance: null,
      support: null,
    });
  });

  it("carries the parameters the author did set", async () => {
    let input: Record<string, unknown> | undefined;
    server.use(
      graphql.mutation("PrepareReference", ({ variables }) => {
        input = (variables as { input: Record<string, unknown> }).input;
        return HttpResponse.json({
          data: {
            prepareReference: {
              __typename: "PrepareReferencePayload",
              writes: preparedWrites(),
              userErrors: [],
            },
          },
        });
      }),
    );
    await prepareReference(client(), {
      artifact: "p-1",
      target: "u-1",
      relevance: 0.4,
      support: -0.2,
    });
    expect(input).toMatchObject({ relevance: 0.4, support: -0.2 });
  });

  it("surfaces a refusal", async () => {
    server.use(
      graphql.mutation("PrepareReference", () =>
        HttpResponse.json({
          data: {
            prepareReference: {
              __typename: "PrepareReferencePayload",
              writes: null,
              userErrors: [
                {
                  __typename: "UserError",
                  message: "no",
                  code: "WRITE_RULE_FAILED",
                  field: null,
                },
              ],
            },
          },
        }),
      ),
    );
    const outcome = await prepareReference(client(), { artifact: "p-1", target: "u-1" });
    expect(outcome.kind).toBe("refused");
    if (outcome.kind !== "refused") return;
    expect(outcome.errors[0]?.code).toBe("WRITE_RULE_FAILED");
  });
});

describe("prepareReferenceWithdrawal", () => {
  // D11: the server assembles counter-records until the bundle reaches (0, 0),
  // so the returned batch — however long — is the quoted cost.
  it("returns every counter-record the server quoted", async () => {
    server.use(
      graphql.mutation("PrepareReferenceWithdrawal", () =>
        HttpResponse.json({
          data: {
            prepareReferenceWithdrawal: {
              __typename: "PrepareReferenceWithdrawalPayload",
              writes: [
                {
                  __typename: "StagedWrite",
                  id: "sw-1",
                  family: "REFERENCE",
                  canonicalProposal: "AA==",
                  gcAfterEpochs: 3,
                },
                {
                  __typename: "StagedWrite",
                  id: "sw-2",
                  family: "REFERENCE",
                  canonicalProposal: "AQ==",
                  gcAfterEpochs: 3,
                },
              ],
              userErrors: [],
            },
          },
        }),
      ),
    );
    const outcome = await prepareReferenceWithdrawal(client(), {
      artifact: "p-1",
      target: "u-1",
    });
    expect(outcome.kind).toBe("success");
    if (outcome.kind !== "success") return;
    expect(outcome.value.map((write) => write.id)).toEqual(["sw-1", "sw-2"]);
  });

  it("reports a transport fault as failed", async () => {
    server.use(graphql.mutation("PrepareReferenceWithdrawal", () => HttpResponse.error()));
    expect(
      (await prepareReferenceWithdrawal(client(), { artifact: "p-1", target: "u-1" })).kind,
    ).toBe("failed");
  });
});
