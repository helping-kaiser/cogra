import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { graphql, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { hasCode } from "./outcome";
import {
  approveApplicant,
  createInviteLink,
  fetchInviteLinks,
  revokeInviteLink,
} from "./invites-api";
import { startMswServer } from "@/test/msw";

const server = startMswServer();

function client() {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({ uri: "http://localhost/graphql" }),
  });
}

const linkNode = {
  __typename: "InviteLink",
  id: "l1",
  prefillPDirected: 0.1,
  prefillPInterest: 0.1,
  singleUse: false,
  createdAt: "2026-08-07T00:00:00Z",
  expiresAt: "2026-08-14T00:00:00Z",
  revokedAt: null,
  applications: { __typename: "ApplicationConnection", nodes: [] },
};

describe("fetchInviteLinks", () => {
  it("returns the viewer's links", async () => {
    server.use(
      graphql.query("InviteLinks", () =>
        HttpResponse.json({
          data: {
            me: {
              __typename: "User",
              id: "u1",
              inviteLinks: { __typename: "InviteLinkConnection", nodes: [linkNode] },
            },
          },
        }),
      ),
    );
    const outcome = await fetchInviteLinks(client());
    expect(outcome.kind).toBe("success");
    if (outcome.kind === "success") expect(outcome.value[0].id).toBe("l1");
  });

  it("treats a null viewer as unauthenticated", async () => {
    server.use(graphql.query("InviteLinks", () => HttpResponse.json({ data: { me: null } })));
    expect(hasCode(await fetchInviteLinks(client()), "UNAUTHENTICATED")).toBe(true);
  });
});

describe("createInviteLink", () => {
  const input = {
    expiresAt: "2026-08-14T00:00:00Z",
    prefillPDirected: 0.1,
    prefillPInterest: 0.1,
    singleUse: true,
  };

  it("returns true on success", async () => {
    server.use(
      graphql.mutation("CreateInviteLink", () =>
        HttpResponse.json({
          data: {
            createInviteLink: {
              __typename: "CreateInviteLinkPayload",
              inviteLink: { __typename: "InviteLink", id: "l1" },
              userErrors: [],
            },
          },
        }),
      ),
    );
    expect(await createInviteLink(client(), input)).toEqual({ kind: "success", value: true });
  });

  it("surfaces a bad-expiry refusal", async () => {
    server.use(
      graphql.mutation("CreateInviteLink", () =>
        HttpResponse.json({
          data: {
            createInviteLink: {
              __typename: "CreateInviteLinkPayload",
              inviteLink: null,
              userErrors: [
                { __typename: "UserError", message: "past", code: "BAD_INPUT", field: ["expiresAt"] },
              ],
            },
          },
        }),
      ),
    );
    expect(hasCode(await createInviteLink(client(), input), "BAD_INPUT")).toBe(true);
  });
});

describe("revokeInviteLink", () => {
  it("surfaces the stale-link refusal as a userError", async () => {
    // The contract deviation: NOT_FOUND rides the userError tier here
    // (api-spec.md "Auth and accounts").
    server.use(
      graphql.mutation("RevokeInviteLink", () =>
        HttpResponse.json({
          data: {
            revokeInviteLink: {
              __typename: "RevokeInviteLinkPayload",
              inviteLink: null,
              userErrors: [
                { __typename: "UserError", message: "gone", code: "NOT_FOUND", field: null },
              ],
            },
          },
        }),
      ),
    );
    expect(hasCode(await revokeInviteLink(client(), "l1"), "NOT_FOUND")).toBe(true);
  });
});

describe("approveApplicant", () => {
  it("adapts the returned Opinion records for the signer", async () => {
    server.use(
      graphql.mutation("ApproveApplicants", ({ variables }) => {
        expect(variables).toEqual({
          input: { approvals: [{ application: "a1", pDirected: 0.4, pInterest: 0.2 }] },
        });
        return HttpResponse.json({
          data: {
            approveApplicants: {
              __typename: "PreparePayload",
              writes: [
                {
                  __typename: "PreparedWrite",
                  id: "w1",
                  family: "OPINION",
                  canonicalProposal: "cHJvcG9zYWw=",
                },
              ],
              userErrors: [],
            },
          },
        });
      }),
    );
    const outcome = await approveApplicant(client(), "a1", 0.4, 0.2);
    expect(outcome).toEqual({
      kind: "success",
      value: [
        {
          id: "w1",
          family: "OPINION",
          canonicalProposal: "cHJvcG9zYWw=",
          state: "AWAITING_PRE_SIGN",
          verifiedAct: null,
        },
      ],
    });
  });

  it("surfaces a per-entry refusal", async () => {
    server.use(
      graphql.mutation("ApproveApplicants", () =>
        HttpResponse.json({
          data: {
            approveApplicants: {
              __typename: "PreparePayload",
              writes: null,
              userErrors: [
                {
                  __typename: "UserError",
                  message: "expired",
                  code: "BAD_INPUT",
                  field: ["approvals", "0", "application"],
                },
              ],
            },
          },
        }),
      ),
    );
    expect(hasCode(await approveApplicant(client(), "a1", 0.1, 0.1), "BAD_INPUT")).toBe(true);
  });

  it("maps a transport fault to failed", async () => {
    server.use(graphql.mutation("ApproveApplicants", () => HttpResponse.error()));
    expect((await approveApplicant(client(), "a1", 0.1, 0.1)).kind).toBe("failed");
  });
});
