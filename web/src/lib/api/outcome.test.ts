import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { describe, expect, it } from "vitest";

import {
  fetchOutcome,
  hasCode,
  payload,
  payloadOutcome,
  refused,
  unauthenticated,
  type UserError,
} from "./outcome";

const unauthenticatedError = () =>
  new CombinedGraphQLErrors({
    errors: [{ message: "unauthenticated", extensions: { code: "UNAUTHENTICATED" } }],
  });

const forbiddenError = () =>
  new CombinedGraphQLErrors({
    errors: [{ message: "forbidden", extensions: { code: "FORBIDDEN" } }],
  });

const emailNotVerifiedError = () =>
  new CombinedGraphQLErrors({
    errors: [
      { message: "email verification required before acting", extensions: { code: "EMAIL_NOT_VERIFIED" } },
    ],
  });

const rateLimitedError = () =>
  new CombinedGraphQLErrors({
    errors: [{ message: "too many attempts", extensions: { code: "RATE_LIMITED" } }],
  });

describe("fetchOutcome", () => {
  it("lifts data into success", async () => {
    const outcome = await fetchOutcome(async () => ({ data: { ok: true } }));
    expect(outcome).toEqual({ kind: "success", value: { ok: true } });
  });

  it("treats a dataless response as a transport fault", async () => {
    const outcome = await fetchOutcome(async () => ({ data: undefined }));
    expect(outcome.kind).toBe("failed");
  });

  it("synthesizes an errors-array UNAUTHENTICATED into a refusal", async () => {
    const outcome = await fetchOutcome(async () => ({
      data: undefined,
      error: unauthenticatedError(),
    }));
    expect(hasCode(outcome, "UNAUTHENTICATED")).toBe(true);
  });

  it("synthesizes an errors-array RATE_LIMITED into a refusal, not a transport fault", async () => {
    const outcome = await fetchOutcome(async () => ({
      data: undefined,
      error: rateLimitedError(),
    }));
    expect(outcome.kind).toBe("refused");
    expect(hasCode(outcome, "RATE_LIMITED")).toBe(true);
  });

  it("classifies a thrown RATE_LIMITED the same as a returned one", async () => {
    const outcome = await fetchOutcome(async () => {
      throw rateLimitedError();
    });
    expect(hasCode(outcome, "RATE_LIMITED")).toBe(true);
  });

  // HT-7. An acting mutation refuses a non-member at the transport tier, so
  // an applicant who has not verified their email was told the server could
  // not be reached. It was reached; it answered.
  it("lifts a FORBIDDEN out of the transport tier — it is an answer, not a fault", async () => {
    const outcome = await fetchOutcome(async () => ({
      data: undefined,
      error: forbiddenError(),
    }));
    expect(hasCode(outcome, "FORBIDDEN")).toBe(true);
  });

  it("classifies a thrown FORBIDDEN the same as a returned one", async () => {
    const outcome = await fetchOutcome(async () => {
      throw forbiddenError();
    });
    expect(hasCode(outcome, "FORBIDDEN")).toBe(true);
  });

  // The unverified applicant's own code, carried through so the surface can
  // word it separately once the copy is ruled.
  it("lifts an EMAIL_NOT_VERIFIED under its own code", async () => {
    const outcome = await fetchOutcome(async () => ({
      data: undefined,
      error: emailNotVerifiedError(),
    }));
    expect(hasCode(outcome, "EMAIL_NOT_VERIFIED")).toBe(true);
  });

  it("keeps a GraphQL error with no code it knows in the transport tier", async () => {
    const outcome = await fetchOutcome(async () => ({
      data: undefined,
      error: new CombinedGraphQLErrors({
        errors: [{ message: "boom", extensions: { code: "INTERNAL" } }],
      }),
    }));
    expect(outcome.kind).toBe("failed");
  });

  it("classifies a thrown UNAUTHENTICATED the same as a returned one", async () => {
    const outcome = await fetchOutcome(async () => {
      throw unauthenticatedError();
    });
    expect(hasCode(outcome, "UNAUTHENTICATED")).toBe(true);
  });

  it("maps a thrown network fault to failed", async () => {
    const outcome = await fetchOutcome(async () => {
      throw new Error("socket hang up");
    });
    expect(outcome.kind).toBe("failed");
  });
});

describe("payload", () => {
  const someError: UserError = {
    code: "INVALID_CREDENTIALS",
    message: "no match",
    field: null,
  };

  it("refuses when userErrors is non-empty", () => {
    expect(payload([someError], { any: 1 })).toEqual({
      kind: "refused",
      errors: [someError],
    });
  });

  it("succeeds on a value with no errors", () => {
    expect(payload([], 42)).toEqual({ kind: "success", value: 42 });
  });

  it("treats a null result without userErrors as a contract break", () => {
    expect(payload([], null).kind).toBe("failed");
  });
});

describe("payloadOutcome", () => {
  it("runs both splits", async () => {
    const outcome = await payloadOutcome(
      async () => ({ data: { op: { userErrors: [], value: "v" } } }),
      (d) => d.op.userErrors,
      (d) => d.op.value,
    );
    expect(outcome).toEqual({ kind: "success", value: "v" });
  });

  it("short-circuits on a transport fault", async () => {
    const outcome = await payloadOutcome(
      async () => {
        throw new Error("offline");
      },
      () => [],
      () => null,
    );
    expect(outcome.kind).toBe("failed");
  });
});

describe("hasCode", () => {
  it("matches only refusals carrying the code", () => {
    expect(hasCode(unauthenticated(), "UNAUTHENTICATED")).toBe(true);
    expect(hasCode(refused([]), "UNAUTHENTICATED")).toBe(false);
    expect(hasCode({ kind: "failed", cause: new Error() }, "UNAUTHENTICATED")).toBe(false);
  });
});
