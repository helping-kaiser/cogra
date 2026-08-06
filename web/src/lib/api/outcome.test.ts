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

  it("keeps other GraphQL errors in the transport tier", async () => {
    const outcome = await fetchOutcome(async () => ({
      data: undefined,
      error: forbiddenError(),
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
