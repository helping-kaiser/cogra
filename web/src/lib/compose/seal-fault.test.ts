import { describe, expect, it } from "vitest";

import { newReferenceDraft } from "@/lib/references/draft";
import { sealFaultOf } from "./seal-fault";

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
    expect(
      sealFaultOf([{ code: "FORBIDDEN", message: "", field: ["references", "0", "target"] }], refs),
    ).toEqual({ kind: "bug" });
    expect(sealFaultOf([], refs)).toEqual({ kind: "bug" });
  });
});
