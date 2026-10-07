import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { graphql, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { hasCode } from "./outcome";
import {
  cancelEmailChange,
  changeHandle,
  changePassword,
  confirmEmailChange,
  emailChangeLinkCheck,
  fetchDefaultLicense,
  fetchSettingsAccount,
  requestEmailChange,
  resendEmailChange,
  revokeOtherSessions,
  revokeSession,
  setDefaultLicense,
} from "./settings-api";
import { startMswServer } from "@/test/msw";

const server = startMswServer();

function client() {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({ uri: "http://localhost/graphql" }),
  });
}

const PENDING = {
  __typename: "PendingEmailChange",
  newEmail: "new@example.com",
  requiresCode: true,
  codeConfirmed: false,
  linkConfirmed: false,
  expiresAt: "2026-10-08T12:00:00Z",
};

function userError(code: string, field: string[] | null = null) {
  return { __typename: "UserError", message: "refused", code, field };
}

describe("fetchSettingsAccount", () => {
  it("returns the viewer's account in one read", async () => {
    server.use(
      graphql.query("SettingsAccount", () =>
        HttpResponse.json({
          data: {
            me: {
              __typename: "User",
              id: "u1",
              handle: "sol",
              email: "sol@example.com",
              emailVerified: true,
              accountState: "MEMBER",
              actorPubkey: "pk",
              passwordChangedAt: "2026-09-16T12:00:00Z",
              keyBackupCreatedAt: null,
              pendingEmailChange: null,
              preferences: { __typename: "UserPreferences", defaultLicense: null },
              sessions: [
                {
                  __typename: "Session",
                  id: "s1",
                  deviceLabel: "here",
                  createdAt: "2026-10-01T00:00:00Z",
                  lastUsedAt: null,
                  isCurrent: true,
                },
              ],
            },
          },
        }),
      ),
    );
    const outcome = await fetchSettingsAccount(client());
    expect(outcome.kind).toBe("success");
    if (outcome.kind === "success") {
      expect(outcome.value.handle).toBe("sol");
      expect(outcome.value.sessions?.[0].isCurrent).toBe(true);
    }
  });

  it("treats a null viewer as unauthenticated", async () => {
    server.use(graphql.query("SettingsAccount", () => HttpResponse.json({ data: { me: null } })));
    expect(hasCode(await fetchSettingsAccount(client()), "UNAUTHENTICATED")).toBe(true);
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
              userErrors: [userError("INVALID_CREDENTIALS", ["currentPassword"])],
            },
          },
        }),
      ),
    );
    expect(hasCode(await changePassword(client(), "old", "new"), "INVALID_CREDENTIALS")).toBe(true);
  });

  it("lifts the re-authentication budget out of the transport tier", async () => {
    server.use(
      graphql.mutation("ChangePassword", () =>
        HttpResponse.json({
          data: null,
          errors: [{ message: "rate limited", extensions: { code: "RATE_LIMITED" } }],
        }),
      ),
    );
    expect(hasCode(await changePassword(client(), "old", "new"), "RATE_LIMITED")).toBe(true);
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
              userErrors: [userError("HANDLE_TAKEN", ["handle"])],
            },
          },
        }),
      ),
    );
    expect(hasCode(await changeHandle(client(), "ada"), "HANDLE_TAKEN")).toBe(true);
  });
});

describe("the email change", () => {
  it("requestEmailChange returns the opened change", async () => {
    server.use(
      graphql.mutation("RequestEmailChange", () =>
        HttpResponse.json({
          data: {
            requestEmailChange: {
              __typename: "RequestEmailChangePayload",
              pendingEmailChange: PENDING,
              userErrors: [],
            },
          },
        }),
      ),
    );
    const outcome = await requestEmailChange(client(), "new@example.com", "pw");
    expect(outcome.kind === "success" && outcome.value.newEmail).toBe("new@example.com");
  });

  it("requestEmailChange surfaces a wrong current password", async () => {
    server.use(
      graphql.mutation("RequestEmailChange", () =>
        HttpResponse.json({
          data: {
            requestEmailChange: {
              __typename: "RequestEmailChangePayload",
              pendingEmailChange: null,
              userErrors: [userError("INVALID_CREDENTIALS", ["currentPassword"])],
            },
          },
        }),
      ),
    );
    expect(
      hasCode(await requestEmailChange(client(), "new@example.com", "pw"), "INVALID_CREDENTIALS"),
    ).toBe(true);
  });

  it("confirmEmailChange trims the code and reads where the change stands", async () => {
    server.use(
      graphql.mutation("ConfirmEmailChange", ({ variables }) => {
        expect(variables).toEqual({ input: { code: "123456" } });
        return HttpResponse.json({
          data: {
            confirmEmailChange: {
              __typename: "ConfirmEmailChangePayload",
              user: {
                __typename: "User",
                id: "u1",
                email: "old@example.com",
                pendingEmailChange: { ...PENDING, codeConfirmed: true },
              },
              userErrors: [],
            },
          },
        });
      }),
    );
    const outcome = await confirmEmailChange(client(), "  123456  ");
    expect(outcome.kind).toBe("success");
    if (outcome.kind === "success") {
      expect(outcome.value.email).toBe("old@example.com");
      expect(outcome.value.pending?.codeConfirmed).toBe(true);
    }
  });

  it("confirmEmailChange surfaces a disabled code", async () => {
    server.use(
      graphql.mutation("ConfirmEmailChange", () =>
        HttpResponse.json({
          data: {
            confirmEmailChange: {
              __typename: "ConfirmEmailChangePayload",
              user: null,
              userErrors: [userError("EMAIL_CHANGE_CODE_DISABLED", ["code"])],
            },
          },
        }),
      ),
    );
    expect(
      hasCode(await confirmEmailChange(client(), "000000"), "EMAIL_CHANGE_CODE_DISABLED"),
    ).toBe(true);
  });

  it("resendEmailChange returns the change and refuses with nothing pending", async () => {
    server.use(
      graphql.mutation("ResendEmailChange", () =>
        HttpResponse.json({
          data: {
            resendEmailChange: {
              __typename: "ResendEmailChangePayload",
              pendingEmailChange: null,
              userErrors: [userError("NOT_FOUND")],
            },
          },
        }),
      ),
    );
    expect(hasCode(await resendEmailChange(client()), "NOT_FOUND")).toBe(true);
  });

  it("cancelEmailChange reads the address the account keeps", async () => {
    server.use(
      graphql.mutation("CancelEmailChange", () =>
        HttpResponse.json({
          data: {
            cancelEmailChange: {
              __typename: "CancelEmailChangePayload",
              user: { __typename: "User", id: "u1", email: "old@example.com", pendingEmailChange: null },
              userErrors: [],
            },
          },
        }),
      ),
    );
    expect(await cancelEmailChange(client())).toEqual({
      kind: "success",
      value: { email: "old@example.com", pending: null },
    });
  });

  it("emailChangeLinkCheck reads null for a token that names no change", async () => {
    server.use(
      graphql.query("EmailChangeLinkCheck", ({ variables }) => {
        expect(variables).toEqual({ token: "tok" });
        return HttpResponse.json({ data: { emailChangeLinkCheck: null } });
      }),
    );
    expect(await emailChangeLinkCheck(client(), "tok")).toEqual({ kind: "success", value: null });
  });
});

describe("the default license", () => {
  it("setDefaultLicense sends the pair and null restores public domain", async () => {
    const sent: unknown[] = [];
    server.use(
      graphql.mutation("SetPreferences", ({ variables }) => {
        sent.push(variables);
        return HttpResponse.json({
          data: {
            setPreferences: {
              __typename: "SetPreferencesPayload",
              preferences: { __typename: "UserPreferences", defaultLicense: null },
              userErrors: [],
            },
          },
        });
      }),
    );
    await setDefaultLicense(client(), { attribution: 1, provenance: 0.5 });
    await setDefaultLicense(client(), null);
    expect(sent).toEqual([
      { input: { defaultLicense: { attribution: 1, provenance: 0.5 } } },
      { input: { defaultLicense: null } },
    ]);
  });

  it("fetchDefaultLicense reads null as unset", async () => {
    server.use(
      graphql.query("DefaultLicense", () =>
        HttpResponse.json({
          data: {
            me: {
              __typename: "User",
              id: "u1",
              preferences: { __typename: "UserPreferences", defaultLicense: null },
            },
          },
        }),
      ),
    );
    expect(await fetchDefaultLicense(client())).toEqual({ kind: "success", value: null });
  });
});
