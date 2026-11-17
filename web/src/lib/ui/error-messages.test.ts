import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { describe, expect, it } from "vitest";

import { DeviceRefusalError } from "@/lib/signing/device-refusal";
import {
  answeredFaultLine,
  fallbackMessage,
  firstRefusalMessage,
  NO_ANSWER_LINE,
  NOT_THROUGH_LINE,
  outcomeFaultLine,
  UNVERIFIED_LINE,
  wholeActLine,
  writeRefusalMessage,
} from "./error-messages";

describe("fallbackMessage", () => {
  it("names the rate limit and falls back generically", () => {
    expect(fallbackMessage("RATE_LIMITED")).toContain("Too many attempts");
    expect(fallbackMessage("INTERNAL")).toBe("Something went wrong. Try again.");
  });

  // NetworkError.md:13 — a FORBIDDEN answer reads the not-through line.
  it("reads FORBIDDEN as the not-through line", () => {
    expect(NOT_THROUGH_LINE).toBe("That didn't go through. Try again.");
    expect(fallbackMessage("FORBIDDEN")).toBe(NOT_THROUGH_LINE);
  });
});

describe("writeRefusalMessage", () => {
  it("reads FORBIDDEN as the not-through line, never as a connection fault", () => {
    expect(writeRefusalMessage("FORBIDDEN")).toBe(NOT_THROUGH_LINE);
    expect(writeRefusalMessage("FORBIDDEN")).not.toMatch(/reach the server/);
  });
});

// NetworkError.md:13-19, copy-voice *Faults by code*.
describe("the answered whole-act lines", () => {
  const internal = new CombinedGraphQLErrors({ errors: [{ message: "no", extensions: { code: "INTERNAL" } }] });

  it("reads INTERNAL and SIGNATURE_INVALID as the not-through line", () => {
    expect(writeRefusalMessage("INTERNAL")).toBe(NOT_THROUGH_LINE);
    expect(writeRefusalMessage("SIGNATURE_INVALID")).toBe(NOT_THROUGH_LINE);
  });

  it("reads EMAIL_NOT_VERIFIED as its own line", () => {
    expect(UNVERIFIED_LINE).toBe("Verify your email first — the link is in your inbox.");
    expect(writeRefusalMessage("EMAIL_NOT_VERIFIED")).toBe(UNVERIFIED_LINE);
  });

  it("reads a BAD_INPUT naming no field as the not-through line, one naming a field as before", () => {
    expect(firstRefusalMessage([{ code: "BAD_INPUT", message: "", field: null }], "x")).toBe(NOT_THROUGH_LINE);
    expect(firstRefusalMessage([{ code: "BAD_INPUT", message: "", field: ["bio"] }], "x")).toBe(
      writeRefusalMessage("BAD_INPUT"),
    );
  });

  it("says nothing whole-act about the write rule, a row's NOT_FOUND or a rate limit", () => {
    for (const code of ["WRITE_RULE_FAILED", "NOT_FOUND", "RATE_LIMITED"] as const) {
      expect(wholeActLine([{ code, message: "", field: null }])).toBeNull();
    }
  });

  it("reads the device's own refusal as an answer (seam 355)", () => {
    expect(answeredFaultLine(new DeviceRefusalError("bad seal"))).toBe(NOT_THROUGH_LINE);
  });

  it("reads a transport INTERNAL as an answer and a link fault as none", () => {
    expect(answeredFaultLine(internal)).toBe(NOT_THROUGH_LINE);
    expect(answeredFaultLine(new Error("offline"))).toBeNull();
    expect(outcomeFaultLine({ kind: "failed", cause: internal })).toBe(NOT_THROUGH_LINE);
    expect(outcomeFaultLine({ kind: "failed", cause: new Error("offline") })).toBeNull();
    expect(
      outcomeFaultLine({ kind: "refused", errors: [{ code: "EMAIL_NOT_VERIFIED", message: "", field: null }] }),
    ).toBe(UNVERIFIED_LINE);
  });

  it("keeps the no-answer line apart", () => {
    expect(NO_ANSWER_LINE).toBe("That didn't send. Try again.");
  });
});
