import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { graphql, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { hasCode } from "./outcome";
import {
  changeHandle,
  changePassword,
  confirmEmailChange,
  fetchSessions,
  requestEmailChange,
  revokeOtherSessions,
  revokeSession,
} from "./settings-api";
import { startMswServer } from "@/test/msw";

const server = startMswServer();

function client() {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({ uri: "http://localhost/graphql" }),
  });
}

describe("fetchSessions", () => {
  it("returns the viewer's sessions", async () => {
    server.use(
      graphql.query("Sessions", () =>
        HttpResponse.json({
          data: {
            me: {
              __typename: "User",
              id: "u1",
              sessions: [
                { __typename: "Session", id: "s1", deviceLabel: "here", isCurrent: true },
              ],
            },
          },
        }),
      ),
    );
    const outcome = await fetchSessions(client());
    expect(outcome.kind).toBe("success");
    if (outcome.kind === "success") expect(outcome.value[0].isCurrent).toBe(true);
  });

  it("treats a null viewer as unauthenticated", async () => {
    server.use(graphql.query("Sessions", () => HttpResponse.json({ data: { me: null } })));
    expect(hasCode(await fetchSessions(client()), "UNAUTHENTICATED")).toBe(true);
  });
});

describe("revokeSession", () => {
  it("omits the id to revoke the current session", async () => {
    server.use(
      graphql.mutation("RevokeSession", ({ variables }) => {
        expect(variables).toEqual({ input: {} });
        return HttpResponse.json({
          data: {
            revokeSession: {
              __typename: "RevokeSessionPayload",
              session: { __typename: "Session", id: "s1" },
              userErrors: [],
            },
          },
        });
      }),
    );
    expect(await revokeSession(client(), null)).toEqual({ kind: "success", value: true });
  });

  it("names the session to revoke another", async () => {
    server.use(
      graphql.mutation("RevokeSession", ({ variables }) => {
        expect(variables).toEqual({ input: { session: "s2" } });
        return HttpResponse.json({
          data: {
            revokeSession: {
              __typename: "RevokeSessionPayload",
              session: { __typename: "Session", id: "s2" },
              userErrors: [],
            },
          },
        });
      }),
    );
    expect(await revokeSession(client(), "s2")).toEqual({ kind: "success", value: true });
  });
});

describe("revokeOtherSessions", () => {
  it("returns the revoked count", async () => {
    server.use(
      graphql.mutation("RevokeOtherSessions", () =>
        HttpResponse.json({
          data: {
            revokeOtherSessions: {
              __typename: "RevokeSessionsPayload",
              revokedCount: 3,
              userErrors: [],
            },
          },
        }),
      ),
    );
    expect(await revokeOtherSessions(client())).toEqual({ kind: "success", value: 3 });
  });
});

describe("changePassword", () => {
  it("maps a wrong current password to its refusal", async () => {
    server.use(
      graphql.mutation("ChangePassword", () =>
        HttpResponse.json({
          data: {
            changePassword: {
              __typename: "ChangePasswordPayload",
              ok: null,
              userErrors: [
                {
                  __typename: "UserError",
                  message: "no match",
                  code: "INVALID_CREDENTIALS",
                  field: ["currentPassword"],
                },
              ],
            },
          },
        }),
      ),
    );
    expect(hasCode(await changePassword(client(), "old", "new"), "INVALID_CREDENTIALS")).toBe(true);
  });

  it("returns true on success", async () => {
    server.use(
      graphql.mutation("ChangePassword", () =>
        HttpResponse.json({
          data: { changePassword: { __typename: "ChangePasswordPayload", ok: true, userErrors: [] } },
        }),
      ),
    );
    expect(await changePassword(client(), "old", "new-password-12")).toEqual({
      kind: "success",
      value: true,
    });
  });
});

describe("changeHandle", () => {
  it("returns the new handle", async () => {
    server.use(
      graphql.mutation("ChangeHandle", () =>
        HttpResponse.json({
          data: {
            changeHandle: {
              __typename: "ChangeHandlePayload",
              user: { __typename: "User", id: "u1", handle: "ada2" },
              userErrors: [],
            },
          },
        }),
      ),
    );
    expect(await changeHandle(client(), "ada2")).toEqual({ kind: "success", value: "ada2" });
  });

  it("surfaces a taken handle", async () => {
    server.use(
      graphql.mutation("ChangeHandle", () =>
        HttpResponse.json({
          data: {
            changeHandle: {
              __typename: "ChangeHandlePayload",
              user: null,
              userErrors: [
                { __typename: "UserError", message: "taken", code: "HANDLE_TAKEN", field: ["handle"] },
              ],
            },
          },
        }),
      ),
    );
    expect(hasCode(await changeHandle(client(), "ada"), "HANDLE_TAKEN")).toBe(true);
  });
});

describe("the email-change pair", () => {
  it("requestEmailChange is a silent verb", async () => {
    server.use(
      graphql.mutation("RequestEmailChange", () =>
        HttpResponse.json({
          data: { requestEmailChange: { __typename: "RequestEmailChangePayload", ok: true } },
        }),
      ),
    );
    expect(await requestEmailChange(client(), "new@example.com", "pw")).toEqual({
      kind: "success",
      value: true,
    });
  });

  it("confirmEmailChange trims the code and succeeds on a returned user", async () => {
    server.use(
      graphql.mutation("ConfirmEmailChange", ({ variables }) => {
        expect(variables).toEqual({ input: { code: "123456" } });
        return HttpResponse.json({
          data: {
            confirmEmailChange: {
              __typename: "ConfirmEmailChangePayload",
              user: { __typename: "User", id: "u1" },
              userErrors: [],
            },
          },
        });
      }),
    );
    expect(await confirmEmailChange(client(), "  123456  ")).toEqual({
      kind: "success",
      value: true,
    });
  });

  it("confirmEmailChange surfaces an invalid code", async () => {
    server.use(
      graphql.mutation("ConfirmEmailChange", () =>
        HttpResponse.json({
          data: {
            confirmEmailChange: {
              __typename: "ConfirmEmailChangePayload",
              user: null,
              userErrors: [
                {
                  __typename: "UserError",
                  message: "bad",
                  code: "VERIFICATION_TOKEN_INVALID",
                  field: ["code"],
                },
              ],
            },
          },
        }),
      ),
    );
    expect(hasCode(await confirmEmailChange(client(), "nope"), "VERIFICATION_TOKEN_INVALID")).toBe(
      true,
    );
  });
});
