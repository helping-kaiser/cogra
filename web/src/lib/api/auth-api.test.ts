// The session and account calls: the token-pair lift, the silent verbs, and
// the viewer reads.

import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";
import { graphql, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import {
  confirmPasswordReset,
  createKeyBackupChallenge,
  fetchKeyBackup,
  fetchMe,
  logIn,
  refreshExecutor,
  requestPasswordReset,
  sessionAuthOf,
  uploadKeyBackup,
} from "./auth-api";
import { startMswServer } from "@/test/msw";

const server = startMswServer();

function client() {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({ uri: "http://localhost/graphql" }),
  });
}

function authPayload(over: Record<string, unknown> = {}) {
  return {
    __typename: "AuthSession",
    accessToken: "access-1",
    refreshToken: "refresh-1",
    user: { __typename: "User", id: "u-1" },
    ...over,
  };
}

describe("sessionAuthOf", () => {
  it("lifts the pair with the account it belongs to", () => {
    expect(sessionAuthOf(authPayload() as never)).toEqual({
      accessToken: "access-1",
      refreshToken: "refresh-1",
      accountId: "u-1",
    });
  });

  // A non-null auth without its user is a server-contract break, and the null
  // is what turns it into a failure rather than a half-stored session.
  it("refuses an auth with no user, and a missing auth", () => {
    expect(sessionAuthOf(authPayload({ user: null }) as never)).toBeNull();
    expect(sessionAuthOf(null)).toBeNull();
    expect(sessionAuthOf(undefined)).toBeNull();
  });
});

describe("logIn", () => {
  it("carries the reuse event the first login after detection delivers", async () => {
    server.use(
      graphql.mutation("LogIn", () =>
        HttpResponse.json({
          data: {
            logIn: {
              __typename: "LogInPayload",
              auth: authPayload(),
              reuseDetectedAt: "2026-09-01T00:00:00Z",
              userErrors: [],
            },
          },
        }),
      ),
    );
    const outcome = await logIn(client(), "ada@example.com", "hunter2", "phone");
    expect(outcome.kind).toBe("success");
    if (outcome.kind !== "success") return;
    expect(outcome.value.auth.accountId).toBe("u-1");
    expect(outcome.value.reuseDetectedAt).toBe("2026-09-01T00:00:00Z");
  });

  it("reads an absent reuse event as null rather than undefined", async () => {
    server.use(
      graphql.mutation("LogIn", () =>
        HttpResponse.json({
          data: {
            logIn: {
              __typename: "LogInPayload",
              auth: authPayload(),
              reuseDetectedAt: null,
              userErrors: [],
            },
          },
        }),
      ),
    );
    const outcome = await logIn(client(), "ada@example.com", "hunter2", null);
    expect(outcome.kind).toBe("success");
    if (outcome.kind !== "success") return;
    expect(outcome.value.reuseDetectedAt).toBeNull();
  });

  it("surfaces bad credentials as a refusal", async () => {
    server.use(
      graphql.mutation("LogIn", () =>
        HttpResponse.json({
          data: {
            logIn: {
              __typename: "LogInPayload",
              auth: null,
              reuseDetectedAt: null,
              userErrors: [
                {
                  __typename: "UserError",
                  message: "nope",
                  code: "INVALID_CREDENTIALS",
                  field: null,
                },
              ],
            },
          },
        }),
      ),
    );
    const outcome = await logIn(client(), "ada@example.com", "wrong", null);
    expect(outcome.kind).toBe("refused");
    if (outcome.kind !== "refused") return;
    expect(outcome.errors[0]?.code).toBe("INVALID_CREDENTIALS");
  });

  it("reports a transport fault as failed, never as bad credentials", async () => {
    server.use(graphql.mutation("LogIn", () => HttpResponse.error()));
    expect((await logIn(client(), "ada@example.com", "hunter2", null)).kind).toBe("failed");
  });
});

describe("refreshExecutor", () => {
  it("spends the token it is given and returns the new pair", async () => {
    let input: { refreshToken: string } | undefined;
    server.use(
      graphql.mutation("RefreshSession", ({ variables }) => {
        input = (variables as { input: { refreshToken: string } }).input;
        return HttpResponse.json({
          data: {
            refreshSession: {
              __typename: "RefreshSessionPayload",
              auth: authPayload({ accessToken: "access-2", refreshToken: "refresh-2" }),
              userErrors: [],
            },
          },
        });
      }),
    );
    const outcome = await refreshExecutor(client())("refresh-1");
    expect(input?.refreshToken).toBe("refresh-1");
    expect(outcome.kind).toBe("success");
    if (outcome.kind !== "success") return;
    expect(outcome.value?.accessToken).toBe("access-2");
  });

  it("surfaces an invalid refresh token as a refusal", async () => {
    server.use(
      graphql.mutation("RefreshSession", () =>
        HttpResponse.json({
          data: {
            refreshSession: {
              __typename: "RefreshSessionPayload",
              auth: null,
              userErrors: [
                {
                  __typename: "UserError",
                  message: "gone",
                  code: "REFRESH_TOKEN_INVALID",
                  field: null,
                },
              ],
            },
          },
        }),
      ),
    );
    const outcome = await refreshExecutor(client())("refresh-1");
    expect(outcome.kind).toBe("refused");
    if (outcome.kind !== "refused") return;
    expect(outcome.errors[0]?.code).toBe("REFRESH_TOKEN_INVALID");
  });
});

describe("the password-reset pair", () => {
  // A silent verb has no userErrors by design: surfacing a failure would
  // reintroduce account enumeration.
  it("reads the request verb's ok without a refusal channel", async () => {
    server.use(
      graphql.mutation("RequestPasswordReset", () =>
        HttpResponse.json({
          data: { requestPasswordReset: { __typename: "RequestPasswordResetPayload", ok: true } },
        }),
      ),
    );
    expect(await requestPasswordReset(client(), "ada@example.com")).toEqual({
      kind: "success",
      value: true,
    });
  });

  it("surfaces a spent reset token on the confirm leg", async () => {
    server.use(
      graphql.mutation("ConfirmPasswordReset", () =>
        HttpResponse.json({
          data: {
            confirmPasswordReset: {
              __typename: "ConfirmPasswordResetPayload",
              ok: null,
              userErrors: [
                {
                  __typename: "UserError",
                  message: "used",
                  code: "RESET_TOKEN_INVALID",
                  field: null,
                },
              ],
            },
          },
        }),
      ),
    );
    const outcome = await confirmPasswordReset(client(), "token", "a-new-password");
    expect(outcome.kind).toBe("refused");
    if (outcome.kind !== "refused") return;
    expect(outcome.errors[0]?.code).toBe("RESET_TOKEN_INVALID");
  });
});

describe("the key-backup calls", () => {
  it("reads a never-uploaded blob as null rather than a failure", async () => {
    server.use(
      graphql.query("KeyBackup", () =>
        HttpResponse.json({
          data: { me: { __typename: "User", id: "u-1", keyBackup: null } },
        }),
      ),
    );
    expect(await fetchKeyBackup(client())).toEqual({ kind: "success", value: null });
  });

  it("returns the newest blob when one exists", async () => {
    server.use(
      graphql.query("KeyBackup", () =>
        HttpResponse.json({
          data: { me: { __typename: "User", id: "u-1", keyBackup: "AAEC" } },
        }),
      ),
    );
    expect(await fetchKeyBackup(client())).toEqual({ kind: "success", value: "AAEC" });
  });

  it("surfaces a spent challenge", async () => {
    server.use(
      graphql.mutation("CreateKeyBackupChallenge", () =>
        HttpResponse.json({
          data: {
            createKeyBackupChallenge: {
              __typename: "KeyBackupChallengePayload",
              challenge: null,
              userErrors: [
                {
                  __typename: "UserError",
                  message: "spent",
                  code: "CHALLENGE_EXPIRED",
                  field: null,
                },
              ],
            },
          },
        }),
      ),
    );
    const outcome = await createKeyBackupChallenge(client());
    expect(outcome.kind).toBe("refused");
    if (outcome.kind !== "refused") return;
    expect(outcome.errors[0]?.code).toBe("CHALLENGE_EXPIRED");
  });

  it("sends the blob with its proof", async () => {
    let input: Record<string, unknown> | undefined;
    server.use(
      graphql.mutation("UploadKeyBackup", ({ variables }) => {
        input = (variables as { input: Record<string, unknown> }).input;
        return HttpResponse.json({
          data: { uploadKeyBackup: { __typename: "UploadKeyBackupPayload", ok: true, userErrors: [] } },
        });
      }),
    );
    expect(await uploadKeyBackup(client(), "AAEC", "chal", "sig")).toEqual({
      kind: "success",
      value: true,
    });
    expect(input).toEqual({ blob: "AAEC", challenge: "chal", signature: "sig" });
  });
});

describe("fetchMe", () => {
  it("returns the viewer", async () => {
    server.use(
      graphql.query("Me", () =>
        HttpResponse.json({
          data: {
            me: {
              __typename: "User",
              id: "u-1",
              handle: "ada",
              displayName: { __typename: "ModeratedText", value: "Ada" },
              accountState: "MEMBER",
              hasReciprocated: true,
              invitedBy: null,
            },
          },
        }),
      ),
    );
    const outcome = await fetchMe(client());
    expect(outcome.kind).toBe("success");
    if (outcome.kind !== "success") return;
    expect(outcome.value.handle).toBe("ada");
  });

  // A null viewer on a query that needs one is not a viewer with no fields —
  // the read has to say so rather than hand back an empty user.
  it("does not report a null viewer as a success", async () => {
    server.use(graphql.query("Me", () => HttpResponse.json({ data: { me: null } })));
    expect((await fetchMe(client())).kind).not.toBe("success");
  });
});
