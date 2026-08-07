import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { graphql, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { hasCode } from "./outcome";
import {
  applyWithInvite,
  attachActorKey,
  checkInviteLink,
  fetchApplicationStatus,
  register,
  resendVerificationEmail,
  verifyEmail,
} from "./onboarding-api";
import { startMswServer } from "@/test/msw";

const server = startMswServer();

function client() {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({ uri: "http://localhost/graphql" }),
  });
}

const application = {
  __typename: "Application",
  id: "app-1",
  handle: "ada",
  emailVerified: false,
  keyAttached: false,
  approvedAt: null,
  landedAt: null,
  createdAt: "2026-08-07T00:00:00Z",
  expiresAt: "2026-08-08T00:00:00Z",
};

function stagedNode(id: string, family: string, state: string) {
  return {
    __typename: "StagedWrite",
    id,
    state,
    family,
    canonicalProposal: "cHJvcG9zYWw=",
    verifiedAct: null,
    record: null,
  };
}

describe("checkInviteLink", () => {
  it("returns the check for a known link", async () => {
    server.use(
      graphql.query("InviteLinkCheck", () =>
        HttpResponse.json({
          data: {
            inviteLinkCheck: {
              __typename: "InviteLinkCheck",
              usable: true,
              inviterHandle: "grace",
              expiresAt: "2026-08-08T00:00:00Z",
            },
          },
        }),
      ),
    );
    const outcome = await checkInviteLink(client(), "id-1");
    expect(outcome.kind).toBe("success");
    if (outcome.kind === "success") expect(outcome.value?.inviterHandle).toBe("grace");
  });

  it("returns success(null) when the id references no link", async () => {
    server.use(
      graphql.query("InviteLinkCheck", () => HttpResponse.json({ data: { inviteLinkCheck: null } })),
    );
    const outcome = await checkInviteLink(client(), "id-1");
    expect(outcome).toEqual({ kind: "success", value: null });
  });

  it("maps a transport fault to failed", async () => {
    server.use(graphql.query("InviteLinkCheck", () => HttpResponse.error()));
    expect((await checkInviteLink(client(), "id-1")).kind).toBe("failed");
  });
});

describe("register", () => {
  const input = {
    inviteLink: "link-1",
    handle: "ada",
    email: "ada@example.org",
    password: "correct horse battery",
    deviceLabel: "Chrome on Linux",
  };

  it("returns the session pair", async () => {
    server.use(
      graphql.mutation("Register", () =>
        HttpResponse.json({
          data: {
            register: {
              __typename: "RegisterPayload",
              auth: {
                __typename: "AuthSession",
                accessToken: "access",
                refreshToken: "refresh",
                user: { __typename: "User", id: "acct-1" },
              },
              expiresAt: "2026-08-08T00:00:00Z",
              userErrors: [],
            },
          },
        }),
      ),
    );
    const outcome = await register(client(), input);
    expect(outcome).toEqual({
      kind: "success",
      value: { accessToken: "access", refreshToken: "refresh", accountId: "acct-1" },
    });
  });

  it("surfaces a form refusal", async () => {
    server.use(
      graphql.mutation("Register", () =>
        HttpResponse.json({
          data: {
            register: {
              __typename: "RegisterPayload",
              auth: null,
              expiresAt: null,
              userErrors: [
                {
                  __typename: "UserError",
                  message: "taken",
                  code: "HANDLE_TAKEN",
                  field: ["handle"],
                },
              ],
            },
          },
        }),
      ),
    );
    const outcome = await register(client(), input);
    expect(hasCode(outcome, "HANDLE_TAKEN")).toBe(true);
  });
});

describe("verifyEmail", () => {
  it("succeeds only on ok", async () => {
    server.use(
      graphql.mutation("VerifyEmail", () =>
        HttpResponse.json({
          data: { verifyEmail: { __typename: "VerifyEmailPayload", ok: true, userErrors: [] } },
        }),
      ),
    );
    expect(await verifyEmail(client(), "token")).toEqual({ kind: "success", value: true });
  });

  it("surfaces the invalid-token refusal", async () => {
    server.use(
      graphql.mutation("VerifyEmail", () =>
        HttpResponse.json({
          data: {
            verifyEmail: {
              __typename: "VerifyEmailPayload",
              ok: false,
              userErrors: [
                {
                  __typename: "UserError",
                  message: "invalid",
                  code: "VERIFICATION_TOKEN_INVALID",
                  field: null,
                },
              ],
            },
          },
        }),
      ),
    );
    expect(hasCode(await verifyEmail(client(), "token"), "VERIFICATION_TOKEN_INVALID")).toBe(true);
  });
});

describe("resendVerificationEmail", () => {
  it("is a silent verb — ok is the whole payload", async () => {
    server.use(
      graphql.mutation("ResendVerificationEmail", () =>
        HttpResponse.json({
          data: {
            resendVerificationEmail: { __typename: "ResendVerificationEmailPayload", ok: true },
          },
        }),
      ),
    );
    expect(await resendVerificationEmail(client(), "a@b.c")).toEqual({
      kind: "success",
      value: true,
    });
  });
});

describe("attachActorKey", () => {
  it("succeeds when the user comes back", async () => {
    server.use(
      graphql.mutation("AttachActorKey", () =>
        HttpResponse.json({
          data: {
            attachActorKey: {
              __typename: "AttachActorKeyPayload",
              user: { __typename: "User", id: "u1" },
              userErrors: [],
            },
          },
        }),
      ),
    );
    expect(await attachActorKey(client(), "cHVi", "aabb")).toEqual({
      kind: "success",
      value: true,
    });
  });

  it("surfaces the bound-address refusal", async () => {
    server.use(
      graphql.mutation("AttachActorKey", () =>
        HttpResponse.json({
          data: {
            attachActorKey: {
              __typename: "AttachActorKeyPayload",
              user: null,
              userErrors: [
                { __typename: "UserError", message: "bound", code: "FORBIDDEN", field: null },
              ],
            },
          },
        }),
      ),
    );
    expect(hasCode(await attachActorKey(client(), "cHVi", "aabb"), "FORBIDDEN")).toBe(true);
  });
});

describe("applyWithInvite", () => {
  it("re-arms against a fresh link", async () => {
    server.use(
      graphql.mutation("ApplyWithInvite", () =>
        HttpResponse.json({
          data: {
            applyWithInvite: {
              __typename: "ApplyWithInvitePayload",
              application: { __typename: "Application", id: "app-2" },
              userErrors: [],
            },
          },
        }),
      ),
    );
    expect(await applyWithInvite(client(), "link-2")).toEqual({ kind: "success", value: true });
  });

  it("refuses a dead link", async () => {
    server.use(
      graphql.mutation("ApplyWithInvite", () =>
        HttpResponse.json({
          data: {
            applyWithInvite: {
              __typename: "ApplyWithInvitePayload",
              application: null,
              userErrors: [
                { __typename: "UserError", message: "dead", code: "INVITE_UNUSABLE", field: null },
              ],
            },
          },
        }),
      ),
    );
    expect(hasCode(await applyWithInvite(client(), "link-2"), "INVITE_UNUSABLE")).toBe(true);
  });
});

describe("fetchApplicationStatus", () => {
  function statusResponse(me: unknown) {
    return graphql.query("ApplicationStatus", () => HttpResponse.json({ data: { me } }));
  }

  it("maps a null viewer to the shared UNAUTHENTICATED refusal", async () => {
    server.use(statusResponse(null));
    expect(hasCode(await fetchApplicationStatus(client()), "UNAUTHENTICATED")).toBe(true);
  });

  it("selects the first unexpired Registration among the staged writes", async () => {
    server.use(
      statusResponse({
        __typename: "User",
        id: "u1",
        accountState: "APPLICANT",
        application,
        stagedWrites: {
          __typename: "StagedWriteConnection",
          nodes: [
            stagedNode("sw-0", "REGISTRATION", "EXPIRED"),
            stagedNode("sw-1", "OPINION", "AWAITING_PRE_SIGN"),
            stagedNode("sw-2", "REGISTRATION", "AWAITING_PRE_SIGN"),
          ],
        },
      }),
    );
    const outcome = await fetchApplicationStatus(client());
    expect(outcome.kind).toBe("success");
    if (outcome.kind === "success") {
      expect(outcome.value.accountState).toBe("APPLICANT");
      expect(outcome.value.stagedRegistration?.id).toBe("sw-2");
    }
  });

  it("reports no staged Registration when none is pending", async () => {
    server.use(
      statusResponse({
        __typename: "User",
        id: "u1",
        accountState: "APPLICANT",
        application,
        stagedWrites: { __typename: "StagedWriteConnection", nodes: [] },
      }),
    );
    const outcome = await fetchApplicationStatus(client());
    if (outcome.kind === "success") expect(outcome.value.stagedRegistration).toBeNull();
    expect(outcome.kind).toBe("success");
  });
});
