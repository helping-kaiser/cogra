import { CombinedGraphQLErrors } from "@apollo/client/errors";
import { describe, expect, it } from "vitest";

import { newReferenceDraft } from "@/lib/references/draft";
import { NOT_THROUGH_LINE, UNVERIFIED_LINE } from "@/lib/ui/error-messages";
import { sealFaultOf, sealFaultOfFailure, sealFaultOfResults } from "./seal-fault";

const refs = [
  newReferenceDraft("p-1", { kind: "Post", label: "One", href: "/posts/p-1" }),
  newReferenceDraft("p-2", { kind: "Post", label: "Two", href: "/posts/p-2" }),
];

describe("sealFaultOf", () => {
  it("reads the write rule as its notice, whatever else came with it", () => {
    expect(
      sealFaultOf(
        [
          { code: "NOT_FOUND", message: "", field: ["references", "1", "target"] },
          { code: "WRITE_RULE_FAILED", message: "", field: null },
        ],
        refs,
      ),
    ).toEqual({ kind: "writeRule" });
  });

  // SealFaultRow: the one honest way a picked target stops answering.
  it("names the citation whose target never landed", () => {
    expect(
      sealFaultOf([{ code: "NOT_FOUND", message: "", field: ["references", "1", "target"] }], refs),
    ).toEqual({ kind: "row", targetId: "p-2" });
  });

  // SealFaultBug: any other refusal of a staged act is ours, and no row is marked.
  it("reads every other refusal as the bug", () => {
    expect(sealFaultOf([{ code: "BAD_INPUT", message: "", field: ["tags", "0", "name"] }], refs)).toEqual({
      kind: "bug",
    });
    expect(sealFaultOf([], refs)).toEqual({ kind: "bug" });
  });

  // NetworkError.md:13: the server answered FORBIDDEN — the whole act did not
  // go through, wherever the code was anchored, and it outranks a row.
  it("reads FORBIDDEN as not through, never the bug or a row", () => {
    expect(sealFaultOf([{ code: "FORBIDDEN", message: "", field: null }], refs)).toEqual({ kind: "notThrough", line: NOT_THROUGH_LINE });
    expect(
      sealFaultOf(
        [
          { code: "NOT_FOUND", message: "", field: ["references", "1", "target"] },
          { code: "FORBIDDEN", message: "", field: ["references", "0", "target"] },
        ],
        refs,
      ),
    ).toEqual({ kind: "notThrough", line: NOT_THROUGH_LINE });
  });
});

// NetworkError.md:13-19 — every answered fault of the whole act, read once.
describe("sealFaultOf — the answered whole-act faults", () => {
  it.each(["INTERNAL", "SIGNATURE_INVALID"] as const)("reads %s as not through", (code) => {
    expect(sealFaultOf([{ code, message: "", field: null }], refs)).toEqual({
      kind: "notThrough",
      line: NOT_THROUGH_LINE,
    });
  });

  it("reads a BAD_INPUT naming no field as not through, and one naming a field as before", () => {
    expect(sealFaultOf([{ code: "BAD_INPUT", message: "", field: null }], refs)).toEqual({
      kind: "notThrough",
      line: NOT_THROUGH_LINE,
    });
    expect(sealFaultOf([{ code: "BAD_INPUT", message: "", field: [] }], refs)).toEqual({
      kind: "notThrough",
      line: NOT_THROUGH_LINE,
    });
    expect(sealFaultOf([{ code: "BAD_INPUT", message: "", field: ["content"] }], refs)).toEqual({ kind: "bug" });
  });

  it("reads EMAIL_NOT_VERIFIED in its own line", () => {
    expect(sealFaultOf([{ code: "EMAIL_NOT_VERIFIED", message: "", field: null }], refs)).toEqual({
      kind: "notThrough",
      line: UNVERIFIED_LINE,
    });
  });

  it("still reads the write rule first", () => {
    expect(
      sealFaultOf(
        [
          { code: "INTERNAL", message: "", field: null },
          { code: "WRITE_RULE_FAILED", message: "", field: null },
        ],
        refs,
      ),
    ).toEqual({ kind: "writeRule" });
  });
});

describe("sealFaultOfFailure / sealFaultOfResults", () => {
  const internal = new CombinedGraphQLErrors({ errors: [{ message: "no", extensions: { code: "INTERNAL" } }] });

  // NetworkError.md:13: an INTERNAL on the errors array is an answer.
  it("reads a transport INTERNAL as not through and a link fault as no answer", () => {
    expect(sealFaultOfFailure(internal)).toEqual({ kind: "notThrough", line: NOT_THROUGH_LINE });
    expect(sealFaultOfFailure(new Error("offline"))).toEqual({ kind: "offline" });
  });

  it("reads a batch: a refusal first, then an answered failed leg, else no answer", () => {
    expect(sealFaultOfResults([{ kind: "failed", id: "a", cause: internal }], refs)).toEqual({
      kind: "notThrough",
      line: NOT_THROUGH_LINE,
    });
    expect(
      sealFaultOfResults(
        [
          { kind: "failed", id: "a", cause: internal },
          { kind: "refused", id: "b", errors: [{ code: "WRITE_RULE_FAILED", message: "", field: null }] },
        ],
        refs,
      ),
    ).toEqual({ kind: "writeRule" });
    expect(sealFaultOfResults([{ kind: "failed", id: "a", cause: new Error("x") }, { kind: "awaitingSeal", id: "b" }], refs)).toEqual({
      kind: "offline",
    });
  });
});

// Seam 355: a refusal the device's own signer made is an answer — not through.
describe("sealFaultOfResults — the device's own refusal", () => {
  it("reads rejectedByDevice as not through, never the no-answer line", () => {
    expect(sealFaultOfResults([{ kind: "rejectedByDevice", id: "a", reason: "bad seal" }], refs)).toEqual({
      kind: "notThrough",
      line: NOT_THROUGH_LINE,
    });
  });
});
